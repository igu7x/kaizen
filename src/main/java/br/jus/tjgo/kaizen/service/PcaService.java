package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de pca.service.ts (tabela pca_items). Ordenação por número extraído do item_pca.
 * PCA items NÃO seedam checklist (só renovações seedam) — replicado fielmente.
 */
@Service
@RequiredArgsConstructor
public class PcaService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final DomainService domainService;

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

    private static final String ORDER_BY_NUMERO =
            " ORDER BY CAST(NULLIF(regexp_replace(p.item_pca, '[^0-9]', '', 'g'), '') AS INTEGER) NULLS LAST, p.item_pca";

    public List<Map<String, Object>> findAll(Integer ano, String diretoria) {
        StringBuilder sql = new StringBuilder(
                "SELECT p.*, ca.nome as area_demandante_nome, cp.nome as responsavel_nome " +
                        "FROM pca_items p " +
                        "LEFT JOIN cadastros_areas ca ON ca.id = p.area_demandante_id " +
                        "LEFT JOIN cadastros_pessoas cp ON cp.id = p.responsavel_id " +
                        "WHERE p.is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND p.ano = ?");
            params.add(ano);
        }
        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            sql.append(" AND p.area_demandante = ANY(?::text[])");
            params.add(textArray(domain.diretoriasInDomain()));
        }
        sql.append(ORDER_BY_NUMERO);
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    public Map<String, Object> findById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM pca_items WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findByItemPca(String itemPca) {
        var rows = jdbc.queryForList("SELECT * FROM pca_items WHERE item_pca = ? AND is_deleted = FALSE", itemPca);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private boolean existsByItemPca(String itemPca, Long excludeId) {
        if (excludeId != null) {
            Integer c = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM pca_items WHERE item_pca = ? AND is_deleted = FALSE AND id != ?",
                    Integer.class, itemPca, excludeId);
            return c != null && c > 0;
        }
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pca_items WHERE item_pca = ? AND is_deleted = FALSE", Integer.class, itemPca);
        return c != null && c > 0;
    }

    public Map<String, Object> create(Map<String, Object> data, Long userId) {
        String itemPca = (String) data.get("item_pca");
        if (existsByItemPca(itemPca, null)) {
            throw new ApiException(409, "Item PCA \"" + itemPca + "\" já existe");
        }
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO pca_items (item_pca, tipo, area_demandante, area_demandante_id, responsavel, " +
                        "responsavel_id, objeto, valor_estimado, valor_formalizado, data_estimada_contratacao, status, ano, created_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                itemPca,
                orDefault((String) data.get("tipo"), "Contratação"),
                data.get("area_demandante"),
                data.get("area_demandante_id"),
                data.get("responsavel"),
                data.get("responsavel_id"),
                data.get("objeto"),
                data.get("valor_estimado"),
                data.get("valor_formalizado"),
                data.get("data_estimada_contratacao"),
                orDefault((String) data.get("status"), "Não Iniciada"),
                data.get("ano") != null ? data.get("ano") : LocalDate.now().getYear(),
                userId);
        audit.log("pca_items", asLong(created.get("id")), "INSERT", userId, null, null, created);
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
        for (String key : List.of("item_pca", "tipo", "area_demandante", "area_demandante_id", "responsavel",
                "responsavel_id", "objeto", "valor_estimado", "valor_formalizado", "data_estimada_contratacao",
                "status", "ano")) {
            if (data.containsKey(key)) {
                updates.add(key + " = ?");
                values.add(data.get(key));
            }
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord; // só updated_by, nada para atualizar
        }
        var rows = jdbc.queryForList(
                "UPDATE pca_items SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = rows.get(0);
        audit.log("pca_items", id, "UPDATE", userId, null, oldRecord, updated);
        return updated;
    }

    public Map<String, Object> updateStatus(long id, String status, Long userId) {
        Map<String, Object> oldRecord = findById(id);
        if (oldRecord == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE pca_items SET status = ?, updated_by = ?, updated_at = NOW() " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *", status, userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = rows.get(0);
        audit.log("pca_items", id, "UPDATE", userId, List.of("status"), oldRecord, updated);
        return updated;
    }

    public boolean softDelete(long id, Long userId) {
        Map<String, Object> existing = findById(id);
        if (existing == null) {
            return false;
        }
        var rows = jdbc.queryForList(
                "UPDATE pca_items SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING id", userId, id);
        if (rows.isEmpty()) {
            return false;
        }
        audit.log("pca_items", id, "SOFT_DELETE", userId, null, existing, null);
        return true;
    }

    public Map<String, Object> getStats(Integer ano, String diretoria) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*) as total, COALESCE(SUM(valor_estimado), 0) as valor_total, " +
                        "COUNT(CASE WHEN status = 'Concluída' THEN 1 END) as concluidos, " +
                        "COUNT(CASE WHEN status = 'Em andamento' THEN 1 END) as em_andamento, " +
                        "COUNT(CASE WHEN status = 'Não Iniciada' THEN 1 END) as nao_iniciados " +
                        "FROM pca_items p WHERE p.is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND p.ano = ?");
            params.add(ano);
        }
        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            sql.append(" AND p.area_demandante = ANY(?::text[])");
            params.add(textArray(domain.diretoriasInDomain()));
        }
        Map<String, Object> row = jdbc.queryForMap(sql.toString(), params.toArray());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", toInt(row.get("total")));
        out.put("valorTotal", toDouble(row.get("valor_total")));
        out.put("concluidos", toInt(row.get("concluidos")));
        out.put("emAndamento", toInt(row.get("em_andamento")));
        out.put("naoIniciados", toInt(row.get("nao_iniciados")));
        return out;
    }

    public List<String> getAreasDemandantes() {
        return jdbc.queryForList(
                "SELECT DISTINCT area_demandante FROM pca_items WHERE is_deleted = FALSE ORDER BY area_demandante",
                String.class);
    }

    public List<String> getResponsaveis() {
        return jdbc.queryForList(
                "SELECT DISTINCT responsavel FROM pca_items WHERE is_deleted = FALSE ORDER BY responsavel",
                String.class);
    }

    public List<String> getMeses() {
        List<String> meses = jdbc.queryForList(
                "SELECT DISTINCT data_estimada_contratacao FROM pca_items WHERE is_deleted = FALSE", String.class);
        meses.sort((a, b) -> MONTH_ORDER.getOrDefault(a, 13) - MONTH_ORDER.getOrDefault(b, 13));
        return meses;
    }

    // ---------- helpers ----------

    private static String textArray(List<String> dirs) {
        return "{" + String.join(",", dirs) + "}";
    }

    private static String orDefault(String v, String def) {
        return (v == null || v.isEmpty()) ? def : v;
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
