package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de api/src/services/permissoes-tap.service.ts (Node) → Java.
 *
 * Regra da feature "Permissões do TAP":
 * - Um ADMIN concede a um usuário a permissão de editar os 13 campos do TAP em
 *   projetos cuja "Diretoria de Governança" (cadastros_areas vinculadas via
 *   cadastros_projetos.areas_vinculadas_ids) inclua a sigla de users.diretoria.
 * - NÃO usar cadastros_projetos.diretoria — esse campo guarda a diretoria de
 *   origem (do criador) e não reflete a governança atual.
 *
 * Coluna em users é "name" (NÃO "nome") — bug já pego no Node em 2026-06-01.
 */
@Service
@RequiredArgsConstructor
public class PermissoesTapService {

    private final JdbcTemplate jdbc;

    private static final String SELECT_BASE =
        "SELECT pt.user_id, " +
        "       u.name      AS user_nome, " +
        "       u.email     AS user_email, " +
        "       u.diretoria AS user_diretoria, " +
        "       pt.granted_by, " +
        "       g.name      AS granted_by_nome, " +
        "       pt.granted_at " +
        "  FROM permissoes_tap pt " +
        "  JOIN users u ON u.id = pt.user_id " +
        "  LEFT JOIN users g ON g.id = pt.granted_by ";

    /** Lista todas as permissões TAP ativas. */
    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(SELECT_BASE + "ORDER BY u.name ASC");
    }

    /**
     * Concede permissão TAP a um usuário (idempotente — upsert).
     * Retorna a linha resultante ou {@code null} se o user não existir.
     */
    public Map<String, Object> conceder(long userId, long grantedBy) {
        Integer exists = jdbc.query(
            "SELECT 1 FROM users WHERE id = ?",
            ps -> ps.setLong(1, userId),
            rs -> rs.next() ? 1 : null
        );
        if (exists == null) return null;

        jdbc.update(
            "INSERT INTO permissoes_tap (user_id, granted_by, granted_at, updated_at) " +
            "VALUES (?, ?, NOW(), NOW()) " +
            "ON CONFLICT (user_id) DO UPDATE " +
            "  SET granted_by = EXCLUDED.granted_by, updated_at = NOW()",
            userId, grantedBy
        );

        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_BASE + "WHERE pt.user_id = ?", userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Revoga a permissão TAP de um usuário. Retorna true se removeu alguma linha. */
    public boolean revogar(long userId) {
        int deleted = jdbc.update("DELETE FROM permissoes_tap WHERE user_id = ?", userId);
        return deleted > 0;
    }

    /** TRUE se o usuário tem permissão TAP ativa. */
    public boolean temPermissao(long userId) {
        Integer found = jdbc.query(
            "SELECT 1 FROM permissoes_tap WHERE user_id = ? LIMIT 1",
            ps -> ps.setLong(1, userId),
            rs -> rs.next() ? 1 : null
        );
        return found != null;
    }

    /**
     * Verifica se o usuário pode editar os 13 campos do TAP do projeto:
     * tem permissão TAP ativa E a sigla de users.diretoria está entre as
     * cadastros_areas cujos ids estão em cadastros_projetos.areas_vinculadas_ids.
     */
    public boolean podeEditarTapDoProjeto(long userId, long projetoId) {
        Integer found = jdbc.query(
            "SELECT 1 " +
            "  FROM permissoes_tap pt " +
            "  JOIN users u             ON u.id = pt.user_id " +
            "  JOIN cadastros_projetos p ON p.id = ? " +
            " WHERE pt.user_id = ? " +
            "   AND u.diretoria IS NOT NULL " +
            "   AND EXISTS ( " +
            "     SELECT 1 FROM cadastros_areas ca " +
            "      WHERE ca.id = ANY(COALESCE(p.areas_vinculadas_ids, ARRAY[]::int[])) " +
            "        AND LOWER(TRIM(ca.sigla)) = LOWER(TRIM(u.diretoria)) " +
            "   ) " +
            " LIMIT 1",
            ps -> { ps.setLong(1, projetoId); ps.setLong(2, userId); },
            rs -> rs.next() ? 1 : null
        );
        return found != null;
    }

    /** Diretoria (sigla) do usuário; null se o user não existe ou não tem diretoria. */
    public String getDiretoriaUsuario(long userId) {
        try {
            return jdbc.queryForObject(
                "SELECT diretoria FROM users WHERE id = ?",
                String.class,
                userId
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }
}
