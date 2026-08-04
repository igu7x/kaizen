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
 * Pendências do TAP (Termo de Abertura de Projeto) — validação em 3 camadas (Gestor → Diretor →
 * Patrocinador) e a devolução ao Gestor quando o TAP é recusado.
 *
 * <p>Correção vs. HomeService antiga: a camada Gestor agora resolve o gestor por
 * {@code users.id = p.gestor_id} (FK criada na migration 186), não mais por {@code cadastros_pessoas}
 * — o join antigo estava defasado e a pendência do Gestor nunca aparecia.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TapPendenciaProvider implements PendenciaProvider {

    private static final String LINK_BASE = "/gestao-estrategica/execucao";
    private final JdbcTemplate jdbc;

    @Override
    public List<Pendencia> coletar(PendenciaContext ctx) {
        List<Pendencia> out = new ArrayList<>();
        long userId = ctx.userId();

        // ── TAP recusado — devolvido ao Gestor para correção (handoff de volta) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM cadastros_projetos p " +
                            "JOIN users ges ON ges.id = p.gestor_id " +
                            "WHERE p.ativo = TRUE AND p.tap_id IS NOT NULL " +
                            "  AND p.tap_recusado_em IS NOT NULL AND ges.id = ? " +
                            "ORDER BY p.tap_recusado_em ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("tap_recusado",
                        lbl(n, "1 TAP foi recusado — ajuste e valide novamente (gestor)",
                                " TAPs foram recusados — ajuste e valide novamente (gestor)"),
                        n, linkTap(rows.get(0)), "orange",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_DEVOLVIDO));
            }
        } catch (Exception e) {
            log.warn("[home] tap recusado: {}", e.getMessage());
        }

        // ── TAP camada 1 (Gestor) — não recusados (recusados vão para tap_recusado acima) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM cadastros_projetos p " +
                            "JOIN users ges ON ges.id = p.gestor_id " +
                            "WHERE p.ativo = TRUE AND p.tap_id IS NOT NULL AND p.tap_validado_gestor_em IS NULL " +
                            "  AND p.tap_recusado_em IS NULL AND ges.id = ? " +
                            "ORDER BY p.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("tap_gestor",
                        lbl(n, "1 TAP aguardando sua validação (gestor)",
                                " TAPs aguardando sua validação (gestor)"),
                        n, linkTap(rows.get(0)), "blue",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] tap gestor: {}", e.getMessage());
        }

        // ── TAP camada 2 (Diretor) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM cadastros_projetos p " +
                            "JOIN cadastros_areas ca ON LOWER(TRIM(ca.sigla)) = LOWER(TRIM(p.diretoria)) " +
                            "WHERE p.ativo = TRUE AND p.tap_id IS NOT NULL AND p.tap_validado_gestor_em IS NOT NULL " +
                            "  AND p.tap_validado_diretor_em IS NULL AND ca.gestor_user_id = ? " +
                            "ORDER BY p.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("tap_diretor",
                        lbl(n, "1 TAP aguardando sua validação (diretor)",
                                " TAPs aguardando sua validação (diretor)"),
                        n, linkTap(rows.get(0)), "blue",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] tap diretor: {}", e.getMessage());
        }

        // ── TAP camada 3 (Patrocinador) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM cadastros_projetos p " +
                            "JOIN users pat ON pat.id = p.patrocinador_id " +
                            "WHERE p.ativo = TRUE AND p.tap_id IS NOT NULL AND p.tap_validado_diretor_em IS NOT NULL " +
                            "  AND p.tap_validado_patrocinador_em IS NULL AND pat.id = ? " +
                            "ORDER BY p.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("tap_patrocinador",
                        lbl(n, "1 TAP aguardando sua validação (patrocinador)",
                                " TAPs aguardando sua validação (patrocinador)"),
                        n, linkTap(rows.get(0)), "blue",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] tap patrocinador: {}", e.getMessage());
        }

        return out;
    }

    private String linkTap(Map<String, Object> row) {
        return build(LINK_BASE, params("projetoId", row.get("id"), "openTap", "true"));
    }

    private static String lbl(int n, String singular, String pluralSuffix) {
        return n == 1 ? singular : n + pluralSuffix;
    }
}
