package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de form.service.ts (formulários dinâmicos: forms + sections + fields + responses + answers).
 * jsonb: allowed_directorates, form_fields.config, form_answers.value (Bug #3). Operador jsonb `?`
 * substituído por jsonb_exists() para não colidir com placeholder JDBC. saveFormStructure soft-deleta
 * e recria (KNOWN_DIVERGENCE #5). saveFormResponse: ALREADY_SUBMITTED -> 409.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FormService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final ObjectMapper objectMapper;

    private static final Map<String, String> TYPE_MAP = new LinkedHashMap<>();

    static {
        TYPE_MAP.put("TEXT", "SHORT_TEXT");
        TYPE_MAP.put("TEXTAREA", "LONG_TEXT");
        TYPE_MAP.put("SHORT_TEXT", "SHORT_TEXT");
        TYPE_MAP.put("LONG_TEXT", "LONG_TEXT");
        TYPE_MAP.put("RADIO", "MULTIPLE_CHOICE");
        TYPE_MAP.put("MULTIPLE_CHOICE", "MULTIPLE_CHOICE");
        TYPE_MAP.put("CHECKBOX", "CHECKBOXES");
        TYPE_MAP.put("CHECKBOXES", "CHECKBOXES");
        TYPE_MAP.put("SELECT", "DROPDOWN");
        TYPE_MAP.put("DROPDOWN", "DROPDOWN");
        TYPE_MAP.put("SCALE", "SCALE");
        TYPE_MAP.put("NUMBER", "NUMBER");
        TYPE_MAP.put("DATE", "DATE");
        TYPE_MAP.put("EMAIL", "SHORT_TEXT");
        TYPE_MAP.put("PHONE", "SHORT_TEXT");
        TYPE_MAP.put("FILE", "FILE");
    }

    private static String mapFieldTypeToFrontend(String dbType) {
        String upper = (dbType == null ? "" : dbType).toUpperCase();
        String mapped = TYPE_MAP.get(upper);
        if (mapped != null) {
            return mapped;
        }
        return upper.isEmpty() ? "SHORT_TEXT" : upper;
    }

    // ======================== FORMS ========================

    public List<Map<String, Object>> findAllForms(String directorateCode, boolean isAdmin) {
        StringBuilder sql = new StringBuilder("SELECT * FROM forms WHERE is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        if (!isAdmin && directorateCode != null) {
            // jsonb `?` operador -> jsonb_exists() (evita colisao com placeholder JDBC)
            sql.append(" AND (allowed_directorates IS NULL OR allowed_directorates = '[]' " +
                    "OR jsonb_exists(allowed_directorates::jsonb, 'ALL') " +
                    "OR jsonb_exists(allowed_directorates::jsonb, ?))");
            params.add(directorateCode);
        }
        sql.append(" ORDER BY created_at DESC");
        var rows = jdbc.queryForList(sql.toString(), params.toArray());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            out.add(toFormListDto(row));
        }
        return out;
    }

    public Map<String, Object> findFormById(long id) {
        var formRows = jdbc.queryForList("SELECT * FROM forms WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            return null;
        }
        Map<String, Object> form = formRows.get(0);
        var sections = jdbc.queryForList(
                "SELECT * FROM form_sections WHERE form_id = ? AND is_deleted = FALSE ORDER BY display_order", id);
        var fields = jdbc.queryForList(
                "SELECT * FROM form_fields WHERE form_id = ? AND is_deleted = FALSE ORDER BY display_order", id);
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM form_responses WHERE form_id = ? AND status = 'SUBMITTED' AND is_deleted = FALSE",
                Integer.class, id);

        Map<String, Object> out = toFormListDto(form);
        out.put("sections", sections.stream().map(s -> sectionDto(s, id)).toList());
        out.put("fields", fields.stream().map(f -> fieldDto(f, id)).toList());
        out.put("responseCount", count != null ? count : 0);
        return out;
    }

    public Map<String, Object> createForm(Map<String, Object> data, Long userId) {
        Object allowed = data.get("allowed_directorates");
        Map<String, Object> form = jdbc.queryForMap(
                "INSERT INTO forms (title, description, directorate_code, allowed_directorates, created_by, status) " +
                        "VALUES (?, ?, ?, ?::jsonb, ?, ?) RETURNING *",
                data.get("title"), orNull(data.get("description")), data.get("directorate_code"),
                toJson(allowed != null ? allowed : List.of()), userId,
                data.get("status") != null ? data.get("status") : "DRAFT");
        audit.log("forms", asLong(form.get("id")), "INSERT", userId, null, null, form);
        return toFormListDto(form);
    }

    public Map<String, Object> updateForm(long id, Map<String, Object> data, Long userId) {
        var existingRows = jdbc.queryForList("SELECT * FROM forms WHERE id = ? AND is_deleted = FALSE", id);
        if (existingRows.isEmpty()) {
            return null;
        }
        Map<String, Object> existing = existingRows.get(0);
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        if (data.containsKey("title")) {
            updates.add("title = ?");
            values.add(data.get("title"));
        }
        if (data.containsKey("description")) {
            updates.add("description = ?");
            values.add(data.get("description"));
        }
        if (data.containsKey("status")) {
            updates.add("status = ?");
            values.add(data.get("status"));
        }
        if (data.containsKey("allowed_directorates")) {
            updates.add("allowed_directorates = ?::jsonb");
            values.add(toJson(data.get("allowed_directorates")));
        }
        if (updates.isEmpty()) {
            return findFormById(id);
        }
        updates.add("updated_at = NOW()");
        values.add(id);
        var rows = jdbc.queryForList(
                "UPDATE forms SET " + String.join(", ", updates) + " WHERE id = ? AND is_deleted = FALSE RETURNING *",
                values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> form = rows.get(0);
        audit.log("forms", id, "UPDATE", userId, null, existing, form);
        return toFormListDto(form);
    }

    public boolean deleteForm(long id, Long userId) {
        var existing = jdbc.queryForList("SELECT * FROM forms WHERE id = ? AND is_deleted = FALSE", id);
        if (existing.isEmpty()) {
            return false;
        }
        var rows = jdbc.queryForList(
                "UPDATE forms SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING id", userId, id);
        if (rows.isEmpty()) {
            return false;
        }
        audit.log("forms", id, "SOFT_DELETE", userId, null, existing.get(0), null);
        return true;
    }

    // ======================== STRUCTURE ========================

    public Map<String, Object> getFormStructure(long formId) {
        var sections = jdbc.queryForList(
                "SELECT * FROM form_sections WHERE form_id = ? AND is_deleted = FALSE ORDER BY display_order", formId);
        var fields = jdbc.queryForList(
                "SELECT * FROM form_fields WHERE form_id = ? AND is_deleted = FALSE ORDER BY display_order", formId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sections", sections.stream().map(s -> sectionDto(s, formId)).toList());
        out.put("fields", fields.stream().map(f -> fieldDto(f, formId)).toList());
        return out;
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public void saveFormStructure(long formId, List<Map<String, Object>> sections,
                                  List<Map<String, Object>> fields, Long userId) {
        jdbc.update("UPDATE form_fields SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                "WHERE form_id = ? AND is_deleted = FALSE", userId, formId);
        jdbc.update("UPDATE form_sections SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                "WHERE form_id = ? AND is_deleted = FALSE", userId, formId);

        Map<String, Long> sectionIdMap = new LinkedHashMap<>();
        for (Map<String, Object> section : sections) {
            String oldId = section.get("id") == null ? null : String.valueOf(section.get("id"));
            Map<String, Object> res = jdbc.queryForMap(
                    "INSERT INTO form_sections (form_id, title, description, display_order) VALUES (?, ?, ?, ?) RETURNING id",
                    formId, section.get("title"), section.get("description"), section.get("order"));
            if (oldId != null) {
                sectionIdMap.put(oldId, ((Number) res.get("id")).longValue());
            }
        }

        for (Map<String, Object> field : fields) {
            Long realSectionId = null;
            if (field.get("sectionId") != null) {
                realSectionId = sectionIdMap.get(String.valueOf(field.get("sectionId")));
            }
            String fieldType = field.get("type") != null ? String.valueOf(field.get("type")) : "SHORT_TEXT";
            Object config = field.get("config");
            if (config == null) {
                Map<String, Object> cfg = new LinkedHashMap<>();
                cfg.put("options", field.get("options") != null ? field.get("options") : List.of());
                cfg.put("placeholder", field.get("placeholder"));
                cfg.put("minValue", field.get("minValue"));
                cfg.put("maxValue", field.get("maxValue"));
                cfg.put("minLabel", field.get("minLabel"));
                cfg.put("maxLabel", field.get("maxLabel"));
                config = cfg;
            }
            jdbc.update(
                    "INSERT INTO form_fields (form_id, section_id, label, field_type, required, display_order, help_text, config) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)",
                    formId, realSectionId, field.get("label"), fieldType,
                    Boolean.TRUE.equals(field.get("required")),
                    field.get("order") != null ? field.get("order") : 0,
                    orNull(field.get("helpText")), toJson(config));
        }

        audit.log("forms", formId, "UPDATE", userId, List.of("structure", "sections", "fields"), null, null);
    }

    // ======================== RESPONSES ========================

    public List<Map<String, Object>> getFormResponses(long formId) {
        var responses = jdbc.queryForList(
                "SELECT r.*, u.name as user_name FROM form_responses r LEFT JOIN users u ON r.user_id = u.id " +
                        "WHERE r.form_id = ? AND r.is_deleted = FALSE ORDER BY r.created_at DESC", formId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> resp : responses) {
            var answers = jdbc.queryForList(
                    "SELECT * FROM form_answers WHERE response_id = ? AND is_deleted = FALSE", resp.get("id"));
            List<Map<String, Object>> answerDtos = new ArrayList<>();
            for (Map<String, Object> a : answers) {
                Map<String, Object> ad = new LinkedHashMap<>();
                ad.put("id", a.get("id"));
                ad.put("responseId", a.get("response_id"));
                ad.put("fieldId", a.get("field_id"));
                ad.put("value", a.get("value"));
                answerDtos.add(ad);
            }
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", resp.get("id"));
            r.put("formId", resp.get("form_id"));
            r.put("userId", resp.get("user_id"));
            r.put("userName", resp.get("user_name") != null ? resp.get("user_name") : "Usuário Desconhecido");
            r.put("status", resp.get("status"));
            r.put("submittedAt", resp.get("submitted_at") != null ? resp.get("submitted_at") : resp.get("created_at"));
            r.put("createdAt", resp.get("created_at"));
            r.put("updatedAt", resp.get("updated_at"));
            r.put("answers", answerDtos);
            out.add(r);
        }
        return out;
    }

    /** Throws RuntimeException("ALREADY_SUBMITTED") -> controller mapeia para 409. */
    @Transactional
    public Map<String, Object> saveFormResponse(long formId, long userId, List<Map<String, Object>> answers, String status) {
        boolean submitted = "SUBMITTED".equals(status);
        var existing = jdbc.queryForList(
                "SELECT id, status FROM form_responses WHERE form_id = ? AND user_id = ? AND is_deleted = FALSE",
                formId, userId);

        if (!existing.isEmpty()) {
            Map<String, Object> existingResponse = existing.get(0);
            if ("SUBMITTED".equals(existingResponse.get("status"))) {
                throw new RuntimeException("ALREADY_SUBMITTED");
            }
            long respId = ((Number) existingResponse.get("id")).longValue();
            jdbc.update("UPDATE form_responses SET status = ?, updated_at = NOW(), submitted_at = " +
                    (submitted ? "NOW()" : "NULL") + " WHERE id = ?", status, respId);
            jdbc.update("UPDATE form_answers SET is_deleted = TRUE, deleted_at = NOW() WHERE response_id = ?", respId);
            for (Map<String, Object> answer : answers) {
                jdbc.update("INSERT INTO form_answers (response_id, field_id, value) VALUES (?, ?, ?::jsonb)",
                        respId, answer.get("fieldId"), toJson(answer.get("value")));
            }
            audit.log("form_responses", respId, "UPDATE", userId);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", respId);
            out.put("status", status);
            return out;
        }

        Map<String, Object> response = jdbc.queryForMap(
                "INSERT INTO form_responses (form_id, user_id, status, submitted_at) " +
                        "VALUES (?, ?, ?, " + (submitted ? "NOW()" : "NULL") + ") RETURNING *",
                formId, userId, status);
        long respId = ((Number) response.get("id")).longValue();
        for (Map<String, Object> answer : answers) {
            jdbc.update("INSERT INTO form_answers (response_id, field_id, value) VALUES (?, ?, ?::jsonb)",
                    respId, answer.get("fieldId"), toJson(answer.get("value")));
        }
        audit.log("form_responses", respId, "INSERT", userId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", response.get("id"));
        out.put("formId", response.get("form_id"));
        out.put("userId", response.get("user_id"));
        out.put("status", response.get("status"));
        return out;
    }

    // ======================== DTO HELPERS ========================

    private static Map<String, Object> toFormListDto(Map<String, Object> row) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", row.get("id"));
        dto.put("title", row.get("title"));
        dto.put("description", row.get("description"));
        dto.put("status", row.get("status"));
        dto.put("directorate", row.get("directorate_code"));
        dto.put("allowedDirectorates", row.get("allowed_directorates"));
        dto.put("createdBy", row.get("created_by"));
        dto.put("createdAt", row.get("created_at"));
        dto.put("updatedAt", row.get("updated_at"));
        return dto;
    }

    private static Map<String, Object> sectionDto(Map<String, Object> s, long formId) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", String.valueOf(s.get("id")));
        dto.put("formId", String.valueOf(formId));
        dto.put("title", s.get("title"));
        dto.put("description", s.get("description"));
        dto.put("order", s.get("display_order"));
        return dto;
    }

    private Map<String, Object> fieldDto(Map<String, Object> f, long formId) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", String.valueOf(f.get("id")));
        dto.put("formId", String.valueOf(formId));
        // sectionId omitido quando null (Node usa undefined -> ausente no JSON)
        if (f.get("section_id") != null) {
            dto.put("sectionId", String.valueOf(f.get("section_id")));
        }
        dto.put("type", mapFieldTypeToFrontend((String) f.get("field_type")));
        dto.put("label", f.get("label"));
        dto.put("helpText", f.get("help_text"));
        dto.put("required", f.get("required"));
        dto.put("order", f.get("display_order"));
        dto.put("config", f.get("config") != null ? f.get("config") : new LinkedHashMap<>());
        return dto;
    }

    // ======================== HELPERS ========================

    private static Object orNull(Object v) {
        return v == null ? null : v;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "null";
        }
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }
}
