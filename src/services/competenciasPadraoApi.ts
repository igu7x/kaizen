import { apiClient } from "./apiClient";

export interface CompetenciaPadrao {
  id: number;
  tipo: "comportamental" | "estrategica" | "gerencial";
  nome: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompetenciasPadraoGrouped {
  comportamental: CompetenciaPadrao[];
  estrategica: CompetenciaPadrao[];
  gerencial: CompetenciaPadrao[];
}

export interface VersaoSnapshot {
  id: number;
  versao: number;
  tipo: string;
  snapshot: any[];
  mudancas: {
    adicionadas: { id: number; nome: string }[];
    removidas: { id: number; nome: string }[];
    alteradas: { id: number; nome: string }[];
  } | null;
  publicado_por: number | null;
  publicado_por_nome?: string;
  created_at: string;
}

export interface PublishResult {
  versao: number;
  tiposAfetados: string[];
  formulariosAfetados: number;
}

const BASE_URL = "/api/competencias-padrao";

export const competenciasPadraoApi = {
  /** Buscar competências ativas agrupadas por tipo */
  getAll(): Promise<CompetenciasPadraoGrouped> {
    return apiClient.request<CompetenciasPadraoGrouped>(BASE_URL);
  },

  /** Buscar TODAS (incluindo inativas) — admin */
  getAllAdmin(): Promise<CompetenciaPadrao[]> {
    return apiClient.request<CompetenciaPadrao[]>(`${BASE_URL}/all`);
  },

  /** Versão atual */
  getVersaoAtual(): Promise<{ versao: number }> {
    return apiClient.request<{ versao: number }>(`${BASE_URL}/versao-atual`);
  },

  /** Histórico de versões — admin */
  getVersoes(): Promise<VersaoSnapshot[]> {
    return apiClient.request<VersaoSnapshot[]>(`${BASE_URL}/versoes`);
  },

  /** Verificar se há mudanças pendentes — admin */
  hasPendingChanges(): Promise<{ hasPendingChanges: boolean }> {
    return apiClient.request<{ hasPendingChanges: boolean }>(
      `${BASE_URL}/pending-changes`,
    );
  },

  /** Diff desde uma versão */
  getDiff(fromVersion: number): Promise<{
    versaoAtual: number;
    mudancas: {
      tipo: string;
      adicionadas: any[];
      removidas: any[];
      alteradas: any[];
    }[];
  }> {
    return apiClient.request(`${BASE_URL}/diff/${fromVersion}`);
  },

  /** Criar competência — admin */
  create(data: {
    tipo: string;
    nome: string;
    descricao: string;
    ordem?: number;
  }): Promise<CompetenciaPadrao> {
    return apiClient.post<CompetenciaPadrao>(BASE_URL, data);
  },

  /** Atualizar competência — admin */
  update(
    id: number,
    data: { nome?: string; descricao?: string; ordem?: number },
  ): Promise<CompetenciaPadrao> {
    return apiClient.put<CompetenciaPadrao>(`${BASE_URL}/${id}`, data);
  },

  /** Desativar competência — admin */
  remove(id: number): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  /** Reativar competência — admin */
  reactivate(id: number): Promise<void> {
    return apiClient.post(`${BASE_URL}/${id}/reactivate`);
  },

  /** Publicar nova versão — admin */
  publicar(): Promise<PublishResult> {
    return apiClient.post<PublishResult>(`${BASE_URL}/publicar`);
  },
};
