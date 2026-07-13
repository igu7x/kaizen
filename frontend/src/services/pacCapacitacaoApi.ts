import { apiClient } from "./apiClient";

/** Item da Matriz do Plano Anual de Capacitação (PAC). */
export interface PacCapacitacaoItem {
  id: number;
  modulo: string; // "ti" | "apoio"
  // Colunas da tabela (verde)
  codigo: string | null;
  area_demandante: string | null;
  evento_capacitacao: string | null;
  prioridade: string | null;
  numero_vagas: number | null;
  modalidade: string | null;
  estimativa_custo: string | null;
  // Colunas do painel de detalhes (azul)
  categoria: string | null;
  tema: string | null;
  objetivo_justificativa: string | null;
  publico_alvo: string | null;
  competencias: string | null;
  observacoes: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PacCapacitacaoInput = Partial<
  Omit<PacCapacitacaoItem, "id" | "created_at" | "updated_at">
>;

const BASE_URL = "/api/pac-capacitacao";

// O backend serializa bigint (id) como string e int4 (numero_vagas) como número.
// Normaliza para os tipos declarados, evitando comparações string vs number.
function normalizar(it: PacCapacitacaoItem): PacCapacitacaoItem {
  return {
    ...it,
    id: Number(it.id),
    numero_vagas:
      it.numero_vagas === null || it.numero_vagas === undefined
        ? null
        : Number(it.numero_vagas),
  };
}

export const pacCapacitacaoApi = {
  async list(modulo: string = "ti"): Promise<PacCapacitacaoItem[]> {
    const data = await apiClient.request<PacCapacitacaoItem[]>(
      `${BASE_URL}?modulo=${encodeURIComponent(modulo)}`,
    );
    return (data || []).map(normalizar);
  },

  async create(data: PacCapacitacaoInput): Promise<PacCapacitacaoItem> {
    return normalizar(await apiClient.post<PacCapacitacaoItem>(BASE_URL, data));
  },

  async update(
    id: number,
    data: PacCapacitacaoInput,
  ): Promise<PacCapacitacaoItem> {
    return normalizar(
      await apiClient.put<PacCapacitacaoItem>(`${BASE_URL}/${id}`, data),
    );
  },

  remove(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`${BASE_URL}/${id}`);
  },
};
