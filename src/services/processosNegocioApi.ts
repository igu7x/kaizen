import { apiClient } from './apiClient';

// ============================================================
// INTERFACES
// ============================================================

export type ProcessoStatus =
  | 'em_elaboracao'
  | 'enviado'
  | 'validado_autor'
  | 'validado_diretoria'
  | 'validado_final'
  | 'recusado';

export type TipoDocumentoAnexado = 'MPS' | 'POP' | 'AUX' | 'PRI';

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
  MPS: 'MPS — Manual de Procedimentos Setoriais',
  POP: 'POP — Procedimento Operacional Padrão',
  AUX: 'Docs Auxiliares',
  PRI: 'Documento Primário',
};

export const TIPO_DOCUMENTO_BADGE: Record<TipoDocumentoAnexado, string> = {
  MPS: 'bg-blue-100 text-blue-700 border-blue-200',
  POP: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  AUX: 'bg-slate-100 text-slate-700 border-slate-200',
  PRI: 'bg-violet-100 text-violet-700 border-violet-200',
};

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
  proprietarios: string[];
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
  recusado_camada: 'autor' | 'diretoria' | 'final' | null;
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
  proprietarios?: string[];
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

const BASE = '/api/processos-negocio';

// ============================================================
// API
// ============================================================

export const processosNegocioApi = {
  getAll(diretoria?: string): Promise<ProcessoNegocio[]> {
    const url = diretoria ? `${BASE}?diretoria=${encodeURIComponent(diretoria)}` : BASE;
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

  recusar(id: number, camada: 'autor' | 'diretoria' | 'final', motivo: string): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/recusar`, { camada, motivo });
  },

  remove(id: number): Promise<void> {
    return apiClient.delete(`${BASE}/${id}`);
  },

  /** Lista as versões homologadas (snapshots) de um processo */
  listVersoes(id: number): Promise<VersaoHistorico[]> {
    return apiClient.request<VersaoHistorico[]>(`${BASE}/${id}/versoes`);
  },

  /** Retorna o snapshot completo de uma versão específica */
  getVersaoSnapshot(id: number, historicoId: number): Promise<ProcessoNegocio> {
    return apiClient.request<ProcessoNegocio>(`${BASE}/${id}/versoes/${historicoId}`);
  },
};

// ============================================================
// HELPERS
// ============================================================

export const STATUS_LABEL: Record<ProcessoStatus, string> = {
  em_elaboracao: 'Em elaboração',
  enviado: 'Aguardando validação do autor',
  validado_autor: 'Aguardando validação da diretoria',
  validado_diretoria: 'Aguardando validação final',
  validado_final: 'Homologado',
  recusado: 'Recusado',
};

export const STATUS_COLOR: Record<ProcessoStatus, string> = {
  em_elaboracao: 'bg-slate-100 text-slate-700 border-slate-200',
  enviado: 'bg-amber-50 text-amber-700 border-amber-200',
  validado_autor: 'bg-blue-50 text-blue-700 border-blue-200',
  validado_diretoria: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  validado_final: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  recusado: 'bg-red-50 text-red-700 border-red-200',
};
