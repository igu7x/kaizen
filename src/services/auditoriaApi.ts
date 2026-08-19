import { apiClient } from "./apiClient";

/** Um registro da trilha de auditoria GLOBAL (leitura de audit_log). */
export interface AuditoriaRegistro {
  id: number;
  created_at: string;
  action: string;
  table_name: string;
  record_id: number | null;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  changed_fields: string | null;
  /** Nome do item mexido, extraído do conteúdo gravado — "nº 17" sozinho não diz nada. */
  item_nome: string | null;
  /** Tem conteúdo de antes/depois pra abrir no detalhe. */
  tem_detalhe: boolean;
}

/** Página da trilha: `total` é a contagem completa do filtro, não o tamanho da página. */
export interface AuditoriaPagina {
  total: number;
  pagina: number;
  tamanho: number;
  itens: AuditoriaRegistro[];
}

/** Registro completo — inclui os JSONs de antes/depois que alimentam o comparativo. */
export interface AuditoriaDetalhe extends AuditoriaRegistro {
  user_role: string | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  /**
   * Nomes das chaves estrangeiras citadas no antes/depois: `{ cadastros_areas_id: { "1": "SGJT" } }`.
   * Sem isso o comparativo mostraria "Área: de 2 para 1".
   */
  referencias: Record<string, Record<string, string>>;
}

export interface AuditoriaFacetas {
  acoes: string[];
  tabelas: string[];
}

const BASE = "/api/auditoria";

/**
 * O backend serializa bigint/Long como STRING (comportamento conhecido do Jackson neste projeto:
 * `audit_log.id` e a contagem chegam como `"1038"`). Normalizamos na entrada pra o resto da tela
 * poder fazer conta e comparação sem se preocupar com o tipo.
 */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizarRegistro<T extends AuditoriaRegistro>(r: T): T {
  return {
    ...r,
    id: num(r.id),
    record_id: r.record_id === null ? null : num(r.record_id),
    user_id: r.user_id === null ? null : num(r.user_id),
  };
}

export const auditoriaApi = {
  /**
   * Lista uma página da trilha. Sem teto de registros: paginando até `total` chega-se a 100% deles.
   * `tamanho: 0` traz tudo de uma vez.
   */
  getAuditoria(params?: {
    acao?: string;
    tabela?: string;
    busca?: string;
    /** Início do período (AAAA-MM-DD), inclusive. */
    de?: string;
    /** Fim do período (AAAA-MM-DD), inclusive — o dia inteiro entra no filtro. */
    ate?: string;
    pagina?: number;
    tamanho?: number;
  }): Promise<AuditoriaPagina> {
    const qs = new URLSearchParams();
    if (params?.acao) qs.set("acao", params.acao);
    if (params?.tabela) qs.set("tabela", params.tabela);
    if (params?.busca) qs.set("busca", params.busca);
    if (params?.de) qs.set("de", params.de);
    if (params?.ate) qs.set("ate", params.ate);
    if (params?.pagina) qs.set("pagina", String(params.pagina));
    if (params?.tamanho !== undefined)
      qs.set("tamanho", String(params.tamanho));
    const s = qs.toString();
    return apiClient
      .get<AuditoriaPagina>(`${BASE}${s ? `?${s}` : ""}`)
      .then((p) => ({
        ...p,
        total: num(p.total),
        pagina: num(p.pagina),
        tamanho: num(p.tamanho),
        itens: (p.itens || []).map(normalizarRegistro),
      }));
  },

  getDetalhe(id: number): Promise<AuditoriaDetalhe> {
    return apiClient
      .get<AuditoriaDetalhe>(`${BASE}/${id}`)
      .then(normalizarRegistro);
  },

  getFacetas(): Promise<AuditoriaFacetas> {
    return apiClient.get<AuditoriaFacetas>(`${BASE}/facetas`);
  },
};
