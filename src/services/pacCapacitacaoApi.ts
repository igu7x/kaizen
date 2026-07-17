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
  /** Quantidade de certificados de participantes lançados (para o progresso). */
  certificados_count?: number;
  created_at?: string;
  updated_at?: string;
}

/** Certificado de participação de um servidor num item de capacitação. */
export interface PacCertificado {
  id: number;
  capacitacao_id: number;
  colaborador_id: number | null;
  nome_servidor: string;
  diretoria: string | null;
  arquivo_nome: string | null;
  tem_arquivo?: boolean;
  created_at?: string;
}

export interface PacCertificadoInput {
  colaborador_id?: number | null;
  nome_servidor: string;
  diretoria?: string | null;
  arquivo_nome?: string | null;
  /** Data URL base64 do PDF (data:application/pdf;base64,...). */
  arquivo_data?: string | null;
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
    certificados_count:
      it.certificados_count === null || it.certificados_count === undefined
        ? 0
        : Number(it.certificados_count),
  };
}

/** Vagas efetivas p/ cálculo de progresso: sem vaga cadastrada, considera 1. */
export function vagasEfetivas(numeroVagas: number | null | undefined): number {
  return numeroVagas && numeroVagas > 0 ? numeroVagas : 1;
}

/** Progresso (0–100) = certificados / vagas efetivas, limitado a 100. */
export function progressoCapacitacao(it: PacCapacitacaoItem): number {
  const total = vagasEfetivas(it.numero_vagas);
  const feitos = it.certificados_count ?? 0;
  return Math.min(100, Math.round((feitos / total) * 100));
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

  // ---- Certificados dos participantes ----
  async listCertificados(capacitacaoId: number): Promise<PacCertificado[]> {
    const data = await apiClient.request<PacCertificado[]>(
      `${BASE_URL}/${capacitacaoId}/certificados`,
    );
    return (data || []).map((c) => ({ ...c, id: Number(c.id) }));
  },

  addCertificado(
    capacitacaoId: number,
    data: PacCertificadoInput,
  ): Promise<PacCertificado> {
    return apiClient.post<PacCertificado>(
      `${BASE_URL}/${capacitacaoId}/certificados`,
      data,
    );
  },

  getCertificadoArquivo(
    certId: number,
  ): Promise<{ arquivo_nome: string | null; arquivo_data: string | null }> {
    return apiClient.request(`${BASE_URL}/certificados/${certId}/arquivo`);
  },

  removeCertificado(certId: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(
      `${BASE_URL}/certificados/${certId}`,
    );
  },
};
