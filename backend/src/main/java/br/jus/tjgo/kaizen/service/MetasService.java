package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Porte fiel de metas.service.ts (tabela cadastros_metas). Categoria A.
 * findAllMetas mapeia camelCase + areaNome/areaSigla; create/update mapeiam camelCase sem area*.
 */
@Service
@RequiredArgsConstructor
public class MetasService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final DomainService domainService;

    // ============================================================
    // PARSING DE PRAZO (paridade com parsePrazo/calcularSituacao do Node)
    // ============================================================

    private static final Map<String, Integer> MESES_PT = new LinkedHashMap<>();

    static {
        MESES_PT.put("janeiro", 0);
        MESES_PT.put("fevereiro", 1);
        MESES_PT.put("março", 2);
        MESES_PT.put("marco", 2);
        MESES_PT.put("abril", 3);
        MESES_PT.put("maio", 4);
        MESES_PT.put("junho", 5);
        MESES_PT.put("julho", 6);
        MESES_PT.put("agosto", 7);
        MESES_PT.put("setembro", 8);
        MESES_PT.put("outubro", 9);
        MESES_PT.put("novembro", 10);
        MESES_PT.put("dezembro", 11);
    }

    private static final Pattern MM_YYYY = Pattern.compile("^(\\d{1,2})/(\\d{4})$");
    private static final Pattern YEAR = Pattern.compile("(\\d{4})");

    /** new Date(year, month+1, 0, 23,59,59) — último dia do mês às 23:59:59. */
    private static LocalDateTime parsePrazo(String prazo) {
        String trimmed = prazo.trim();
        try {
            Matcher mm = MM_YYYY.matcher(trimmed);
            if (mm.matches()) {
                int month = Integer.parseInt(mm.group(1)) - 1;
                int year = Integer.parseInt(mm.group(2));
                if (month >= 0 && month <= 11) {
                    return YearMonth.of(year, month + 1).atEndOfMonth().atTime(23, 59, 59);
                }
                return null;
            }
            String normalized = trimmed.toLowerCase();
            for (Map.Entry<String, Integer> e : MESES_PT.entrySet()) {
                if (normalized.contains(e.getKey())) {
                    Matcher ym = YEAR.matcher(normalized);
                    if (ym.find()) {
                        int year = Integer.parseInt(ym.group(1));
                        int monthIdx = e.getValue();
                        return YearMonth.of(year, monthIdx + 1).atEndOfMonth().atTime(23, 59, 59);
                    }
                }
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private static String calcularSituacao(String status, String prazo) {
        if ("CONCLUIDO".equals(status)) {
            return "FINALIZADO";
        }
        if (prazo == null) {
            return "NO_PRAZO";
        }
        LocalDateTime target = parsePrazo(prazo);
        if (target == null) {
            return "NO_PRAZO";
        }
        if (LocalDateTime.now().isAfter(target)) {
            return "EM_ATRASO";
        }
        return "NO_PRAZO";
    }

    // ============================================================
    // OPERAÇÕES
    // ============================================================

    public List<Map<String, Object>> findAllMetas(String diretoria) {
        String sql = "SELECT m.*, a.nome AS area_nome, a.sigla AS area_sigla " +
                "FROM cadastros_metas m " +
                "LEFT JOIN cadastros_areas a ON a.id = m.area_id " +
                "WHERE m.is_deleted = FALSE";
        List<Map<String, Object>> rows;
        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            rows = jdbc.queryForList(
                    sql + " AND a.sigla = ANY(?::text[]) ORDER BY m.id",
                    textArray(domain.diretoriasInDomain()));
        } else {
            rows = jdbc.queryForList(sql + " ORDER BY m.id");
        }
        return rows.stream().map(m -> {
            String status = m.get("status") != null ? (String) m.get("status") : "NAO_INICIADO";
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", m.get("id"));
            dto.put("titulo", m.get("titulo"));
            dto.put("descricao", m.get("descricao"));
            dto.put("areaId", m.get("area_id"));
            dto.put("areaNome", m.get("area_nome"));
            dto.put("areaSigla", m.get("area_sigla"));
            dto.put("status", status);
            dto.put("situacao", calcularSituacao(status, (String) m.get("prazo")));
            dto.put("prazo", m.get("prazo"));
            dto.put("createdAt", m.get("created_at"));
            dto.put("updatedAt", m.get("updated_at"));
            return dto;
        }).toList();
    }

    public Map<String, Object> createMeta(String titulo, String descricao, Object areaId, String status,
                                          String prazo, Long userId) {
        String st = status != null ? status : "NAO_INICIADO";
        String situacao = calcularSituacao(st, prazo);
        Map<String, Object> m = jdbc.queryForMap(
                "INSERT INTO cadastros_metas (titulo, descricao, area_id, status, situacao, prazo, created_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
                titulo, descricao, areaId, st, situacao, prazo, userId);
        audit.log("cadastros_metas", asLong(m.get("id")), "INSERT", userId, null, null, m);
        return toMetaDto(m, calcularSituacao((String) m.get("status"), (String) m.get("prazo")));
    }

    public Map<String, Object> updateMeta(long id, String titulo, String descricao, Object areaId,
                                          String status, String situacao, String prazo, Long userId) {
        Map<String, Object> existing = findOne(id);
        if (existing == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE cadastros_metas SET titulo = COALESCE(?, titulo), descricao = COALESCE(?, descricao), " +
                        "area_id = COALESCE(?, area_id), status = COALESCE(?, status), situacao = COALESCE(?, situacao), " +
                        "prazo = COALESCE(?, prazo), updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *",
                titulo, descricao, areaId, status, situacao, prazo, userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> m = rows.get(0);
        String situacaoCalculada = calcularSituacao((String) m.get("status"), (String) m.get("prazo"));
        if (!situacaoCalculada.equals(m.get("situacao"))) {
            jdbc.update("UPDATE cadastros_metas SET situacao = ? WHERE id = ?", situacaoCalculada, id);
        }
        audit.log("cadastros_metas", id, "UPDATE", userId, null, existing, m);
        return toMetaDto(m, situacaoCalculada);
    }

    public boolean deleteMeta(long id, Long userId) {
        Map<String, Object> existing = findOne(id);
        if (existing == null) {
            return false;
        }
        int affected = jdbc.update(
                "UPDATE cadastros_metas SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE",
                userId, id);
        if (affected == 0) {
            return false;
        }
        audit.log("cadastros_metas", id, "SOFT_DELETE", userId, null, existing, null);
        return true;
    }

    private Map<String, Object> findOne(long id) {
        var rows = jdbc.queryForList(
                "SELECT * FROM cadastros_metas WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static Map<String, Object> toMetaDto(Map<String, Object> m, String situacao) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", m.get("id"));
        dto.put("titulo", m.get("titulo"));
        dto.put("descricao", m.get("descricao"));
        dto.put("areaId", m.get("area_id"));
        dto.put("status", m.get("status"));
        dto.put("situacao", situacao);
        dto.put("prazo", m.get("prazo"));
        dto.put("createdAt", m.get("created_at"));
        dto.put("updatedAt", m.get("updated_at"));
        return dto;
    }

    private static String textArray(List<String> dirs) {
        return "{" + String.join(",", dirs) + "}";
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }
}
