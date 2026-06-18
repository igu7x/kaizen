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
            " ORDER BY CAST(NULLIF(regexp_replace(p.code, '[^0-9]', '', 'g'), '') AS INTEGER) NULLS LAST, p.code";

    private static final String MONTH_CASE_SQL = 
            "CASE EXTRACT(MONTH FROM p.estimated_date) WHEN 1 THEN 'Janeiro' WHEN 2 THEN 'Fevereiro' " +
            "WHEN 3 THEN 'Março' WHEN 4 THEN 'Abril' WHEN 5 THEN 'Maio' WHEN 6 THEN 'Junho' " +
            "WHEN 7 THEN 'Julho' WHEN 8 THEN 'Agosto' WHEN 9 THEN 'Setembro' WHEN 10 THEN 'Outubro' " +
            "WHEN 11 THEN 'Novembro' WHEN 12 THEN 'Dezembro' ELSE CAST(p.estimated_date AS TEXT) END";

    private String parseMonthToDateStr(String monthName, Object yearObj) {
        if (monthName == null) return null;
        Integer m = MONTH_ORDER.get(monthName);
        if (m != null) {
            String y = yearObj != null ? String.valueOf(yearObj) : String.valueOf(LocalDate.now().getYear());
            return String.format("%s-%02d-01", y, m);
        }
        return monthName;
    }

    public List<Map<String, Object>> findAll(Integer ano, String diretoria) {
        StringBuilder sql = new StringBuilder(
                "SELECT p.id, p.code as item_pca, CASE WHEN p.contract_type = 'RENOVACAO' THEN 'Renovação' WHEN p.contract_type = 'NOVA_CONTRATACAO' THEN 'Contratação' ELSE 'Contratação' END as tipo, " +
                        "p.directory_acronym as area_demandante, p.object_name as objeto, p.estimated_value_cents / 100.0 as valor_estimado, " +
                        MONTH_CASE_SQL + " as data_estimada_contratacao, " +
                        "CASE p.status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                        "p.priority, p.process, p.description, p.justification, p.financial_resource_type, p.step, " +
                        "CAST(p.year AS INTEGER) as ano, p.is_deleted, p.created_at, p.updated_at " +
                        "FROM pcas p " +
                        "WHERE (p.is_deleted = FALSE OR p.is_deleted IS NULL)");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND p.year = ?");
            params.add(String.valueOf(ano));
        }
        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            sql.append(" AND p.directory_acronym = ANY(?::text[])");
            params.add(textArray(domain.diretoriasInDomain()));
        }
        sql.append(ORDER_BY_NUMERO);
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    public Map<String, Object> findById(long id) {
        var rows = jdbc.queryForList("SELECT p.id, p.code as item_pca, CASE WHEN p.contract_type = 'RENOVACAO' THEN 'Renovação' WHEN p.contract_type = 'NOVA_CONTRATACAO' THEN 'Contratação' ELSE 'Contratação' END as tipo, " +
                "p.directory_acronym as area_demandante, p.object_name as objeto, p.estimated_value_cents / 100.0 as valor_estimado, " +
                MONTH_CASE_SQL + " as data_estimada_contratacao, " +
                "CASE p.status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                "p.priority, p.process, p.description, p.justification, p.financial_resource_type, p.step, " +
                "CAST(p.year AS INTEGER) as ano, p.is_deleted, p.created_at, p.updated_at " +
                "FROM pcas p WHERE p.id = ? AND p.is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findByItemPca(String itemPca) {
        var rows = jdbc.queryForList("SELECT p.id, p.code as item_pca, CASE WHEN p.contract_type = 'RENOVACAO' THEN 'Renovação' WHEN p.contract_type = 'NOVA_CONTRATACAO' THEN 'Contratação' ELSE 'Contratação' END as tipo, " +
                "p.directory_acronym as area_demandante, p.object_name as objeto, p.estimated_value_cents / 100.0 as valor_estimado, " +
                MONTH_CASE_SQL + " as data_estimada_contratacao, " +
                "CASE p.status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                "p.priority, p.process, p.description, p.justification, p.financial_resource_type, p.step, " +
                "CAST(p.year AS INTEGER) as ano, p.is_deleted, p.created_at, p.updated_at " +
                "FROM pcas p WHERE p.code = ? AND p.is_deleted = FALSE", itemPca);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private boolean existsByItemPca(String itemPca, Long excludeId) {
        if (excludeId != null) {
            Integer c = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM pcas WHERE code = ? AND is_deleted = FALSE AND id != ?",
                    Integer.class, itemPca, excludeId);
            return c != null && c > 0;
        }
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pcas WHERE code = ? AND is_deleted = FALSE", Integer.class, itemPca);
        return c != null && c > 0;
    }

    public Map<String, Object> create(Map<String, Object> data, Long userId) {
        String itemPca = (String) data.get("item_pca");
        if (existsByItemPca(itemPca, null)) {
            throw new ApiException(409, "Item PCA \"" + itemPca + "\" já existe");
        }
        
        String statusStr = parseStatusStr((String) data.get("status"));
        Long valCents = asCents(data.get("valor_estimado"));
        String tipo = mapTipoToContractType((String) data.get("tipo"));

        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO pcas (code, contract_type, directory_acronym, " +
                        "object_name, estimated_value_cents, estimated_date, status, year, " +
                        "process, description, justification, financial_resource_type, step, priority, created_by) " +
                        "VALUES (?, ?, ?, ?, ?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, code as item_pca, " +
                        "CASE WHEN contract_type = 'RENOVACAO' THEN 'Renovação' WHEN contract_type = 'NOVA_CONTRATACAO' THEN 'Contratação' ELSE 'Contratação' END as tipo, " +
                        "directory_acronym as area_demandante, object_name as objeto, estimated_value_cents / 100.0 as valor_estimado, " +
                        "CASE EXTRACT(MONTH FROM estimated_date) WHEN 1 THEN 'Janeiro' WHEN 2 THEN 'Fevereiro' WHEN 3 THEN 'Março' WHEN 4 THEN 'Abril' WHEN 5 THEN 'Maio' WHEN 6 THEN 'Junho' WHEN 7 THEN 'Julho' WHEN 8 THEN 'Agosto' WHEN 9 THEN 'Setembro' WHEN 10 THEN 'Outubro' WHEN 11 THEN 'Novembro' WHEN 12 THEN 'Dezembro' ELSE CAST(estimated_date AS TEXT) END as data_estimada_contratacao, " +
                        "CASE status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                        "priority, process, description, justification, financial_resource_type, step, " +
                        "CAST(year AS INTEGER) as ano, is_deleted, created_at, updated_at",
                itemPca,
                tipo,
                data.get("area_demandante"),
                data.get("objeto"),
                valCents,
                parseMonthToDateStr((String) data.get("data_estimada_contratacao"), data.get("ano")),
                statusStr,
                String.valueOf(data.get("ano") != null ? data.get("ano") : LocalDate.now().getYear()),
                data.get("process"),
                data.get("description"),
                data.get("justification"),
                data.get("financial_resource_type"),
                data.get("step"),
                parsePriorityStr((String) data.get("priority")),
                userId);
        audit.log("pcas", asLong(created.get("id")), "INSERT", userId, null, null, created);
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
        
        if (data.containsKey("item_pca")) { updates.add("code = ?"); values.add(data.get("item_pca")); }
        if (data.containsKey("tipo")) { updates.add("contract_type = ?"); values.add(mapTipoToContractType((String) data.get("tipo"))); }
        if (data.containsKey("area_demandante")) { updates.add("directory_acronym = ?"); values.add(data.get("area_demandante")); }
        if (data.containsKey("objeto")) { updates.add("object_name = ?"); values.add(data.get("objeto")); }
        if (data.containsKey("valor_estimado")) { updates.add("estimated_value_cents = ?"); values.add(asCents(data.get("valor_estimado"))); }
        if (data.containsKey("data_estimada_contratacao")) { updates.add("estimated_date = CAST(? AS DATE)"); values.add(parseMonthToDateStr((String) data.get("data_estimada_contratacao"), data.get("ano") != null ? data.get("ano") : oldRecord.get("ano"))); }
        if (data.containsKey("status")) { updates.add("status = ?"); values.add(parseStatusStr((String) data.get("status"))); }
        if (data.containsKey("ano")) { updates.add("year = ?"); values.add(String.valueOf(data.get("ano"))); }
        if (data.containsKey("process")) { updates.add("process = ?"); values.add(data.get("process")); }
        if (data.containsKey("description")) { updates.add("description = ?"); values.add(data.get("description")); }
        if (data.containsKey("justification")) { updates.add("justification = ?"); values.add(data.get("justification")); }
        if (data.containsKey("financial_resource_type")) { updates.add("financial_resource_type = ?"); values.add(data.get("financial_resource_type")); }
        if (data.containsKey("step")) { updates.add("step = ?"); values.add(data.get("step")); }
        if (data.containsKey("priority")) { updates.add("priority = ?"); values.add(parsePriorityStr((String) data.get("priority"))); }

        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord; // só updated_by, nada para atualizar
        }
        var rows = jdbc.queryForList(
                "UPDATE pcas SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL) RETURNING id, code as item_pca, " +
                        "CASE WHEN contract_type = 'RENOVACAO' THEN 'Renovação' WHEN contract_type = 'NOVA_CONTRATACAO' THEN 'Contratação' ELSE 'Contratação' END as tipo, " +
                        "directory_acronym as area_demandante, object_name as objeto, estimated_value_cents / 100.0 as valor_estimado, " +
                        "CAST(estimated_date AS TEXT) as data_estimada_contratacao, " +
                        "CASE status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                        "priority, process, description, justification, financial_resource_type, step, " +
                        "CAST(year AS INTEGER) as ano, is_deleted, created_at, updated_at", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = rows.get(0);
        audit.log("pcas", id, "UPDATE", userId, null, oldRecord, updated);
        return updated;
    }

    public Map<String, Object> updateStatus(long id, String status, Long userId) {
        Map<String, Object> oldRecord = findById(id);
        if (oldRecord == null) {
            return null;
        }
        String statusStr = parseStatusStr(status);
        var rows = jdbc.queryForList(
                "UPDATE pcas SET status = ?, updated_by = ?, updated_at = NOW() " +
                        "WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL) RETURNING id, code as item_pca, " +
                        "CASE WHEN contract_type = 'RENOVACAO' THEN 'Renovação' WHEN contract_type = 'NOVA_CONTRATACAO' THEN 'Contratação' ELSE 'Contratação' END as tipo, " +
                        "directory_acronym as area_demandante, object_name as objeto, estimated_value_cents / 100.0 as valor_estimado, " +
                        "CAST(estimated_date AS TEXT) as data_estimada_contratacao, " +
                        "CASE status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                        "priority, process, description, justification, financial_resource_type, step, " +
                        "CAST(year AS INTEGER) as ano, is_deleted, created_at, updated_at", statusStr, userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = rows.get(0);
        audit.log("pcas", id, "UPDATE", userId, List.of("status"), oldRecord, updated);
        return updated;
    }

    public boolean softDelete(long id, Long userId) {
        Map<String, Object> existing = findById(id);
        if (existing == null) {
            return false;
        }
        var rows = jdbc.queryForList(
                "UPDATE pcas SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING id", userId, id);
        if (rows.isEmpty()) {
            return false;
        }
        audit.log("pcas", id, "SOFT_DELETE", userId, null, existing, null);
        return true;
    }

    public Map<String, Object> getStats(Integer ano, String diretoria) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*) as total, COALESCE(SUM(estimated_value_cents), 0) as valor_total_cents, " +
                        "COUNT(CASE WHEN status = 'CONCLUIDA' THEN 1 END) as concluidos, " +
                        "COUNT(CASE WHEN status = 'EM_ANDAMENTO' THEN 1 END) as em_andamento, " +
                        "COUNT(CASE WHEN status = 'NAO_INICIADA' THEN 1 END) as nao_iniciados " +
                        "FROM pcas p WHERE p.is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND p.year = ?");
            params.add(String.valueOf(ano));
        }
        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            sql.append(" AND p.directory_acronym = ANY(?::text[])");
            params.add(textArray(domain.diretoriasInDomain()));
        }
        Map<String, Object> row = jdbc.queryForMap(sql.toString(), params.toArray());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", toInt(row.get("total")));
        out.put("valorTotal", toDouble(row.get("valor_total_cents")) / 100.0);
        out.put("concluidos", toInt(row.get("concluidos")));
        out.put("emAndamento", toInt(row.get("em_andamento")));
        out.put("naoIniciados", toInt(row.get("nao_iniciados")));
        return out;
    }

    public List<String> getAreasDemandantes() {
        return jdbc.queryForList(
                "SELECT DISTINCT directory_acronym FROM pcas WHERE is_deleted = FALSE ORDER BY directory_acronym",
                String.class);
    }

    public List<String> getResponsaveis() {
        // Não usamos mais responsavel, retornando vazio para não quebrar frontend imediatamente
        return new ArrayList<>();
    }

    public List<String> getMeses() {
        List<String> meses = jdbc.queryForList(
                "SELECT DISTINCT CAST(estimated_date AS TEXT) FROM pcas WHERE is_deleted = FALSE AND estimated_date IS NOT NULL", String.class);
        meses.sort((a, b) -> a.compareTo(b));
        return meses;
    }

    // ---------- helpers ----------

    private static String parseStatusStr(String status) {
        if ("Concluída".equals(status)) return "CONCLUIDA";
        if ("Em andamento".equals(status)) return "EM_ANDAMENTO";
        return "NAO_INICIADA";
    }

    private static String parsePriorityStr(String priority) {
        if ("Alto".equalsIgnoreCase(priority)) return "ALTO";
        if ("Baixo".equalsIgnoreCase(priority)) return "BAIXO";
        return "MEDIO";
    }
    
    private static String mapTipoToContractType(String tipo) {
        if ("Renovação".equals(tipo)) return "RENOVACAO";
        return "NOVA_CONTRATACAO";
    }
    
    private static Long asCents(Object val) {
        if (val == null) return 0L;
        double v = toDouble(val);
        return Math.round(v * 100.0);
    }

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
