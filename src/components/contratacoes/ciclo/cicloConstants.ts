import type { CicloTimelinePerna, CicloTimelineNode } from "./CicloTimeline";

/**
 * Dados canônicos do Ciclo Orçamentário, derivados da Especificação de Requisitos
 * (RF-42, RF-76, RF-77, RF-78). Mantidos aqui como fonte única para a timeline e o calendário.
 * As datas do rito são fixas por decreto; o backend confirma/parametriza (RF-73).
 */

/** RF-42 — Formação: 11 nós em duas pernas (Formação 1–7; Revisão e publicação 8–11). */
export const NOS_FORMACAO: CicloTimelinePerna[] = [
  {
    label: "Formação",
    nodes: [
      { area: "CCA", fase: "Abertura", data: "31/01" },
      { area: "Demandantes", fase: "Consulta", data: "28/02" },
      { area: "CCA · GEJUT", fase: "Consolidação", data: "07/03" },
      { area: "SGJT", fase: "Apreciação", data: "15/03" },
      { area: "CGTIC · CGovTIC", fase: "Comitês", data: "25/03" },
      { area: "SGJT", fase: "Autorização", data: "até 31/03", soft: true },
      { area: "CCA · GEJUT → DG", fase: "Remessa V1", data: "31/03" },
    ],
  },
  {
    label: "Revisão e publicação",
    nodes: [
      { area: "Demandantes", fase: "Janela de Revisão", data: "15/05" },
      {
        area: "Rito de TIC (ágil)",
        fase: "Rito Simplificado",
        data: "15/05–31/05",
        soft: true,
      },
      { area: "CCA · GEJUT → DG", fase: "Remessa Final", data: "31/05" },
      { area: "DG", fase: "Publicação", data: "evento", soft: true, marco: true },
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

export const CALENDARIO_REVISOES: CalendarioRevisao[] = [
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
    { area: "CCA · GEJUT", fase: "Consolidação", data: cal.ritoSgjt },
    { area: "CGTIC · CGovTIC", fase: "Comitês", data: cal.comites },
    { area: "CCA · GEJUT → DG", fase: "Remessa DG", data: cal.remessaDg },
  ];
  return [{ label: "Rito ágil da revisão", nodes }];
}

/** Rótulo de exibição da versão gerada por uma revisão (ex.: "Versão 3"). */
export function rotuloVersao(versao: number): string {
  return `Versão ${versao}`;
}
