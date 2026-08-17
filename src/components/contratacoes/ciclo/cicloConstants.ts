import type { CicloTimelinePerna, CicloTimelineNode } from "./CicloTimeline";

/**
 * Dados canônicos do Ciclo Orçamentário, derivados da Especificação de Requisitos
 * (RF-42, RF-76, RF-77, RF-78). As constantes *_DEFAULT servem como fallback quando
 * o backend (parametros_ciclo_*) não responde. As telas devem buscar os dados dinâmicos
 * via parametrosCicloApi e usar estes defaults apenas em caso de erro.
 */

/** RF-42 — Formação: fallback default para o timeline (quando o backend não responde). */
export const NOS_FORMACAO_DEFAULT: CicloTimelinePerna[] = [
  {
    label: "Formação",
    nodes: [
      { area: "CCA", fase: "Abertura", data: "31/01" },
      { area: "Demandantes", fase: "Consulta", data: "28/02" },
      { area: "CCA · GEJUT", fase: "Consolidação", data: "15/03" },
      { area: "SGJT", fase: "Apreciação", data: "20/03" },
      { area: "CGovTIC", fase: "Comitês", data: "25/03" },
      { area: "CCA", fase: "Remessa à DG", data: "31/03" },
    ],
  },
];

/**
 * RF-76/RF-77 — Calendário das três revisões ordinárias do exercício vigente.
 * A 1ª revisão abre pelo evento de publicação da Versão 1; as demais têm datas fixas.
 * O rito é sempre dias 07 → 15 → 20 do mês de apuração.
 */
export interface CalendarioRevisao {
  /** 1, 2 ou 3 (ordinárias). */
  ordem: 1 | 2 | 3;
  /** Versão que a revisão gera (2, 3 ou 4). */
  versao: number;
  /** Início da janela dos demandantes (null na 1ª = evento de publicação). */
  janelaInicio: string | null;
  /** Fim da janela dos demandantes. */
  janelaFim: string;
  /** Consolidação CCA/GEJUT → SGJT (dia 07). */
  ritoSgjt: string;
  /** Apreciação dos comitês (dia 15). */
  comites: string;
  /** Remessa à DG (dia 20). */
  remessaDg: string;
}

/** Fallback default para o calendário de revisões (quando o backend não responde). */
export const CALENDARIO_REVISOES_DEFAULT: CalendarioRevisao[] = [
  {
    ordem: 1,
    versao: 2,
    janelaInicio: null,
    janelaFim: "31/01",
    ritoSgjt: "07/02",
    comites: "15/02",
    remessaDg: "20/02",
  },
  {
    ordem: 2,
    versao: 3,
    janelaInicio: "01/04",
    janelaFim: "30/04",
    ritoSgjt: "07/05",
    comites: "15/05",
    remessaDg: "20/05",
  },
  {
    ordem: 3,
    versao: 4,
    janelaInicio: "01/07",
    janelaFim: "31/07",
    ritoSgjt: "07/08",
    comites: "15/08",
    remessaDg: "20/08",
  },
];

/**
 * RF-78 — Linha do tempo curta da Revisão (4 nós), com datas relativas à janela vigente.
 * Janela de ajustes → Consolidação CCA/GEJUT → Comitês → Remessa DG.
 */
export function nosRevisao(cal: CalendarioRevisao): CicloTimelinePerna[] {
  const nodes: CicloTimelineNode[] = [
    { area: "Demandantes", fase: "Janela de ajustes", data: cal.janelaFim },
    { area: "CCA", fase: "Consolidação", data: cal.ritoSgjt },
    { area: "GEJUT", fase: "Validação", data: cal.ritoSgjt },
    { area: "CGTIC · CGovTIC", fase: "Comitês", data: cal.comites },
    { area: "CCA · GEJUT → DG", fase: "Remessa DG", data: cal.remessaDg },
  ];
  return [{ label: "Rito ágil da revisão", nodes }];
}

/** Rótulo de exibição da versão gerada por uma revisão (ex.: "Versão 3"). */
export function rotuloVersao(versao: number): string {
  return `Versão ${versao}`;
}

// Aliases de retrocompatibilidade — novos consumers devem usar *_DEFAULT diretamente.
export const NOS_FORMACAO = NOS_FORMACAO_DEFAULT;
export const CALENDARIO_REVISOES = CALENDARIO_REVISOES_DEFAULT;
