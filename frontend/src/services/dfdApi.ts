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

/** §8.4 — estado de validação da demanda (IFO) nas 2 camadas. */
export type ValidacaoDemanda = "em_edicao" | "validada_1a" | "validada_2a";

export interface IfoContratoDetalhe {
  contractId: number;
  interesseRenovacao: boolean;
  motivoReclassificacao: string | null;
  valorContratoCents?: number | null;
}

export interface Ifo {
  id: number;
  codigo: string;
  ano: number;
  cicloId: number | null;
  bloco: BlocoIfo;
  natureza: string | null;
  objeto: string | null;
  cadastrosUnidadesId: number | null;
  cadastrosAreasId: number | null;
  estado: EstadoIfo;
  valorEstimado: number | null;
  interesseRenovacao: boolean | null;
  interesseRenovacaoConfirmado: boolean | null;
  /** RF-07 — motivo quando reclassificado (Renovação→Encerramento). */
  motivoReclassificacao: string | null;
  /** Código oficial de Item de PCA atribuído na publicação (RF-49); null antes disso. */
  codigoOficial: string | null;
  /** §8.4 — validação por demanda: em_edicao → validada_1a → validada_2a. */
  validacao: ValidacaoDemanda | null;
  description?: string | null;
  justification?: string | null;
  process?: string | null;
  financialResourceType?: string | null;
  contractType?: string | null;
  formalizedValueCents?: number | null;

  priority?: string | null;
  estimatedDate?: string | null;
  /** ID do PCA de origem, quando o IFO foi gerado a partir de um PCA existente (bloco nova_contratacao). */
  pcaOrigemId?: number | null;
  areaSigla?: string | null;
  areaNome?: string | null;
  unidadeSigla?: string | null;
  unidadeNome?: string | null;
  contratos: number[];
  ifoContratosDetalhes?: IfoContratoDetalhe[];
}

export interface CriarIfoRequest {
  ano: number;
  cicloId?: number | null;
  bloco: BlocoIfo;
  natureza?: string | null;
  objeto?: string | null;
  cadastrosUnidadesId?: number | null;
  cadastrosAreasId?: number | null;
  valorEstimado?: number | null;
  interesseRenovacao?: boolean | null;
  description?: string | null;
  justification?: string | null;
  process?: string | null;
  financialResourceType?: string | null;
  contractType?: string | null;
  formalizedValueCents?: number | null;

  priority?: string | null;
  estimatedDate?: string | null;
  contratos: number[];
}

export interface AtualizarIfoRequest {
  bloco: BlocoIfo;
  natureza?: string | null;
  objeto?: string | null;
  cadastrosUnidadesId?: number | null;
  cadastrosAreasId?: number | null;
  valorEstimado?: number | null;
  interesseRenovacao?: boolean | null;
  description?: string | null;
  justification?: string | null;
  process?: string | null;
  financialResourceType?: string | null;
  contractType?: string | null;
  formalizedValueCents?: number | null;
  idCadastrosAreas?: number | null;
  priority?: string | null;
  estimatedDate?: string | null;
}

export const ifoApi = {
  /** Lista os IFOs de um ano (e opcionalmente de um ciclo). */
  listar(ano: number, cicloId?: number, minhasDemandas?: boolean): Promise<Ifo[]> {
    const params = new URLSearchParams({ ano: String(ano) });
    if (cicloId != null) params.set("cicloId", String(cicloId));
    if (minhasDemandas) params.set("minhasDemandas", "true");
    
    // Pegar o header do x-user-id como no contractsApi (gambiarra rápida pois listar() não recebe headers)
    const headers: Record<string, string> = {};
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.id) headers["x-user-id"] = String(user.id);
      } catch (e) {}
    }
    
    return apiClient.get<Ifo[]>(`/api/ifo?${params.toString()}`, { headers });
  },

  /** RF-24 — cria um IFO agrupando contratos da DFD-Consulta. */
  criar(req: CriarIfoRequest): Promise<Ifo> {
    return apiClient.post<Ifo>("/api/ifo", req);
  },

  /** Atualiza os atributos de um IFO. Requer tag de edição correspondente ao estado. */
  atualizar(id: number, req: AtualizarIfoRequest): Promise<Ifo> {
    return apiClient.put<Ifo>(`/api/ifo/${id}`, req);
  },

  /** Atualiza a lista de contratos vinculados a um IFO. Requer tag de edição. */
  atualizarContratos(id: number, contratosIds: number[]): Promise<Ifo> {
    return apiClient.put<Ifo>(`/api/ifo/${id}/contratos`, contratosIds);
  },

  /** RF-26 — envia o IFO à CCA. */
  enviarCca(id: number): Promise<Ifo> {
    return apiClient.post<Ifo>(`/api/ifo/${id}/enviar-cca`);
  },

  /** RF-07 — interesse na renovação; "Não" reclassifica o IFO para Encerramento (com motivo). */
  definirInteresseRenovacao(id: number, interesse: boolean, motivo?: string): Promise<Ifo> {
    return apiClient.patch<Ifo>(`/api/ifo/${id}/interesse-renovacao`, { interesse, motivo });
  },

  /** Define o interesse na renovação por contrato individualmente. */
  definirInteresseRenovacaoContrato(id: number, contractId: number, interesse: boolean, motivo?: string): Promise<Ifo> {
    return apiClient.patch<Ifo>(`/api/ifo/${id}/contratos/${contractId}/interesse-renovacao`, { interesse, motivo });
  },

  /** RF-11 — Edita o valor de um contrato vinculado a um IFO. */
  atualizarValorContrato(id: number, contractId: number, valorContratoCents: number): Promise<Ifo> {
    return apiClient.patch<Ifo>(`/api/ifo/${id}/contratos/${contractId}/valor`, { valorContratoCents });
  },

  /** Remove um IFO. Requer tag de exclusão correspondente ao estado atual. */
  excluir(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/ifo/${id}`);
  },

  // ---------- validação por demanda (§8.4 / Cap. 8) ----------

  /** §8.4 — valida a demanda numa das 2 camadas (1 = Gestor Demandante, 2 = Diretor de Área). */
  validar(id: number, camada: 1 | 2): Promise<Ifo> {
    return apiClient.patch<Ifo>(`/api/ifo/${id}/validar`, { camada });
  },

  /** RN-GERAL-07 — devolve a demanda à edição, derrubando as validações. */
  devolverDemanda(id: number): Promise<Ifo> {
    return apiClient.post<Ifo>(`/api/ifo/${id}/devolver-demanda`);
  },

  /** RN-GERAL-08 — remessa da partição (todas as demandas da unidade no ciclo) à CCA; congela. */
  remeterParticao(cicloId: number, unidadeId: number): Promise<{ remetidas: number }> {
    return apiClient.post<{ remetidas: number }>(`/api/ifo/particao/remeter`, { cicloId, unidadeId });
  },

  /** Devolução da partição pela CCA à área (reabre para edição). */
  devolverParticao(cicloId: number, unidadeId: number): Promise<{ devolvidas: number }> {
    return apiClient.post<{ devolvidas: number }>(`/api/ifo/particao/devolver`, { cicloId, unidadeId });
  },
};
