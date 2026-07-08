package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.utils.SqlValue;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de pca-renovacoes-details.service.ts. Sub-recursos da renovação nas tabelas
 * compartilhadas, sempre filtrando por renovacao_id AND tipo = 'renovacao'. Sem audit log
 * (paridade — o service Node de renovações-details não registra audit).
 */
@Service
@RequiredArgsConstructor
public class PcaRenovacoesDetailsService {

    private final JdbcTemplate jdbc;

    // ---------- DETALHES ----------

    public Map<String, Object> getDetails(long renovacaoId) {
        var rows = jdbc.queryForList(
                "SELECT * FROM pca_item_details WHERE renovacao_id = ? AND tipo = 'renovacao'", renovacaoId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> upsertDetails(long renovacaoId, Map<String, Object> data, Long userId) {
        String tipo = (String) data.get("validacao_dg_tipo");
        if ("Data".equals(tipo) && data.get("validacao_dg_data") == null) {
            throw new ApiException(400, "Data da validação é obrigatória quando tipo é \"Data\"");
        }
        String fase = (String) data.get("fase_atual");
        if (fase != null && fase.length() > 20) {
            throw new ApiException(400, "Fase atual deve ter no máximo 20 caracteres");
        }
        boolean pendente = "Pendente".equals(tipo);

        Map<String, Object> existing = getDetails(renovacaoId);
        if (existing != null) {
            Object dataVal = pendente ? null
                    : (data.containsKey("validacao_dg_data") ? data.get("validacao_dg_data") : existing.get("validacao_dg_data"));
            Object faseVal = data.containsKey("fase_atual") ? data.get("fase_atual") : existing.get("fase_atual");
            return jdbc.queryForMap(
                    "UPDATE pca_item_details SET validacao_dg_tipo = COALESCE(?, validacao_dg_tipo), " +
                            "validacao_dg_data = ?::date, fase_atual = COALESCE(?, fase_atual), updated_by = ?, updated_at = NOW() " +
                            "WHERE renovacao_id = ? AND tipo = 'renovacao' RETURNING *",
                    tipo != null ? tipo : existing.get("validacao_dg_tipo"), dataVal, faseVal, userId, renovacaoId);
        }
        Object dataVal = pendente ? null : data.get("validacao_dg_data");
        return jdbc.queryForMap(
                "INSERT INTO pca_item_details (renovacao_id, tipo, validacao_dg_tipo, validacao_dg_data, fase_atual, updated_by) " +
                        "VALUES (?, 'renovacao', ?, ?::date, ?, ?) RETURNING *",
                renovacaoId, tipo != null ? tipo : "Pendente", dataVal, fase, userId);
    }

    // ---------- CHECKLIST ----------

    public List<Map<String, Object>> getChecklist(long renovacaoId) {
        return jdbc.queryForList(
                "SELECT * FROM pca_checklist_items WHERE renovacao_id = ? AND tipo = 'renovacao' ORDER BY item_ordem",
                renovacaoId);
    }

    public Map<String, Object> updateChecklistStatus(long checklistId, String status, Long userId) {
        var rows = jdbc.queryForList(
                "UPDATE pca_checklist_items SET status = ?, updated_by = ?, updated_at = NOW() " +
                        "WHERE id = ? AND tipo = 'renovacao' RETURNING *", status, userId, checklistId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public int getChecklistProgress(List<Map<String, Object>> checklist) {
        if (checklist.isEmpty()) {
            return 0;
        }
        long completed = checklist.stream().filter(i -> "Concluída".equals(i.get("status"))).count();
        return (int) Math.round((double) completed / checklist.size() * 100);
    }

    // ---------- PONTOS DE CONTROLE ----------

    public List<Map<String, Object>> getPontosControle(long renovacaoId) {
        return jdbc.queryForList(
                "SELECT * FROM pca_pontos_controle WHERE renovacao_id = ? AND tipo = 'renovacao' ORDER BY data DESC",
                renovacaoId);
    }

    public List<Map<String, Object>> getPontosControleComTarefas(long renovacaoId) {
        var pcs = getPontosControle(renovacaoId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> pc : pcs) {
            var tarefas = jdbc.queryForList(
                    "SELECT * FROM pca_tarefas WHERE ponto_controle_id = ? AND renovacao_id = ? AND tipo = 'renovacao' ORDER BY prazo",
                    pc.get("id"), renovacaoId);
            Map<String, Object> m = new LinkedHashMap<>(pc);
            m.put("tarefas", tarefas);
            out.add(m);
        }
        return out;
    }

    public Map<String, Object> createPontoControle(long renovacaoId, Map<String, Object> data, Long userId) {
        return jdbc.queryForMap(
                "INSERT INTO pca_pontos_controle (renovacao_id, tipo, ponto_controle, data, proxima_reuniao, created_by) " +
                        "VALUES (?, 'renovacao', ?, ?::date, ?::date, ?) RETURNING *",
                renovacaoId, data.get("ponto_controle"), data.get("data"), data.get("proxima_reuniao"), userId);
    }

    public Map<String, Object> updatePontoControle(long pcId, Map<String, Object> data, Long userId) {
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("ponto_controle", "data", "proxima_reuniao")) {
            if (data.containsKey(key)) {
                updates.add(key + (isDateCol(key) ? " = ?::date" : " = ?"));
                values.add(data.get(key));
            }
        }
        if (updates.isEmpty()) {
            return null;
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(pcId);
        var rows = jdbc.queryForList(
                "UPDATE pca_pontos_controle SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? AND tipo = 'renovacao' RETURNING *", values.toArray());
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public boolean deletePontoControle(long pcId, boolean deleteTarefas) {
        if (deleteTarefas) {
            jdbc.update("DELETE FROM pca_tarefas WHERE ponto_controle_id = ? AND tipo = 'renovacao'", pcId);
        } else {
            jdbc.update("UPDATE pca_tarefas SET ponto_controle_id = NULL WHERE ponto_controle_id = ? AND tipo = 'renovacao'", pcId);
        }
        var rows = jdbc.queryForList(
                "DELETE FROM pca_pontos_controle WHERE id = ? AND tipo = 'renovacao' RETURNING id", pcId);
        return !rows.isEmpty();
    }

    // ---------- TAREFAS ----------

    public List<Map<String, Object>> getTarefas(long renovacaoId) {
        return jdbc.queryForList(
                "SELECT * FROM pca_tarefas WHERE renovacao_id = ? AND tipo = 'renovacao' ORDER BY prazo", renovacaoId);
    }

    public List<Map<String, Object>> getTarefasOrfas(long renovacaoId) {
        return jdbc.queryForList(
                "SELECT * FROM pca_tarefas WHERE renovacao_id = ? AND ponto_controle_id IS NULL AND tipo = 'renovacao' ORDER BY prazo",
                renovacaoId);
    }

    public Map<String, Object> createTarefa(long renovacaoId, Map<String, Object> data, Long userId) {
        return jdbc.queryForMap(
                "INSERT INTO pca_tarefas (renovacao_id, tipo, ponto_controle_id, tarefa, responsavel, prazo, status, created_by) " +
                        "VALUES (?, 'renovacao', ?, ?, ?, ?::date, ?, ?) RETURNING *",
                renovacaoId, SqlValue.numeroOuNull(data.get("ponto_controle_id")), data.get("tarefa"),
                data.get("responsavel"),
                data.get("prazo"), orDefault((String) data.get("status"), "Não iniciada"), userId);
    }

    public Map<String, Object> updateTarefa(long tarefaId, Map<String, Object> data, Long userId) {
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("tarefa", "responsavel", "prazo", "status", "ponto_controle_id")) {
            if (data.containsKey(key)) {
                updates.add(key + (isDateCol(key) ? " = ?::date" : " = ?"));
                // ponto_controle_id é integer; o front pode mandar como String (ver SqlValue).
                values.add("ponto_controle_id".equals(key)
                        ? SqlValue.numeroOuNull(data.get(key))
                        : data.get(key));
            }
        }
        if (updates.isEmpty()) {
            return null;
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(tarefaId);
        var rows = jdbc.queryForList(
                "UPDATE pca_tarefas SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? AND tipo = 'renovacao' RETURNING *", values.toArray());
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean deleteTarefa(long tarefaId) {
        var rows = jdbc.queryForList("DELETE FROM pca_tarefas WHERE id = ? AND tipo = 'renovacao' RETURNING id", tarefaId);
        return !rows.isEmpty();
    }

    public Map<String, Object> associarTarefaAPontoControle(long tarefaId, Object pontoControleId, Long userId) {
        var rows = jdbc.queryForList(
                "UPDATE pca_tarefas SET ponto_controle_id = ?, updated_by = ?, updated_at = NOW() " +
                        "WHERE id = ? AND tipo = 'renovacao' RETURNING *", pontoControleId, userId, tarefaId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ---------- DADOS COMPLETOS ----------

    public Map<String, Object> getAllData(long renovacaoId) {
        var checklist = getChecklist(renovacaoId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("details", getDetails(renovacaoId));
        out.put("checklist", checklist);
        out.put("checklistProgress", getChecklistProgress(checklist));
        out.put("pontosControle", getPontosControle(renovacaoId));
        out.put("pontosControleComTarefas", getPontosControleComTarefas(renovacaoId));
        out.put("tarefas", getTarefas(renovacaoId));
        out.put("tarefasOrfas", getTarefasOrfas(renovacaoId));
        return out;
    }

    // ---------- SALVAR TODAS AS MUDANÇAS ----------

    @Transactional
    public Map<String, Object> saveAllChanges(long renovacaoId, Map<String, Object> details,
                                              List<Map<String, Object>> checklistUpdates,
                                              List<Map<String, Object>> tarefasUpdates, Long userId) {
        boolean detailsSaved = false;
        int checklistCount = 0;
        int tarefasCount = 0;

        if (details != null) {
            boolean pendente = "Pendente".equals(details.get("validacao_dg_tipo"));
            Map<String, Object> existing = getDetails(renovacaoId);
            if (existing != null) {
                Object dataVal = pendente ? null
                        : (details.containsKey("validacao_dg_data") ? details.get("validacao_dg_data") : existing.get("validacao_dg_data"));
                Object faseVal = details.containsKey("fase_atual") ? details.get("fase_atual") : existing.get("fase_atual");
                jdbc.update(
                        "UPDATE pca_item_details SET validacao_dg_tipo = COALESCE(?, validacao_dg_tipo), " +
                                "validacao_dg_data = ?::date, fase_atual = COALESCE(?, fase_atual), updated_by = ?, updated_at = NOW() " +
                                "WHERE renovacao_id = ? AND tipo = 'renovacao'",
                        details.get("validacao_dg_tipo") != null ? details.get("validacao_dg_tipo") : existing.get("validacao_dg_tipo"),
                        dataVal, faseVal, userId, renovacaoId);
                detailsSaved = true;
            }
        }

        if (checklistUpdates != null) {
            for (Map<String, Object> item : checklistUpdates) {
                jdbc.update("UPDATE pca_checklist_items SET status = ?, updated_by = ?, updated_at = NOW() " +
                        "WHERE id = ? AND tipo = 'renovacao'", item.get("status"), userId, item.get("id"));
                checklistCount++;
            }
        }

        if (tarefasUpdates != null) {
            for (Map<String, Object> item : tarefasUpdates) {
                if (item.containsKey("ponto_controle_id")) {
                    jdbc.update("UPDATE pca_tarefas SET status = ?, ponto_controle_id = ?, updated_by = ?, updated_at = NOW() " +
                            "WHERE id = ? AND tipo = 'renovacao'",
                            item.get("status"), item.get("ponto_controle_id"), userId, item.get("id"));
                } else {
                    jdbc.update("UPDATE pca_tarefas SET status = ?, updated_by = ?, updated_at = NOW() " +
                            "WHERE id = ? AND tipo = 'renovacao'", item.get("status"), userId, item.get("id"));
                }
                tarefasCount++;
            }
        }

        Map<String, Object> savedCount = new LinkedHashMap<>();
        savedCount.put("details", detailsSaved);
        savedCount.put("checklist", checklistCount);
        savedCount.put("tarefas", tarefasCount);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("saved_count", savedCount);
        return out;
    }

    private static String orDefault(String v, String def) {
        return (v == null || v.isEmpty()) ? def : v;
    }

    /** Colunas date (Bug #4): exigem cast explícito ?::date no JDBC. */
    private static boolean isDateCol(String key) {
        return "data".equals(key) || "proxima_reuniao".equals(key) || "prazo".equals(key)
                || "validacao_dg_data".equals(key);
    }
}
