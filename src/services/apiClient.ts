/**
 * Cliente HTTP centralizado para comunicação com API
 *
 * Funcionalidades:
 * - Interceptor de requisição para adicionar token JWT
 * - Interceptor de resposta para tratamento de erros
 * - Retry automático para erros de rede
 * - Tratamento de erros amigável
 */

import { toast } from "sonner";

// Detecta automaticamente a URL da API baseado no ambiente.
//
// Hierarquia de resolução (ordem de prioridade):
//   1. VITE_API_URL          — URL explícita (sobrescreve tudo)
//   2. VITE_APP_ENV          — 'staging' | 'production' | 'development'
//      + VITE_API_URL_STAGING    (fallback: https://painel-sgjt-stag-api.apps.ocp-prd.tjgo.jus.br)
//      + VITE_API_URL_PRODUCTION (fallback: https://kaizen-api.tjgo.jus.br)
//   3. Hostname detection    — fallback automático pelo domínio do browser
//
// Recomendação para builds no OpenShift:
//   staging:    VITE_APP_ENV=staging
//   produção:   VITE_APP_ENV=production
export const getApiBaseUrl = (): string => {
  // 1. URL explícita (prioridade máxima)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2. Controle explícito por VITE_APP_ENV (definido no build do OpenShift)
  const appEnvRaw = (import.meta.env.VITE_APP_ENV || "")
    .toString()
    .trim()
    .toLowerCase();
  if (appEnvRaw === "staging") {
    const url = (
      import.meta.env.VITE_API_URL_STAGING ||
      "https://painel-sgjt-stag-api2.apps.ocp-prd.tjgo.jus.br"
    )
      .toString()
      .trim();

    return url;
  }
  if (appEnvRaw === "production") {
    const url = (
      import.meta.env.VITE_API_URL_PRODUCTION ||
      "https://kaizen-api.tjgo.jus.br"
    )
      .toString()
      .trim();

    return url;
  }

  // 3. Detecção automática pelo hostname (fallback quando VITE_APP_ENV não está definido)
  const hostname = window.location.hostname;

  if (hostname.includes("stag") && hostname.includes("tjgo.jus.br")) {
    const url = (
      import.meta.env.VITE_API_URL_STAGING ||
      "https://painel-sgjt-stag-api2.apps.ocp-prd.tjgo.jus.br"
    )
      .toString()
      .trim();

    return url;
  }

  if (hostname.includes("tjgo.jus.br")) {
    const url = (
      import.meta.env.VITE_API_URL_PRODUCTION ||
      "https://kaizen-api.tjgo.jus.br"
    )
      .toString()
      .trim();

    return url;
  }

  return "http://localhost:8081";
};

export const API_BASE_URL = getApiBaseUrl();

// Tipos de erro customizados
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string = "Erro de conexão. Verifique sua internet.") {
    super(message);
    this.name = "NetworkError";
  }
}

export class AuthError extends Error {
  constructor(message: string = "Sessão expirada. Faça login novamente.") {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiClient {
  private baseURL: string;
  private maxRetries: number = 2;
  private retryDelay: number = 1000;

  private isPublicEndpoint(endpoint: string): boolean {
    return (
      endpoint === "/api/auth/sso/status" ||
      endpoint.startsWith("/api/auth/sso/status?") ||
      endpoint === "/api/auth/sso/login" ||
      endpoint.startsWith("/api/auth/sso/login?") ||
      endpoint === "/api/auth/local/login" ||
      endpoint === "/api/auth/login"
    );
  }

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Obtém o token JWT do localStorage
   */
  private getToken(): string | null {
    return localStorage.getItem("auth_token");
  }

  /**
   * Remove dados de autenticação e redireciona para login
   */
  private handleAuthError(): void {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");

    // Redirecionar para login se não estiver na página de login
    if (!window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
  }

  /**
   * Aguarda antes de retry
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Mapeia código de status HTTP para mensagem amigável
   */
  private getErrorMessage(status: number, serverMessage?: string): string {
    if (serverMessage) return serverMessage;

    switch (status) {
      case 400:
        return "Dados inválidos. Verifique as informações e tente novamente.";
      case 401:
        return "Sessão expirada. Faça login novamente.";
      case 403:
        return "Você não tem permissão para realizar esta ação.";
      case 404:
        return "Recurso não encontrado.";
      case 409:
        return "Conflito de dados. Este registro já existe.";
      case 422:
        return "Dados de entrada inválidos.";
      case 429:
        return "Muitas requisições. Aguarde um momento.";
      case 500:
        return "Erro interno do servidor. Tente novamente mais tarde.";
      case 502:
      case 503:
      case 504:
        return "Servidor temporariamente indisponível. Tente novamente.";
      default:
        return `Erro na requisição (${status})`;
    }
  }

  /**
   * Verifica se o erro é recuperável (pode fazer retry)
   */
  private isRetryableError(status: number): boolean {
    return status >= 500 || status === 429 || status === 0;
  }

  /**
   * Igual a {@link request}, mas devolve `null` quando o servidor responde com corpo VAZIO.
   *
   * Necessário porque `request()` converte corpo vazio em `{}` — e `{}` é *truthy*. Handlers
   * Spring que retornam `Map<String,Object>` = null (ex.: "esse usuário ainda não preencheu o
   * formulário") não escrevem corpo algum ("Nothing to write: null body"), então o front recebia
   * um objeto vazio e concluía que o recurso EXISTIA. Sintoma clássico: telas de "já enviado"
   * aparecendo para quem nunca enviou, com "Invalid Date" no lugar da data.
   *
   * Use em todo endpoint cujo contrato seja `T | null`.
   */
  async requestNullable<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T | null> {
    const r = await this.request<T | Record<string, never>>(endpoint, options);
    if (r == null) {
      return null;
    }
    return Object.keys(r).length === 0 ? null : (r as T);
  }

  /**
   * Executa requisição HTTP com retry automático
   */
  async request<T>(
    endpoint: string,
    options?: RequestInit,
    retryCount: number = 0,
  ): Promise<T> {
    let finalEndpoint = endpoint;

    // Dev mode: injetar dominio override em chamadas /api/areas que não têm dominio
    const devEnv = localStorage.getItem("devEnvironment");
    if (devEnv && devEnv !== "null") {
      const parsed = JSON.parse(devEnv);
      if (parsed && typeof parsed === "string") {
        // Adicionar ?dominio= em chamadas /api/areas, /api/pessoas, /api/users que não têm o param
        if (
          (finalEndpoint.startsWith("/api/areas") ||
            finalEndpoint.startsWith("/api/pessoas") ||
            finalEndpoint.startsWith("/api/users")) &&
          !finalEndpoint.includes("dominio=")
        ) {
          const separator = finalEndpoint.includes("?") ? "&" : "?";
          finalEndpoint += `${separator}dominio=${encodeURIComponent(parsed)}`;
        }
      }
    }

    const url = `${this.baseURL}${finalEndpoint}`;

    // Configurar headers
    // Não adicionar Content-Type se body for FormData (browser adiciona automaticamente com boundary)
    const isFormData = options?.body instanceof FormData;
    const headers: HeadersInit = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    };

    // Adicionar token JWT se disponível (exceto endpoints públicos)
    const token = this.getToken();
    if (token && !this.isPublicEndpoint(endpoint)) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      cache: "no-store", // Previne cache agressivo do navegador em requisições GET
      headers,
      credentials: "include",
    };

    try {
      if (options?.method && options.method !== "GET") {
      }
      const response = await fetch(url, config);
      if (options?.method && options.method !== "GET") {
      }

      // Tratar erros de autenticação (não aplicar em endpoints públicos)
      if (response.status === 401) {
        if (!this.isPublicEndpoint(endpoint)) {
          this.handleAuthError();
          throw new AuthError();
        }
        // Se for endpoint público (login), deixa passar para o tratamento de erro padrão
        // para capturar a mensagem "Credenciais inválidas" do backend
      }

      // Se erro HTTP
      if (!response.ok) {
        let errorMessage = this.getErrorMessage(response.status);
        let errorCode: string | undefined;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorCode = errorData.code;
        } catch {
          /* erro já tratado pelo apiClient ou ignorado intencionalmente */
        }

        // Tentar retry para erros recuperáveis
        if (
          this.isRetryableError(response.status) &&
          retryCount < this.maxRetries
        ) {
          await this.delay(this.retryDelay * (retryCount + 1));
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        // O errorHeader vem URI encoded (pelo Flash.java), mas o errorMessage vem do JSON (não codificado)
        let errorHeader = response.headers.get("x-flash-error");
        let finalErrorMessage = "";
        if (errorHeader) {
          try {
            finalErrorMessage = decodeURIComponent(errorHeader);
          } catch (e) {
            finalErrorMessage = errorHeader;
          }
        } else {
          finalErrorMessage =
            typeof errorMessage === "string"
              ? errorMessage
              : JSON.stringify(errorMessage);
        }

        const isSilentError = options?.headers && "x-silent-error" in (options.headers as any);
        
        // Dispara toast global de erro apenas se não for silencioso
        if (!isSilentError) {
          toast.error(finalErrorMessage);
        }

        throw new ApiError(finalErrorMessage, response.status, errorCode);
      }

      // Tratamento de Flash Notices (Sucesso e Aviso) vindos do backend
      let successHeader = response.headers.get("x-flash-success");
      let noticeHeader = response.headers.get("x-flash-notice");

      if (successHeader) {
        let msg = successHeader;
        try {
          msg = decodeURIComponent(successHeader);
        } catch (e) {
          /* erro já tratado pelo apiClient ou ignorado intencionalmente */
        }
        toast.success(msg);
      } else if (noticeHeader) {
        let msg = noticeHeader;
        try {
          msg = decodeURIComponent(noticeHeader);
        } catch (e) {
          /* erro já tratado pelo apiClient ou ignorado intencionalmente */
        }
        toast.info(msg);
      }

      // Se 204 No Content, retornar objeto vazio
      if (response.status === 204) {
        return {} as T;
      }

      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      // Tratar erro de rede
      if (error instanceof TypeError && error.message.includes("fetch")) {
        if (retryCount < this.maxRetries) {
          await this.delay(this.retryDelay * (retryCount + 1));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        toast.error(
          "Não foi possível conectar ao servidor. Verifique sua conexão.",
        );
        throw new NetworkError();
      }

      // Re-throw erros conhecidos
      if (
        error instanceof ApiError ||
        error instanceof AuthError ||
        error instanceof NetworkError
      ) {
        throw error;
      }

      // Erro desconhecido

      toast.error(
        error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      );
      throw error;
    }
  }

  /**
   * GET request
   */
  get<T>(
    endpoint: string,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "GET",
      headers: options?.headers,
    });
  }

  /**
   * POST request
   */
  post<T>(
    endpoint: string,
    data?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body:
        data instanceof FormData
          ? data
          : data
            ? JSON.stringify(data)
            : undefined,
      headers: options?.headers,
    });
  }

  /**
   * PUT request
   */
  put<T>(
    endpoint: string,
    data?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body:
        data instanceof FormData
          ? data
          : data
            ? JSON.stringify(data)
            : undefined,
      headers: options?.headers,
    });
  }

  /**
   * PATCH request
   */
  patch<T>(
    endpoint: string,
    data?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
      headers: options?.headers,
    });
  }

  /**
   * DELETE request
   */
  delete<T>(
    endpoint: string,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      headers: options?.headers,
    });
  }
}

// Exportar instância singleton
export const apiClient = new ApiClient();

// Exportar funções helper para compatibilidade
export const get = <T>(url: string): Promise<T> => apiClient.get<T>(url);
export const post = <T>(url: string, data?: unknown): Promise<T> =>
  apiClient.post<T>(url, data);
export const put = <T>(url: string, data?: unknown): Promise<T> =>
  apiClient.put<T>(url, data);
export const del = <T>(url: string): Promise<T> => apiClient.delete<T>(url);
