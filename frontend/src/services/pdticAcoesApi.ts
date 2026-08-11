import { apiClient } from "./apiClient";

/** Ação do PDTIC (Plano Diretor de TIC) cadastrada no Kaizen. */
export interface PdticAcao {
  id: number;
  nome: string | null;
  id_pdtic: string | null;
  diretoria: string | null;
  area_responsavel: string | null;
  conclusao: string | null; // YYYY-MM-DD
  created_at?: string;
  updated_at?: string;
}

export type PdticAcaoInput = Partial<
  Omit<PdticAcao, "id" | "created_at" | "updated_at">
>;

const BASE_URL = "/api/pdtic-acoes";

function normalizar(a: PdticAcao): PdticAcao {
  return { ...a, id: Number(a.id) };
}

export const pdticAcoesApi = {
  async list(): Promise<PdticAcao[]> {
    const data = await apiClient.request<PdticAcao[]>(BASE_URL);
    return (data || []).map(normalizar);
  },

  async create(data: PdticAcaoInput): Promise<PdticAcao> {
    return normalizar(await apiClient.post<PdticAcao>(BASE_URL, data));
  },

  async update(id: number, data: PdticAcaoInput): Promise<PdticAcao> {
    return normalizar(await apiClient.put<PdticAcao>(`${BASE_URL}/${id}`, data));
  },

  remove(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`${BASE_URL}/${id}`);
  },
};
