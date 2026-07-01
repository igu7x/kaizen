/**
 * API de Contratações de TI (PCA)
 *
 * Este arquivo fornece funções para comunicação com os endpoints do PCA.
 */

import {
  PcaItem,
  CreatePcaItemDto,
  UpdatePcaItemDto,
  PcaStats,
  PcaFilters,
  PcaStatus,
} from "@/types";
import { apiClient, ApiError } from "./apiClient";
import Storage from "@/utils/storage";
import { User } from "@/types";

/**
 * Helper para obter headers com informações do usuário
 */
function getUserHeaders(): Record<string, string> {
  const user = Storage.load<User | null>("user", null);
  if (user) {
    return {
      "x-user-id": String(user.id),
      "x-user-role": user.role,
    };
  }
  return {};
}

// ============================================================
// API DE ITENS PCA
// ============================================================

/**
 * Buscar todos os itens PCA
 */
export async function getPcaItems(
  ano?: number,
  diretoria?: string,
  versionNumber?: number,
): Promise<PcaItem[]> {
  const params = new URLSearchParams();
  if (ano) params.set("ano", String(ano));
  if (diretoria) params.set("diretoria", diretoria);
  if (versionNumber) params.set("versionNumber", String(versionNumber));
  const url = `/api/pca-items${params.toString() ? "?" + params.toString() : ""}`;
  return apiClient.get<PcaItem[]>(url, {
    headers: getUserHeaders(),
  });
}

/**
 * Buscar um item PCA por ID
 */
export async function getPcaItemById(id: number): Promise<PcaItem | null> {
  try {
    return await apiClient.get<PcaItem>(`/api/pca-items/${id}`, {
      headers: getUserHeaders(),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Buscar estatísticas do PCA
 */
export async function getPcaStats(
  ano?: number,
  diretoria?: string,
  versionNumber?: number,
): Promise<PcaStats> {
  const params = new URLSearchParams();
  if (ano) params.set("ano", String(ano));
  if (diretoria) params.set("diretoria", diretoria);
  if (versionNumber) params.set("versionNumber", String(versionNumber));
  const url = `/api/pca-items/stats${params.toString() ? "?" + params.toString() : ""}`;
  return apiClient.get<PcaStats>(url, {
    headers: getUserHeaders(),
  });
}

/**
 * Buscar opções de filtros
 */
export async function getPcaFilters(): Promise<PcaFilters> {
  return apiClient.get<PcaFilters>("/api/pca-items/filters", {
    headers: getUserHeaders(),
  });
}

/**
 * Buscar versões de um PCA
 */
export async function getPcaVersions(ano: number): Promise<number[]> {
  return apiClient.get<number[]>(`/api/pca-items/versions?ano=${ano}`, {
    headers: getUserHeaders(),
  });
}

/**
 * RF-46/57 — proveniência das versões publicadas (versão → finalidade/ciclo/data).
 */
export interface PcaVersaoInfo {
  versao: number;
  finalidade: "formacao" | "revisao" | "manual";
  ciclo_id: number | null;
  publicado_em: string | null;
  publicado_por: number | null;
}

export async function getPcaVersoesInfo(ano: number): Promise<PcaVersaoInfo[]> {
  return apiClient.get<PcaVersaoInfo[]>(`/api/pca-items/versoes-info?ano=${ano}`, {
    headers: getUserHeaders(),
  });
}

/**
 * RF-54 — comparação entre duas versões do PCA-TIC.
 */
export interface PcaMudancaCampo {
  campo: string;
  de: unknown;
  para: unknown;
}

export interface PcaItemAlterado {
  item_pca: string;
  objeto: string;
  area_demandante: string;
  mudancas: PcaMudancaCampo[];
}

export interface PcaComparacao {
  ano: number;
  versaoNova: number | null;
  versaoAntiga: number | null;
  incluidos: PcaItem[];
  excluidos: PcaItem[];
  alterados: PcaItemAlterado[];
  totalNova: number;
  totalAntiga: number;
}

/**
 * Compara duas versões do PCA de um ano. Passe `undefined` para representar a versão viva/atual.
 */
export async function getPcaComparison(
  ano: number,
  versaoNova?: number,
  versaoAntiga?: number,
): Promise<PcaComparacao> {
  const params = new URLSearchParams();
  params.set("ano", String(ano));
  if (versaoNova != null) params.set("versaoNova", String(versaoNova));
  if (versaoAntiga != null) params.set("versaoAntiga", String(versaoAntiga));
  return apiClient.get<PcaComparacao>(`/api/pca-items/compare?${params.toString()}`, {
    headers: getUserHeaders(),
  });
}

/**
 * Criar snapshot (versão histórica) de um ano PCA
 */
export async function createPcaSnapshot(ano: number): Promise<void> {
  return apiClient.post<void>("/api/pca-items/snapshots", { ano }, {
    headers: getUserHeaders(),
  });
}

/**
 * Criar novo item PCA
 */
export async function createPcaItem(data: CreatePcaItemDto): Promise<PcaItem> {
  return apiClient.post<PcaItem>("/api/pca-items", data, {
    headers: getUserHeaders(),
  });
}

/**
 * Atualizar item PCA existente
 */
export async function updatePcaItem(
  id: number,
  data: UpdatePcaItemDto,
): Promise<PcaItem> {
  return apiClient.put<PcaItem>(`/api/pca-items/${id}`, data, {
    headers: getUserHeaders(),
  });
}

/**
 * Atualizar apenas o status de um item PCA
 */
export async function updatePcaItemStatus(
  id: number,
  status: PcaStatus,
): Promise<PcaItem> {
  return apiClient.patch<PcaItem>(
    `/api/pca-items/${id}/status`,
    { status },
    {
      headers: getUserHeaders(),
    },
  );
}

/**
 * Excluir item PCA (soft delete)
 */
export async function deletePcaItem(id: number): Promise<void> {
  await apiClient.delete<void>(`/api/pca-items/${id}`, {
    headers: getUserHeaders(),
  });
}

// ============================================================
// HELPERS DE FORMATAÇÃO
// ============================================================

/**
 * Formatar valor em reais
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Obter cor do badge de status
 */
export function getStatusColor(status: PcaStatus): string {
  switch (status) {
    case "Concluída":
      return "#66BB6A"; // Verde
    case "Em andamento":
      return "#FFA726"; // Laranja
    case "Não Iniciada":
    default:
      return "#9E9E9E"; // Cinza
  }
}

/**
 * Obter classe CSS do badge de status
 */
export function getStatusBadgeClass(status: PcaStatus): string {
  switch (status) {
    case "Concluída":
      return "bg-green-500 text-white";
    case "Em andamento":
      return "bg-amber-500 text-white";
    case "Não Iniciada":
    default:
      return "bg-gray-400 text-white";
  }
}

// ============================================================
// EXPORTAÇÃO DEFAULT
// ============================================================

export const pcaApi = {
  // CRUD
  getPcaItems,
  getPcaItemById,
  createPcaItem,
  updatePcaItem,
  updatePcaItemStatus,
  deletePcaItem,

  // Estatísticas e Filtros
  getPcaStats,
  getPcaFilters,
  getPcaVersions,
  createPcaSnapshot,

  // Helpers
  formatCurrency,
  getStatusColor,
  getStatusBadgeClass,
};

export default pcaApi;
