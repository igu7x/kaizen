import { apiClient } from './apiClient';
import Storage from '@/utils/storage';
import { User } from '../types';
import {
  PcaRenovacao,
  CreateRenovacaoDto,
  UpdateRenovacaoDto,
  RenovacaoStats,
  RenovacaoResumo,
  RenovacaoFilters,
  RenovacaoAllDetails,
  RenovacaoDetails,
  RenovacaoChecklistItem,
  RenovacaoPontoControle,
  RenovacaoPontoControleComTarefas,
  RenovacaoTarefa,
  ChecklistStatus,
  SaveRenovacaoChangesRequest,
} from '../types';

/**
 * Helper para obter headers com informações do usuário
 */
function getUserHeaders(): Record<string, string> {
  const user = Storage.load<User | null>('user', null);
  if (user) {
    return {
      'x-user-id': String(user.id),
      'x-user-role': user.role
    };
  }
  return {};
}

// ============================================================
// API DE RENOVAÇÕES (Lista)
// ============================================================

export const renovacoesApi = {
  // Listar todas as renovações
  getAll: async (): Promise<PcaRenovacao[]> => {
    return await apiClient.get<PcaRenovacao[]>('/api/pca-renovacoes', {
      headers: getUserHeaders()
    });
  },

  // Buscar renovação por ID
  getById: async (id: number): Promise<PcaRenovacao> => {
    return await apiClient.get<PcaRenovacao>(`/api/pca-renovacoes/${id}`, {
      headers: getUserHeaders()
    });
  },

  // Obter estatísticas
  getStats: async (): Promise<RenovacaoStats> => {
    return await apiClient.get<RenovacaoStats>('/api/pca-renovacoes/stats', {
      headers: getUserHeaders()
    });
  },

  // Obter resumo completo
  getResumo: async (): Promise<RenovacaoResumo> => {
    return await apiClient.get<RenovacaoResumo>('/api/pca-renovacoes/resumo', {
      headers: getUserHeaders()
    });
  },

  // Obter filtros disponíveis
  getFilters: async (): Promise<RenovacaoFilters> => {
    return await apiClient.get<RenovacaoFilters>('/api/pca-renovacoes/filters', {
      headers: getUserHeaders()
    });
  },

  // Criar nova renovação
  create: async (data: CreateRenovacaoDto): Promise<PcaRenovacao> => {
    return await apiClient.post<PcaRenovacao>('/api/pca-renovacoes', data, {
      headers: getUserHeaders()
    });
  },

  // Atualizar renovação
  update: async (id: number, data: UpdateRenovacaoDto): Promise<PcaRenovacao> => {
    return await apiClient.put<PcaRenovacao>(`/api/pca-renovacoes/${id}`, data, {
      headers: getUserHeaders()
    });
  },

  // Atualizar status
  updateStatus: async (id: number, status: string): Promise<PcaRenovacao> => {
    return await apiClient.patch<PcaRenovacao>(`/api/pca-renovacoes/${id}/status`, { status }, {
      headers: getUserHeaders()
    });
  },

  // Excluir renovação
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/pca-renovacoes/${id}`, {
      headers: getUserHeaders()
    });
  },
};

// ============================================================
// API DE DETALHES DE RENOVAÇÕES
// ============================================================

export const renovacoesDetailsApi = {
  // Buscar todos os dados de uma renovação
  getAllData: async (renovacaoId: number): Promise<RenovacaoAllDetails> => {
    return await apiClient.get<RenovacaoAllDetails>(`/api/pca-renovacoes-details/${renovacaoId}/all`, {
      headers: getUserHeaders()
    });
  },

  // --------------------------------------------------------
  // DETAILS (Campos Estáticos)
  // --------------------------------------------------------

  getDetails: async (renovacaoId: number): Promise<RenovacaoDetails | null> => {
    return await apiClient.get<RenovacaoDetails | null>(`/api/pca-renovacoes-details/${renovacaoId}/details`, {
      headers: getUserHeaders()
    });
  },

  updateDetails: async (
    renovacaoId: number,
    data: Partial<RenovacaoDetails>
  ): Promise<RenovacaoDetails> => {
    return await apiClient.put<RenovacaoDetails>(`/api/pca-renovacoes-details/${renovacaoId}/details`, data, {
      headers: getUserHeaders()
    });
  },

  // --------------------------------------------------------
  // CHECKLIST
  // --------------------------------------------------------

  getChecklist: async (
    renovacaoId: number
  ): Promise<{ checklist: RenovacaoChecklistItem[]; progress: number }> => {
    return await apiClient.get<{ checklist: RenovacaoChecklistItem[]; progress: number }>(`/api/pca-renovacoes-details/${renovacaoId}/checklist`, {
      headers: getUserHeaders()
    });
  },

  updateChecklistStatus: async (
    renovacaoId: number,
    checklistId: number,
    status: ChecklistStatus
  ): Promise<RenovacaoChecklistItem> => {
    return await apiClient.patch<RenovacaoChecklistItem>(
      `/api/pca-renovacoes-details/${renovacaoId}/checklist/${checklistId}/status`,
      { status },
      { headers: getUserHeaders() }
    );
  },

  // --------------------------------------------------------
  // PONTOS DE CONTROLE
  // --------------------------------------------------------

  getPontosControle: async (renovacaoId: number): Promise<RenovacaoPontoControle[]> => {
    return await apiClient.get<RenovacaoPontoControle[]>(`/api/pca-renovacoes-details/${renovacaoId}/pontos-controle`, {
      headers: getUserHeaders()
    });
  },

  getPontosControleComTarefas: async (
    renovacaoId: number
  ): Promise<RenovacaoPontoControleComTarefas[]> => {
    return await apiClient.get<RenovacaoPontoControleComTarefas[]>(
      `/api/pca-renovacoes-details/${renovacaoId}/pontos-controle-com-tarefas`,
      { headers: getUserHeaders() }
    );
  },

  createPontoControle: async (
    renovacaoId: number,
    data: { ponto_controle: string; data: string; proxima_reuniao: string }
  ): Promise<RenovacaoPontoControle> => {
    return await apiClient.post<RenovacaoPontoControle>(
      `/api/pca-renovacoes-details/${renovacaoId}/pontos-controle`,
      data,
      { headers: getUserHeaders() }
    );
  },

  updatePontoControle: async (
    renovacaoId: number,
    pcId: number,
    data: Partial<{ ponto_controle: string; data: string; proxima_reuniao: string }>
  ): Promise<RenovacaoPontoControle> => {
    return await apiClient.put<RenovacaoPontoControle>(
      `/api/pca-renovacoes-details/${renovacaoId}/pontos-controle/${pcId}`,
      data,
      { headers: getUserHeaders() }
    );
  },

  deletePontoControle: async (
    renovacaoId: number,
    pcId: number,
    deleteTarefas: boolean = false
  ): Promise<void> => {
    await apiClient.delete(
      `/api/pca-renovacoes-details/${renovacaoId}/pontos-controle/${pcId}?deleteTarefas=${deleteTarefas}`,
      { headers: getUserHeaders() }
    );
  },

  // --------------------------------------------------------
  // TAREFAS
  // --------------------------------------------------------

  getTarefas: async (renovacaoId: number): Promise<RenovacaoTarefa[]> => {
    return await apiClient.get<RenovacaoTarefa[]>(`/api/pca-renovacoes-details/${renovacaoId}/tarefas`, {
      headers: getUserHeaders()
    });
  },

  getTarefasOrfas: async (renovacaoId: number): Promise<RenovacaoTarefa[]> => {
    return await apiClient.get<RenovacaoTarefa[]>(`/api/pca-renovacoes-details/${renovacaoId}/tarefas-orfas`, {
      headers: getUserHeaders()
    });
  },

  createTarefa: async (
    renovacaoId: number,
    data: {
      tarefa: string;
      responsavel: string;
      prazo: string;
      status?: string;
      ponto_controle_id?: number | null;
    }
  ): Promise<RenovacaoTarefa> => {
    return await apiClient.post<RenovacaoTarefa>(
      `/api/pca-renovacoes-details/${renovacaoId}/tarefas`,
      data,
      { headers: getUserHeaders() }
    );
  },

  updateTarefa: async (
    renovacaoId: number,
    tarefaId: number,
    data: Partial<{
      tarefa: string;
      responsavel: string;
      prazo: string;
      status: string;
      ponto_controle_id: number | null;
    }>
  ): Promise<RenovacaoTarefa> => {
    return await apiClient.put<RenovacaoTarefa>(
      `/api/pca-renovacoes-details/${renovacaoId}/tarefas/${tarefaId}`,
      data,
      { headers: getUserHeaders() }
    );
  },

  deleteTarefa: async (renovacaoId: number, tarefaId: number): Promise<void> => {
    await apiClient.delete(`/api/pca-renovacoes-details/${renovacaoId}/tarefas/${tarefaId}`, {
      headers: getUserHeaders()
    });
  },

  associarTarefaAPontoControle: async (
    renovacaoId: number,
    tarefaId: number,
    pontoControleId: number | null
  ): Promise<RenovacaoTarefa> => {
    return await apiClient.patch<RenovacaoTarefa>(
      `/api/pca-renovacoes-details/${renovacaoId}/tarefas/${tarefaId}/associar-pc`,
      { ponto_controle_id: pontoControleId },
      { headers: getUserHeaders() }
    );
  },

  // --------------------------------------------------------
  // SALVAR TODAS AS MUDANÇAS
  // --------------------------------------------------------

  saveAllChanges: async (
    renovacaoId: number,
    changes: SaveRenovacaoChangesRequest
  ): Promise<{ success: boolean; saved_count: { details: boolean; checklist: number; tarefas: number } }> => {
    return await apiClient.patch<{ success: boolean; saved_count: { details: boolean; checklist: number; tarefas: number } }>(
      `/api/pca-renovacoes-details/${renovacaoId}/save-all-changes`,
      changes,
      { headers: getUserHeaders() }
    );
  },
};

export default renovacoesApi;

