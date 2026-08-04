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
 * Pendências do TEP (Termo de Encerramento de Projeto) — validação em 3 camadas (Gestor → Diretor →
 * Patrocinador) e a devolução ao Gestor quando o TEP é recusado.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TepPendenciaProvider implements PendenciaProvider {

    private static final String LINK_BASE = "/gestao-estrategica/execucao";
    private final JdbcTemplate jdbc;

    @Override
    public List<Pendencia> coletar(PendenciaContext ctx) {
        List<Pendencia> out = new ArrayList<>();
        long userId = ctx.userId();

        // ── TEP recusado — devolvido ao Gestor para correção ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM tep_termos_encerramento t " +
                            "JOIN cadastros_projetos p ON p.id = t.projeto_id " +
                            "JOIN users ges ON ges.id = p.gestor_id " +
                            "WHERE p.ativo = TRUE AND t.tep_recusado_em IS NOT NULL AND ges.id = ? " +
                            "ORDER BY t.tep_recusado_em ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("tep_recusado",
                        lbl(n, "1 TEP foi recusado — ajuste e valide novamente (gestor)",
                                " TEPs foram recusados — ajuste e valide novamente (gestor)"),
                        n, linkTep(rows.get(0)), "orange",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_DEVOLVIDO));
            }
        } catch (Exception e) {
            log.warn("[home] tep recusado: {}", e.getMessage());
        }

        // ── TEP camada 1 (Gestor) — não recusados ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM tep_termos_encerramento t " +
                            "JOIN cadastros_projetos p ON p.id = t.projeto_id " +
                            "JOIN users ges ON ges.id = p.gestor_id " +
                            "WHERE p.ativo = TRUE AND t.tep_validado_gestor_em IS NULL " +
                            "  AND t.tep_recusado_em IS NULL AND ges.id = ? " +
                            "ORDER BY t.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("tep_gestor",
                        lbl(n, "1 TEP aguardando sua validação (gestor)",
                                " TEPs aguardando sua validação (gestor)"),
                        n, linkTep(rows.get(0)), "orange",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] tep gestor: {}", e.getMessage());
        }

        // ── TEP camada 2 (Diretor) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM tep_termos_encerramento t " +
                            "JOIN cadastros_projetos p ON p.id = t.projeto_id " +
                            "JOIN cadastros_areas ca ON LOWER(TRIM(ca.sigla)) = LOWER(TRIM(p.diretoria)) " +
                            "WHERE p.ativo = TRUE AND t.tep_validado_gestor_em IS NOT NULL AND t.tep_validado_diretor_em IS NULL " +
                            "  AND ca.gestor_user_id = ? " +
                            "ORDER BY t.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("tep_diretor",
                        lbl(n, "1 TEP aguardando sua validação (diretor)",
                                " TEPs aguardando sua validação (diretor)"),
                        n, linkTep(rows.get(0)), "orange",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] tep diretor: {}", e.getMessage());
        }

        // ── TEP camada 3 (Patrocinador) ──
        // patrocinador_id é FK para users(id) (migration 186), igual ao TAP patrocinador — o join
        // antigo por cadastros_pessoas/user_id estava defasado e a pendência não aparecia.
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM tep_termos_encerramento t " +
                            "JOIN cadastros_projetos p ON p.id = t.projeto_id " +
                            "JOIN users pat ON pat.id = p.patrocinador_id " +
                            "WHERE p.ativo = TRUE AND t.tep_validado_diretor_em IS NOT NULL AND t.tep_validado_patrocinador_em IS NULL " +
                            "  AND pat.id = ? " +
                            "ORDER BY t.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("tep_patrocinador",
                        lbl(n, "1 TEP aguardando sua validação (patrocinador)",
                                " TEPs aguardando sua validação (patrocinador)"),
                        n, linkTep(rows.get(0)), "orange",
                        Pendencia.CAT_PROJETOS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] tep patrocinador: {}", e.getMessage());
        }

        return out;
    }

    private String linkTep(Map<String, Object> row) {
        return build(LINK_BASE, params("projetoId", row.get("id"), "openTep", "true"));
    }

    private static String lbl(int n, String singular, String pluralSuffix) {
        return n == 1 ? singular : n + pluralSuffix;
    }
}
