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

// ============================================================
// IFO (Item de Formação do Orçamento) — banda-envelope (RF-10/24/49)
// ============================================================

export type BlocoIfo = BlocoDfd | "nova_contratacao";
export type EstadoIfo = "rascunho" | "enviado_cca" | "consolidado" | "publicado";

export interface Ifo {
  id: number;
  codigo: string;
  ano: number;
  cicloId: number | null;
  bloco: BlocoIfo;
  natureza: string | null;
  objeto: string | null;
  areaDemandante: string | null;
  unidadeId: number | null;
  estado: EstadoIfo;
  valorEstimado: number | null;
  interesseRenovacao: boolean | null;
  /** Código oficial de Item de PCA atribuído na publicação (RF-49); null antes disso. */
  codigoOficial: string | null;
  contratos: number[];
}

export interface CriarIfoRequest {
  ano: number;
  cicloId?: number | null;
  bloco: BlocoIfo;
  natureza?: string | null;
  objeto?: string | null;
  areaDemandante?: string | null;
  unidadeId?: number | null;
  valorEstimado?: number | null;
  interesseRenovacao?: boolean | null;
  contratos: number[];
}

export const ifoApi = {
  /** Lista os IFOs de um ano (e opcionalmente de um ciclo). */
  listar(ano: number, cicloId?: number): Promise<Ifo[]> {
    const params = new URLSearchParams({ ano: String(ano) });
    if (cicloId != null) params.set("cicloId", String(cicloId));
    return apiClient.get<Ifo[]>(`/api/ifo?${params.toString()}`);
  },

  /** RF-24 — cria um IFO agrupando contratos da DFD-Consulta. */
  criar(req: CriarIfoRequest): Promise<Ifo> {
    return apiClient.post<Ifo>("/api/ifo", req);
  },

  /** RF-26 — envia o IFO à CCA. */
  enviarCca(id: number): Promise<Ifo> {
    return apiClient.post<Ifo>(`/api/ifo/${id}/enviar-cca`);
  },

  /** Remove um IFO em rascunho. */
  excluir(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/ifo/${id}`);
  },
};
