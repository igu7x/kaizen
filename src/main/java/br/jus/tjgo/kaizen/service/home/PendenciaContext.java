package br.jus.tjgo.kaizen.service.home;

/**
 * Dados do usuário logado repassados a cada {@link PendenciaProvider}. Resolvidos uma única vez pela
 * {@code HomeService} e reutilizados por todos os provedores (evita reconsultar a tabela users).
 */
public record PendenciaContext(
        long userId,
        String email,
        /** {@code Validadores.isFinal(email)} — usuário faz parte da whitelist de validação final. */
        boolean isValidadorFinal,
        /** Sigla da diretoria do usuário (coluna users.diretoria). */
        String diretoria,
        boolean isSuperadmin
) {
}
