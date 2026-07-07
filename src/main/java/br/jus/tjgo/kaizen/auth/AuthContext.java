package br.jus.tjgo.kaizen.auth;

import br.jus.tjgo.kaizen.exception.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Acesso ao usuario autenticado + helpers de autorizacao.
 *
 * DOIS helpers distintos de userId (Bug #1 da 1a tentativa — o mais caro):
 *  - requestUserId(): Categoria A (controllers permissivos), fallback userId = 1.
 *  - currentUserId(): Categoria B (controllers strict), lanca 401 se sem auth.
 * Consultar AUTH_AUDIT.md para a categoria de cada controller.
 */
public final class AuthContext {

    private AuthContext() {
    }

    public static Optional<AuthenticatedUser> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AuthenticatedUser u)) {
            return Optional.empty();
        }
        return Optional.of(u);
    }

    /** Categoria A — permissivo (fallback userId = 1, espelha req.userId || 1 do Node). */
    public static Long requestUserId() {
        return getCurrentUser().map(AuthenticatedUser::id).orElse(1L);
    }

    /** Categoria B — strict (lanca 401 se sem auth). */
    public static Long currentUserId() {
        return getCurrentUser()
                .map(AuthenticatedUser::id)
                .orElseThrow(() -> new ApiException(401, "Não autenticado"));
    }

    public static void requireRole(List<String> allowedRoles) {
        AuthenticatedUser u = getCurrentUser()
                .orElseThrow(() -> new ApiException(401, "Não autenticado"));
        if (!u.isSuperadmin() && !allowedRoles.contains(u.role())) {
            throw new ApiException(403, "Acesso negado: permissão insuficiente");
        }
    }

    /** Para KRs: MANAGER so pode atualizar o campo 'status'. */
    public static void requireKRUpdate(Map<String, Object> body) {
        AuthenticatedUser u = getCurrentUser()
                .orElseThrow(() -> new ApiException(401, "Não autenticado"));
        if ("ADMIN".equals(u.role())) {
            return;
        }
        if ("MANAGER".equals(u.role())) {
            if (body.size() == 1 && body.containsKey("status")) {
                return;
            }
            throw new ApiException(403, "Acesso negado: Gestores podem editar apenas o status dos KRs");
        }
        throw new ApiException(403, "Acesso negado: permissão insuficiente");
    }
}
