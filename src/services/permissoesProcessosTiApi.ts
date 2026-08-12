import { apiClient } from "./apiClient";

/** Permissão para editar processos do Escritório de Processos — grupo Tecnologia da Informação. */
export interface PermissaoProcessosTi {
  user_id: number;
  user_nome: string;
  user_email: string | null;
  granted_by: number | null;
  granted_by_nome: string | null;
  granted_at: string;
}

export interface MinhaPermissaoProcessosTi {
  temPermissao: boolean;
}

export const permissoesProcessosTiApi = {
  listar: (): Promise<PermissaoProcessosTi[]> =>
    apiClient.get<PermissaoProcessosTi[]>("/api/permissoes-processos-ti"),

  conceder: (userId: number): Promise<PermissaoProcessosTi> =>
    apiClient.post<PermissaoProcessosTi>("/api/permissoes-processos-ti", {
      user_id: userId,
    }),

  revogar: (userId: number): Promise<void> =>
    apiClient.delete<void>(`/api/permissoes-processos-ti/${userId}`),

  minha: (): Promise<MinhaPermissaoProcessosTi> =>
    apiClient.get<MinhaPermissaoProcessosTi>("/api/permissoes-processos-ti/me"),
};
