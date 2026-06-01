package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de pca-details.service.ts (sub-recursos do PCA item).
 * Filtra por pca_item_id; INSERTs não setam tipo (default 'nova'). Pontos de controle e tarefas
 * são hard-DELETE. saveAllChanges é transacional.
 */
@Service
@RequiredArgsConstructor
public class PcaDetailsService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    private static final List<String> STATUS_CHECKLIST = List.of("Concluída", "Em andamento", "Não Iniciada");
    private static final List<String> STATUS_TAREFA = List.of("Não iniciada", "Em andamento", "Concluída");

    // ---------- DETALHES ----------

    public Map<String, Object> getDetails(long pcaItemId) {
        var rows = jdbc.queryForList("SELECT * FROM pca_item_details WHERE pca_item_id = ?", pcaItemId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> upsertDetails(long pcaItemId, Map<String, Object> data, Long userId) {
        String tipo = (String) data.get("validacao_dg_tipo");
        Object validacaoData = data.get("validacao_dg_data");
        String faseAtual = (String) data.get("fase_atual");

        if ("Data".equals(tipo) && (validacaoData == null || String.valueOf(validacaoData).isEmpty())) {
            throw new ApiException(400, "Data da validação é obrigatória quando tipo é \"Data\"");
        }
        if (faseAtual != null && faseAtual.length() > 20) {
            throw new ApiException(400, "Fase atual deve ter no máximo 20 caracteres");
        }
        if ("Pendente".equals(tipo)) {
            validacaoData = null;
        }

        Map<String, Object> existing = getDetails(pcaItemId);
        if (existing != null) {
            return jdbc.queryForMap(
                    "UPDATE pca_item_details SET validacao_dg_tipo = COALESCE(?, validacao_dg_tipo), " +
                            "validacao_dg_data = ?::date, fase_atual = COALESCE(?, fase_atual), updated_by = ?, updated_at = NOW() " +
                            "WHERE pca_item_id = ? RETURNING *",
                    tipo, validacaoData, faseAtual, userId, pcaItemId);
        }
        return jdbc.queryForMap(
                "INSERT INTO pca_item_details (pca_item_id, validacao_dg_tipo, validacao_dg_data, fase_atual, updated_by) " +
                        "VALUES (?, ?, ?::date, ?, ?) RETURNING *",
                pcaItemId, tipo != null ? tipo : "Pendente", validacaoData, faseAtual, userId);
    }

    // ---------- CHECKLIST ----------

    public List<Map<String, Object>> getChecklist(long pcaItemId) {
        return jdbc.queryForList(
                "SELECT * FROM pca_checklist_items WHERE pca_item_id = ? ORDER BY item_ordem", pcaItemId);
    }

    public Map<String, Object> getChecklistProgress(long pcaItemId) {
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'Concluída' THEN 1 END) as concluidos " +
                        "FROM pca_checklist_items WHERE pca_item_id = ?", pcaItemId);
        int total = toInt(row.get("total"));
        int concluidos = toInt(row.get("concluidos"));
        int percentual = total > 0 ? (int) Math.round((double) concluidos / total * 100) : 0;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("concluidos", concluidos);
        out.put("percentual", percentual);
        return out;
    }

    public Map<String, Object> updateChecklistItemStatus(long checklistId, String status, Long userId) {
        if (!STATUS_CHECKLIST.contains(status)) {
            throw new ApiException(400, "Status inválido");
        }
        var rows = jdbc.queryForList(
                "UPDATE pca_checklist_items SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ? RETURNING *",
                status, userId, checklistId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ---------- PONTOS DE CONTROLE ----------

    public List<Map<String, Object>> getPontosControle(long pcaItemId) {
        return jdbc.queryForList(
                "SELECT * FROM pca_pontos_controle WHERE pca_item_id = ? ORDER BY ponto_controle", pcaItemId);
    }

    public Map<String, Object> getPontoControleById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM pca_pontos_controle WHERE id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createPontoControle(long pcaItemId, Map<String, Object> data, Long userId) {
        if (isBlank(data.get("ponto_controle"))) {
            throw new ApiException(400, "Ponto de controle é obrigatório");
        }
        if (data.get("data") == null) {
            throw new ApiException(400, "Data é obrigatória");
        }
        if (data.get("proxima_reuniao") == null) {
            throw new ApiException(400, "Próxima reunião é obrigatória");
        }
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO pca_pontos_controle (pca_item_id, ponto_controle, data, proxima_reuniao, created_by, updated_by) " +
                        "VALUES (?, ?, ?::date, ?::date, ?, ?) RETURNING *",
                pcaItemId, data.get("ponto_controle"), data.get("data"), data.get("proxima_reuniao"), userId, userId);
        audit.log("pca_pontos_controle", asLong(created.get("id")), "INSERT", userId, null, null, created);
        return created;
    }

    public Map<String, Object> updatePontoControle(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> existing = getPontoControleById(id);
        if (existing == null) {
            return null;
        }
        Map<String, Object> updated = jdbc.queryForMap(
                "UPDATE pca_pontos_controle SET ponto_controle = COALESCE(?, ponto_controle), " +
                        "data = COALESCE(?::date, data), proxima_reuniao = COALESCE(?::date, proxima_reuniao), " +
                        "updated_by = ?, updated_at = NOW() WHERE id = ? RETURNING *",
                data.get("ponto_controle"), data.get("data"), data.get("proxima_reuniao"), userId, id);
        audit.log("pca_pontos_controle", id, "UPDATE", userId, null, existing, updated);
        return updated;
    }

    public Map<String, Object> deletePontoControle(long id, Long userId, boolean deleteTarefas) {
        Map<String, Object> existing = getPontoControleById(id);
        if (existing == null) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("success", false);
            r.put("tarefasAfetadas", 0);
            return r;
        }
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM pca_tarefas WHERE ponto_controle_id = ?", Integer.class, id);
        int tarefasAfetadas = count == null ? 0 : count;
        if (deleteTarefas && tarefasAfetadas > 0) {
            jdbc.update("DELETE FROM pca_tarefas WHERE ponto_controle_id = ?", id);
        }
        jdbc.update("DELETE FROM pca_pontos_controle WHERE id = ?", id);
        Map<String, Object> old = new LinkedHashMap<>(existing);
        old.put("tarefas_deletadas", deleteTarefas);
        old.put("tarefas_afetadas", tarefasAfetadas);
        audit.log("pca_pontos_controle", id, "DELETE", userId, null, old, null);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("success", true);
        r.put("tarefasAfetadas", tarefasAfetadas);
        return r;
    }

    public List<Map<String, Object>> getTarefasByPontoControle(long pontoControleId) {
        return jdbc.queryForList("SELECT * FROM pca_tarefas WHERE ponto_controle_id = ? ORDER BY prazo", pontoControleId);
    }

    public List<Map<String, Object>> getTarefasOrfas(long pcaItemId) {
        return jdbc.queryForList(
                "SELECT * FROM pca_tarefas WHERE pca_item_id = ? AND ponto_controle_id IS NULL ORDER BY prazo", pcaItemId);
    }

    public List<Map<String, Object>> getPontosControleComTarefas(long pcaItemId) {
        var pcs = getPontosControle(pcaItemId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> pc : pcs) {
            Map<String, Object> m = new LinkedHashMap<>(pc);
            m.put("tarefas", getTarefasByPontoControle(((Number) pc.get("id")).longValue()));
            out.add(m);
        }
        return out;
    }

    public Map<String, Object> associarTarefaAPontoControle(long tarefaId, Object pontoControleId, Long userId) {
        Map<String, Object> existing = getTarefaById(tarefaId);
        if (existing == null) {
            return null;
        }
        if (pontoControleId != null) {
            Map<String, Object> pc = getPontoControleById(((Number) pontoControleId).longValue());
            if (pc == null || !eqNum(pc.get("pca_item_id"), existing.get("pca_item_id"))) {
                throw new ApiException(400, "Ponto de controle inválido");
            }
        }
        return jdbc.queryForMap(
                "UPDATE pca_tarefas SET ponto_controle_id = ?, updated_by = ?, updated_at = NOW() WHERE id = ? RETURNING *",
                pontoControleId, userId, tarefaId);
    }

    // ---------- TAREFAS ----------

    public List<Map<String, Object>> getTarefas(long pcaItemId) {
        return jdbc.queryForList("SELECT * FROM pca_tarefas WHERE pca_item_id = ? ORDER BY prazo", pcaItemId);
    }

    public Map<String, Object> getTarefaById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM pca_tarefas WHERE id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createTarefa(long pcaItemId, Map<String, Object> data, Long userId) {
        String tarefa = (String) data.get("tarefa");
        String responsavel = (String) data.get("responsavel");
        if (tarefa == null || tarefa.trim().isEmpty()) {
            throw new ApiException(400, "Tarefa é obrigatória");
        }
        if (tarefa.length() > 255) {
            throw new ApiException(400, "Tarefa deve ter no máximo 255 caracteres");
        }
        if (responsavel == null || responsavel.trim().isEmpty()) {
            throw new ApiException(400, "Responsável é obrigatório");
        }
        if (responsavel.length() > 255) {
            throw new ApiException(400, "Responsável deve ter no máximo 255 caracteres");
        }
        if (data.get("prazo") == null) {
            throw new ApiException(400, "Prazo é obrigatório");
        }
        String status = data.get("status") != null ? (String) data.get("status") : "Não iniciada";
        if (!STATUS_TAREFA.contains(status)) {
            throw new ApiException(400, "Status inválido");
        }
        Object pontoControleId = data.get("ponto_controle_id");
        if (pontoControleId != null) {
            Map<String, Object> pc = getPontoControleById(((Number) pontoControleId).longValue());
            if (pc == null || !eqNum(pc.get("pca_item_id"), pcaItemId)) {
                throw new ApiException(400, "Ponto de controle inválido");
            }
        }
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO pca_tarefas (pca_item_id, ponto_controle_id, tarefa, responsavel, prazo, status, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?::date, ?, ?, ?) RETURNING *",
                pcaItemId, pontoControleId, tarefa, responsavel, data.get("prazo"), status, userId, userId);
        audit.log("pca_tarefas", asLong(created.get("id")), "INSERT", userId, null, null, created);
        return created;
    }

    public Map<String, Object> updateTarefa(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> existing = getTarefaById(id);
        if (existing == null) {
            return null;
        }
        String tarefa = (String) data.get("tarefa");
        String responsavel = (String) data.get("responsavel");
        if (data.containsKey("tarefa") && tarefa != null && tarefa.trim().isEmpty()) {
            throw new ApiException(400, "Tarefa não pode ser vazia");
        }
        if (tarefa != null && tarefa.length() > 255) {
            throw new ApiException(400, "Tarefa deve ter no máximo 255 caracteres");
        }
        if (data.containsKey("responsavel") && responsavel != null && responsavel.trim().isEmpty()) {
            throw new ApiException(400, "Responsável não pode ser vazio");
        }
        if (responsavel != null && responsavel.length() > 255) {
            throw new ApiException(400, "Responsável deve ter no máximo 255 caracteres");
        }
        String status = (String) data.get("status");
        if (status != null && !STATUS_TAREFA.contains(status)) {
            throw new ApiException(400, "Status inválido");
        }
        Map<String, Object> updated = jdbc.queryForMap(
                "UPDATE pca_tarefas SET tarefa = COALESCE(?, tarefa), responsavel = COALESCE(?, responsavel), " +
                        "prazo = COALESCE(?::date, prazo), status = COALESCE(?, status), updated_by = ?, updated_at = NOW() " +
                        "WHERE id = ? RETURNING *",
                tarefa, responsavel, data.get("prazo"), status, userId, id);
        audit.log("pca_tarefas", id, "UPDATE", userId, null, existing, updated);
        return updated;
    }

    public Map<String, Object> updateTarefaStatus(long id, String status, Long userId) {
        if (!STATUS_TAREFA.contains(status)) {
            throw new ApiException(400, "Status inválido");
        }
        var rows = jdbc.queryForList(
                "UPDATE pca_tarefas SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ? RETURNING *",
                status, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean deleteTarefa(long id, Long userId) {
        Map<String, Object> existing = getTarefaById(id);
        if (existing == null) {
            return false;
        }
        jdbc.update("DELETE FROM pca_tarefas WHERE id = ?", id);
        audit.log("pca_tarefas", id, "DELETE", userId, null, existing, null);
        return true;
    }

    // ---------- DADOS COMPLETOS ----------

    public Map<String, Object> getAllData(long pcaItemId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("details", getDetails(pcaItemId));
        out.put("checklist", getChecklist(pcaItemId));
        out.put("checklistProgress", getChecklistProgress(pcaItemId));
        out.put("pontosControle", getPontosControle(pcaItemId));
        out.put("pontosControleComTarefas", getPontosControleComTarefas(pcaItemId));
        out.put("tarefas", getTarefas(pcaItemId));
        out.put("tarefasOrfas", getTarefasOrfas(pcaItemId));
        return out;
    }

    // ---------- SALVAMENTO EM LOTE ----------

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> saveAllChanges(long pcaItemId, Map<String, Object> details,
                                              List<Map<String, Object>> checklistUpdates,
                                              List<Map<String, Object>> tarefasUpdates, Long userId) {
        // Validações (fora da transação no Node, mas aqui o @Transactional só commita no fim)
        if (details != null) {
            String tipo = (String) details.get("validacao_dg_tipo");
            if ("Data".equals(tipo) && details.get("validacao_dg_data") == null) {
                throw new ApiException(400, "Data da validação é obrigatória quando tipo é \"Data\"");
            }
            String fase = (String) details.get("fase_atual");
            if (fase != null && fase.length() > 20) {
                throw new ApiException(400, "Fase atual deve ter no máximo 20 caracteres");
            }
        }
        if (checklistUpdates != null) {
            for (Map<String, Object> u : checklistUpdates) {
                if (!STATUS_CHECKLIST.contains(u.get("status"))) {
                    throw new ApiException(400, "Status de checklist inválido: " + u.get("status"));
                }
            }
        }
        if (tarefasUpdates != null) {
            for (Map<String, Object> u : tarefasUpdates) {
                if (!STATUS_TAREFA.contains(u.get("status"))) {
                    throw new ApiException(400, "Status de tarefa inválido: " + u.get("status"));
                }
            }
        }

        int detailsSaved = 0;
        int checklistSaved = 0;
        int tarefasSaved = 0;

        if (details != null && !details.isEmpty()) {
            var existing = jdbc.queryForList("SELECT id FROM pca_item_details WHERE pca_item_id = ?", pcaItemId);
            Object validacaoData = details.get("validacao_dg_data");
            if ("Pendente".equals(details.get("validacao_dg_tipo"))) {
                validacaoData = null;
            }
            if (!existing.isEmpty()) {
                jdbc.update(
                        "UPDATE pca_item_details SET validacao_dg_tipo = COALESCE(?, validacao_dg_tipo), " +
                                "validacao_dg_data = ?::date, fase_atual = COALESCE(?, fase_atual), updated_by = ?, updated_at = NOW() " +
                                "WHERE pca_item_id = ?",
                        details.get("validacao_dg_tipo"), validacaoData, details.get("fase_atual"), userId, pcaItemId);
            } else {
                jdbc.update(
                        "INSERT INTO pca_item_details (pca_item_id, validacao_dg_tipo, validacao_dg_data, fase_atual, updated_by) " +
                                "VALUES (?, ?, ?::date, ?, ?)",
                        pcaItemId, details.get("validacao_dg_tipo") != null ? details.get("validacao_dg_tipo") : "Pendente",
                        validacaoData, details.get("fase_atual"), userId);
            }
            detailsSaved = 1;
        }

        if (checklistUpdates != null) {
            for (Map<String, Object> u : checklistUpdates) {
                jdbc.update("UPDATE pca_checklist_items SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
                        u.get("status"), userId, u.get("id"));
                checklistSaved++;
            }
        }
        if (tarefasUpdates != null) {
            for (Map<String, Object> u : tarefasUpdates) {
                jdbc.update("UPDATE pca_tarefas SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
                        u.get("status"), userId, u.get("id"));
                tarefasSaved++;
            }
        }

        Map<String, Object> savedCount = new LinkedHashMap<>();
        savedCount.put("details", detailsSaved);
        savedCount.put("checklist", checklistSaved);
        savedCount.put("tarefas", tarefasSaved);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("message", "Todas as alterações foram salvas com sucesso");
        out.put("saved_count", savedCount);
        return out;
    }

    // ---------- helpers ----------

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).trim().isEmpty();
    }

    private static boolean eqNum(Object a, Object b) {
        if (a == null || b == null) {
            return false;
        }
        return ((Number) a).longValue() == ((Number) b).longValue();
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    private static int toInt(Object v) {
        if (v == null) {
            return 0;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        return Integer.parseInt(v.toString());
    }
}
