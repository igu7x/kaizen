package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Audit log — porte fiel de audit.service.ts. Insere em audit_log (singular).
 * Best-effort: falha de audit NÃO quebra a operação principal (igual ao Node).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public void log(String tableName, Long recordId, String action, Long userId,
                    Object changedFields, Object oldValues, Object newValues) {
        try {
            jdbc.update(
                    "INSERT INTO audit_log (table_name, record_id, action, user_id, " +
                            "changed_fields, old_values, new_values, ip_address, user_agent) " +
                            "VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?)",
                    tableName,
                    recordId,
                    action,
                    userId,
                    toJson(changedFields),
                    toJson(oldValues),
                    toJson(newValues),
                    null,
                    null
            );
        } catch (Exception e) {
            log.error("Erro ao registrar audit log: {}", e.getMessage());
        }
    }

    public void log(String tableName, Long recordId, String action, Long userId) {
        log(tableName, recordId, action, userId, null, null, null);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? null : value);
        } catch (Exception e) {
            return "null";
        }
    }
}
