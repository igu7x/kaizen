package br.jus.tjgo.kaizen.service.notificacao;

import br.jus.tjgo.kaizen.util.Validadores;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static br.jus.tjgo.kaizen.service.home.PendenciaLinks.build;
import static br.jus.tjgo.kaizen.service.home.PendenciaLinks.params;

/**
 * Notificações da Matriz de Competências do Gestor. Cada transição (validado pelo autor → diretoria,
 * validado pela diretoria → final, recusa → autor) avisa quem deve agir em seguida. Recebe a linha
 * completa do formulário (id/user_id/tipo/diretoria + timestamps). Nunca lança para o chamador.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CompetenciasMatrizNotificacoes {

    private static final String LINK = "/pessoas/competencias";
    private final JdbcTemplate jdbc;
    private final Notificador notificador;

    /** Validado pelo autor (ou auto-validado) → avisa o Revisor da diretoria (gestor da área). */
    public void aoValidarAutor(Map<String, Object> f) {
        try {
            Long gestor = gestorDaDiretoria(str(f.get("diretoria")));
            if (gestor != null) {
                notificador.notificar(gestor, "matriz_diretoria", idDe(f),
                        f.get("validado_por_autor_em"),
                        "Matriz de competências aguardando sua validação (diretoria)",
                        "Uma matriz de competências foi validada pelo autor e aguarda sua validação como diretoria.",
                        link(f));
            }
        } catch (Exception e) {
            log.warn("[notif-matriz] validar-autor: {}", e.getMessage());
        }
    }

    /** Validado pela diretoria → avisa os validadores finais (whitelist). */
    public void aoValidarDiretoria(Map<String, Object> f) {
        try {
            for (Long uid : validadoresFinais()) {
                notificador.notificar(uid, "matriz_final", idDe(f),
                        f.get("validado_por_diretoria_em"),
                        "Matriz de competências aguardando validação final",
                        "Uma matriz de competências passou pela diretoria e aguarda a validação final.",
                        link(f));
            }
        } catch (Exception e) {
            log.warn("[notif-matriz] validar-diretoria: {}", e.getMessage());
        }
    }

    /** Validação final concluída → avisa o autor que a matriz foi aprovada (confirmação). */
    public void aoValidarFinal(Map<String, Object> f) {
        try {
            Long autor = asLong(f.get("user_id"));
            if (autor != null) {
                notificador.notificar(autor, "matriz_aprovada", idDe(f), f.get("validado_final_em"),
                        "Matriz de competências aprovada",
                        "Sua matriz de competências foi validada em todas as camadas e está aprovada.",
                        link(f));
            }
        } catch (Exception e) {
            log.warn("[notif-matriz] validar-final: {}", e.getMessage());
        }
    }

    /** Recusada (diretoria ou final) → devolve ao autor para ajuste. */
    public void aoRecusar(Map<String, Object> f) {
        try {
            Long autor = asLong(f.get("user_id"));
            if (autor != null) {
                String motivo = str(f.get("recusado_comentario"));
                String porque = (motivo != null && !motivo.isBlank()) ? " Motivo: " + motivo : "";
                notificador.notificar(autor, "matriz_recusada", idDe(f), f.get("recusado_em"),
                        "Matriz de competências recusada — ajuste e reenvie",
                        "Sua matriz de competências foi recusada e voltou para ajuste." + porque,
                        link(f));
            }
        } catch (Exception e) {
            log.warn("[notif-matriz] recusar: {}", e.getMessage());
        }
    }

    // ── helpers ──

    private String link(Map<String, Object> f) {
        return build(LINK, params("matrizId", idDe(f), "tipo", f.get("tipo")));
    }

    private Long gestorDaDiretoria(String diretoria) {
        if (diretoria == null || diretoria.isBlank()) {
            return null;
        }
        List<Long> rows = jdbc.queryForList(
                "SELECT gestor_user_id FROM cadastros_areas " +
                        "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE " +
                        "  AND gestor_user_id IS NOT NULL LIMIT 1",
                Long.class, diretoria);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Long> validadoresFinais() {
        List<String> finais = Validadores.FINAIS;
        if (finais.isEmpty()) {
            return List.of();
        }
        String in = String.join(",", finais.stream().map(x -> "?").toList());
        Object[] p = finais.stream().map(e -> e.toLowerCase().trim()).toArray();
        return jdbc.queryForList(
                "SELECT id FROM users WHERE is_deleted = FALSE AND LOWER(TRIM(email)) IN (" + in + ")",
                Long.class, p);
    }

    private static long idDe(Map<String, Object> f) {
        return ((Number) f.get("id")).longValue();
    }

    private static Long asLong(Object o) {
        return o == null ? null : ((Number) o).longValue();
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
