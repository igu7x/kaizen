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
}

export interface AuditoriaFacetas {
  acoes: string[];
  tabelas: string[];
}

const BASE = "/api/auditoria";

export const auditoriaApi = {
  getAuditoria(params?: {
    acao?: string;
    tabela?: string;
    busca?: string;
    limite?: number;
  }): Promise<AuditoriaRegistro[]> {
    const qs = new URLSearchParams();
    if (params?.acao) qs.set("acao", params.acao);
    if (params?.tabela) qs.set("tabela", params.tabela);
    if (params?.busca) qs.set("busca", params.busca);
    if (params?.limite) qs.set("limite", String(params.limite));
    const s = qs.toString();
    return apiClient.get<AuditoriaRegistro[]>(`${BASE}${s ? `?${s}` : ""}`);
  },

  getFacetas(): Promise<AuditoriaFacetas> {
    return apiClient.get<AuditoriaFacetas>(`${BASE}/facetas`);
  },
};
