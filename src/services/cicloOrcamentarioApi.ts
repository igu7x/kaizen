import { apiClient } from "./apiClient";
import type { PcaItem } from "@/types";
import {
  CALENDARIO_REVISOES,
  type CalendarioRevisao,
} from "@/components/contratacoes/ciclo/cicloConstants";

/** Campos editáveis de um item do PCA-TIC durante a Revisão (RF-62/63). */
export interface EdicaoItemRevisao {
  objeto?: string;
  valor_estimado?: number;
  status?: string;
  data_estimada_contratacao?: string;
}

/**
 * Contrato de API do Ciclo Orçamentário (Orçamento de TIC).
 *
 * IMPORTANTE: o backend deste módulo AINDA NÃO EXISTE (DFD/IFO/Ciclo/finalidade são novos —
 * ver Especificação de Requisitos, Cap. 2–6). Este arquivo define a superfície tipada que o
 * time de backend deve implementar sob `/api/ciclo-orcamentario`. Os resolvedores puros
 * (por data) já funcionam client-side e não dependem do backend.
 *
 * Conceitos-chave:
 *  - Finalidade: Formação (gera a Versão 1 do ano seguinte) | Revisão (gera Versões 2–4 do ano vigente).
 *  - IFO (Item de Formação do Orçamento, IFO-{ano}-{NNNN}): identidade provisória do item; na
 *    publicação pela DG vira código oficial de Item de PCA (atributo `code`).
 *  - A publicação pela DG é o ÚNICO evento que oficializa uma versão e a deposita no PCA-TIC.
 */

// ============================================================
// TIPOS DO DOMÍNIO
// ============================================================

/** RF-48 — finalidade do ciclo. */
export type FinalidadeCiclo = "formacao" | "revisao";

/** RF-73 — subtipo da revisão. */
export type SubtipoRevisao = "ordinaria" | "extraordinaria";

/** Papel do usuário resolvido no contexto do ciclo (deriva de role + diretoria + comitê). */
export type PapelCiclo =
  | "cca"
  | "demandante"
  | "gejut"
  | "sgjt"
  | "comite"
  | "dg";

/** Estados da esteira de Formação (RF-19/21 → publicação). */
export type EstadoFormacao =
  | "aberto_aguardando_proad"
  | "em_consulta"
  | "retorno_areas"
  | "consolidacao_cca"
  | "validacao_gejut"
  | "apreciacao_sgjt"
  | "em_comites"
  | "autorizado"
  | "ajuste_pre_publicacao"
  | "remessa_dg"
  | "publicado";

/** Estados da esteira de Revisão (RF-60/67/68). */
export type EstadoRevisao =
  | "sem_janela"
  | "janela_aberta"
  | "em_rito_validacao"
  | "consolidacao_cca"
  | "remessa_dg"
  | "publicado";

/** Um ciclo de produção de versão (Formação ou Revisão). RNF-08/09: transacional e auditável. */
export interface Ciclo {
  id: number;
  ano: number;
  finalidade: FinalidadeCiclo;
  subtipo?: SubtipoRevisao | null;
  /** Estado atual da esteira (string do enum conforme finalidade). */
  estado: EstadoFormacao | EstadoRevisao;
  /** PROAD de instrução (RF-22). Chave-container e de monitoramento. */
  proad: string | null;
  /** Versão que este ciclo gera ao publicar (1 na formação; 2–4 nas revisões). */
  versaoGerada: number | null;
  aberturaEm: string | null;
  publicadoEm: string | null;
}

/** Resumo de uma janela de revisão resolvida pela data corrente (RF-60/61). */
export interface JanelaRevisaoResumo {
  calendario: CalendarioRevisao;
  /** True quando a data corrente está dentro da janela de ajustes dos demandantes. */
  ativa: boolean;
  /** Próxima janela a abrir (quando nenhuma está ativa). */
  proximaAberturaEm: string | null;
}

/** Payload da tela de entrada do Ciclo Orçamentário (RF-59/60), espelha EntradaCicloDto do backend. */
export interface EntradaCiclo {
  /** Botão "Formação PCA – [anoFormacao]" gera a Versão 1 de anoFormacao. */
  anoFormacao: number;
  /** Ciclo de formação persistido do anoFormacao (null se ainda não aberto). */
  formacao: Ciclo | null;
  /** Botão "Revisão PCA – [anoVigente]". */
  anoVigente: number;
  /** Ordem (1–3) da janela ordinária ativa na data corrente, resolvida no backend; null se nenhuma. */
  revisaoOrdemAtiva: number | null;
  /** Versão que a janela ativa gera (2–4); null se nenhuma. */
  revisaoVersaoAtiva: number | null;
  /** Ciclo de revisão persistido do ano vigente (null se nenhum). */
  revisao: Ciclo | null;
}

// ============================================================
// RESOLVEDORES PUROS (client-side, RF-60) — já funcionam sem backend
// ============================================================

function parseDiaMes(dm: string, ano: number): Date | null {
  const m = dm.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return new Date(ano, Number(m[2]) - 1, Number(m[1]), 0, 0, 0, 0);
}

/**
 * RF-60/61 — resolve qual janela ordinária está ativa na data informada e, se nenhuma,
 * quando a próxima abre. A 1ª janela (sem início fixo) é ignorada aqui como "abertura por
 * evento de publicação" — o backend confirma sua abertura real.
 */
export function resolverJanelaRevisao(
  hoje: Date,
  anoVigente: number,
): JanelaRevisaoResumo {
  const ativa = CALENDARIO_REVISOES.find((cal) => {
    if (!cal.janelaInicio) return false;
    const ini = parseDiaMes(cal.janelaInicio, anoVigente);
    const fim = parseDiaMes(cal.janelaFim, anoVigente);
    if (!ini || !fim) return false;
    // Fim inclusivo até o final do dia.
    fim.setHours(23, 59, 59, 999);
    return hoje >= ini && hoje <= fim;
  });
  if (ativa) {
    return { calendario: ativa, ativa: true, proximaAberturaEm: null };
  }
  const proxima = CALENDARIO_REVISOES.filter((c) => c.janelaInicio)
    .map((c) => ({ c, ini: parseDiaMes(c.janelaInicio as string, anoVigente) }))
    .filter((x) => x.ini && x.ini >= hoje)
    .sort((a, b) => (a.ini as Date).getTime() - (b.ini as Date).getTime())[0];
  const fallback = CALENDARIO_REVISOES[0];
  return {
    calendario: proxima?.c ?? fallback,
    ativa: false,
    proximaAberturaEm: proxima?.c.janelaInicio ?? fallback.janelaFim,
  };
}

// ============================================================
// API (contrato para o backend — endpoints sob /api/ciclo-orcamentario)
// ============================================================

const BASE = "/api/ciclo-orcamentario";

export const cicloOrcamentarioApi = {
  /** RF-59/60 — estado das duas finalidades para a tela de entrada. */
  getEntrada(ano: number): Promise<EntradaCiclo> {
    return apiClient.get<EntradaCiclo>(`${BASE}/entrada?ano=${ano}`);
  },

  /** Detalhe/estado de um ciclo específico. */
  getCiclo(id: number): Promise<Ciclo> {
    return apiClient.get<Ciclo>(`${BASE}/${id}`);
  },

  /** RF-21/22 — obtém (ou abre) a Formação de um ano; a abertura real é pelo gatilho de 01/01. */
  getOuAbrirFormacao(ano: number): Promise<Ciclo> {
    return apiClient.post<Ciclo>(`${BASE}/formacao`, { ano });
  },

  /** RF-22 — registra o PROAD de instrução (obrigatório para avançar). */
  informarProad(cicloId: number, proad: string): Promise<Ciclo> {
    return apiClient.patch<Ciclo>(`${BASE}/${cicloId}/proad`, { proad });
  },

  /** RF-26/32/35/37 — transição da esteira (encaminhar ao próximo ator = mudar o estado). */
  atualizarEstado(cicloId: number, estado: string): Promise<Ciclo> {
    return apiClient.patch<Ciclo>(`${BASE}/${cicloId}/estado`, { estado });
  },

  /** RNF-07 — encaminha o ciclo ao próximo ator da esteira (transição adjacente determinística). */
  avancar(cicloId: number): Promise<Ciclo> {
    return apiClient.post<Ciclo>(`${BASE}/${cicloId}/avancar`);
  },

  /** Retorna o ciclo ao ator anterior (correção). */
  retroceder(cicloId: number): Promise<Ciclo> {
    return apiClient.post<Ciclo>(`${BASE}/${cicloId}/retroceder`);
  },

  /** RF-62..69 — edita campos revisáveis de um item do PCA-TIC (só com revisão aberta). */
  editarItemRevisao(itemId: number, campos: EdicaoItemRevisao): Promise<PcaItem> {
    return apiClient.patch<PcaItem>(`${BASE}/revisao/item/${itemId}`, campos);
  },

  /** RF-60 — abre/obtém a revisão ordinária vigente (resolvida por data no backend). */
  getOuAbrirRevisao(ano: number): Promise<Ciclo> {
    return apiClient.post<Ciclo>(`${BASE}/revisao`, { ano });
  },

  /** RF-73/74 — abre uma revisão extraordinária (CCA), serializada sobre o mesmo PCA-TIC{ano}. */
  abrirRevisaoExtraordinaria(ano: number): Promise<Ciclo> {
    return apiClient.post<Ciclo>(`${BASE}/revisao/extraordinaria`, { ano });
  },

  /** RF-41/75 — publicação pela DG: grava a próxima versão no PCA-TIC e converte IFO→código oficial. */
  publicar(cicloId: number): Promise<Ciclo> {
    return apiClient.post<Ciclo>(`${BASE}/${cicloId}/publicar`);
  },
};
