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
): Promise<PcaItem[]> {
  const params = new URLSearchParams();
  if (ano) params.set("ano", String(ano));
  if (diretoria) params.set("diretoria", diretoria);
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
): Promise<PcaStats> {
  const params = new URLSearchParams();
  if (ano) params.set("ano", String(ano));
  if (diretoria) params.set("diretoria", diretoria);
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

  // Helpers
  formatCurrency,
  getStatusColor,
  getStatusBadgeClass,
};

export default pcaApi;
