package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.util.Validadores;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de home.ts (toda a lógica vive na rota no Node — não há service separado).
 * GET /api/home/resumo: resumo personalizado de pendências do usuário logado.
 * Cada bloco de pendência é envolto em try/catch silencioso (paridade fiel — falha de uma
 * query não derruba as outras). Numeração não-sequencial dos blocos (1, 4-5, 7-15) preservada
 * nos comentários pra facilitar diff lado-a-lado com o Node.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HomeService {

    private final JdbcTemplate jdbc;

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
        boolean isValidadorFinal = Validadores.isFinal(userEmail);

        List<Map<String, Object>> pendencias = new ArrayList<>();

        // ── 1) Matrizes de Competências pendentes (validação em 3 camadas) ──
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
                pendencias.add(pend("matriz_autor",
                        n == 1 ? "1 matriz de competências aguardando sua validação (autor)"
                                : n + " matrizes de competências aguardando sua validação (autor)",
                        n, buildLink("/pessoas/competencias", linkParams("matrizId", first.get("id"), "tipo", first.get("tipo"))),
                        "amber"));
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
                pendencias.add(pend("matriz_recusada",
                        n == 1 ? "1 matriz de competências foi recusada — ajuste e valide novamente"
                                : n + " matrizes de competências foram recusadas — ajuste e valide novamente",
                        n, buildLink("/pessoas/competencias", linkParams("matrizId", first.get("id"), "tipo", first.get("tipo"))),
                        "orange"));
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
                pendencias.add(pend("matriz_diretoria",
                        n == 1 ? "1 matriz aguardando sua validação (diretoria)"
                                : n + " matrizes aguardando sua validação (diretoria)",
                        n, buildLink("/pessoas/competencias", linkParams("matrizId", first.get("id"), "tipo", first.get("tipo"))),
                        "orange"));
            }

            // Camada final
            if (isValidadorFinal) {
                List<Map<String, Object>> finalPending = jdbc.queryForList(
                        "SELECT id, tipo FROM competencias_gestor_formularios " +
                                "WHERE is_deleted = FALSE AND status = 'validado_diretoria' " +
                                "ORDER BY created_at ASC");
                if (!finalPending.isEmpty()) {
                    Map<String, Object> first = finalPending.get(0);
                    int n = finalPending.size();
                    pendencias.add(pend("matriz_final",
                            n == 1 ? "1 matriz aguardando validação final"
                                    : n + " matrizes aguardando validação final",
                            n, buildLink("/pessoas/competencias", linkParams("matrizId", first.get("id"), "tipo", first.get("tipo"))),
                            "emerald"));
                }
            }
        } catch (Exception ignored) {
        }

        // ── 4) Avaliação integrada aguardando validação do colaborador (é o user) ──
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
                Map<String, Object> first = rows.get(0);
                int n = rows.size();
                pendencias.add(pend("integrada_colaborador",
                        n == 1 ? "1 avaliação integrada aguardando sua validação"
                                : n + " avaliações integradas aguardando sua validação",
                        n, buildLink("/pessoas/competencias", linkParams("integradaId", first.get("id"), "tipo", first.get("tipo"))),
                        "emerald"));
            }
        } catch (Exception ignored) {
        }

        // ── 5) Avaliação integrada aguardando validação do gestor (user é o avaliador) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, COALESCE(tipo_inventario, 'equipe') AS tipo " +
                            "FROM avaliacao_integrada_formularios " +
                            "WHERE is_deleted = FALSE AND avaliador_user_id = ? " +
                            "  AND status = 'enviado' AND validado_gestor_em IS NULL " +
                            "ORDER BY created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                Map<String, Object> first = rows.get(0);
                int n = rows.size();
                pendencias.add(pend("integrada_gestor",
                        n == 1 ? "1 avaliação integrada aguardando sua validação"
                                : n + " avaliações integradas aguardando sua validação",
                        n, buildLink("/pessoas/competencias", linkParams("integradaId", first.get("id"), "tipo", first.get("tipo"))),
                        "emerald"));
            }
        } catch (Exception ignored) {
        }

        // ── 7) TAP — Camada 1 (Gestor) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM contratos_projetos p " +
                            "JOIN cadastros_pessoas ges ON ges.id = p.gestor_id " +
                            "WHERE p.ativo = TRUE AND p.tap_id IS NOT NULL AND p.tap_validado_gestor_em IS NULL AND ges.user_id = ? " +
                            "ORDER BY p.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                pendencias.add(pend("tap_gestor",
                        n == 1 ? "1 TAP aguardando sua validação (gestor)" : n + " TAPs aguardando sua validação (gestor)",
                        n, buildLink("/gestao-estrategica/execucao", linkParams("projetoId", rows.get(0).get("id"), "openTap", "true")),
                        "blue"));
            }
        } catch (Exception ignored) {
        }

        // ── 8) TAP — Camada 2 (Diretor) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM contratos_projetos p " +
                            "JOIN cadastros_areas ca ON LOWER(TRIM(ca.sigla)) = LOWER(TRIM(p.diretoria)) " +
                            "WHERE p.ativo = TRUE AND p.tap_id IS NOT NULL AND p.tap_validado_gestor_em IS NOT NULL " +
                            "  AND p.tap_validado_diretor_em IS NULL AND ca.gestor_user_id = ? " +
                            "ORDER BY p.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                pendencias.add(pend("tap_diretor",
                        n == 1 ? "1 TAP aguardando sua validação (diretor)" : n + " TAPs aguardando sua validação (diretor)",
                        n, buildLink("/gestao-estrategica/execucao", linkParams("projetoId", rows.get(0).get("id"), "openTap", "true")),
                        "blue"));
            }
        } catch (Exception ignored) {
        }

        // ── 9) TAP — Camada 3 (Patrocinador) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM contratos_projetos p " +
                            "JOIN cadastros_pessoas pat ON pat.id = p.patrocinador_id " +
                            "WHERE p.ativo = TRUE AND p.tap_id IS NOT NULL AND p.tap_validado_diretor_em IS NOT NULL " +
                            "  AND p.tap_validado_patrocinador_em IS NULL AND pat.user_id = ? " +
                            "ORDER BY p.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                pendencias.add(pend("tap_patrocinador",
                        n == 1 ? "1 TAP aguardando sua validação (patrocinador)" : n + " TAPs aguardando sua validação (patrocinador)",
                        n, buildLink("/gestao-estrategica/execucao", linkParams("projetoId", rows.get(0).get("id"), "openTap", "true")),
                        "blue"));
            }
        } catch (Exception ignored) {
        }

        // ── 10) TEP — Camada 1 (Gestor) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM tep_termos_encerramento t " +
                            "JOIN contratos_projetos p ON p.id = t.projeto_id " +
                            "JOIN cadastros_pessoas ges ON ges.id = p.gestor_id " +
                            "WHERE p.ativo = TRUE AND t.tep_validado_gestor_em IS NULL AND ges.user_id = ? " +
                            "ORDER BY t.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                pendencias.add(pend("tep_gestor",
                        n == 1 ? "1 TEP aguardando sua validação (gestor)" : n + " TEPs aguardando sua validação (gestor)",
                        n, buildLink("/gestao-estrategica/execucao", linkParams("projetoId", rows.get(0).get("id"), "openTep", "true")),
                        "orange"));
            }
        } catch (Exception ignored) {
        }

        // ── 11) TEP — Camada 2 (Diretor) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM tep_termos_encerramento t " +
                            "JOIN contratos_projetos p ON p.id = t.projeto_id " +
                            "JOIN cadastros_areas ca ON LOWER(TRIM(ca.sigla)) = LOWER(TRIM(p.diretoria)) " +
                            "WHERE p.ativo = TRUE AND t.tep_validado_gestor_em IS NOT NULL AND t.tep_validado_diretor_em IS NULL " +
                            "  AND ca.gestor_user_id = ? " +
                            "ORDER BY t.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                pendencias.add(pend("tep_diretor",
                        n == 1 ? "1 TEP aguardando sua validação (diretor)" : n + " TEPs aguardando sua validação (diretor)",
                        n, buildLink("/gestao-estrategica/execucao", linkParams("projetoId", rows.get(0).get("id"), "openTep", "true")),
                        "orange"));
            }
        } catch (Exception ignored) {
        }

        // ── 12) TEP — Camada 3 (Patrocinador) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT p.id FROM tep_termos_encerramento t " +
                            "JOIN contratos_projetos p ON p.id = t.projeto_id " +
                            "JOIN cadastros_pessoas pat ON pat.id = p.patrocinador_id " +
                            "WHERE p.ativo = TRUE AND t.tep_validado_diretor_em IS NOT NULL AND t.tep_validado_patrocinador_em IS NULL " +
                            "  AND pat.user_id = ? " +
                            "ORDER BY t.created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                pendencias.add(pend("tep_patrocinador",
                        n == 1 ? "1 TEP aguardando sua validação (patrocinador)" : n + " TEPs aguardando sua validação (patrocinador)",
                        n, buildLink("/gestao-estrategica/execucao", linkParams("projetoId", rows.get(0).get("id"), "openTep", "true")),
                        "orange"));
            }
        } catch (Exception ignored) {
        }

        // ── 13) Autoavaliações próprias enviadas mas ainda não validadas pelo próprio user ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id FROM autoavaliacao_formularios " +
                            "WHERE is_deleted = FALSE AND user_id = ? AND status = 'enviado' AND validado_em IS NULL " +
                            "ORDER BY created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                pendencias.add(pend("autoavaliacao_validar",
                        n == 1 ? "1 autoavaliação aguardando sua validação" : n + " autoavaliações aguardando sua validação",
                        n, buildLink("/pessoas/competencias", linkParams("autoavaliacaoId", rows.get(0).get("id"))),
                        "amber"));
            }
        } catch (Exception ignored) {
        }

        // ── 14) Avaliações do gestor enviadas mas ainda não validadas pelo próprio user (avaliador) ──
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id FROM avaliacao_gestor_formularios " +
                            "WHERE is_deleted = FALSE AND avaliador_user_id = ? AND status = 'enviado' AND validado_em IS NULL " +
                            "ORDER BY created_at ASC",
                    userId);
            if (!rows.isEmpty()) {
                int n = rows.size();
                pendencias.add(pend("avaliacao_gestor_validar",
                        n == 1 ? "1 avaliação do gestor aguardando sua validação" : n + " avaliações do gestor aguardando sua validação",
                        n, buildLink("/pessoas/competencias", linkParams("avgestorId", rows.get(0).get("id"))),
                        "amber"));
            }
        } catch (Exception ignored) {
        }

        // ── 15) Resumo de projetos (para qualquer usuário com acesso) ──
        // BUG LATENTE (POST_CUTOVER_BUGS.md #1): a query referencia `data_fim_prevista`, coluna que
        // NÃO existe em pca_items → Postgres erra → o try/catch engole → projetos fica sempre {0,0,0}.
        // Replicado fielmente (bug do Node = bug do Java; NÃO corrigir).
        Map<String, Object> projetos = new LinkedHashMap<>();
        projetos.put("total", 0);
        projetos.put("no_prazo", 0);
        projetos.put("em_atraso", 0);
        try {
            String userDominio = user.get("diretoria") != null ? String.valueOf(user.get("diretoria")) : "";
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT " +
                            "  COUNT(*) FILTER (WHERE status IN ('em_andamento', 'em_planejamento'))::int AS total, " +
                            "  COUNT(*) FILTER (WHERE status = 'em_andamento' AND data_fim_prevista IS NOT NULL AND data_fim_prevista < NOW() AND data_fim_real IS NULL)::int AS em_atraso, " +
                            "  COUNT(*) FILTER (WHERE status IN ('em_andamento', 'em_planejamento') AND (data_fim_prevista IS NULL OR data_fim_prevista >= NOW()))::int AS no_prazo " +
                            "FROM pca_items WHERE diretoria = ?",
                    userDominio);
            if (!rows.isEmpty()) {
                Map<String, Object> r = rows.get(0);
                projetos.put("total", r.get("total") != null ? r.get("total") : 0);
                projetos.put("no_prazo", r.get("no_prazo") != null ? r.get("no_prazo") : 0);
                projetos.put("em_atraso", r.get("em_atraso") != null ? r.get("em_atraso") : 0);
            }
        } catch (Exception ignored) {
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
        out.put("projetos", projetos);
        return out;
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static Map<String, Object> pend(String tipo, String label, int count, String link, String color) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tipo", tipo);
        m.put("label", label);
        m.put("count", count);
        m.put("link", link);
        m.put("color", color);
        return m;
    }

    /** Monta um LinkedHashMap preservando a ordem de inserção (paridade com a ordem do URLSearchParams). */
    private static LinkedHashMap<String, Object> linkParams(Object... kv) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }

    /** Espelha buildLink do Node: ignora null/undefined/'' e preserva a ordem dos params. */
    private static String buildLink(String base, LinkedHashMap<String, Object> params) {
        StringBuilder qs = new StringBuilder();
        for (Map.Entry<String, Object> e : params.entrySet()) {
            Object v = e.getValue();
            if (v == null) {
                continue;
            }
            String s = String.valueOf(v);
            if (s.isEmpty()) {
                continue;
            }
            if (qs.length() > 0) {
                qs.append("&");
            }
            qs.append(enc(e.getKey())).append("=").append(enc(s));
        }
        return qs.length() > 0 ? base + "?" + qs : base;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
