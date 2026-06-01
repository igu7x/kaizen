import { apiClient } from './apiClient';

export interface RespostaItem {
  competencia_unidade_id?: number;
  competencia_nome: string;
  competencia_descricao?: string;
  nota: number;
  comentario?: string;
  tipo?: 'tecnica' | 'comportamental' | 'estrategica' | 'gerencial';
}

export interface AutoavaliacaoFormulario {
  id: number;
  user_id: number;
  nome_completo: string;
  matricula: string;
  cargo_funcao: string;
  email_institucional: string;
  diretoria: string;
  unidade_id: number | null;
  unidade_nome?: string;
  tipo_inventario?: 'equipe' | 'gestor';
  status: string;
  respostas?: RespostaItem[];
  total_respostas?: number;
  user_name?: string;
  validado_por_id?: number;
  validado_por_nome?: string;
  validado_em?: string;
  tecnicas_versao?: number | null;
  versao_formulario?: number | null;
  created_at: string;
  updated_at: string;
}

export interface VersaoHistoricoAutoavaliacao {
  id: number;
  formulario_id: number;
  versao: number;
  validado_em: string;
  validado_nome: string;
  created_at: string;
}

export interface CreateAutoavaliacaoDto {
  nome_completo: string;
  matricula: string;
  cargo_funcao: string;
  email_institucional: string;
  diretoria: string;
  unidade_id?: number;
  pessoa_id?: number;
  tipo_inventario?: 'equipe' | 'gestor';
  respostas: RespostaItem[];
}

const BASE_URL = '/api/autoavaliacao';

export const autoavaliacaoApi = {
  getAll(diretoria?: string, tipoInventario?: string): Promise<AutoavaliacaoFormulario[]> {
    const params = new URLSearchParams();
    if (diretoria) params.set('diretoria', diretoria);
    if (tipoInventario) params.set('tipo_inventario', tipoInventario);
    const qs = params.toString();
    const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;
    return apiClient.request<AutoavaliacaoFormulario[]>(url);
  },

  getMeu(tipoInventario: string = 'equipe'): Promise<AutoavaliacaoFormulario | null> {
    return apiClient.request<AutoavaliacaoFormulario | null>(`${BASE_URL}/meu?tipo_inventario=${encodeURIComponent(tipoInventario)}`);
  },

  getById(id: number): Promise<AutoavaliacaoFormulario> {
    return apiClient.request<AutoavaliacaoFormulario>(`${BASE_URL}/${id}`);
  },

  create(data: CreateAutoavaliacaoDto): Promise<AutoavaliacaoFormulario> {
    return apiClient.post<AutoavaliacaoFormulario>(BASE_URL, data);
  },

  getByUnidade(unidadeId: number, tipoInventario: string = 'equipe'): Promise<{ id: number; nome_completo: string; cargo_funcao: string; email_institucional: string; unidade_id: number }[]> {
    return apiClient.request(`${BASE_URL}/por-unidade/${unidadeId}?tipo_inventario=${encodeURIComponent(tipoInventario)}`);
  },

  validar(id: number): Promise<AutoavaliacaoFormulario> {
    return apiClient.patch<AutoavaliacaoFormulario>(`${BASE_URL}/${id}/validar`);
  },

  remove(id: number): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  /** Listar versões históricas de um formulário */
  getVersoes(id: number): Promise<VersaoHistoricoAutoavaliacao[]> {
    return apiClient.request<VersaoHistoricoAutoavaliacao[]>(`${BASE_URL}/${id}/versoes`);
  },

  /** Buscar snapshot completo de uma versão específica (para gerar PDF) */
  getVersaoDados(id: number, versao: number): Promise<AutoavaliacaoFormulario> {
    return apiClient.request<AutoavaliacaoFormulario>(`${BASE_URL}/${id}/versoes/${versao}`);
  },
};
