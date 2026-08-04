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
 * Pendências do domínio Pessoas / Gestão por Competências:
 * matrizes (autor/diretoria/final/recusada), avaliações integradas (colaborador/gestor),
 * autoavaliação e avaliação do gestor — validação pendente E "atualização requisitada" (retrabalho
 * devolvido ao dono quando um catálogo/versão avança ou uma camada superior revalida).
 *
 * <p>Blocos herdados da HomeService antiga (1, 4, 5, 13, 14) preservados com labels/links/cores
 * idênticos; adicionados os estados {@code atualizacao_requisitada} (antes invisíveis na Home).</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CompetenciasPendenciaProvider implements PendenciaProvider {

    private static final String LINK_BASE = "/pessoas/competencias";
    private final JdbcTemplate jdbc;

    @Override
    public List<Pendencia> coletar(PendenciaContext ctx) {
        List<Pendencia> out = new ArrayList<>();
        long userId = ctx.userId();

        // ── Matrizes de competências (validação em 3 camadas) ──
        try {
            // Camada autor
            List<Map<String, Object>> autorPending = jdbc.queryForList(
                    "SELECT cgf.id, cgf.tipo FROM competencias_gestor_formularios cgf " +
                            "WHERE cgf.is_deleted = FALSE AND cgf.user_id = ? AND cgf.status = 'enviado' " +
                            "  AND cgf.recusado_em IS NULL " +
                            "  AND (cgf.tipo = 'equipe' OR EXISTS ( " +
                            "    SELECT 1 FROM cadastros_areas ca " +
                            "    WHERE LOWER(TRIM(ca.sigla)) = LOWER(TRIM(cgf.diretoria)) " +
                            "      AND ca.subdiretor_user_id = cgf.user_id " +
                            "  )) " +
                            "ORDER BY cgf.created_at ASC",
                    userId);
            if (!autorPending.isEmpty()) {
                Map<String, Object> first = autorPending.get(0);
                int n = autorPending.size();
                out.add(new Pendencia("matriz_autor",
                        lbl(n, "1 matriz de competências aguardando sua validação (autor)",
                                " matrizes de competências aguardando sua validação (autor)"),
                        n, linkMatriz(first), "amber",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_VALIDACAO));
            }

            // Matrizes RECUSADAS devolvidas ao autor
            List<Map<String, Object>> recusadasPending = jdbc.queryForList(
                    "SELECT cgf.id, cgf.tipo FROM competencias_gestor_formularios cgf " +
                            "WHERE cgf.is_deleted = FALSE AND cgf.user_id = ? AND cgf.status = 'enviado' " +
                            "  AND cgf.recusado_em IS NOT NULL " +
                            "ORDER BY cgf.recusado_em ASC",
                    userId);
            if (!recusadasPending.isEmpty()) {
                Map<String, Object> first = recusadasPending.get(0);
                int n = recusadasPending.size();
                out.add(new Pendencia("matriz_recusada",
                        lbl(n, "1 matriz de competências foi recusada — ajuste e valide novamente",
                                " matrizes de competências foram recusadas — ajuste e valide novamente"),
                        n, linkMatriz(first), "orange",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_DEVOLVIDO));
            }

            // Camada diretoria
            List<Map<String, Object>> diretoriaPending = jdbc.queryForList(
                    "SELECT cgf.id, cgf.tipo FROM competencias_gestor_formularios cgf " +
                            "JOIN cadastros_areas ca ON LOWER(TRIM(ca.sigla)) = LOWER(TRIM(cgf.diretoria)) " +
                            "WHERE cgf.is_deleted = FALSE AND ca.gestor_user_id = ? " +
                            "  AND ( " +
                            "    (cgf.tipo = 'equipe' AND cgf.status = 'validado_autor') " +
                            "    OR (cgf.tipo = 'gestor' AND ( " +
                            "      (cgf.user_id = ca.gestor_user_id AND cgf.status = 'enviado') OR " +
                            "      (cgf.user_id = ca.subdiretor_user_id AND cgf.status = 'validado_autor') " +
                            "    )) " +
                            "  ) " +
                            "ORDER BY cgf.created_at ASC",
                    userId);
            if (!diretoriaPending.isEmpty()) {
                Map<String, Object> first = diretoriaPending.get(0);
                int n = diretoriaPending.size();
                out.add(new Pendencia("matriz_diretoria",
                        lbl(n, "1 matriz aguardando sua validação (diretoria)",
                                " matrizes aguardando sua validação (diretoria)"),
                        n, linkMatriz(first), "orange",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_VALIDACAO));
            }

            // Camada final (whitelist de validação final)
            if (ctx.isValidadorFinal()) {
                List<Map<String, Object>> finalPending = jdbc.queryForList(
                        "SELECT id, tipo FROM competencias_gestor_formularios " +
                                "WHERE is_deleted = FALSE AND status = 'validado_diretoria' " +
                                "ORDER BY created_at ASC");
                if (!finalPending.isEmpty()) {
                    Map<String, Object> first = finalPending.get(0);
                    int n = finalPending.size();
                    out.add(new Pendencia("matriz_final",
                            lbl(n, "1 matriz aguardando validação final",
                                    " matrizes aguardando validação final"),
                            n, linkMatriz(first), "emerald",
                            Pendencia.CAT_PESSOAS, Pendencia.PRIO_VALIDACAO));
                }
            }
        } catch (Exception e) {
            log.warn("[home] matrizes: {}", e.getMessage());
        }

        // ── Avaliação integrada — colaborador (é o user) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT aif.id, COALESCE(aif.tipo_inventario, 'equipe') AS tipo " +
                            "FROM avaliacao_integrada_formularios aif " +
                            "JOIN autoavaliacao_formularios aaf ON aaf.id = aif.autoavaliacao_id " +
                            "WHERE aif.is_deleted = FALSE AND aaf.user_id = ? " +
                            "  AND aif.status = 'validado_gestor' AND aif.validado_colaborador_em IS NULL " +
                            "ORDER BY aif.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("integrada_colaborador",
                        lbl(n, "1 avaliação integrada aguardando sua validação",
                                " avaliações integradas aguardando sua validação"),
                        n, linkIntegrada(rows.get(0)), "emerald",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] integrada colaborador: {}", e.getMessage());
        }

        // ── Avaliação integrada — gestor (user é o avaliador OU o gestor vinculado à avaliação do gestor) ──
        try {
            // Cobre o bloco 5 antigo (avaliador_user_id) E o caso em que o gestor legítimo (o avaliador
            // da avaliação do gestor vinculada) difere de quem criou a integrada — antes esse gestor
            // nunca via a pendência (validarGestor aceita ambos: AvaliacaoIntegradaService).
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT aif.id, COALESCE(aif.tipo_inventario, 'equipe') AS tipo " +
                            "FROM avaliacao_integrada_formularios aif " +
                            "LEFT JOIN avaliacao_gestor_formularios ag ON ag.id = aif.avaliacao_gestor_id " +
                            "WHERE aif.is_deleted = FALSE " +
                            "  AND aif.status = 'enviado' AND aif.validado_gestor_em IS NULL " +
                            "  AND (aif.avaliador_user_id = ? OR ag.avaliador_user_id = ?) " +
                            "ORDER BY aif.created_at ASC",
                    userId, userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("integrada_gestor",
                        lbl(n, "1 avaliação integrada aguardando sua validação",
                                " avaliações integradas aguardando sua validação"),
                        n, linkIntegrada(rows.get(0)), "emerald",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] integrada gestor: {}", e.getMessage());
        }

        // ── Avaliação integrada — atualização requisitada (retrabalho devolvido ao avaliador) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, COALESCE(tipo_inventario, 'equipe') AS tipo " +
                            "FROM avaliacao_integrada_formularios " +
                            "WHERE is_deleted = FALSE AND avaliador_user_id = ? " +
                            "  AND status = 'atualizacao_requisitada' " +
                            "ORDER BY updated_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("integrada_atualizacao",
                        lbl(n, "1 avaliação integrada precisa ser atualizada e reenviada",
                                " avaliações integradas precisam ser atualizadas e reenviadas"),
                        n, linkIntegrada(rows.get(0)), "orange",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_DEVOLVIDO));
            }
        } catch (Exception e) {
            log.warn("[home] integrada atualizacao: {}", e.getMessage());
        }

        // ── Autoavaliação — aguardando validação do próprio user ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id FROM autoavaliacao_formularios " +
                            "WHERE is_deleted = FALSE AND user_id = ? AND status = 'enviado' AND validado_em IS NULL " +
                            "ORDER BY created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("autoavaliacao_validar",
                        lbl(n, "1 autoavaliação aguardando sua validação",
                                " autoavaliações aguardando sua validação"),
                        n, build(LINK_BASE, params("autoavaliacaoId", rows.get(0).get("id"))), "amber",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] autoavaliacao validar: {}", e.getMessage());
        }

        // ── Autoavaliação — atualização requisitada (colaborador precisa refazer) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id FROM autoavaliacao_formularios " +
                            "WHERE is_deleted = FALSE AND user_id = ? AND status = 'atualizacao_requisitada' " +
                            "ORDER BY updated_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("autoavaliacao_atualizacao",
                        lbl(n, "1 autoavaliação precisa ser atualizada e reenviada",
                                " autoavaliações precisam ser atualizadas e reenviadas"),
                        n, build(LINK_BASE, params("autoavaliacaoId", rows.get(0).get("id"))), "orange",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_DEVOLVIDO));
            }
        } catch (Exception e) {
            log.warn("[home] autoavaliacao atualizacao: {}", e.getMessage());
        }

        // ── Avaliação do gestor — aguardando validação do próprio user (avaliador) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id FROM avaliacao_gestor_formularios " +
                            "WHERE is_deleted = FALSE AND avaliador_user_id = ? AND status = 'enviado' AND validado_em IS NULL " +
                            "ORDER BY created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("avaliacao_gestor_validar",
                        lbl(n, "1 avaliação do gestor aguardando sua validação",
                                " avaliações do gestor aguardando sua validação"),
                        n, build(LINK_BASE, params("avgestorId", rows.get(0).get("id"))), "amber",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_VALIDACAO));
            }
        } catch (Exception e) {
            log.warn("[home] avaliacao gestor validar: {}", e.getMessage());
        }

        // ── Avaliação do gestor — atualização requisitada (avaliador precisa refazer) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id FROM avaliacao_gestor_formularios " +
                            "WHERE is_deleted = FALSE AND avaliador_user_id = ? AND status = 'atualizacao_requisitada' " +
                            "ORDER BY updated_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                out.add(new Pendencia("avaliacao_gestor_atualizacao",
                        lbl(n, "1 avaliação do gestor precisa ser atualizada e reenviada",
                                " avaliações do gestor precisam ser atualizadas e reenviadas"),
                        n, build(LINK_BASE, params("avgestorId", rows.get(0).get("id"))), "orange",
                        Pendencia.CAT_PESSOAS, Pendencia.PRIO_DEVOLVIDO));
            }
        } catch (Exception e) {
            log.warn("[home] avaliacao gestor atualizacao: {}", e.getMessage());
        }

        return out;
    }

    private String linkMatriz(Map<String, Object> row) {
        return build(LINK_BASE, params("matrizId", row.get("id"), "tipo", row.get("tipo")));
    }

    private String linkIntegrada(Map<String, Object> row) {
        return build(LINK_BASE, params("integradaId", row.get("id"), "tipo", row.get("tipo")));
    }

    private static String lbl(int n, String singular, String pluralSuffix) {
        return n == 1 ? singular : n + pluralSuffix;
    }
}
