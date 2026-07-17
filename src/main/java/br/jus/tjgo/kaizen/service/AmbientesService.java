package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.util.PasswordHasher;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** Porte fiel de ambientes.service.ts. */
@Service
@RequiredArgsConstructor
public class AmbientesService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;

    private static final String SELECT_WITH_STATS =
            "SELECT a.*, COALESCE(areas.total, 0)::int AS total_areas, " +
                    "COALESCE(users_count.total, 0)::int AS total_users FROM ambientes a " +
                    "LEFT JOIN (SELECT dominio, COUNT(*)::int AS total FROM cadastros_areas " +
                    "WHERE COALESCE(ativo, TRUE) = TRUE AND sigla IS NOT NULL GROUP BY dominio) areas " +
                    "ON areas.dominio = a.codigo " +
                    "LEFT JOIN (SELECT dominio, COUNT(*)::int AS total FROM users " +
                    "WHERE is_deleted = FALSE GROUP BY dominio) users_count ON users_count.dominio = a.codigo ";

    public List<Map<String, Object>> getAll() {
        return jdbc.queryForList(SELECT_WITH_STATS + "WHERE a.ativo = TRUE ORDER BY a.nome");
    }

    public Map<String, Object> getById(long id) {
        var rows = jdbc.queryForList(SELECT_WITH_STATS + "WHERE a.id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> dto, long userId) {
        String nome = str(dto.get("nome"));
        String codigo = str(dto.get("codigo"));
        String descricao = str(dto.get("descricao"));
        String siglaRaiz = str(dto.get("sigla_raiz"));
        String nomeRaiz = str(dto.get("nome_raiz"));

        Map<String, Object> ambiente = jdbc.queryForMap(
                "INSERT INTO ambientes (nome, codigo, descricao, diretoria_raiz, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
                nome, codigo, descricao, siglaRaiz, userId, userId);

        var existingArea = jdbc.queryForList("SELECT id FROM cadastros_areas WHERE sigla = ?", siglaRaiz);
        if (!existingArea.isEmpty()) {
            jdbc.update(
                    "UPDATE cadastros_areas SET dominio = ?, is_domain_root = TRUE, updated_at = NOW(), updated_by = ? " +
                            "WHERE sigla = ?",
                    codigo, userId, siglaRaiz);
        } else {
            jdbc.update(
                    "INSERT INTO cadastros_areas (nome, sigla, dominio, is_domain_root, ativo, created_by, updated_by) " +
                            "VALUES (?, ?, ?, TRUE, TRUE, ?, ?)",
                    nomeRaiz, siglaRaiz, codigo, userId, userId);
        }


        List<String> abas = jdbc.queryForList("SELECT DISTINCT aba_codigo FROM permissoes_diretoria", String.class);
        for (String aba : abas) {
            jdbc.update(
                    "INSERT INTO permissoes_diretoria (diretoria, aba_codigo, pode_acessar, apenas_propria_diretoria, cadastros_areas_id) " +
                            "VALUES (?, ?, TRUE, FALSE, (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1)) ON CONFLICT (diretoria, aba_codigo) DO NOTHING",
                    siglaRaiz, aba, siglaRaiz);
        }

        jdbc.update("UPDATE users SET dominio = ? WHERE diretoria = ?", codigo, siglaRaiz);

        domainService.invalidateCache();
        return ambiente;
    }

    public Map<String, Object> update(long id, Map<String, Object> dto, long userId) {
        java.util.List<String> fields = new java.util.ArrayList<>();
        java.util.List<Object> values = new java.util.ArrayList<>();
        if (dto.containsKey("nome")) {
            fields.add("nome = ?");
            values.add(str(dto.get("nome")));
        }
        if (dto.containsKey("descricao")) {
            fields.add("descricao = ?");
            values.add(str(dto.get("descricao")));
        }
        if (fields.isEmpty()) {
            return getById(id);
        }
        fields.add("updated_at = NOW()");
        fields.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        var rows = jdbc.queryForList(
                "UPDATE ambientes SET " + String.join(", ", fields) + " WHERE id = ? RETURNING *",
                values.toArray());
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean delete(long id, long userId) {
        return jdbc.update(
                "UPDATE ambientes SET ativo = FALSE, updated_at = NOW(), updated_by = ? WHERE id = ? AND ativo = TRUE",
                userId, id) > 0;
    }

    public List<Map<String, Object>> getAdmins(String codigo) {
        String diretoriaRaiz = diretoriaRaizOrThrow(codigo);
        return jdbc.queryForList(
                "SELECT id, name, email, role, diretoria, is_superadmin FROM users " +
                        "WHERE diretoria = ? AND is_superadmin = TRUE AND is_deleted = FALSE",
                diretoriaRaiz);
    }

    public Map<String, Object> addAdmin(String codigo, Map<String, Object> data, long createdBy) {
        String diretoriaRaiz = diretoriaRaizOrThrow(codigo);
        String email = str(data.get("email"));
        if (email != null) email = email.trim();
        if (email == null || email.isBlank()) {
            throw new ApiException(400, "Campos obrigatórios: email");
        }

        var existingUser = jdbc.queryForList("SELECT id, is_deleted, status FROM users WHERE email = ?", email);
        if (existingUser.isEmpty()) {
            throw new ApiException(404, "Usuário não encontrado. O e-mail deve estar previamente cadastrado.");
        }
        Map<String, Object> user = existingUser.get(0);
        if (Boolean.TRUE.equals(user.get("is_deleted")) || !"ACTIVE".equals(user.get("status"))) {
            throw new ApiException(400, "Usuário inativo ou excluído. Não é possível conceder permissões.");
        }
        
        return jdbc.queryForMap(
                "UPDATE users SET diretoria = ?, role = 'ADMIN', is_superadmin = TRUE, dominio = ?, " +
                        "updated_at = NOW() " +
                        "WHERE email = ? RETURNING id, name, email, role, diretoria, is_superadmin",
                diretoriaRaiz, codigo, email);
    }

    public boolean removeAdmin(String codigo, long userId) {
        diretoriaRaizOrThrow(codigo);
        return jdbc.update(
                "UPDATE users SET is_superadmin = FALSE, updated_at = NOW() WHERE id = ? AND is_deleted = FALSE",
                userId) > 0;
    }

    private String diretoriaRaizOrThrow(String codigo) {
        var rows = jdbc.queryForList(
                "SELECT diretoria_raiz FROM ambientes WHERE codigo = ? AND ativo = TRUE", codigo);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ambiente não encontrado");
        }
        return (String) rows.get(0).get("diretoria_raiz");
    }

    public String getEmailById(long userId) {
        var rows = jdbc.queryForList("SELECT email FROM users WHERE id = ?", userId);
        return rows.isEmpty() ? null : (String) rows.get(0).get("email");
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
