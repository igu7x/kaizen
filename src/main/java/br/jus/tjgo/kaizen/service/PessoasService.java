package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Porte fiel de pessoas.service.ts. userId é nullable (sem fallback) — pessoas não retorna 401. */
@Service
@RequiredArgsConstructor
public class PessoasService {

    private final JdbcTemplate jdbc;

    private static final String JOIN_AREA_UNIDADE =
            "SELECT p.*, a.nome as area_nome, u.nome as unidade_nome FROM cadastros_pessoas p " +
                    "JOIN cadastros_areas a ON a.id = p.area_id " +
                    "LEFT JOIN cadastros_unidades u ON u.id = p.unidade_id ";

    private static final String JOIN_WITH_FOTO =
            "SELECT p.*, a.nome as area_nome, u.nome as unidade_nome, usr.foto_perfil as foto_perfil " +
                    "FROM cadastros_pessoas p JOIN cadastros_areas a ON a.id = p.area_id " +
                    "LEFT JOIN cadastros_unidades u ON u.id = p.unidade_id " +
                    "LEFT JOIN users usr ON usr.id = p.user_id AND usr.is_deleted = FALSE " +
                    "AND (p.email IS NULL OR p.email = '' OR LOWER(TRIM(usr.email)) = LOWER(TRIM(p.email))) ";

    public List<Map<String, Object>> getAll(String dominio) {
        if (dominio != null && !dominio.isBlank()) {
            return jdbc.queryForList(JOIN_AREA_UNIDADE +
                    "WHERE p.ativo = TRUE AND a.ativo = TRUE AND a.dominio = ? " +
                    "ORDER BY a.nome, p.ordem, p.nome", dominio);
        }
        return jdbc.queryForList(JOIN_AREA_UNIDADE +
                "WHERE p.ativo = TRUE AND a.ativo = TRUE ORDER BY a.nome, p.ordem, p.nome");
    }

    public List<Map<String, Object>> getByAreaId(long areaId) {
        return jdbc.queryForList(JOIN_WITH_FOTO +
                "WHERE p.area_id = ? AND p.ativo = TRUE ORDER BY p.ordem, p.nome", areaId);
    }

    public List<Map<String, Object>> getByUnidadeId(long unidadeId) {
        return jdbc.queryForList(JOIN_WITH_FOTO +
                "WHERE p.unidade_id = ? AND p.ativo = TRUE ORDER BY p.ordem, p.nome", unidadeId);
    }

    public Map<String, Object> getById(long id) {
        var rows = jdbc.queryForList(JOIN_AREA_UNIDADE + "WHERE p.id = ? AND p.ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> getPerfilCompleto(long id) {
        var rows = jdbc.queryForList(
                "SELECT p.id AS pessoa_id, p.user_id AS user_id, p.nome AS nome, p.nome_exibicao AS nome_exibicao, " +
                        "p.email AS email, p.situacao AS situacao, p.cc_fc AS cc_fc, p.cc_fc_classe AS cc_fc_classe, " +
                        "p.cargo_efetivo AS cargo_efetivo, p.cargo_efetivo_classe AS cargo_efetivo_classe, " +
                        "a.nome AS area_nome, a.sigla AS area_sigla, u.nome AS unidade_nome, " +
                        "usr.name AS user_name, usr.email AS user_email, usr.matricula AS matricula, " +
                        "usr.cargo_funcao AS cargo_funcao, usr.foto_perfil AS foto_perfil, usr.role AS user_role, " +
                        "usr.diretoria AS user_diretoria " +
                        "FROM cadastros_pessoas p JOIN cadastros_areas a ON a.id = p.area_id " +
                        "LEFT JOIN cadastros_unidades u ON u.id = p.unidade_id " +
                        "LEFT JOIN users usr ON usr.id = p.user_id AND usr.is_deleted = FALSE " +
                        "AND (p.email IS NULL OR p.email = '' OR LOWER(TRIM(usr.email)) = LOWER(TRIM(p.email))) " +
                        "WHERE p.id = ? AND p.ativo = TRUE",
                id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> create(Map<String, Object> dto, Long userId) {
        Object areaId = dto.get("area_id");
        Integer nextOrdem = jdbc.queryForObject(
                "SELECT COALESCE(MAX(ordem), -1) + 1 FROM cadastros_pessoas WHERE area_id = ? AND ativo = TRUE",
                Integer.class, areaId);
        Object linha = dto.get("linha_organograma");
        return jdbc.queryForMap(
                "INSERT INTO cadastros_pessoas (area_id, unidade_id, nome, nome_exibicao, usuario, email, situacao, " +
                        "cc_fc, cc_fc_classe, cargo_efetivo, cargo_efetivo_classe, linha_organograma, ordem, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                areaId, orNull(dto.get("unidade_id")), str(dto.get("nome")), orNull(dto.get("nome_exibicao")),
                orNull(dto.get("usuario")), orNull(dto.get("email")), orNull(dto.get("situacao")),
                orNull(dto.get("cc_fc")), orNull(dto.get("cc_fc_classe")), orNull(dto.get("cargo_efetivo")),
                orNull(dto.get("cargo_efetivo_classe")), linha != null ? linha : 4,
                nextOrdem == null ? 0 : nextOrdem, userId);
    }

    public Map<String, Object> update(long id, Map<String, Object> dto, Long userId) {
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        addIfPresent(dto, "nome", updates, values, false);
        addIfPresent(dto, "nome_exibicao", updates, values, true);
        addIfPresent(dto, "unidade_id", updates, values, false);
        addIfPresent(dto, "usuario", updates, values, true);
        addIfPresent(dto, "email", updates, values, true);
        addIfPresent(dto, "situacao", updates, values, true);
        addIfPresent(dto, "cc_fc", updates, values, true);
        addIfPresent(dto, "cc_fc_classe", updates, values, true);
        addIfPresent(dto, "cargo_efetivo", updates, values, true);
        addIfPresent(dto, "cargo_efetivo_classe", updates, values, true);
        addIfPresent(dto, "linha_organograma", updates, values, false);
        addIfPresent(dto, "subordinacao_id", updates, values, false);

        updates.add("updated_at = CURRENT_TIMESTAMP");
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);

        var rows = jdbc.queryForList(
                "UPDATE cadastros_pessoas SET " + String.join(", ", updates) +
                        " WHERE id = ? AND ativo = TRUE RETURNING *",
                values.toArray());
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean delete(long id, Long userId) {
        return jdbc.update(
                "UPDATE cadastros_pessoas SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE",
                userId, id) > 0;
    }

    // ---- sync users (POST/PUT) ----

    public void syncCreateUser(String email, String nome, Object areaId, long pessoaId) {
        try {
            var areaRows = jdbc.queryForList("SELECT sigla FROM cadastros_areas WHERE id = ?", areaId);
            String diretoriaSigla = (!areaRows.isEmpty() && areaRows.get(0).get("sigla") != null)
                    ? String.valueOf(areaRows.get(0).get("sigla")) : "SGJT";
            String emailLower = email.trim().toLowerCase();
            jdbc.update(
                    "INSERT INTO users (name, email, password_hash, role, status, diretoria, dominio, is_sso_user) " +
                            "VALUES (?, ?, md5(random()::text), 'VIEWER', 'INACTIVE', ?, 'SGJT', TRUE) " +
                            "ON CONFLICT (email) DO NOTHING",
                    nome.trim(), emailLower, diretoriaSigla);
            var userRows = jdbc.queryForList("SELECT id FROM users WHERE email = ?", emailLower);
            if (!userRows.isEmpty()) {
                jdbc.update("UPDATE cadastros_pessoas SET user_id = ? WHERE id = ?",
                        userRows.get(0).get("id"), pessoaId);
            }
        } catch (Exception ignored) {
            // não falha a criação
        }
    }

    public void resyncUserId(String email, long pessoaId) {
        try {
            var userRows = jdbc.queryForList("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", email);
            if (!userRows.isEmpty()) {
                jdbc.update("UPDATE cadastros_pessoas SET user_id = ? WHERE id = ?",
                        userRows.get(0).get("id"), pessoaId);
            }
        } catch (Exception ignored) {
            // best effort
        }
    }

    private void addIfPresent(Map<String, Object> dto, String key, List<String> updates, List<Object> values, boolean blankToNull) {
        if (dto.containsKey(key)) {
            updates.add(key + " = ?");
            Object v = dto.get(key);
            values.add(blankToNull ? orNull(v) : v);
        }
    }

    private static Object orNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof String s) {
            return s.isEmpty() ? null : s;
        }
        return v;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
