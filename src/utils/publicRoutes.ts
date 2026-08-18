/**
 * Rotas públicas do Kaizen — acessíveis sem login (SSO ou conta local).
 *
 * Uma rota listada aqui:
 *  - NÃO passa pelo ProtectedRoute em App.tsx (renderiza direto);
 *  - abre em "modo público" para visitantes anônimos: sem menu lateral e com o
 *    botão "Entrar" no header (ver Layout/Header);
 *  - o apiClient não redireciona para /login em um eventual 401 quando o usuário
 *    está numa rota pública (ver apiClient.handleAuthError).
 *
 * Para tornar outra página pública, basta adicionar o caminho aqui e remover o
 * ProtectedRoute correspondente em App.tsx.
 */
export const PUBLIC_ROUTES: string[] = ["/gestao-estrategica/pdtic"];

/** True se o caminho atual é uma rota pública (match exato ou sub-rota). */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (base) => pathname === base || pathname.startsWith(base + "/"),
  );
}
