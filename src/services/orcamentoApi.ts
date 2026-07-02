import { apiClient } from "./apiClient";

/**
 * Cap. 8 (Orçamento de TIC) — atribuição de Editores por escopo (RN-GERAL-09) e juntada das atas
 * dos comitês CGTIC/CGOVTIC (RN-GERAL-04). Espelha OrcamentoPapelController e AtaComiteController.
 */

/** Escopos internos do modelo Editor × Autoridade. */
export type EscopoOrcamento = "cca" | "demandante" | "gejut" | "sgjt";

/** Comitês externos (deliberam no PROAD; o Kaizen reflete via juntada de ata). */
export type ComiteOrcamento = "cgtic" | "cgovtic";

export interface EditorOrcamento {
  id: number;
  user_id: number;
  escopo: EscopoOrcamento;
  ciclo_id: number | null;
  created_at: string | null;
  user_name: string | null;
  user_email: string | null;
}

export interface AtaComite {
  id: number;
  ciclo_id: number | null;
  comite: ComiteOrcamento;
  numero: string | null;
  data_ata: string | null;
  decisao: string | null;
  anexo_url: string | null;
  created_at: string | null;
}

export interface RegistrarAtaRequest {
  cicloId?: number | null;
  comite: ComiteOrcamento;
  numero?: string | null;
  dataAta?: string | null;
  decisao?: string | null;
  anexoUrl?: string | null;
}

export const orcamentoApi = {
  // ---------- Editores (RN-GERAL-09) ----------

  /** Lista os Editores atribuídos (opcionalmente por escopo/ciclo). */
  listarEditores(escopo?: EscopoOrcamento, cicloId?: number): Promise<EditorOrcamento[]> {
    const params = new URLSearchParams();
    if (escopo) params.set("escopo", escopo);
    if (cicloId != null) params.set("cicloId", String(cicloId));
    const qs = params.toString();
    return apiClient.get<EditorOrcamento[]>(`/api/orcamento/editores${qs ? `?${qs}` : ""}`);
  },

  /** Atribui um usuário como Editor de um escopo (ato da Autoridade do escopo). */
  atribuirEditor(userId: number, escopo: EscopoOrcamento, cicloId?: number | null): Promise<void> {
    return apiClient.post<void>(`/api/orcamento/editores`, { userId, escopo, cicloId: cicloId ?? null });
  },

  /** Revoga a atribuição de Editor. */
  revogarEditor(userId: number, escopo: EscopoOrcamento, cicloId?: number): Promise<void> {
    const params = new URLSearchParams({ userId: String(userId), escopo });
    if (cicloId != null) params.set("cicloId", String(cicloId));
    return apiClient.delete<void>(`/api/orcamento/editores?${params.toString()}`);
  },

  // ---------- Atas dos comitês (RN-GERAL-04) ----------

  /** Lista as atas juntadas (opcionalmente de um ciclo). */
  listarAtas(cicloId?: number): Promise<AtaComite[]> {
    const qs = cicloId != null ? `?cicloId=${cicloId}` : "";
    return apiClient.get<AtaComite[]>(`/api/orcamento/atas${qs}`);
  },

  /** Junta (registra) a ata de um comitê — ato do Editor SGJT. */
  registrarAta(req: RegistrarAtaRequest): Promise<AtaComite> {
    return apiClient.post<AtaComite>(`/api/orcamento/atas`, req);
  },

  /** Remove uma ata juntada. */
  excluirAta(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/orcamento/atas/${id}`);
  },
};
