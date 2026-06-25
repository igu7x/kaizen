import { apiClient } from "./apiClient";

// ============================================================
// INTERFACES
// ============================================================

export type ProcessoStatus =
  | "em_elaboracao"
  | "enviado"
  | "validado_autor"
  | "validado_diretoria"
  | "validado_final"
  | "recusado";

export type TipoDocumentoAnexado = "MPS" | "POP" | "AUX" | "PRI" | "FLUXOGRAMA";

export interface DocumentoAnexado {
  tipo: TipoDocumentoAnexado;
  nome: string;
  mime: string;
  data: string; // data URL base64
}

export interface VersaoHistorico {
  id: number;
  versao: string;
  validado_final_em: string;
  validado_final_nome: string | null;
  created_at: string;
}

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoAnexado, string> = {
  MPS: "MPS — Manual de Procedimentos Setoriais",
  POP: "POP — Procedimento Operacional Padrão",
  AUX: "Docs Auxiliares",
  PRI: "Documento Primário",
  FLUXOGRAMA: "Fluxograma",
};

export const TIPO_DOCUMENTO_BADGE: Record<TipoDocumentoAnexado, string> = {
  MPS: "bg-blue-100 text-blue-700 border-blue-200",
  POP: "bg-emerald-100 text-emerald-700 border-emerald-200",
  AUX: "bg-slate-100 text-slate-700 border-slate-200",
  PRI: "bg-violet-100 text-violet-700 border-violet-200",
  FLUXOGRAMA: "bg-pink-100 text-pink-700 border-pink-200",
};

/**
 * Resolve o fluxograma do processo: prefere o documento anexado tipo "FLUXOGRAMA";
 * faz fallback para os campos legados fluxograma_* (processos antigos).
 */
export function getFluxograma(p: {
  documentos_anexados?: DocumentoAnexado[] | null;
  fluxograma_data?: string | null;
  fluxograma_filename?: string | null;
  fluxograma_mime?: string | null;
}): { data: string | null; filename: string | null; mime: string | null } {
  const doc = (p.documentos_anexados || []).find(
    (d) => d.tipo === "FLUXOGRAMA",
  );
  if (doc) return { data: doc.data, filename: doc.nome, mime: doc.mime };
  return {
    data: p.fluxograma_data ?? null,
    filename: p.fluxograma_filename ?? null,
    mime: p.fluxograma_mime ?? null,
  };
}

/**
 * Indica se o processo tem fluxograma. Prefere o flag `tem_fluxograma` do payload enxuto da
 * listagem (sem base64); cai para a checagem dos dados completos quando o flag não vier
 * (objeto vindo de getById/create/update).
 */
export function temFluxograma(p: {
  tem_fluxograma?: boolean;
  documentos_anexados?: DocumentoAnexado[] | null;
  fluxograma_data?: string | null;
}): boolean {
  if (typeof p.tem_fluxograma === "boolean") return p.tem_fluxograma;
  return !!getFluxograma(p).data;
}

/** Tem documento primário = anexo com tipo `PRI`. */
export function temDocumentoPrimario(p: {
  documentos_anexados?: DocumentoAnexado[] | null;
}): boolean {
  return (p.documentos_anexados || []).some((d) => d.tipo === "PRI");
}

/** Tem PDF de aprovação. Prefere o flag enxuto `tem_aprovacao`; cai para os dados completos. */
export function temAprovacao(p: {
  tem_aprovacao?: boolean;
  aprovacao_data?: string | null;
}): boolean {
  if (typeof p.tem_aprovacao === "boolean") return p.tem_aprovacao;
  return !!p.aprovacao_data;
}

/**
 * Modelo K1: PDF de aprovação anexado E as 3 camadas de validação concluídas (status
 * validado_final). É derivado — cai sozinho se o processo sair do validado_final (reedição).
 */
export function isK1(p: {
  status: ProcessoStatus;
  tem_aprovacao?: boolean;
  aprovacao_data?: string | null;
}): boolean {
  return p.status === "validado_final" && temAprovacao(p);
}

/** Próxima revisão = período cadastrado + 1 ano. Null se período ausente/inválido. */
export function proximaRevisao(p: { periodo: string | null }): Date | null {
  if (!p.periodo) return null;
  const m = p.periodo.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Revisão vencida = próxima revisão no passado. */
export function revisaoVencida(p: { periodo: string | null }): boolean {
  const next = proximaRevisao(p);
  return next != null && next.getTime() < Date.now();
}

/** Vigente = tem documento primário OU é Modelo K1. */
export function isVigente(p: ProcessoNegocio): boolean {
  return temDocumentoPrimario(p) || isK1(p);
}

/**
 * Revisão ou Novo = NÃO é K1 OU revisão vencida. Não é exclusivo de {@link isVigente}:
 * um processo pode aparecer nas duas abas (ex: doc primário sem K1, ou K1 com revisão vencida).
 */
export function isRevisaoOuNovo(p: ProcessoNegocio): boolean {
  return !isK1(p) || revisaoVencida(p);
}

/**
 * Responsável por um processo: área + cargo (camada 1 = área, camada 2 = cargo).
 * No PDF aparece apenas o cargo. Persistido no JSONB legado `proprietarios`.
 */
export interface ResponsavelEntry {
  area: string;
  cargo: string;
}

/** Normaliza uma entrada de responsável, tolerando dado legado (string = cargo). */
export function normalizeResponsavel(raw: unknown): ResponsavelEntry {
  if (typeof raw === "string") return { area: "", cargo: raw };
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return { area: String(r.area ?? ""), cargo: String(r.cargo ?? "") };
  }
  return { area: "", cargo: "" };
}

/** Política de revisão exibida na coluna "Periodicidade" da seção Revisão. */
export const REVISAO_POLITICA_TEXTO =
  "A revisão do processo deverá ocorrer de forma ordinária, anualmente, ou de forma extraordinária, sempre que houver necessidade de atualização.";

export interface ProcessoNegocio {
  id: number;
  macroprocesso: string;
  diretoria: string;
  periodo: string | null;
  revisao: string | null;
  codigo_versao: string | null;
  nome_processo: string;
  descricao: string | null;
  detalhamento: string | null;
  /** Indicadores de desempenho/resultado do processo (texto livre). */
  indicadores: string | null;
  /** Responsáveis (área + cargo). Coluna JSONB historicamente chamada `proprietarios`. */
  proprietarios: ResponsavelEntry[];
  atores: string[];
  areas_responsaveis: string[];
  entradas: string[];
  saidas: string[];
  sistemas_ferramentas: string[];
  normativos_referencias: string[];
  fluxograma_data: string | null;
  fluxograma_filename: string | null;
  fluxograma_mime: string | null;
  documentos_anexados: DocumentoAnexado[];
  /** PDF de aprovação (data URL base64). Junto com status validado_final, define o Modelo K1. */
  aprovacao_data: string | null;
  aprovacao_filename: string | null;
  aprovacao_mime: string | null;
  /**
   * Presentes apenas no payload da listagem (getAll), que vem enxuto sem os bytes base64.
   * `tem_fluxograma`: tem fluxograma (legado ou doc tipo FLUXOGRAMA); `tem_aprovacao`: tem PDF de aprovação.
   * No detalhe (getById) vêm undefined — use {@link getFluxograma}/{@link isK1} a partir dos dados completos.
   */
  tem_fluxograma?: boolean;
  tem_aprovacao?: boolean;
  periodicidade_revisao: string | null;
  numero_proad: string | null;
  observacoes_gerais: string | null;
  versao: string;
  status: ProcessoStatus;
  validado_autor_user_id: number | null;
  validado_autor_nome: string | null;
  validado_autor_em: string | null;
  validado_diretoria_user_id: number | null;
  validado_diretoria_nome: string | null;
  validado_diretoria_em: string | null;
  validado_final_user_id: number | null;
  validado_final_nome: string | null;
  validado_final_em: string | null;
  recusado_em: string | null;
  recusado_por_user_id: number | null;
  recusado_por_nome: string | null;
  recusado_camada: "autor" | "diretoria" | "final" | null;
  recusa_motivo: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProcessoNegocioDto {
  macroprocesso: string;
  diretoria: string;
  periodo?: string | null;
  revisao?: string | null;
  codigo_versao?: string | null;
  nome_processo: string;
  descricao?: string | null;
  detalhamento?: string | null;
  indicadores?: string | null;
  proprietarios?: ResponsavelEntry[];
  atores?: string[];
  areas_responsaveis?: string[];
  entradas?: string[];
  saidas?: string[];
  sistemas_ferramentas?: string[];
  normativos_referencias?: string[];
  fluxograma_data?: string | null;
  fluxograma_filename?: string | null;
  fluxograma_mime?: string | null;
  documentos_anexados?: DocumentoAnexado[];
  periodicidade_revisao?: string | null;
  numero_proad?: string | null;
  observacoes_gerais?: string | null;
}

export type UpdateProcessoNegocioDto = Partial<CreateProcessoNegocioDto>;

const BASE = "/api/processos-negocio";

// ============================================================
// API
// ============================================================

export const processosNegocioApi = {
  getAll(diretoria?: string): Promise<ProcessoNegocio[]> {
    const url = diretoria
      ? `${BASE}?diretoria=${encodeURIComponent(diretoria)}`
      : BASE;
    return apiClient.request<ProcessoNegocio[]>(url);
  },

  getById(id: number): Promise<ProcessoNegocio> {
    return apiClient.request<ProcessoNegocio>(`${BASE}/${id}`);
  },

  create(data: CreateProcessoNegocioDto): Promise<ProcessoNegocio> {
    return apiClient.post<ProcessoNegocio>(BASE, data);
  },

  update(id: number, data: UpdateProcessoNegocioDto): Promise<ProcessoNegocio> {
    return apiClient.put<ProcessoNegocio>(`${BASE}/${id}`, data);
  },

  enviar(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/enviar`);
  },

  validarAutor(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/validar-autor`);
  },

  validarDiretoria(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/validar-diretoria`);
  },

  validarFinal(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/validar-final`);
  },

  recusar(
    id: number,
    camada: "autor" | "diretoria" | "final",
    motivo: string,
  ): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/recusar`, {
      camada,
      motivo,
    });
  },

  remove(id: number): Promise<void> {
    return apiClient.delete(`${BASE}/${id}`);
  },

  /** Anexa o PDF de aprovação (Modelo K1). Restrito a superadmin no backend. */
  setAprovacao(
    id: number,
    data: { aprovacao_data: string; aprovacao_filename: string; aprovacao_mime: string },
  ): Promise<ProcessoNegocio> {
    return apiClient.put<ProcessoNegocio>(`${BASE}/${id}/aprovacao`, data);
  },

  /** Remove o PDF de aprovação. Restrito a superadmin no backend. */
  removeAprovacao(id: number): Promise<ProcessoNegocio> {
    return apiClient.delete<ProcessoNegocio>(`${BASE}/${id}/aprovacao`);
  },

  /** Lista as versões homologadas (snapshots) de um processo */
  listVersoes(id: number): Promise<VersaoHistorico[]> {
    return apiClient.request<VersaoHistorico[]>(`${BASE}/${id}/versoes`);
  },

  /** Retorna o snapshot completo de uma versão específica */
  getVersaoSnapshot(id: number, historicoId: number): Promise<ProcessoNegocio> {
    return apiClient.request<ProcessoNegocio>(
      `${BASE}/${id}/versoes/${historicoId}`,
    );
  },
};

// ============================================================
// HELPERS
// ============================================================

export const STATUS_LABEL: Record<ProcessoStatus, string> = {
  em_elaboracao: "Em elaboração",
  enviado: "Aguardando validação do autor",
  validado_autor: "Aguardando validação da diretoria",
  validado_diretoria: "Aguardando validação final",
  validado_final: "Homologado",
  recusado: "Recusado",
};

export const STATUS_COLOR: Record<ProcessoStatus, string> = {
  em_elaboracao: "bg-slate-100 text-slate-700 border-slate-200",
  enviado: "bg-amber-50 text-amber-700 border-amber-200",
  validado_autor: "bg-blue-50 text-blue-700 border-blue-200",
  validado_diretoria: "bg-indigo-50 text-indigo-700 border-indigo-200",
  validado_final: "bg-emerald-50 text-emerald-700 border-emerald-200",
  recusado: "bg-red-50 text-red-700 border-red-200",
};
