package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de tep.service.ts — Termo de Encerramento do Projeto.
 * Validação em 3 camadas (gestor → diretor → patrocinador) identity-based.
 * Throws de regra de negócio viram ApiException(400) (rotas validar/recusar/revogar → 400);
 * upsert/delete são chamados de rotas cujo catch é 500 (tratado no controller).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TepService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public Map<String, Object> findByProjetoId(long projetoId) {
        var rows = jdbc.queryForList(
                "SELECT * FROM tep_termos_encerramento WHERE projeto_id = ? LIMIT 1", projetoId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Cria/atualiza o TEP e ajusta o status do projeto (concluido/cancelado).
     * Pré-condição: TAP vigente. Throws viram 500 no controller (paridade rota POST tep).
     */
    public Map<String, Object> upsert(long projetoId, String tipoEncerramento, String motivoCancelamento,
                                      String consideracoesGerente, String consideracoesPatrocinador,
                                      Long userId, String userName) {
        String motivoFinal = "cancelado".equals(tipoEncerramento)
                ? blankToNull(motivoCancelamento)
                : "Não se aplica";

        var tapCheck = jdbc.queryForList(
                "SELECT tap_validado_patrocinador_em FROM cadastros_projetos WHERE id = ? AND ativo = TRUE",
                projetoId);
        if (tapCheck.isEmpty()) {
            throw new RuntimeException("Projeto não encontrado");
        }
        if (tapCheck.get(0).get("tap_validado_patrocinador_em") == null) {
            throw new RuntimeException("Não é possível gerar o TEP enquanto o TAP do projeto não estiver vigente. " +
                    "Conclua o ciclo de validação do TAP primeiro.");
        }

        // Só na CRIAÇÃO do TEP: todas as entregas ativas precisam estar concluídas.
        // Um TEP já existente segue editável/validável mesmo que alguma entrega mude de status.
        boolean tepJaExiste = !jdbc.queryForList(
                "SELECT 1 FROM tep_termos_encerramento WHERE projeto_id = ? LIMIT 1", projetoId).isEmpty();
        if (!tepJaExiste) {
            Integer entregasPendentes = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM cadastros_projetos_entregas " +
                            "WHERE projeto_id = ? AND ativo = TRUE AND status <> 'concluida'",
                    Integer.class, projetoId);
            if (entregasPendentes != null && entregasPendentes > 0) {
                throw new RuntimeException("Não é possível finalizar o projeto: há " + entregasPendentes +
                        " entrega(s) não concluída(s). Conclua todas as entregas antes de gerar o TEP.");
            }
        }

        Map<String, Object> tep = jdbc.queryForMap(
                "INSERT INTO tep_termos_encerramento " +
                        "(projeto_id, tipo_encerramento, motivo_cancelamento, consideracoes_gerente, " +
                        "consideracoes_patrocinador, finalizado_por, finalizado_por_nome, finalizado_em, tep_versao, updated_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 1, NOW()) " +
                        "ON CONFLICT (projeto_id) DO UPDATE SET " +
                        "tipo_encerramento = EXCLUDED.tipo_encerramento, " +
                        "motivo_cancelamento = EXCLUDED.motivo_cancelamento, " +
                        "consideracoes_gerente = EXCLUDED.consideracoes_gerente, " +
                        "consideracoes_patrocinador = EXCLUDED.consideracoes_patrocinador, " +
                        "finalizado_por = EXCLUDED.finalizado_por, " +
                        "finalizado_por_nome = EXCLUDED.finalizado_por_nome, " +
                        "finalizado_em = NOW(), " +
                        "tep_versao = CASE WHEN tep_termos_encerramento.tep_validado_patrocinador_em IS NOT NULL " +
                        "  THEN COALESCE(tep_termos_encerramento.tep_versao, 1) + 1 " +
                        "  ELSE COALESCE(tep_termos_encerramento.tep_versao, 1) END, " +
                        "tep_validado_gestor_em = NULL, tep_validado_gestor_por = NULL, " +
                        "tep_validado_diretor_em = NULL, tep_validado_diretor_por = NULL, " +
                        "tep_validado_patrocinador_em = NULL, tep_validado_patrocinador_por = NULL, " +
                        "tep_gerado_em = NULL, " +
                        "tep_recusado_em = NULL, tep_recusado_por = NULL, " +
                        "tep_recusado_por_nome = NULL, tep_recusado_comentario = NULL, " +
                        "tep_recusado_camada = NULL, " +
                        "updated_at = NOW() " +
                        "RETURNING *",
                projetoId, tipoEncerramento, motivoFinal,
                blankToNull(consideracoesGerente), blankToNull(consideracoesPatrocinador),
                userId, userName);

        jdbc.update("UPDATE cadastros_projetos SET status = ?, updated_at = NOW() WHERE id = ?",
                tipoEncerramento, projetoId);

        return tep;
    }

    public void delete(long projetoId) {
        jdbc.update("DELETE FROM tep_termos_encerramento WHERE projeto_id = ?", projetoId);
        jdbc.update("UPDATE cadastros_projetos SET status = 'em_execucao', updated_at = NOW() WHERE id = ?", projetoId);
    }

    public Map<String, Object> validarCamada(long projetoId, int camada, Long userId) {
        var tepRows = jdbc.queryForList("SELECT * FROM tep_termos_encerramento WHERE projeto_id = ?", projetoId);
        if (tepRows.isEmpty()) {
            throw new ApiException(400, "TEP não encontrado para este projeto");
        }
        Map<String, Object> tep = tepRows.get(0);

        Map<String, Object> projeto = findProjetoComResponsaveis(projetoId);
        if (projeto == null) {
            throw new ApiException(400, "Projeto não encontrado");
        }

        if (camada == 1) {
            if (!eq(projeto.get("gestor_user_id"), userId)) {
                throw new ApiException(400, "Apenas o gestor do projeto pode validar a camada 1");
            }
        } else if (camada == 2) {
            if (tep.get("tep_validado_gestor_em") == null) {
                throw new ApiException(400, "A camada 1 (Gestor) precisa ser validada primeiro");
            }
            if (!eq(projeto.get("diretor_user_id"), userId)) {
                throw new ApiException(400, "Apenas o diretor da área pode validar a camada 2");
            }
        } else if (camada == 3) {
            if (tep.get("tep_validado_diretor_em") == null) {
                throw new ApiException(400, "A camada 2 (Diretor) precisa ser validada primeiro");
            }
            if (!eq(projeto.get("patrocinador_user_id"), userId)) {
                throw new ApiException(400, "Apenas o patrocinador do projeto pode validar a camada 3");
            }
        } else {
            throw new ApiException(400, "Camada inválida (deve ser 1, 2 ou 3)");
        }

        String colEm = camada == 1 ? "tep_validado_gestor_em" : camada == 2 ? "tep_validado_diretor_em" : "tep_validado_patrocinador_em";
        String colPor = camada == 1 ? "tep_validado_gestor_por" : camada == 2 ? "tep_validado_diretor_por" : "tep_validado_patrocinador_por";

        if (camada == 1) {
            jdbc.update(
                    "UPDATE tep_termos_encerramento SET " + colEm + " = NOW(), " + colPor + " = ?, " +
                            "tep_recusado_em = NULL, tep_recusado_por = NULL, " +
                            "tep_recusado_por_nome = NULL, tep_recusado_comentario = NULL, " +
                            "tep_recusado_camada = NULL, updated_at = NOW() WHERE projeto_id = ?",
                    userId, projetoId);
        } else {
            jdbc.update(
                    "UPDATE tep_termos_encerramento SET " + colEm + " = NOW(), " + colPor + " = ?, updated_at = NOW() " +
                            "WHERE projeto_id = ?",
                    userId, projetoId);
        }

        if (camada == 3) {
            jdbc.update(
                    "UPDATE tep_termos_encerramento SET tep_gerado_em = NOW(), " +
                            "tep_versao = COALESCE(tep_versao, 1), updated_at = NOW() WHERE projeto_id = ?",
                    projetoId);
            gravarSnapshot(projetoId, userId);
        }

        return Map.of("success", true, "camada", camada, "projetoId", projetoId);
    }

    private void gravarSnapshot(long projetoId, Long userId) {
        try {
            var tepFinal = jdbc.queryForList("SELECT * FROM tep_termos_encerramento WHERE projeto_id = ?", projetoId);
            var projetoFinal = jdbc.queryForList("SELECT * FROM vw_cadastros_projetos_completo WHERE id = ?", projetoId);
            var entregasFinal = jdbc.queryForList(
                    "SELECT e.*, u.nome AS area_responsavel_nome FROM cadastros_projetos_entregas e " +
                            "LEFT JOIN cadastros_unidades u ON u.id = e.area_responsavel_id " +
                            "WHERE e.projeto_id = ? AND e.ativo = TRUE ORDER BY e.ordem, e.id", projetoId);
            if (!tepFinal.isEmpty() && !projetoFinal.isEmpty()) {
                Map<String, Object> tep = tepFinal.get(0);
                int versao = tep.get("tep_versao") != null ? ((Number) tep.get("tep_versao")).intValue() : 1;
                String userName = lookupUserName(userId);
                Map<String, Object> dados = new LinkedHashMap<>();
                dados.put("tep", tep);
                dados.put("projeto", projetoFinal.get(0));
                dados.put("entregas", entregasFinal);
                jdbc.update(
                        "INSERT INTO tep_versoes (projeto_id, versao, dados, validado_em, validado_por, validado_por_nome) " +
                                "VALUES (?, ?, ?::jsonb, NOW(), ?, ?) " +
                                "ON CONFLICT (projeto_id, versao) DO UPDATE SET dados = EXCLUDED.dados, " +
                                "validado_em = EXCLUDED.validado_em, validado_por = EXCLUDED.validado_por, " +
                                "validado_por_nome = EXCLUDED.validado_por_nome",
                        projetoId, versao, objectMapper.writeValueAsString(dados), userId, userName);
            }
        } catch (Exception e) {
            log.error("[validarCamada TEP] Erro ao gravar snapshot da versão: {}", e.getMessage());
        }
    }

    public List<Map<String, Object>> findVersoes(long projetoId) {
        return jdbc.queryForList(
                "SELECT id, projeto_id, versao, validado_em, validado_por, validado_por_nome, created_at " +
                        "FROM tep_versoes WHERE projeto_id = ? ORDER BY versao DESC", projetoId);
    }

    public Object findVersaoDados(long projetoId, int versao) {
        var rows = jdbc.queryForList(
                "SELECT dados FROM tep_versoes WHERE projeto_id = ? AND versao = ?", projetoId, versao);
        return rows.isEmpty() ? null : rows.get(0).get("dados");
    }

    public Map<String, Object> recusarCamada(long projetoId, int camada, Long userId, String comentario) {
        if (camada != 2 && camada != 3) {
            throw new ApiException(400, "Apenas as camadas 2 (Diretor) e 3 (Patrocinador) podem recusar");
        }
        var tepRows = jdbc.queryForList("SELECT * FROM tep_termos_encerramento WHERE projeto_id = ?", projetoId);
        if (tepRows.isEmpty()) {
            throw new ApiException(400, "TEP não encontrado para este projeto");
        }
        Map<String, Object> tep = tepRows.get(0);
        Map<String, Object> projeto = findProjetoComResponsaveis(projetoId);
        if (projeto == null) {
            throw new ApiException(400, "Projeto não encontrado");
        }

        if (camada == 2) {
            if (tep.get("tep_validado_gestor_em") == null) {
                throw new ApiException(400, "A camada 1 (Gestor) precisa ter sido validada antes de recusar nesta etapa");
            }
            if (!eq(projeto.get("diretor_user_id"), userId)) {
                throw new ApiException(400, "Apenas o diretor da área pode recusar nesta etapa");
            }
        } else {
            if (tep.get("tep_validado_diretor_em") == null) {
                throw new ApiException(400, "A camada 2 (Diretor) precisa ter sido validada antes de recusar nesta etapa");
            }
            if (!eq(projeto.get("patrocinador_user_id"), userId)) {
                throw new ApiException(400, "Apenas o patrocinador pode recusar nesta etapa");
            }
        }

        String userName = lookupUserName(userId);
        String camadaLabel = camada == 2 ? "diretor" : "patrocinador";

        jdbc.update(
                "UPDATE tep_termos_encerramento SET " +
                        "tep_validado_gestor_em = NULL, tep_validado_gestor_por = NULL, " +
                        "tep_validado_diretor_em = NULL, tep_validado_diretor_por = NULL, " +
                        "tep_validado_patrocinador_em = NULL, tep_validado_patrocinador_por = NULL, " +
                        "tep_recusado_em = NOW(), tep_recusado_por = ?, tep_recusado_por_nome = ?, " +
                        "tep_recusado_comentario = ?, tep_recusado_camada = ?, updated_at = NOW() " +
                        "WHERE projeto_id = ?",
                userId, userName, comentario, camadaLabel, projetoId);

        return Map.of("success", true, "camada", camada, "projetoId", projetoId);
    }

    public Map<String, Object> revogarValidacao(long projetoId, int camada) {
        List<String> updates = new java.util.ArrayList<>();
        if (camada <= 1) {
            updates.add("tep_validado_gestor_em = NULL");
            updates.add("tep_validado_gestor_por = NULL");
        }
        if (camada <= 2) {
            updates.add("tep_validado_diretor_em = NULL");
            updates.add("tep_validado_diretor_por = NULL");
        }
        if (camada <= 3) {
            updates.add("tep_validado_patrocinador_em = NULL");
            updates.add("tep_validado_patrocinador_por = NULL");
            updates.add("tep_gerado_em = NULL");
        }
        jdbc.update("UPDATE tep_termos_encerramento SET " + String.join(", ", updates) +
                ", updated_at = NOW() WHERE projeto_id = ?", projetoId);
        return Map.of("success", true, "camada", camada, "projetoId", projetoId);
    }

    // ---------- helpers ----------

    private Map<String, Object> findProjetoComResponsaveis(long projetoId) {
        // Camada 2 = diretor da diretoria indicada na Governança do projeto (1ª de
        // areas_vinculadas_ids). Fallback para p.diretoria quando não há diretoria vinculada.
        var rows = jdbc.queryForList(
                "SELECT p.*, ges.user_id AS gestor_user_id, pat.user_id AS patrocinador_user_id, " +
                        "area.gestor_user_id AS diretor_user_id, area.sigla AS diretor_diretoria_sigla " +
                        "FROM cadastros_projetos p " +
                        "LEFT JOIN cadastros_pessoas ges ON ges.id = p.gestor_id " +
                        "LEFT JOIN cadastros_pessoas pat ON pat.id = p.patrocinador_id " +
                        "LEFT JOIN cadastros_areas area ON area.ativo = TRUE AND (" +
                        "  (array_length(p.areas_vinculadas_ids, 1) >= 1 AND area.id = p.areas_vinculadas_ids[1]) " +
                        "  OR ((p.areas_vinculadas_ids IS NULL OR array_length(p.areas_vinculadas_ids, 1) IS NULL) " +
                        "      AND area.sigla = p.diretoria)" +
                        ") " +
                        "WHERE p.id = ? AND p.ativo = TRUE", projetoId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String lookupUserName(Long userId) {
        if (userId == null) {
            return null;
        }
        var rows = jdbc.queryForList("SELECT name FROM users WHERE id = ?", userId);
        return rows.isEmpty() ? null : (String) rows.get(0).get("name");
    }

    /** Number(col) === userId (paridade com comparação estrita do Node). */
    private static boolean eq(Object col, Long userId) {
        if (col == null || userId == null) {
            return false;
        }
        return ((Number) col).longValue() == userId.longValue();
    }

    private static String blankToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
