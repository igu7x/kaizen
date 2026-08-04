package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.service.home.Pendencia;
import br.jus.tjgo.kaizen.service.home.PendenciaContext;
import br.jus.tjgo.kaizen.service.home.PendenciaProvider;
import br.jus.tjgo.kaizen.util.Validadores;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api/home/resumo — resumo personalizado de pendências do usuário logado.
 *
 * <p><b>Arquitetura extensível:</b> a HomeService não conhece nenhum domínio específico. Ela apenas
 * resolve o usuário, monta o {@link PendenciaContext} e delega a TODOS os {@link PendenciaProvider}
 * registrados como bean (o Spring injeta a lista automaticamente). Cada provedor é envolto em
 * try/catch — uma falha isolada nunca derruba a Home inteira.</p>
 *
 * <p><b>Como a Home acompanha novas funcionalidades:</b> ao criar uma nova feature com pendências,
 * basta adicionar um novo {@code @Component implements PendenciaProvider}. Ele passa a aparecer na
 * Home automaticamente — sem tocar nesta classe, no controller nem no frontend (que renderiza as
 * pendências genericamente por {@code categoria}).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HomeService {

    private final JdbcTemplate jdbc;
    private final List<PendenciaProvider> providers;

    /** Retorna o payload do resumo; null se o usuário não existe (controller → 404). */
    public Map<String, Object> getResumo(long userId) {
        List<Map<String, Object>> userRows = jdbc.queryForList(
                "SELECT id, name, email, role, diretoria, is_superadmin FROM users WHERE id = ? AND is_deleted = FALSE",
                userId);
        if (userRows.isEmpty()) {
            return null;
        }
        Map<String, Object> user = userRows.get(0);
        String userEmail = (user.get("email") != null ? String.valueOf(user.get("email")) : "").toLowerCase().trim();
        String diretoria = user.get("diretoria") != null ? String.valueOf(user.get("diretoria")) : "";
        boolean isSuperadmin = Boolean.TRUE.equals(user.get("is_superadmin"));

        PendenciaContext ctx = new PendenciaContext(
                userId, userEmail, Validadores.isFinal(userEmail), diretoria, isSuperadmin);

        // Coleta de TODOS os provedores (resiliência: um provedor que falha não derruba os demais).
        List<Pendencia> todas = new ArrayList<>();
        for (PendenciaProvider provider : providers) {
            try {
                List<Pendencia> ps = provider.coletar(ctx);
                if (ps != null) {
                    for (Pendencia p : ps) {
                        if (p != null && p.count() > 0) {
                            todas.add(p);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("[home] provedor {} falhou: {}", provider.nome(), e.getMessage());
            }
        }

        // Ordena por urgência (prioridade asc); estável para itens de mesma prioridade.
        todas.sort(Comparator.comparingInt(Pendencia::prioridade));

        List<Map<String, Object>> pendencias = new ArrayList<>(todas.size());
        for (Pendencia p : todas) {
            pendencias.add(p.toMap());
        }

        Map<String, Object> userOut = new LinkedHashMap<>();
        userOut.put("id", user.get("id"));
        userOut.put("name", user.get("name"));
        userOut.put("email", user.get("email"));
        userOut.put("role", user.get("role"));
        userOut.put("diretoria", user.get("diretoria"));
        userOut.put("is_superadmin", user.get("is_superadmin"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", userOut);
        out.put("pendencias", pendencias);
        out.put("projetos", resumoProjetos(diretoria));
        return out;
    }

    /**
     * Resumo de projetos da diretoria do usuário (contadores do card "Escritório de Projetos").
     *
     * <p>Corrige o bug POST_CUTOVER #1: a versão antiga consultava {@code pca_items.data_fim_prevista}
     * (tabela/coluna inexistentes) e o try/catch engolia o erro, deixando {0,0,0} para todo mundo. A
     * fonte correta é {@code cadastros_projetos}, com {@code data_prevista_conclusao} e os status
     * {@code planejado}/{@code em_execucao}; "em atraso" = prazo de conclusão no passado ainda em aberto.</p>
     */
    private Map<String, Object> resumoProjetos(String diretoria) {
        Map<String, Object> projetos = new LinkedHashMap<>();
        projetos.put("total", 0);
        projetos.put("no_prazo", 0);
        projetos.put("em_atraso", 0);
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT " +
                            "  COUNT(*) FILTER (WHERE status IN ('planejado','em_execucao'))::int AS total, " +
                            "  COUNT(*) FILTER (WHERE status IN ('planejado','em_execucao') " +
                            "    AND (data_prevista_conclusao IS NULL OR data_prevista_conclusao >= CURRENT_DATE))::int AS no_prazo, " +
                            "  COUNT(*) FILTER (WHERE status IN ('planejado','em_execucao') " +
                            "    AND data_prevista_conclusao IS NOT NULL AND data_prevista_conclusao < CURRENT_DATE)::int AS em_atraso " +
                            "FROM cadastros_projetos WHERE ativo = TRUE AND diretoria = ?",
                    diretoria);
            if (!rows.isEmpty()) {
                Map<String, Object> r = rows.get(0);
                projetos.put("total", r.get("total") != null ? r.get("total") : 0);
                projetos.put("no_prazo", r.get("no_prazo") != null ? r.get("no_prazo") : 0);
                projetos.put("em_atraso", r.get("em_atraso") != null ? r.get("em_atraso") : 0);
            }
        } catch (Exception e) {
            log.warn("[home] resumo projetos: {}", e.getMessage());
        }
        return projetos;
    }
}
