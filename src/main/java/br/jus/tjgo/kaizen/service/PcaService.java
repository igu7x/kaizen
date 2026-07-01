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

    private static final String SELECT_COLUMNS =
            "SELECT p.id, p.code as item_pca, " +
            "CASE WHEN p.contract_type = 'RENOVACAO' THEN 'Renovação' WHEN p.contract_type = 'NOVA_CONTRATACAO' THEN 'Contratação' ELSE 'Contratação' END as tipo, " +
            "p.directory_acronym as area_demandante, p.object_name as objeto, " +
            "p.estimated_value_cents / 100.0 as valor_estimado, " +
            "COALESCE(p.formalized_value_cents, 0) / 100.0 as valor_formalizado, " +
            "p.id_diretoria, p.id_area_demandante, p.id_cadastros_areas, " +
            "(SELECT string_agg(CAST(c.id AS TEXT), ',') FROM contracts c JOIN contracts_pcas cp ON c.id = cp.contract_id WHERE cp.pca_id = p.id AND (c.is_deleted = FALSE OR c.is_deleted IS NULL)) as contract_ids, " +
            "cadastro_unidades_diretoria.nome as diretoria_nome, " +
            "cadastro_unidades_area.nome as area_demandante_nome, ";

    private static final String SELECT_COLUMNS_SNAPSHOT =
            "SELECT p.original_pca_id as id, p.code as item_pca, " +
            "CASE WHEN p.contract_type = 'RENOVACAO' THEN 'Renovação' WHEN p.contract_type = 'NOVA_CONTRATACAO' THEN 'Contratação' ELSE 'Contratação' END as tipo, " +
            "p.directory_acronym as area_demandante, p.object_name as objeto, " +
            "p.estimated_value_cents / 100.0 as valor_estimado, " +
            "COALESCE(p.formalized_value_cents, 0) / 100.0 as valor_formalizado, " +
            "p.id_diretoria, p.id_area_demandante, p.id_cadastros_areas, " +
            "(SELECT string_agg(CAST(c.id AS TEXT), ',') FROM contracts c JOIN contracts_pcas cp ON c.id = cp.contract_id WHERE cp.pca_id = p.original_pca_id AND (c.is_deleted = FALSE OR c.is_deleted IS NULL)) as contract_ids, " +
            "cadastro_unidades_diretoria.nome as diretoria_nome, " +
            "cadastro_unidades_area.nome as area_demandante_nome, ";

    private static final String FROM_JOINS =
            "FROM pcas p " +
            "LEFT JOIN cadastros_unidades cadastro_unidades_diretoria ON cadastro_unidades_diretoria.id = p.id_diretoria " +
            "LEFT JOIN cadastros_unidades cadastro_unidades_area ON cadastro_unidades_area.id = p.id_area_demandante ";

    private String parseMonthToDateStr(String monthName, Object yearObj) {
        if (monthName == null) return null;
        Integer m = MONTH_ORDER.get(monthName);
        if (m != null) {
            String y = yearObj != null ? String.valueOf(yearObj) : String.valueOf(LocalDate.now().getYear());
            return String.format("%s-%02d-01", y, m);
        }
        return monthName;
    }

    public List<Map<String, Object>> findAll(Integer ano, Long diretoriaId, Integer versionNumber) {
        String fromTable = versionNumber != null ? "FROM pcas_snapshots p " : "FROM pcas p ";
        String columns = versionNumber != null ? SELECT_COLUMNS_SNAPSHOT : SELECT_COLUMNS;
        
        StringBuilder sql = new StringBuilder(
                columns +
                        MONTH_CASE_SQL + " as data_estimada_contratacao, " +
                        "CASE p.status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                        "p.priority, p.process, p.description, p.justification, p.financial_resource_type, p.step, " +
                        "CAST(p.year AS INTEGER) as ano, p.is_deleted, p.created_at, p.updated_at " +
                        fromTable +
                        "LEFT JOIN cadastros_unidades cadastro_unidades_diretoria ON cadastro_unidades_diretoria.id = p.id_diretoria " +
                        "LEFT JOIN cadastros_unidades cadastro_unidades_area ON cadastro_unidades_area.id = p.id_area_demandante " +
                        "WHERE (p.is_deleted = FALSE OR p.is_deleted IS NULL)");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND p.year = ?");
            params.add(String.valueOf(ano));
        }
        if (diretoriaId != null) {
            sql.append(" AND p.id_cadastros_areas = ?");
            params.add(diretoriaId);
        }
        if (versionNumber != null) {
            sql.append(" AND p.snapshot_version = ?");
            params.add(versionNumber);
        }
        sql.append(ORDER_BY_NUMERO);
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    public Map<String, Object> findById(long id) {
        var rows = jdbc.queryForList(SELECT_COLUMNS +
                MONTH_CASE_SQL + " as data_estimada_contratacao, " +
                "CASE p.status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                "p.priority, p.process, p.description, p.justification, p.financial_resource_type, p.step, " +
                "CAST(p.year AS INTEGER) as ano, p.is_deleted, p.created_at, p.updated_at " +
                FROM_JOINS + "WHERE p.id = ? AND p.is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * RF-54 — comparação entre duas versões do PCA-TIC de um mesmo ano. Cada versão pode ser um
     * snapshot imutável (número da versão) ou a versão viva/atual (null). Casa os itens pelo código
     * (item_pca) e classifica em incluídos (só na nova), excluídos (só na antiga) e alterados
     * (presentes em ambas, com mudança em campo relevante — com "de"/"para" por campo).
     */
    public Map<String, Object> compareVersions(Integer ano, Integer versaoNova, Integer versaoAntiga) {
        Map<String, Map<String, Object>> nova = indexarPorItemPca(findAll(ano, null, versaoNova));
        Map<String, Map<String, Object>> antiga = indexarPorItemPca(findAll(ano, null, versaoAntiga));

        List<Map<String, Object>> incluidos = new java.util.ArrayList<>();
        List<Map<String, Object>> alterados = new java.util.ArrayList<>();
        List<Map<String, Object>> excluidos = new java.util.ArrayList<>();

        for (var e : nova.entrySet()) {
            Map<String, Object> antigoItem = antiga.get(e.getKey());
            if (antigoItem == null) {
                incluidos.add(e.getValue());
            } else {
                List<Map<String, Object>> mudancas = diffCampos(antigoItem, e.getValue());
                if (!mudancas.isEmpty()) {
                    Map<String, Object> alt = new java.util.LinkedHashMap<>();
                    alt.put("item_pca", e.getKey());
                    alt.put("objeto", e.getValue().get("objeto"));
                    alt.put("area_demandante", e.getValue().get("area_demandante"));
                    alt.put("mudancas", mudancas);
                    alterados.add(alt);
                }
            }
        }
        for (var e : antiga.entrySet()) {
            if (!nova.containsKey(e.getKey())) {
                excluidos.add(e.getValue());
            }
        }

        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("ano", ano);
        out.put("versaoNova", versaoNova);
        out.put("versaoAntiga", versaoAntiga);
        out.put("incluidos", incluidos);
        out.put("alterados", alterados);
        out.put("excluidos", excluidos);
        out.put("totalNova", nova.size());
        out.put("totalAntiga", antiga.size());
        return out;
    }

    private static final String[] CAMPOS_COMPARAVEIS =
            {"objeto", "valor_estimado", "status", "area_demandante", "tipo", "data_estimada_contratacao"};

    private static List<Map<String, Object>> diffCampos(Map<String, Object> antigo, Map<String, Object> novo) {
        List<Map<String, Object>> mudancas = new java.util.ArrayList<>();
        for (String campo : CAMPOS_COMPARAVEIS) {
            Object de = antigo.get(campo);
            Object para = novo.get(campo);
            if (!java.util.Objects.equals(String.valueOf(de), String.valueOf(para))) {
                Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("campo", campo);
                m.put("de", de);
                m.put("para", para);
                mudancas.add(m);
            }
        }
        return mudancas;
    }

    private static Map<String, Map<String, Object>> indexarPorItemPca(List<Map<String, Object>> itens) {
        Map<String, Map<String, Object>> idx = new java.util.LinkedHashMap<>();
        for (Map<String, Object> it : itens) {
            Object code = it.get("item_pca");
            if (code != null) {
                idx.put(String.valueOf(code), it);
            }
        }
        return idx;
    }

    public Map<String, Object> findByItemPca(String itemPca) {
        var rows = jdbc.queryForList(SELECT_COLUMNS +
                MONTH_CASE_SQL + " as data_estimada_contratacao, " +
                "CASE p.status WHEN 'CONCLUIDA' THEN 'Concluída' WHEN 'EM_ANDAMENTO' THEN 'Em andamento' ELSE 'Não Iniciada' END as status, " +
                "p.priority, p.process, p.description, p.justification, p.financial_resource_type, p.step, " +
                "CAST(p.year AS INTEGER) as ano, p.is_deleted, p.created_at, p.updated_at " +
                FROM_JOINS + "WHERE p.code = ? AND p.is_deleted = FALSE", itemPca);
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
        Long formCents = asCents(data.get("valor_formalizado"));
        String tipo = mapTipoToContractType((String) data.get("tipo"));
        Long idDiretoria = numOrNull(data.get("id_diretoria"));
        Long idAreaDemandante = numOrNull(data.get("id_area_demandante"));

        // Se diretoria FK fornecida, derivar directory_acronym para retro-compatibilidade e id_cadastros_areas
        Long idCadastrosAreas = null;
        String areaDemandante = (String) data.get("area_demandante");
        if (idDiretoria != null) {
            var uniRows = jdbc.queryForList("SELECT nome, area_id FROM cadastros_unidades WHERE id = ?", idDiretoria);
            if (!uniRows.isEmpty()) {
                idCadastrosAreas = asLong(uniRows.get(0).get("area_id"));
                if (idCadastrosAreas != null) {
                    var areaRows = jdbc.queryForList("SELECT sigla FROM cadastros_areas WHERE id = ?", idCadastrosAreas);
                    if (!areaRows.isEmpty()) {
                        areaDemandante = (String) areaRows.get(0).get("sigla");
                    }
                } else if (areaDemandante == null || areaDemandante.isEmpty()) {
                    areaDemandante = (String) uniRows.get(0).get("nome");
                }
            }
        }

        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO pcas (code, contract_type, directory_acronym, " +
                        "object_name, estimated_value_cents, formalized_value_cents, estimated_date, status, year, " +
                        "process, description, justification, financial_resource_type, step, priority, " +
                        "id_diretoria, id_area_demandante, id_cadastros_areas, created_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                itemPca,
                tipo,
                areaDemandante,
                data.get("objeto"),
                valCents,
                formCents,
                parseMonthToDateStr((String) data.get("data_estimada_contratacao"), data.get("ano")),
                statusStr,
                String.valueOf(data.get("ano") != null ? data.get("ano") : LocalDate.now().getYear()),
                data.get("process"),
                data.get("description"),
                data.get("justification"),
                data.get("financial_resource_type"),
                data.get("step"),
                parsePriorityStr((String) data.get("priority")),
                idDiretoria,
                idAreaDemandante,
                idCadastrosAreas,
                userId);
        long newId = ((Number) created.get("id")).longValue();
        audit.log("pcas", newId, "INSERT", userId, null, null, created);
        // Return via findById to get JOINed columns
        return findById(newId);
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
        if (data.containsKey("valor_formalizado")) { updates.add("formalized_value_cents = ?"); values.add(asCents(data.get("valor_formalizado"))); }
        if (data.containsKey("data_estimada_contratacao")) { updates.add("estimated_date = CAST(? AS DATE)"); values.add(parseMonthToDateStr((String) data.get("data_estimada_contratacao"), data.get("ano") != null ? data.get("ano") : oldRecord.get("ano"))); }
        if (data.containsKey("status")) { updates.add("status = ?"); values.add(parseStatusStr((String) data.get("status"))); }
        if (data.containsKey("ano")) { updates.add("year = ?"); values.add(String.valueOf(data.get("ano"))); }
        if (data.containsKey("process")) { updates.add("process = ?"); values.add(data.get("process")); }
        if (data.containsKey("description")) { updates.add("description = ?"); values.add(data.get("description")); }
        if (data.containsKey("justification")) { updates.add("justification = ?"); values.add(data.get("justification")); }
        if (data.containsKey("financial_resource_type")) { updates.add("financial_resource_type = ?"); values.add(data.get("financial_resource_type")); }
        if (data.containsKey("step")) { updates.add("step = ?"); values.add(data.get("step")); }
        if (data.containsKey("priority")) { updates.add("priority = ?"); values.add(parsePriorityStr((String) data.get("priority"))); }
        if (data.containsKey("id_diretoria")) {
            updates.add("id_diretoria = ?");
            values.add(numOrNull(data.get("id_diretoria")));
            // Sync directory_acronym for retro-compatibility and id_cadastros_areas
            Long areaId = numOrNull(data.get("id_diretoria"));
            if (areaId != null) {
                var uniRows = jdbc.queryForList("SELECT nome, area_id FROM cadastros_unidades WHERE id = ?", areaId);
                if (!uniRows.isEmpty()) {
                    Long idCadastrosAreas = asLong(uniRows.get(0).get("area_id"));
                    updates.add("id_cadastros_areas = ?");
                    values.add(idCadastrosAreas);
                    
                    if (idCadastrosAreas != null) {
                        var areaRows = jdbc.queryForList("SELECT sigla FROM cadastros_areas WHERE id = ?", idCadastrosAreas);
                        if (!areaRows.isEmpty()) {
                            int idx = updates.indexOf("directory_acronym = ?");
                            if (idx >= 0) { updates.remove(idx); values.remove(idx); }
                            updates.add("directory_acronym = ?");
                            values.add(areaRows.get(0).get("sigla"));
                        } else {
                            int idx = updates.indexOf("directory_acronym = ?");
                            if (idx >= 0) { updates.remove(idx); values.remove(idx); }
                            updates.add("directory_acronym = ?");
                            values.add(uniRows.get(0).get("nome"));
                        }
                    } else {
                        int idx = updates.indexOf("directory_acronym = ?");
                        if (idx >= 0) { updates.remove(idx); values.remove(idx); }
                        updates.add("directory_acronym = ?");
                        values.add(uniRows.get(0).get("nome"));
                    }
                }
            } else {
                updates.add("id_cadastros_areas = NULL");
            }
        }
        if (data.containsKey("id_area_demandante")) { updates.add("id_area_demandante = ?"); values.add(numOrNull(data.get("id_area_demandante"))); }

        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord; // só updated_by, nada para atualizar
        }
        var rows = jdbc.queryForList(
                "UPDATE pcas SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL) RETURNING id", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = findById(id);
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

    public Map<String, Object> getStats(Integer ano, Long diretoriaId, Integer versionNumber) {
        String fromTable = versionNumber != null ? "FROM pcas_snapshots p " : "FROM pcas p ";
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*) as total, COALESCE(SUM(estimated_value_cents), 0) as valor_total_cents, " +
                        "COUNT(CASE WHEN status = 'CONCLUIDA' THEN 1 END) as concluidos, " +
                        "COUNT(CASE WHEN status = 'EM_ANDAMENTO' THEN 1 END) as em_andamento, " +
                        "COUNT(CASE WHEN status = 'NAO_INICIADA' THEN 1 END) as nao_iniciados " +
                        fromTable + "WHERE (p.is_deleted = FALSE OR p.is_deleted IS NULL)");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND p.year = ?");
            params.add(String.valueOf(ano));
        }
        if (diretoriaId != null) {
            sql.append(" AND p.id_cadastros_areas = ?");
            params.add(diretoriaId);
        }
        if (versionNumber != null) {
            sql.append(" AND p.snapshot_version = ?");
            params.add(versionNumber);
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

    public List<Integer> getAvailableVersions(Integer ano) {
        return jdbc.queryForList("SELECT DISTINCT snapshot_version FROM pcas_snapshots WHERE year = ? ORDER BY snapshot_version DESC", Integer.class, String.valueOf(ano));
    }

    public void createSnapshot(Integer ano, Long userId) {
        Integer maxVersion = jdbc.queryForObject("SELECT MAX(snapshot_version) FROM pcas_snapshots WHERE year = ?", Integer.class, String.valueOf(ano));
        int nextVersion = maxVersion == null ? 1 : maxVersion + 1;
        
        String insertSql = "INSERT INTO pcas_snapshots (original_pca_id, snapshot_version, snapshot_created_by, " +
                "year, code, description, justification, process, financial_resource_type, contract_type, object_name, " +
                "directory_acronym, estimated_value_cents, formalized_value_cents, id_diretoria, id_area_demandante, " +
                "id_cadastros_areas, priority, step, estimated_date, status, is_deleted, created_at, updated_at, " +
                "created_by, updated_by, deleted_at, deleted_by) " +
                "SELECT id, ?, ?, " +
                "year, code, description, justification, process, financial_resource_type, contract_type, object_name, " +
                "directory_acronym, estimated_value_cents, formalized_value_cents, id_diretoria, id_area_demandante, " +
                "id_cadastros_areas, priority, step, estimated_date, status, is_deleted, created_at, updated_at, " +
                "created_by, updated_by, deleted_at, deleted_by " +
                "FROM pcas WHERE year = ? AND (is_deleted = FALSE OR is_deleted IS NULL)";
                
        jdbc.update(insertSql, nextVersion, userId, String.valueOf(ano));
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

    private static Long numOrNull(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
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
