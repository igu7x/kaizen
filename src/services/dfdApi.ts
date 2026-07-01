import { apiClient } from "./apiClient";

/**
 * DFD-Consulta (Orçamento de TIC, Cap. 1) — instrumento de captura da Formação.
 * Os 4 blocos derivam dos contratos de natureza continuada da unidade (Encerramento/Renovação/
 * Plurianual) + itens do PCA-TIC corrente (Nova Contratação). Somente leitura nesta etapa.
 * Espelha DfdConsultaDto do backend (records → JSON camelCase).
 */

export type BlocoDfd = "encerramento" | "renovacao" | "plurianual";

/** Item derivado de um contrato continuada. */
export interface DfdItem {
  contractId: number;
  process: string | null;
  supplier: string | null;
  objeto: string | null;
  unidade: string | null;
  situation: string | null;
  bloco: BlocoDfd;
  startDate: string | null;
  endDate: string | null;
  limitDate: string | null;
  valorTotal: number | null;
}

/** Item do Bloco 4 (Nova Contratação), pré-preenchido do PCA-TIC. */
export interface DfdPcaItem {
  pcaId: number | null;
  itemPca: string | null;
  objeto: string | null;
  areaDemandante: string | null;
  valorEstimado: number | null;
}

export interface DfdConsulta {
  ano: number;
  unidadeId: number | null;
  encerramento: DfdItem[];
  renovacao: DfdItem[];
  plurianual: DfdItem[];
  novaContratacao: DfdPcaItem[];
}

export const dfdApi = {
  /** RF-01/03 — monta a DFD-Consulta do exercício para a unidade (todas as unidades se `unidadeId` omitido). */
  getConsulta(ano: number, unidadeId?: number): Promise<DfdConsulta> {
    const params = new URLSearchParams({ ano: String(ano) });
    if (unidadeId != null) params.set("unidadeId", String(unidadeId));
    return apiClient.get<DfdConsulta>(`/api/dfd/consulta?${params.toString()}`);
  },
};
