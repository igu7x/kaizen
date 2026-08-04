package br.jus.tjgo.kaizen.service.home.providers;

import br.jus.tjgo.kaizen.service.home.Pendencia;
import br.jus.tjgo.kaizen.service.home.PendenciaContext;
import br.jus.tjgo.kaizen.service.home.PendenciaProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static br.jus.tjgo.kaizen.service.home.PendenciaLinks.build;
import static br.jus.tjgo.kaizen.service.home.PendenciaLinks.params;

/**
 * Pendências de projetos (Escritório de Projetos) atribuíveis diretamente ao usuário como Gestor.
 * Hoje: projetos vencidos (prazo de conclusão estourado) sob gestão do usuário.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProjetosPendenciaProvider implements PendenciaProvider {

    private static final String LINK_BASE = "/gestao-estrategica/execucao";
    private final JdbcTemplate jdbc;

    @Override
    public List<Pendencia> coletar(PendenciaContext ctx) {
        List<Pendencia> out = new ArrayList<>();

        // ── Projeto vencido — prazo de conclusão no passado, ainda em aberto, sob sua gestão ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM cadastros_projetos p " +
                            "JOIN users ges ON ges.id = p.gestor_id " +
                            "WHERE p.ativo = TRUE AND ges.id = ? " +
                            "  AND p.status IN ('planejado','em_execucao') " +
                            "  AND p.data_prevista_conclusao IS NOT NULL " +
                            "  AND p.data_prevista_conclusao < CURRENT_DATE " +
                            "ORDER BY p.data_prevista_conclusao ASC",
                    ctx.userId());
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("projeto_atrasado",
                        n == 1 ? "1 projeto seu está com o prazo vencido"
                                : n + " projetos seus estão com o prazo vencido",
                        n, build(LINK_BASE, params("projetoId", rows.get(0).get("id"))), "red",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_VENCIDO));
            }
        } catch (Exception e) {
            log.warn("[home] projeto atrasado: {}", e.getMessage());
        }

        return out;
    }
}
