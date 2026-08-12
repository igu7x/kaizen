import { apiClient } from "./apiClient";

/** Ação do PDTIC (Plano Diretor de TIC) cadastrada no Kaizen. */
export interface PdticAcao {
  id: number;
  nome: string | null;
  id_pdtic: string | null;
  diretoria: string | null;
  area_responsavel: string | null;
  conclusao: string | null; // "Concluída" ou "Mmm/AAAA" (texto livre)
  // Campos de detalhe do quadro de ações do PDTIC (opcionais, só no cadastro).
  necessidade_identificada?: string | null;
  resultado?: string | null;
  reagendada?: string | null;
  classe?: string | null;
  indicador?: string | null;
  objetivos_enticjud?: string | null;
  macrodesafios_tjgo?: string | null;
  com_custo?: boolean;
  custo?: string | null;
  /** Evidência (documento) anexada. Com evidência, o Status é "Concluído". */
  evidencia_nome?: string | null;
  evidencia_mime?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Conteúdo da evidência (para abrir/baixar). */
export interface PdticEvidencia {
  evidencia_nome: string | null;
  evidencia_mime: string | null;
  evidencia_data: string | null; // data URL base64
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

  // Evidência (documento) da ação.
  async setEvidencia(
    id: number,
    ev: { nome: string; mime: string; data: string },
  ): Promise<PdticAcao> {
    return normalizar(
      await apiClient.put<PdticAcao>(`${BASE_URL}/${id}/evidencia`, ev),
    );
  },
  async removerEvidencia(id: number): Promise<PdticAcao> {
    return normalizar(
      await apiClient.delete<PdticAcao>(`${BASE_URL}/${id}/evidencia`),
    );
  },
  getEvidencia(id: number): Promise<PdticEvidencia> {
    return apiClient.request<PdticEvidencia>(`${BASE_URL}/${id}/evidencia`);
  },
};
