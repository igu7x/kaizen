package br.jus.tjgo.kaizen.auth;

/**
 * Usuario autenticado carregado no SecurityContext.
 * Campos espelham as colunas de users usadas pela autorizacao do Node.
 */
public record AuthenticatedUser(
        Long id,
        String name,
        String email,
        String role,
        boolean isSuperadmin,
        String diretoria
) {
}
