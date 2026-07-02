package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.util.PasswordHasher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Porte fiel de user.service.ts + base.service.ts (parte de users).
 * Usa JdbcTemplate (SQL bruto, como o Node). Respostas via LinkedHashMap para preservar
 * a ordem e a presença condicional de campos (paridade byte-a-byte com toResponseDto).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;
    private final AuditService auditService;

    // ---------- mapeamento DTO ----------

    /** Espelha toResponseDto: ordem e defaults exatos; NÃO inclui password_hash. */
    public Map<String, Object> toResponseDto(Map<String, Object> u) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", u.get("id"));
        dto.put("name", u.get("name"));
        dto.put("email", u.get("email"));
        dto.put("role", u.get("role"));
        dto.put("status", u.get("status"));
        dto.put("diretoria", blankToDefault(u.get("diretoria"), "SGJT"));
        dto.put("dominio", blankToDefault(u.get("dominio"), "SGJT"));
        dto.put("is_superadmin", Boolean.TRUE.equals(u.get("is_superadmin")));
        dto.put("matricula", u.get("matricula"));
        dto.put("cargo_funcao", u.get("cargo_funcao"));
        Object unidadeAtual = u.get("unidade_lotacao_atual");
        dto.put("unidade_lotacao", unidadeAtual != null ? unidadeAtual : u.get("unidade_lotacao"));
        dto.put("situacao_funcional", u.get("situacao_funcional"));
        dto.put("nome_cc_fc", u.get("nome_cc_fc"));
        dto.put("classe_cc_fc", u.get("classe_cc_fc"));
        dto.put("cargo_efetivo", u.get("cargo_efetivo"));
        dto.put("classe_efetivo", u.get("classe_efetivo"));
        dto.put("foto_perfil", u.get("foto_perfil"));
        dto.put("is_developer", Boolean.TRUE.equals(u.get("is_developer")));
        dto.put("created_at", u.get("created_at"));
        dto.put("updated_at", u.get("updated_at"));
        return dto;
    }

    public boolean isDeveloper(long userId) {
        Map<String, Object> user = findOneRaw(userId);
        return user != null && Boolean.TRUE.equals(user.get("is_developer"));
    }

    public List<Map<String, Object>> getDevelopers() {
        var rows = jdbc.queryForList("SELECT u.*, (SELECT cu.nome FROM cadastros_pessoas cp JOIN cadastros_unidades cu ON cp.unidade_id = cu.id WHERE cp.user_id = u.id LIMIT 1) as unidade_lotacao_atual FROM users u WHERE u.is_developer = TRUE AND u.is_deleted = FALSE ORDER BY u.name");
        return rows.stream().map(this::toResponseDto).toList();
    }

    public Map<String, Object> addDeveloper(Map<String, Object> data) {
        String email = data.get("email") != null ? String.valueOf(data.get("email")).trim() : null;
        if (email == null || email.isBlank()) {
            throw new ApiException(400, "Campos obrigatórios: email");
        }
        var existing = jdbc.queryForList("SELECT id, is_deleted, status FROM users WHERE email = ?", email);
        if (existing.isEmpty()) {
            throw new ApiException(404, "Usuário não encontrado. O e-mail deve estar previamente cadastrado.");
        }
        Map<String, Object> user = existing.get(0);
        if (Boolean.TRUE.equals(user.get("is_deleted")) || !"ACTIVE".equals(user.get("status"))) {
            throw new ApiException(400, "Usuário inativo ou excluído. Não é possível conceder permissões.");
        }
        return jdbc.queryForMap(
                "UPDATE users SET is_developer = TRUE, updated_at = NOW() WHERE email = ? RETURNING *",
                email);
    }

    public boolean removeDeveloper(long userId) {
        Map<String, Object> user = findOneRaw(userId);
        if (user == null) {
            return false;
        }
        String email = String.valueOf(user.get("email"));
        if ("ifccupertino@tjgo.jus.br".equals(email) ||
            "acandrade@tjgo.jus.br".equals(email) ||
            "sgrocha@tjgo.jus.br".equals(email)) {
            throw new ApiException(400, "Não é possível remover o status de desenvolvedor destes e-mails nativos.");
        }
        return jdbc.update("UPDATE users SET is_developer = FALSE, updated_at = NOW() WHERE id = ? AND is_deleted = FALSE", userId) > 0;
    }

    // ---------- leitura ----------

    private Map<String, Object> findOneRaw(long id) {
        var rows = jdbc.queryForList("SELECT u.*, (SELECT cu.nome FROM cadastros_pessoas cp JOIN cadastros_unidades cu ON cp.unidade_id = cu.id WHERE cp.user_id = u.id LIMIT 1) as unidade_lotacao_atual FROM users u WHERE u.id = ? AND u.is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findUserById(long id) {
        Map<String, Object> u = findOneRaw(id);
        return u == null ? null : toResponseDto(u);
    }

    public Map<String, Object> findUserByEmail(String email) {
        Map<String, Object> u = findByEmailRaw(email);
        return u == null ? null : toResponseDto(u);
    }

    private Map<String, Object> findByEmailRaw(String email) {
        var rows = jdbc.queryForList("SELECT u.*, (SELECT cu.nome FROM cadastros_pessoas cp JOIN cadastros_unidades cu ON cp.unidade_id = cu.id WHERE cp.user_id = u.id LIMIT 1) as unidade_lotacao_atual FROM users u WHERE u.email = ? AND u.is_deleted = FALSE", email);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Object> findDeletedByEmailRaw(String email) {
        var rows = jdbc.queryForList("SELECT * FROM users WHERE email = ? AND is_deleted = TRUE", email);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private boolean emailExists(String email, Long excludeId) {
        String sql = "SELECT id FROM users WHERE email = ? AND is_deleted = FALSE";
        List<Map<String, Object>> rows = excludeId != null
                ? jdbc.queryForList(sql + " AND id != ?", email, excludeId)
                : jdbc.queryForList(sql, email);
        return !rows.isEmpty();
    }

    /** Lista usuários (sem senha). Se dominio informado, filtra via cadastros_areas. */
    public List<Map<String, Object>> findAllUsers(String orderBy, String dominio) {
        String safeOrder = "name".equals(orderBy) || "id".equals(orderBy) ? orderBy : "name";
        List<Map<String, Object>> rows;
        if (dominio != null && !dominio.isBlank()) {
            try {
                rows = jdbc.queryForList(
                        "SELECT u.*, (SELECT cu.nome FROM cadastros_pessoas cp JOIN cadastros_unidades cu ON cp.unidade_id = cu.id WHERE cp.user_id = u.id LIMIT 1) as unidade_lotacao_atual FROM users u WHERE u.is_deleted = FALSE " +
                                "AND u.diretoria IN (SELECT sigla FROM cadastros_areas " +
                                "WHERE dominio = ? AND COALESCE(ativo, TRUE) = TRUE AND sigla IS NOT NULL) " +
                                "ORDER BY u." + safeOrder,
                        dominio);
            } catch (Exception e) {
                rows = jdbc.queryForList(
                        "SELECT u.*, (SELECT cu.nome FROM cadastros_pessoas cp JOIN cadastros_unidades cu ON cp.unidade_id = cu.id WHERE cp.user_id = u.id LIMIT 1) as unidade_lotacao_atual FROM users u WHERE u.is_deleted = FALSE AND u.dominio = ? ORDER BY u." + safeOrder,
                        dominio);
            }
        } else {
            rows = jdbc.queryForList("SELECT u.*, (SELECT cu.nome FROM cadastros_pessoas cp JOIN cadastros_unidades cu ON cp.unidade_id = cu.id WHERE cp.user_id = u.id LIMIT 1) as unidade_lotacao_atual FROM users u WHERE u.is_deleted = FALSE ORDER BY u." + safeOrder);
        }
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            out.add(toResponseDto(r));
        }
        return out;
    }

    // ---------- autenticação ----------

    /** authenticate: compara o hash recebido (frontend já hasheia) com o do banco; enriquece com domínio. */
    public Map<String, Object> authenticate(String email, String passwordHash) {
        Map<String, Object> user = findByEmailRaw(email);
        if (user == null) {
            return null;
        }
        if (Boolean.TRUE.equals(user.get("is_sso_user"))) {
            return null;
        }
        if (!"ACTIVE".equals(user.get("status"))) {
            return null;
        }
        if (!String.valueOf(user.get("password_hash")).equals(passwordHash)) {
            return null;
        }

        long id = ((Number) user.get("id")).longValue();
        auditService.log("users", id, "LOGIN", id);

        Map<String, Object> dto = toResponseDto(user);
        String dirVis = strOrNull(user.get("diretoria_visibilidade"));
        String effectiveDiretoria = dirVis != null && !dirVis.isBlank()
                ? dirVis
                : String.valueOf(dto.get("diretoria"));
        var domainInfo = domainService.getDomainForDiretoria(effectiveDiretoria);
        dto.put("is_domain_root", domainInfo.isDomainRoot());
        dto.put("dominio", domainInfo.dominio());
        if (dirVis != null && !dirVis.isBlank()) {
            dto.put("diretoria_visibilidade", dirVis);
        }
        return dto;
    }

    // ---------- escrita ----------

    @Transactional
    public Map<String, Object> createUser(Map<String, Object> data, long createdByUserId) {
        String email = strOrNull(data.get("email"));
        if (emailExists(email, null)) {
            throw new ApiException(409, "Email já cadastrado");
        }

        Map<String, Object> deleted = findDeletedByEmailRaw(email);
        if (deleted != null) {
            return reactivateUser(((Number) deleted.get("id")).longValue(), data, createdByUserId);
        }

        String password = strOrNull(data.get("password"));
        String passwordHash = password != null
                ? PasswordHasher.ensureHash(password)
                : PasswordHasher.generateRandomPasswordHash();
        String diretoria = blankToDefault(data.get("diretoria"), "SGJT");
        String status = blankToDefault(data.get("status"), "ACTIVE");
        String dominio = domainService.getDomainForDiretoria(diretoria).dominio();

        Map<String, Object> user;
        try {
            user = jdbc.queryForMap(
                    "INSERT INTO users (name, email, password_hash, role, status, diretoria, dominio, is_sso_user, " +
                            "situacao_funcional, nome_cc_fc, classe_cc_fc, cargo_efetivo, classe_efetivo, matricula) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                    strOrNull(data.get("name")), email, passwordHash, strOrNull(data.get("role")),
                    status, diretoria, dominio, password == null,
                    strOrNull(data.get("situacao_funcional")),
                    strOrNull(data.get("nome_cc_fc")), strOrNull(data.get("classe_cc_fc")),
                    strOrNull(data.get("cargo_efetivo")), strOrNull(data.get("classe_efetivo")),
                    strOrNull(data.get("matricula")));
        } catch (DuplicateKeyException dup) {
            Map<String, Object> existingDeleted = findDeletedByEmailRaw(email);
            if (existingDeleted != null) {
                return reactivateUser(((Number) existingDeleted.get("id")).longValue(), data, createdByUserId);
            }
            // Fallback p/ schema antigo (sem dominio/is_sso_user)
            user = jdbc.queryForMap(
                    "INSERT INTO users (name, email, password_hash, role, status, diretoria, " +
                            "situacao_funcional, nome_cc_fc, classe_cc_fc, cargo_efetivo, classe_efetivo, matricula) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                    strOrNull(data.get("name")), email, passwordHash, strOrNull(data.get("role")),
                    status, diretoria,
                    strOrNull(data.get("situacao_funcional")),
                    strOrNull(data.get("nome_cc_fc")), strOrNull(data.get("classe_cc_fc")),
                    strOrNull(data.get("cargo_efetivo")), strOrNull(data.get("classe_efetivo")),
                    strOrNull(data.get("matricula")));
        }

        long id = ((Number) user.get("id")).longValue();
        auditService.log("users", id, "INSERT", createdByUserId, null, null, hidePassword(user));
        syncToCadastrosPessoas(user);
        return toResponseDto(user);
    }

    @Transactional
    public Map<String, Object> reactivateUser(long id, Map<String, Object> data, long reactivatedByUserId) {
        String password = strOrNull(data.get("password"));
        String passwordHash = password != null
                ? PasswordHasher.ensureHash(password)
                : PasswordHasher.generateRandomPasswordHash();

        Map<String, Object> user = jdbc.queryForMap(
                "UPDATE users SET name = ?, password_hash = ?, role = ?, status = ?, diretoria = ?, " +
                        "is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = NOW() " +
                        "WHERE id = ? RETURNING *",
                strOrNull(data.get("name")), passwordHash, strOrNull(data.get("role")),
                blankToDefault(data.get("status"), "ACTIVE"), blankToDefault(data.get("diretoria"), "SGJT"), id);

        auditService.log("users", id, "RESTORE", reactivatedByUserId, null, null, hidePassword(user));
        syncToCadastrosPessoas(user);
        return toResponseDto(user);
    }

    @Transactional
    public Map<String, Object> updateUser(long id, Map<String, Object> data, long updatedByUserId) {
        Map<String, Object> existing = findOneRaw(id);
        if (existing == null) {
            return null;
        }

        String newEmail = data.containsKey("email") ? strOrNull(data.get("email")) : null;
        if (newEmail != null && !newEmail.equals(existing.get("email"))) {
            if (emailExists(newEmail, id)) {
                throw new ApiException(409, "Email já cadastrado");
            }
        }

        List<String> sets = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        if (data.containsKey("name")) {
            sets.add("name = ?");
            values.add(strOrNull(data.get("name")));
        }
        if (data.containsKey("email")) {
            sets.add("email = ?");
            values.add(strOrNull(data.get("email")));
        }
        Object pw = data.get("password");
        if (pw != null && !"".equals(pw)) {
            sets.add("password_hash = ?");
            values.add(PasswordHasher.ensureHash(String.valueOf(pw)));
        }
        if (data.containsKey("role")) {
            sets.add("role = ?");
            values.add(strOrNull(data.get("role")));
        }
        if (data.containsKey("status")) {
            sets.add("status = ?");
            values.add(strOrNull(data.get("status")));
        }
        if (data.containsKey("diretoria")) {
            String diretoria = strOrNull(data.get("diretoria"));
            String newDominio = domainService.getDomainForDiretoria(diretoria == null ? "SGJT" : diretoria).dominio();
            String currentDominio = strOrNull(existing.get("dominio"));
            
            if (currentDominio != null && !currentDominio.equals(newDominio)) {
                Map<String, Object> updater = findOneRaw(updatedByUserId);
                boolean isSuperadmin = updater != null && Boolean.TRUE.equals(updater.get("is_superadmin"));
                if (!isSuperadmin) {
                    throw new ApiException(400, "Não é permitido alterar a diretoria para uma de outro domínio.");
                }
            }

            sets.add("diretoria = ?");
            values.add(diretoria);
            sets.add("dominio = ?");
            values.add(newDominio);
        }
        
        String[] hrFields = {"situacao_funcional", "nome_cc_fc", "classe_cc_fc", "cargo_efetivo", "classe_efetivo", "matricula"};
        for (String field : hrFields) {
            if (data.containsKey(field)) {
                sets.add(field + " = ?");
                values.add(strOrNull(data.get(field)));
            }
        }

        if (sets.isEmpty()) {
            return toResponseDto(existing);
        }

        sets.add("updated_at = NOW()");
        values.add(id);

        var rows = jdbc.queryForList(
                "UPDATE users SET " + String.join(", ", sets) +
                        " WHERE id = ? AND is_deleted = FALSE RETURNING *",
                values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = rows.get(0);
        auditService.log("users", id, "UPDATE", updatedByUserId, null, hidePassword(existing), hidePassword(updated));
        syncToCadastrosPessoas(updated);
        return toResponseDto(updated);
    }

    @Transactional
    public Map<String, Object> updateOwnProfile(long userId, Map<String, Object> provided) {
        if (provided.isEmpty()) {
            return findUserById(userId);
        }
        List<String> sets = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (Map.Entry<String, Object> e : provided.entrySet()) {
            sets.add(e.getKey() + " = ?");
            values.add(e.getValue());
        }
        sets.add("updated_at = NOW()");
        values.add(userId);

        var rows = jdbc.queryForList(
                "UPDATE users SET " + String.join(", ", sets) +
                        " WHERE id = ? AND is_deleted = FALSE RETURNING *",
                values.toArray());
        return rows.isEmpty() ? null : toResponseDto(rows.get(0));
    }

    @Transactional
    public boolean deleteUser(long id, long deletedByUserId) {
        Map<String, Object> existing = findOneRaw(id);
        if (existing == null) {
            return false;
        }
        int affected = jdbc.update(
                "UPDATE users SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE",
                deletedByUserId, id);
        if (affected == 0) {
            return false;
        }
        auditService.log("users", id, "SOFT_DELETE", deletedByUserId, null, hidePassword(existing), null);
        return true;
    }

    // ---------- responses ----------

    public List<Map<String, Object>> findUserResponses(long userId) {
        List<Map<String, Object>> responses = jdbc.queryForList(
                "SELECT r.*, f.title as form_title, f.description as form_description " +
                        "FROM form_responses r JOIN forms f ON r.form_id = f.id " +
                        "WHERE r.user_id = ? AND r.is_deleted = FALSE ORDER BY r.created_at DESC",
                userId);

        List<Map<String, Object>> out = new ArrayList<>(responses.size());
        for (Map<String, Object> row : responses) {
            Object responseId = row.get("id");
            List<Map<String, Object>> answersRows = jdbc.queryForList(
                    "SELECT a.id, a.field_id, a.value FROM form_answers a " +
                            "WHERE a.response_id = ? AND a.is_deleted = FALSE",
                    responseId);
            List<Map<String, Object>> answers = new ArrayList<>(answersRows.size());
            for (Map<String, Object> ans : answersRows) {
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("id", String.valueOf(ans.get("id")));
                a.put("fieldId", String.valueOf(ans.get("field_id")));
                a.put("value", ans.get("value"));
                answers.add(a);
            }
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", String.valueOf(row.get("id")));
            r.put("formId", String.valueOf(row.get("form_id")));
            r.put("userId", String.valueOf(row.get("user_id")));
            r.put("status", row.get("status"));
            r.put("createdAt", row.get("created_at"));
            r.put("updatedAt", row.get("updated_at"));
            r.put("submittedAt", row.get("submitted_at"));
            r.put("formTitle", row.get("form_title"));
            r.put("formDescription", row.get("form_description"));
            r.put("answers", answers);
            out.add(r);
        }
        return out;
    }

    // ---------- sync cadastros_pessoas ----------

    public void syncToCadastrosPessoas(Map<String, Object> user) {
        try {
            String diretoria = blankToDefault(user.get("diretoria"), "SGJT");
            var areaRows = jdbc.queryForList(
                    "SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1", diretoria);
            if (areaRows.isEmpty()) {
                log.warn("[syncToCadastrosPessoas] Área não encontrada para sigla: {}", diretoria);
                return;
            }
            Object areaId = areaRows.get(0).get("id");
            String email = strOrNull(user.get("email"));
            Object userId = user.get("id");
            String name = strOrNull(user.get("name"));

            var existing = jdbc.queryForList(
                    "SELECT id, area_id FROM cadastros_pessoas WHERE email = ? AND ativo = TRUE", email);
            if (!existing.isEmpty()) {
                jdbc.update(
                        "UPDATE cadastros_pessoas SET nome = ?, area_id = ?, user_id = ?, " +
                                "updated_at = CURRENT_TIMESTAMP WHERE email = ? AND ativo = TRUE",
                        name, areaId, userId, email);
            } else {
                Integer nextOrdem = jdbc.queryForObject(
                        "SELECT COALESCE(MAX(ordem), -1) + 1 FROM cadastros_pessoas WHERE area_id = ? AND ativo = TRUE",
                        Integer.class, areaId);
                jdbc.update(
                        "INSERT INTO cadastros_pessoas (area_id, nome, email, user_id, ordem, ativo) " +
                                "VALUES (?, ?, ?, ?, ?, TRUE)",
                        areaId, name, email, userId, nextOrdem == null ? 0 : nextOrdem);
            }
        } catch (Exception e) {
            log.error("[syncToCadastrosPessoas] Erro: {}", e.getMessage());
        }
    }

    public void syncPessoaUserId(String email, long userId) {
        try {
            jdbc.update(
                    "UPDATE cadastros_pessoas SET user_id = ? WHERE LOWER(email) = LOWER(?) AND ativo = TRUE",
                    userId, email);
        } catch (Exception e) {
            log.error("[syncPessoaUserId] Erro ao sincronizar user_id: {}", e.getMessage());
        }
    }

    // ---------- helpers ----------

    private static String strOrNull(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String blankToDefault(Object v, String def) {
        if (v == null) {
            return def;
        }
        String s = String.valueOf(v);
        return s.isEmpty() ? def : s;
    }

    private static Map<String, Object> hidePassword(Map<String, Object> row) {
        Map<String, Object> copy = new LinkedHashMap<>(row);
        if (copy.containsKey("password_hash")) {
            copy.put("password_hash", "[HIDDEN]");
        }
        return copy;
    }
}
