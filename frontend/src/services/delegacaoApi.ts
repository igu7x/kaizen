import { apiClient } from "./apiClient";

export interface DelegacaoEdicaoDto {
  id: number;
  cicloId: number;
  estado: string;
  delegadoId: number;
  delegadoNome: string;
  deleganteId: number;
  deleganteNome: string;
  areaId: number;
  areaNome: string;
  tipo: "normal" | "especial";
  createdAt: string;
}

export interface DelegacaoEdicaoReq {
  estado: string;
  delegadoId: number;
  tipo: "normal" | "especial";
}

export interface MinhaDelegacaoResponse {
  tem_delegacao: boolean;
  tipo: string;
  tem_tag_transicao: boolean;
}

/**
 * Cliente da API de Delegação de Edição do Ciclo Orçamentário.
 */
export const delegacaoApi = {
  /** Cria uma nova delegação para uma etapa específica */
  criar: (cicloId: number, data: DelegacaoEdicaoReq): Promise<DelegacaoEdicaoDto> => {
    return apiClient.post(`/api/ciclo-orcamentario/${cicloId}/delegacoes`, data);
  },

  /** Revoga uma delegação pelo ID */
  revogar: (cicloId: number, delegacaoId: number): Promise<void> => {
    return apiClient.delete(`/api/ciclo-orcamentario/${cicloId}/delegacoes/${delegacaoId}`);
  },

  /** Lista todas as delegações ativas para uma etapa */
  listar: (cicloId: number, estado: string): Promise<DelegacaoEdicaoDto[]> => {
    return apiClient.get(`/api/ciclo-orcamentario/${cicloId}/delegacoes?estado=${estado}`);
  },

  /** Verifica se o usuário logado tem delegação (ou tag de transição) ativa para a etapa */
  minhaDelegacao: (cicloId: number, estado: string): Promise<MinhaDelegacaoResponse> => {
    return apiClient.get(`/api/ciclo-orcamentario/${cicloId}/delegacoes/minha?estado=${estado}`);
  }
};
