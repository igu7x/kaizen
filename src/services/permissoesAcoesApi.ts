import { apiClient } from "./apiClient";

export interface TagAcao {
    id: string;
    name: string;
}

export interface PermissaoAcaoList {
    id: number;
    tagId: string;
    tagNome: string;
    areaId: number;
    areaNome: string;
    unidadeId: number | null;
    unidadeNome: string | null;
    userId: number | null;
    userNome: string | null;
}

export interface CreatePermissaoAcaoReq {
    tagAcoesId: string;
    areaId: number;
    unidadeId?: number | null;
    userId?: number | null;
}

export const permissoesAcoesApi = {
    listarTodas: async (): Promise<PermissaoAcaoList[]> => {
        const response = await apiClient.get<PermissaoAcaoList[]>('/api/permissoes-acoes');
        return response;
    },

    listarTags: async (): Promise<TagAcao[]> => {
        const response = await apiClient.get<TagAcao[]>('/api/permissoes-acoes/tags');
        return response;
    },

    adicionar: async (data: CreatePermissaoAcaoReq): Promise<void> => {
        await apiClient.post('/api/permissoes-acoes', data);
    },

    remover: async (id: number): Promise<void> => {
        await apiClient.delete(`/api/permissoes-acoes/${id}`);
    },

    atualizarTag: async (id: string, name: string): Promise<void> => {
        await apiClient.put(`/api/permissoes-acoes/tags/${id}`, { id, name });
    }
};
