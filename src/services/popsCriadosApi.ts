import { apiClient } from "./apiClient";

/** POP (Procedimento Operacional Padrão) criado no Kaizen. Campos do modelo institucional (SGQ). */
export interface PopCriado {
  id: number;
  codigo: string | null;
  nome_processo: string | null;
  macroprocesso: string | null;
  diretoria_orgao: string | null;
  unidade_orgao: string | null;
  area: string | null;
  data_versao: string | null; // YYYY-MM-DD
  revisao: string | null;
  servico: string | null;
  objetivo: string | null;
  unidade_responsavel: string | null;
  siglas: string | null; // um item por linha
  normativa: string | null; // um item por linha
  descricao_procedimento: string | null;
  gestor_processo: string | null;
  sistemas_utilizados: string | null; // um item por linha
  anexos: string | null; // um item por linha
  fluxograma_nome: string | null;
  /** Imagem do fluxograma como data URL base64. Só vem no getById (omitida na listagem). */
  fluxograma_data?: string | null;
  proposto_por: string | null;
  analisado_por: string | null;
  aprovado_por: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PopCriadoInput = Partial<
  Omit<PopCriado, "id" | "created_at" | "updated_at">
>;

const BASE_URL = "/api/pops-criados";

function normalizar(p: PopCriado): PopCriado {
  return { ...p, id: Number(p.id) };
}

export const popsCriadosApi = {
  async list(): Promise<PopCriado[]> {
    const data = await apiClient.request<PopCriado[]>(BASE_URL);
    return (data || []).map(normalizar);
  },

  async getById(id: number): Promise<PopCriado> {
    return normalizar(await apiClient.request<PopCriado>(`${BASE_URL}/${id}`));
  },

  async create(data: PopCriadoInput): Promise<PopCriado> {
    return normalizar(await apiClient.post<PopCriado>(BASE_URL, data));
  },

  async update(id: number, data: PopCriadoInput): Promise<PopCriado> {
    return normalizar(await apiClient.put<PopCriado>(`${BASE_URL}/${id}`, data));
  },

  remove(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`${BASE_URL}/${id}`);
  },
};
