package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Permissão nomeada "Processos (Tecnologia da Informação)". Espelha PermissoesTapService,
 * porém o escopo é plano: quem está na lista pode editar/salvar os processos do grupo 'ti'
 * que estejam novos ou em revisão (o cruzamento com grupo/status é feito no
 * ProcessosNegocioController.podeEditarProcesso). Concedida via Cadastros.
 */
@Service
@RequiredArgsConstructor
public class PermissoesProcessosTiService {

    private final JdbcTemplate jdbc;

    private static final String SELECT_LISTA =
            "SELECT pp.user_id, u.name AS user_nome, u.email AS user_email, " +
            "       pp.granted_by, g.name AS granted_by_nome, pp.granted_at " +
            "  FROM permissoes_processos_ti pp " +
            "  JOIN users u ON u.id = pp.user_id " +
            "  LEFT JOIN users g ON g.id = pp.granted_by ";

    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(SELECT_LISTA + " ORDER BY u.name ASC");
    }

    /** Upsert idempotente. Retorna a linha criada/atualizada, ou null se o user não existir. */
    public Map<String, Object> conceder(long userId, long grantedBy) {
        Integer exists = jdbc.query(
                "SELECT 1 FROM users WHERE id = ?",
                ps -> ps.setLong(1, userId),
                rs -> rs.next() ? 1 : null);
        if (exists == null) return null;

        jdbc.update(
                "INSERT INTO permissoes_processos_ti (user_id, granted_by, granted_at, updated_at) " +
                "VALUES (?, ?, NOW(), NOW()) " +
                "ON CONFLICT (user_id) DO UPDATE " +
                "  SET granted_by = EXCLUDED.granted_by, updated_at = NOW()",
                userId, grantedBy);

        List<Map<String, Object>> rows = jdbc.queryForList(
                SELECT_LISTA + " WHERE pp.user_id = ?", userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean revogar(long userId) {
        return jdbc.update("DELETE FROM permissoes_processos_ti WHERE user_id = ?", userId) > 0;
    }

    public boolean temPermissao(long userId) {
        Integer found = jdbc.query(
                "SELECT 1 FROM permissoes_processos_ti WHERE user_id = ? LIMIT 1",
                ps -> ps.setLong(1, userId),
                rs -> rs.next() ? 1 : null);
        return found != null;
    }
}
