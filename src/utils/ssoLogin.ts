import { API_BASE_URL } from "@/services/apiClient";

/**
 * Redireciona o navegador para o início do fluxo de login SSO (Keycloak).
 * O backend (GET /api/auth/sso/login) responde 302 para o Keycloak e, após o
 * callback, o usuário volta para `returnUrl`.
 *
 * @param returnUrl destino após o login. Default: a página atual (útil no botão
 *                  "Entrar" das páginas públicas, para voltar exatamente a ela).
 */
export function redirectToSsoLogin(returnUrl?: string): void {
  const alvo = returnUrl || window.location.pathname + window.location.search;
  window.location.assign(
    `${API_BASE_URL}/api/auth/sso/login?returnUrl=${encodeURIComponent(alvo)}`,
  );
}
