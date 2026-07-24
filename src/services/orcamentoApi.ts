import { apiClient, getApiBaseUrl } from "./apiClient";

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
  // Metadados S3
  file_key: string | null;
  original_filename: string | null;
  content_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
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

/** Extensões permitidas para upload de ATAs (deve espelhar StorageService.ALLOWED_EXTENSIONS). */
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

/**
 * Validação client-side antes do upload. Retorna mensagem de erro ou null se válido.
 */
export function validarArquivoAta(file: File): string | null {
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Extensão '${ext}' não permitida. Aceitas: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Arquivo excede o limite de 15 MB (tamanho: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
  }
  return null;
}

/**
 * Formata tamanho em bytes para exibição legível (ex: "2.3 MB", "450 KB").
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  /**
   * Junta (registra) a ata de um comitê com upload opcional de arquivo via FormData.
   * O apiClient detecta FormData e omite Content-Type (browser seta multipart/form-data com boundary).
   */
  registrarAta(req: RegistrarAtaRequest, arquivo?: File): Promise<AtaComite> {
    const formData = new FormData();
    formData.append("dados", JSON.stringify(req));
    if (arquivo) {
      formData.append("arquivo", arquivo);
    }
    return apiClient.post<AtaComite>(`/api/orcamento/atas`, formData);
  },

  /** Remove uma ata juntada (e o arquivo S3 associado, se existir). */
  excluirAta(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/orcamento/atas/${id}`);
  },

  /** URL de download autenticado via streaming pelo backend. */
  getUrlDownloadAta(ataId: number): string {
    return `${getApiBaseUrl()}/api/orcamento/atas/${ataId}/download`;
  },
};
