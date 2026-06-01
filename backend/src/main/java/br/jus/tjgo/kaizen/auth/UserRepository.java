package br.jus.tjgo.kaizen.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Carrega o usuario autenticado. Filtra is_deleted = FALSE em ambos os caminhos
 * (paridade com Node: BaseService.findOne e userService.findByEmail filtram is_deleted = FALSE).
 * Nota dev: users.id = 1 esta soft-deleted no dev DB — usar outro userId em smoke tests (Bug #8).
 */
@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final JdbcTemplate jdbc;

    private static final String SELECT_AUTH =
            "SELECT id, name, email, role, is_superadmin, diretoria FROM users ";

    private static final RowMapper<AuthenticatedUser> MAPPER = (rs, rowNum) -> new AuthenticatedUser(
            rs.getLong("id"),
            rs.getString("name"),
            rs.getString("email"),
            rs.getString("role"),
            rs.getBoolean("is_superadmin"),
            rs.getString("diretoria")
    );

    public Optional<AuthenticatedUser> findAuthById(Long id) {
        return jdbc.query(
                SELECT_AUTH + "WHERE id = ? AND is_deleted = FALSE",
                MAPPER, id
        ).stream().findFirst();
    }

    public Optional<AuthenticatedUser> findAuthByEmail(String email) {
        return jdbc.query(
                SELECT_AUTH + "WHERE email = ? AND is_deleted = FALSE",
                MAPPER, email
        ).stream().findFirst();
    }
}
