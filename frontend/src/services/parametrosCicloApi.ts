import { apiClient } from "./apiClient";

/**
 * API de Parâmetros do Ciclo Orçamentário (Contratações de TIC).
 * Lê/grava nas tabelas parametros_ciclo_formacao, parametros_ciclo_revisao
 * e parametros_ciclo_geral via endpoints /api/parametros-ciclo.
 */

// ============================================================
// TIPOS
// ============================================================

export interface FaseFormacaoParam {
  id?: number;
  ordem: number;
  fase: string;
  area: string;
  data_limite: string; // DD/MM
  updated_at?: string;
  updated_by?: number;
}

export interface JanelaRevisaoParam {
  id?: number;
  ordem: number;
  versao: number;
  janela_inicio: string | null; // DD/MM (null na 1ª)
  janela_fim: string;           // DD/MM
  rito_sgjt: string;            // DD/MM
  comites: string;              // DD/MM
  remessa_dg: string;           // DD/MM
  updated_at?: string;
  updated_by?: number;
}

export interface ParametroGeral {
  id?: number;
  chave: string;
  valor: string;
  descricao?: string;
  updated_at?: string;
  updated_by?: number;
}

export interface ParametrosCicloTodos {
  formacao: FaseFormacaoParam[];
  revisao: JanelaRevisaoParam[];
  geral: ParametroGeral[];
}

// ============================================================
// API
// ============================================================

const BASE = "/api/parametros-ciclo";

export const parametrosCicloApi = {
  /** Busca todos os parâmetros agrupados. */
  getTodos(): Promise<ParametrosCicloTodos> {
    return apiClient.get<ParametrosCicloTodos>(BASE);
  },

  /** Fases da Formação. */
  getFasesFormacao(): Promise<FaseFormacaoParam[]> {
    return apiClient.get<FaseFormacaoParam[]>(`${BASE}/formacao`);
  },

  /** Salva fases da Formação (substituição completa). */
  salvarFasesFormacao(fases: FaseFormacaoParam[]): Promise<FaseFormacaoParam[]> {
    return apiClient.put<FaseFormacaoParam[]>(`${BASE}/formacao`, fases);
  },

  /** Janelas de Revisão. */
  getJanelasRevisao(): Promise<JanelaRevisaoParam[]> {
    return apiClient.get<JanelaRevisaoParam[]>(`${BASE}/revisao`);
  },

  /** Salva janelas de Revisão (substituição completa). */
  salvarJanelasRevisao(janelas: JanelaRevisaoParam[]): Promise<JanelaRevisaoParam[]> {
    return apiClient.put<JanelaRevisaoParam[]>(`${BASE}/revisao`, janelas);
  },

  /** Parâmetros gerais. */
  getParametrosGerais(): Promise<ParametroGeral[]> {
    return apiClient.get<ParametroGeral[]>(`${BASE}/geral`);
  },

  /** Salva um parâmetro geral por chave. */
  salvarParametroGeral(chave: string, valor: string): Promise<ParametroGeral> {
    return apiClient.put<ParametroGeral>(`${BASE}/geral/${chave}`, { valor });
  },
};

// ============================================================
// CONVERSORES: backend → formato dos timelines/resolvers
// ============================================================

import type { CicloTimelinePerna } from "@/components/contratacoes/ciclo/CicloTimeline";
import {
  NOS_FORMACAO_DEFAULT,
  CALENDARIO_REVISOES_DEFAULT,
  type CalendarioRevisao,
} from "@/components/contratacoes/ciclo/cicloConstants";

/**
 * Converte as fases de formação do backend para o formato CicloTimelinePerna[]
 * esperado pelo componente CicloTimeline.
 */
export function fasesParaTimeline(fases: FaseFormacaoParam[]): CicloTimelinePerna[] {
  if (!fases.length) return NOS_FORMACAO_DEFAULT;
  return [
    {
      label: "Formação",
      nodes: fases.map((f) => ({
        area: f.area,
        fase: f.fase,
        data: f.data_limite,
      })),
    },
  ];
}

/**
 * Converte as janelas de revisão do backend para o formato CalendarioRevisao[]
 * esperado pelo resolver de janela e pelo componente CicloTimeline.
 */
export function janelasParaCalendario(janelas: JanelaRevisaoParam[]): CalendarioRevisao[] {
  if (!janelas.length) return CALENDARIO_REVISOES_DEFAULT;
  return janelas.map((j) => ({
    ordem: j.ordem as 1 | 2 | 3,
    versao: j.versao,
    janelaInicio: j.janela_inicio,
    janelaFim: j.janela_fim,
    ritoSgjt: j.rito_sgjt,
    comites: j.comites,
    remessaDg: j.remessa_dg,
  }));
}

/**
 * Carrega as fases da Formação do backend e converte para CicloTimelinePerna[].
 * Retorna o fallback default em caso de erro.
 */
export async function carregarFasesFormacaoTimeline(): Promise<CicloTimelinePerna[]> {
  try {
    const fases = await parametrosCicloApi.getFasesFormacao();
    return fasesParaTimeline(fases);
  } catch {
    return NOS_FORMACAO_DEFAULT;
  }
}

/**
 * Carrega as janelas de Revisão do backend e converte para CalendarioRevisao[].
 * Retorna o fallback default em caso de erro.
 */
export async function carregarCalendarioRevisao(): Promise<CalendarioRevisao[]> {
  try {
    const janelas = await parametrosCicloApi.getJanelasRevisao();
    return janelasParaCalendario(janelas);
  } catch {
    return CALENDARIO_REVISOES_DEFAULT;
  }
}
