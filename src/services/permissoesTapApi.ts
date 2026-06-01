import { apiClient } from './apiClient';

export interface PermissaoTap {
  user_id: number;
  user_nome: string;
  user_email: string | null;
  user_diretoria: string | null;
  granted_by: number | null;
  granted_by_nome: string | null;
  granted_at: string;
}

export interface MinhaPermissaoTap {
  temPermissao: boolean;
  diretoria: string | null;
}

export const permissoesTapApi = {
  listar: (): Promise<PermissaoTap[]> => apiClient.get<PermissaoTap[]>('/api/permissoes-tap'),

  conceder: (userId: number): Promise<PermissaoTap> =>
    apiClient.post<PermissaoTap>('/api/permissoes-tap', { user_id: userId }),

  revogar: (userId: number): Promise<void> =>
    apiClient.delete<void>(`/api/permissoes-tap/${userId}`),

  minha: (): Promise<MinhaPermissaoTap> => apiClient.get<MinhaPermissaoTap>('/api/permissoes-tap/me'),

  podeEditarProjeto: (projetoId: number): Promise<{ podeEditar: boolean }> =>
    apiClient.get<{ podeEditar: boolean }>(`/api/permissoes-tap/projeto/${projetoId}`),
};
