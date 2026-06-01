import { apiClient } from './apiClient';

// ============================================================
// TIPOS
// ============================================================

export interface InstrumentoPlanejamento {
  id: number;
  nome: string;
  tipo: 'plano' | 'programa' | 'estrategia' | 'carteira' | 'outro';
  objetivo: string | null;
  periodo_vigencia_inicio: string | null;
  periodo_vigencia_fim: string | null;
  ambito_institucional: string | null;
  responsavel_institucional: string | null;
  instrumento_superior_id: number | null;
  instrumento_superior_nome?: string;
  documento_formalizacao: string | null;
  versao: string;
  historico_alteracoes: string | null;
  observacoes_gerais: string | null;
  diretoria: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  ordem_linha: number;
  ordem_posicao: number;
  total_projetos?: number;
  total_instrumentos_subordinados?: number;
  projetos_nomes?: string;
  projetos?: ProjetoVinculado[];
  instrumentos_subordinados?: InstrumentoPlanejamento[];
  areas_vinculadas_ids?: number[];
}

export interface ProjetoVinculado {
  id: number;
  projeto_id: number;
  projeto_codigo?: string;
  projeto_nome?: string;
  projeto_status?: string;
  projeto_gestor_nome?: string;
  projeto_diretorias?: string;
}

export interface CreateInstrumentoDto {
  nome: string;
  tipo?: string;
  objetivo?: string;
  periodo_vigencia_inicio?: string;
  periodo_vigencia_fim?: string;
  ambito_institucional?: string;
  responsavel_institucional?: string;
  instrumento_superior_id?: number | null;
  documento_formalizacao?: string;
  versao?: string;
  historico_alteracoes?: string;
  observacoes_gerais?: string;
  diretoria?: string;
  projetos_ids?: number[];
  areas_vinculadas_ids?: number[];
}

export interface InstrumentoAncoragem {
  id: number;
  nome: string;
  tipo: string;
}

// ============================================================
// API
// ============================================================

export const planosProgramasApi = {
  // Listar todos os instrumentos
  async getInstrumentos(diretoria?: string): Promise<InstrumentoPlanejamento[]> {
    const params = diretoria ? `?diretoria=${diretoria}` : '';
    return apiClient.get<InstrumentoPlanejamento[]>(`/api/planos-programas/instrumentos${params}`);
  },

  // Buscar instrumento por ID (com projetos e subordinados)
  async getInstrumentoById(id: number): Promise<InstrumentoPlanejamento> {
    return apiClient.get<InstrumentoPlanejamento>(`/api/planos-programas/instrumentos/${id}`);
  },

  // Criar novo instrumento
  async createInstrumento(data: CreateInstrumentoDto): Promise<InstrumentoPlanejamento> {
    return apiClient.post<InstrumentoPlanejamento>('/api/planos-programas/instrumentos', data);
  },

  // Atualizar instrumento
  async updateInstrumento(id: number, data: Partial<CreateInstrumentoDto>): Promise<InstrumentoPlanejamento> {
    return apiClient.put<InstrumentoPlanejamento>(`/api/planos-programas/instrumentos/${id}`, data);
  },

  // Excluir instrumento
  async deleteInstrumento(id: number): Promise<void> {
    return apiClient.delete(`/api/planos-programas/instrumentos/${id}`);
  },

  // Para uso em selects de ancoragem estratégica
  async getInstrumentosParaAncoragem(diretoria?: string): Promise<InstrumentoAncoragem[]> {
    const params = diretoria ? `?diretoria=${diretoria}` : '';
    return apiClient.get<InstrumentoAncoragem[]>(`/api/planos-programas/instrumentos/ancoragem${params}`);
  },

  // Atualizar ordenação dos instrumentos
  async atualizarOrdenacao(ordenacao: { id: number; linha: number; posicao: number }[]): Promise<void> {
    return apiClient.put('/api/planos-programas/instrumentos-ordenacao', { ordenacao });
  },
};
