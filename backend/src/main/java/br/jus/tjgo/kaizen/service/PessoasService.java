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
            "SELECT p.id, p.area_id, p.unidade_id, p.nome_exibicao, p.usuario, p.linha_organograma, p.ordem, p.subordinacao_id, p.ativo, p.user_id, " +
                    "usr.name as nome, usr.email as email, usr.situacao_funcional as situacao, usr.nome_cc_fc as cc_fc, usr.classe_cc_fc as cc_fc_classe, " +
                    "usr.cargo_efetivo as cargo_efetivo, usr.classe_efetivo as cargo_efetivo_classe, usr.matricula as matricula, " +
                    "a.nome as area_nome, u.nome as unidade_nome FROM cadastros_pessoas p " +
                    "JOIN cadastros_areas a ON a.id = p.area_id " +
                    "LEFT JOIN cadastros_unidades u ON u.id = p.unidade_id " +
                    "LEFT JOIN users usr ON usr.id = p.user_id AND usr.is_deleted = FALSE ";

    private static final String JOIN_WITH_FOTO =
            "SELECT p.id, p.area_id, p.unidade_id, p.nome_exibicao, p.usuario, p.linha_organograma, p.ordem, p.subordinacao_id, p.ativo, p.user_id, " +
                    "usr.name as nome, usr.email as email, usr.situacao_funcional as situacao, usr.nome_cc_fc as cc_fc, usr.classe_cc_fc as cc_fc_classe, " +
                    "usr.cargo_efetivo as cargo_efetivo, usr.classe_efetivo as cargo_efetivo_classe, usr.matricula as matricula, " +
                    "a.nome as area_nome, u.nome as unidade_nome, usr.foto_perfil as foto_perfil " +
                    "FROM cadastros_pessoas p JOIN cadastros_areas a ON a.id = p.area_id " +
                    "LEFT JOIN cadastros_unidades u ON u.id = p.unidade_id " +
                    "LEFT JOIN users usr ON usr.id = p.user_id AND usr.is_deleted = FALSE ";

    public List<Map<String, Object>> getAll(String dominio) {
        if (dominio != null && !dominio.isBlank()) {
            return jdbc.queryForList(JOIN_AREA_UNIDADE +
                    "WHERE p.ativo = TRUE AND a.ativo = TRUE AND a.dominio = ? " +
                    "ORDER BY a.nome, p.ordem, usr.name", dominio);
        }
        return jdbc.queryForList(JOIN_AREA_UNIDADE +
                "WHERE p.ativo = TRUE AND a.ativo = TRUE ORDER BY a.nome, p.ordem, usr.name");
    }

    public List<Map<String, Object>> getByAreaId(long areaId) {
        return jdbc.queryForList(JOIN_WITH_FOTO +
                "WHERE p.area_id = ? AND p.ativo = TRUE ORDER BY p.ordem, usr.name", areaId);
    }

    public List<Map<String, Object>> getByUnidadeId(long unidadeId) {
        return jdbc.queryForList(JOIN_WITH_FOTO +
                "WHERE p.unidade_id = ? AND p.ativo = TRUE ORDER BY p.ordem, usr.name", unidadeId);
    }

    public Map<String, Object> getById(long id) {
        var rows = jdbc.queryForList(JOIN_AREA_UNIDADE + "WHERE p.id = ? AND p.ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> getPerfilCompleto(long id) {
        var rows = jdbc.queryForList(
                "SELECT p.id AS pessoa_id, p.user_id AS user_id, usr.name AS nome, p.nome_exibicao AS nome_exibicao, " +
                        "usr.email AS email, usr.situacao_funcional AS situacao, " +
                        "usr.nome_cc_fc AS cc_fc, usr.classe_cc_fc AS cc_fc_classe, " +
                        "usr.cargo_efetivo AS cargo_efetivo, usr.classe_efetivo AS cargo_efetivo_classe, " +
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
        Map<String, Object> p = jdbc.queryForMap(
                "INSERT INTO cadastros_pessoas (area_id, unidade_id, nome, nome_exibicao, usuario, email, situacao, " +
                        "cc_fc, cc_fc_classe, cargo_efetivo, cargo_efetivo_classe, linha_organograma, ordem, created_by, updated_by, user_id) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                areaId, orNull(dto.get("unidade_id")), str(dto.get("nome")), orNull(dto.get("nome_exibicao")),
                orNull(dto.get("usuario")), orNull(dto.get("email")), orNull(dto.get("situacao")),
                orNull(dto.get("cc_fc")), orNull(dto.get("cc_fc_classe")), orNull(dto.get("cargo_efetivo")),
                orNull(dto.get("cargo_efetivo_classe")), linha != null ? linha : 4,
                nextOrdem == null ? 0 : nextOrdem, userId, userId, orNull(dto.get("user_id")));
        
        if (dto.get("user_id") != null) {
            try {
                jdbc.update(
                    "UPDATE users SET situacao_funcional = ?, nome_cc_fc = ?, classe_cc_fc = ?, cargo_efetivo = ?, classe_efetivo = ?, name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?",
                    dto.get("situacao"), dto.get("cc_fc"), dto.get("cc_fc_classe"), dto.get("cargo_efetivo"), dto.get("cargo_efetivo_classe"), dto.get("nome"), dto.get("email"), dto.get("user_id")
                );
            } catch (Exception ignored) { }
        }
        return p;
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
        
        if (!rows.isEmpty()) {
            Map<String, Object> p = rows.get(0);
            if (p.get("user_id") != null) {
                try {
                    jdbc.update(
                        "UPDATE users SET situacao_funcional = ?, nome_cc_fc = ?, classe_cc_fc = ?, cargo_efetivo = ?, classe_efetivo = ?, name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?",
                        p.get("situacao"), p.get("cc_fc"), p.get("cc_fc_classe"), p.get("cargo_efetivo"), p.get("cargo_efetivo_classe"), p.get("nome"), p.get("email"), p.get("user_id")
                    );
                } catch (Exception ignored) { }
            }
            return p;
        }
        return null;
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
                long fetchedUserId = ((Number) userRows.get(0).get("id")).longValue();
                jdbc.update("UPDATE cadastros_pessoas SET user_id = ? WHERE id = ?",
                        fetchedUserId, pessoaId);
            }
        } catch (Exception ignored) {
            // não falha a criação
        }
    }

    public void resyncUserId(String email, long pessoaId) {
        try {
            var userRows = jdbc.queryForList("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", email);
            if (!userRows.isEmpty()) {
                long fetchedUserId = ((Number) userRows.get(0).get("id")).longValue();
                jdbc.update("UPDATE cadastros_pessoas SET user_id = ? WHERE id = ?",
                        fetchedUserId, pessoaId);
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
