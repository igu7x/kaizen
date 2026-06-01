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
 * Porte fiel de pca-renovacoes.service.ts (tabela pca_renovacoes).
 * create seeda pca_item_details (tipo='renovacao') + 6 itens de checklist em transação —
 * inconsistência proposital: PCA items NÃO seedam, só renovações.
 */
@Service
@RequiredArgsConstructor
public class PcaRenovacoesService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    private static final Map<String, Integer> MONTH_ORDER = new LinkedHashMap<>();

    static {
        MONTH_ORDER.put("Janeiro", 1);
        MONTH_ORDER.put("Fevereiro", 2);
        MONTH_ORDER.put("Março", 3);
        MONTH_ORDER.put("Abril", 4);
        MONTH_ORDER.put("Maio", 5);
        MONTH_ORDER.put("Junho", 6);
        MONTH_ORDER.put("Julho", 7);
        MONTH_ORDER.put("Agosto", 8);
        MONTH_ORDER.put("Setembro", 9);
        MONTH_ORDER.put("Outubro", 10);
        MONTH_ORDER.put("Novembro", 11);
        MONTH_ORDER.put("Dezembro", 12);
    }

    private static final String ORDER_BY_MES = " ORDER BY CASE data_estimada_contratacao " +
            "WHEN 'Janeiro' THEN 1 WHEN 'Fevereiro' THEN 2 WHEN 'Março' THEN 3 WHEN 'Abril' THEN 4 " +
            "WHEN 'Maio' THEN 5 WHEN 'Junho' THEN 6 WHEN 'Julho' THEN 7 WHEN 'Agosto' THEN 8 " +
            "WHEN 'Setembro' THEN 9 WHEN 'Outubro' THEN 10 WHEN 'Novembro' THEN 11 WHEN 'Dezembro' THEN 12 " +
            "ELSE 13 END, item_pca";

    private static final String[][] CHECKLIST_SEED = {
            {"DOD", "1"}, {"ETP", "2"}, {"TR", "3"}, {"MGR", "4"},
            {"Análise de mercado", "5"}, {"Distribuição orçamentária", "6"}
    };

    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("SELECT * FROM pca_renovacoes WHERE is_deleted = FALSE" + ORDER_BY_MES);
    }

    public Map<String, Object> findById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM pca_renovacoes WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private boolean existsByItemPca(String itemPca, Long excludeId) {
        if (excludeId != null) {
            Integer c = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM pca_renovacoes WHERE item_pca = ? AND is_deleted = FALSE AND id != ?",
                    Integer.class, itemPca, excludeId);
            return c != null && c > 0;
        }
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pca_renovacoes WHERE item_pca = ? AND is_deleted = FALSE", Integer.class, itemPca);
        return c != null && c > 0;
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> data, Long userId) {
        String itemPca = (String) data.get("item_pca");
        if (existsByItemPca(itemPca, null)) {
            throw new ApiException(409, "Item PCA \"" + itemPca + "\" já existe nas renovações");
        }
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO pca_renovacoes (item_pca, area_demandante, gestor_demandante, contratada, objeto, " +
                        "valor_anual, data_estimada_contratacao, status, created_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                itemPca, data.get("area_demandante"), data.get("gestor_demandante"), data.get("contratada"),
                data.get("objeto"), data.get("valor_anual"), data.get("data_estimada_contratacao"),
                orDefault((String) data.get("status"), "Não Iniciada"), userId);
        long renovacaoId = ((Number) created.get("id")).longValue();

        jdbc.update("INSERT INTO pca_item_details (renovacao_id, tipo, validacao_dg_tipo, fase_atual) " +
                "VALUES (?, 'renovacao', 'Pendente', NULL)", renovacaoId);

        for (String[] item : CHECKLIST_SEED) {
            jdbc.update("INSERT INTO pca_checklist_items (renovacao_id, tipo, item_nome, item_ordem, status) " +
                    "VALUES (?, 'renovacao', ?, ?, 'Não Iniciada')", renovacaoId, item[0], Integer.parseInt(item[1]));
        }

        audit.log("pca_renovacoes", renovacaoId, "INSERT", userId, null, null, created);
        return created;
    }

    public Map<String, Object> update(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> oldRecord = findById(id);
        if (oldRecord == null) {
            return null;
        }
        String newItemPca = (String) data.get("item_pca");
        if (newItemPca != null && !newItemPca.equals(oldRecord.get("item_pca"))) {
            if (existsByItemPca(newItemPca, id)) {
                throw new ApiException(409, "Item PCA \"" + newItemPca + "\" já existe");
            }
        }
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("item_pca", "area_demandante", "gestor_demandante", "contratada", "objeto",
                "valor_anual", "data_estimada_contratacao", "status")) {
            if (data.containsKey(key)) {
                updates.add(key + " = ?");
                values.add(data.get(key));
            }
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord;
        }
        var rows = jdbc.queryForList(
                "UPDATE pca_renovacoes SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = rows.get(0);
        audit.log("pca_renovacoes", id, "UPDATE", userId, null, oldRecord, updated);
        return updated;
    }

    public Map<String, Object> updateStatus(long id, String status, Long userId) {
        Map<String, Object> oldRecord = findById(id);
        if (oldRecord == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE pca_renovacoes SET status = ?, updated_by = ?, updated_at = NOW() " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *", status, userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = rows.get(0);
        audit.log("pca_renovacoes", id, "UPDATE", userId, List.of("status"), oldRecord, updated);
        return updated;
    }

    public boolean softDelete(long id, Long userId) {
        Map<String, Object> existing = findById(id);
        if (existing == null) {
            return false;
        }
        var rows = jdbc.queryForList(
                "UPDATE pca_renovacoes SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING id", userId, id);
        if (rows.isEmpty()) {
            return false;
        }
        audit.log("pca_renovacoes", id, "SOFT_DELETE", userId, null, existing, null);
        return true;
    }

    public Map<String, Object> getStats() {
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT COUNT(*) as total, COALESCE(SUM(valor_anual), 0) as valor_total, " +
                        "COUNT(CASE WHEN status = 'Concluída' THEN 1 END) as concluidos, " +
                        "COUNT(CASE WHEN status = 'Em andamento' THEN 1 END) as em_andamento, " +
                        "COUNT(CASE WHEN status = 'Não Iniciada' THEN 1 END) as nao_iniciados " +
                        "FROM pca_renovacoes WHERE is_deleted = FALSE");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", toInt(row.get("total")));
        out.put("valorTotal", toDouble(row.get("valor_total")));
        out.put("concluidos", toInt(row.get("concluidos")));
        out.put("emAndamento", toInt(row.get("em_andamento")));
        out.put("naoIniciados", toInt(row.get("nao_iniciados")));
        return out;
    }

    public Map<String, Object> getResumo() {
        Map<String, Object> porStatus = new LinkedHashMap<>();
        porStatus.put("Não Iniciada", 0);
        porStatus.put("Em andamento", 0);
        porStatus.put("Concluída", 0);
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT status, COUNT(*) as count FROM pca_renovacoes WHERE is_deleted = FALSE GROUP BY status")) {
            porStatus.put((String) r.get("status"), toInt(r.get("count")));
        }

        Map<String, Object> porArea = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT area_demandante, COUNT(*) as quantidade, SUM(valor_anual) as valor FROM pca_renovacoes " +
                        "WHERE is_deleted = FALSE GROUP BY area_demandante ORDER BY valor DESC")) {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("quantidade", toInt(r.get("quantidade")));
            a.put("valor", toDouble(r.get("valor")));
            porArea.put((String) r.get("area_demandante"), a);
        }

        Map<String, Object> porMes = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT data_estimada_contratacao, COUNT(*) as count FROM pca_renovacoes " +
                        "WHERE is_deleted = FALSE GROUP BY data_estimada_contratacao")) {
            porMes.put((String) r.get("data_estimada_contratacao"), toInt(r.get("count")));
        }

        Map<String, Object> totalRow = jdbc.queryForMap(
                "SELECT COUNT(*) as total, COALESCE(SUM(valor_anual), 0) as valor_total FROM pca_renovacoes WHERE is_deleted = FALSE");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", toInt(totalRow.get("total")));
        out.put("valor_total", toDouble(totalRow.get("valor_total")));
        out.put("por_status", porStatus);
        out.put("por_area", porArea);
        out.put("por_mes", porMes);
        return out;
    }

    public Map<String, Object> getFilters() {
        List<String> areas = jdbc.queryForList(
                "SELECT DISTINCT area_demandante FROM pca_renovacoes WHERE is_deleted = FALSE ORDER BY area_demandante",
                String.class);
        List<String> gestores = jdbc.queryForList(
                "SELECT DISTINCT gestor_demandante FROM pca_renovacoes WHERE is_deleted = FALSE ORDER BY gestor_demandante",
                String.class);
        List<String> meses = jdbc.queryForList(
                "SELECT DISTINCT data_estimada_contratacao FROM pca_renovacoes WHERE is_deleted = FALSE", String.class);
        meses.sort((a, b) -> MONTH_ORDER.getOrDefault(a, 13) - MONTH_ORDER.getOrDefault(b, 13));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("areasDemandantes", areas);
        out.put("gestores", gestores);
        out.put("meses", meses);
        return out;
    }

    private static String orDefault(String v, String def) {
        return (v == null || v.isEmpty()) ? def : v;
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

    private static double toDouble(Object v) {
        if (v == null) {
            return 0;
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        return Double.parseDouble(v.toString());
    }
}
