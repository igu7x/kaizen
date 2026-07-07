import { Contract } from '@/types';
import { apiClient } from './apiClient';

import Storage from "@/utils/storage";
import { User } from "@/types";

/**
 * Interface for filtering contracts
 */
export interface ContractFilters {
  startDate?: string;
  endDate?: string;
  contractType?: string;
  searchQuery?: string;
  minhasDemandas?: boolean;
}

/**
 * Helper para obter headers com informações do usuário
 */
function getUserHeaders(): Record<string, string> {
  const user = Storage.load<User | null>("user", null);
  if (user) {
    return {
      "x-user-id": String(user.id),
      "x-user-role": user.role || "",
    };
  }
  return {};
}

/**
 * Fetches all contracts, optionally filtered
 */
export async function getContracts(filters?: ContractFilters): Promise<Contract[]> {
  const queryParams = new URLSearchParams();
  
  if (filters) {
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.contractType) queryParams.append('contractType', filters.contractType);
    if (filters.searchQuery) queryParams.append('searchQuery', filters.searchQuery);
    if (filters.minhasDemandas) queryParams.append('minhasDemandas', 'true');
  }

  const queryString = queryParams.toString();
  const url = queryString ? `/api/contracts?${queryString}` : '/api/contracts';
  
  return apiClient.get<Contract[]>(url, {
    headers: getUserHeaders()
  });
}

/**
 * Fetches a single contract by ID
 */
export async function getContractById(id: number): Promise<Contract> {
  return apiClient.get<Contract>(`/api/contracts/${id}`, {
    headers: getUserHeaders()
  });
}

export async function createContract(data: Partial<Contract>): Promise<Contract> {
  return apiClient.post<Contract>('/api/contracts', data, {
    headers: getUserHeaders()
  });
}

export async function updateContract(id: number, data: Partial<Contract>): Promise<Contract> {
  return apiClient.put<Contract>(`/api/contracts/${id}`, data, {
    headers: getUserHeaders()
  });
}

export async function deleteContract(id: number): Promise<void> {
  return apiClient.delete<void>(`/api/contracts/${id}`, {
    headers: getUserHeaders()
  });
}

// Relacionamento N:N com PCAs
export async function getContractPcas(id: number): Promise<any[]> {
  return apiClient.get<any[]>(`/api/contracts/${id}/pcas`, {
    headers: getUserHeaders()
  });
}

export async function linkPcas(id: number, pcaIds: number[]): Promise<void> {
  return apiClient.post<void>(`/api/contracts/${id}/pcas`, { pcaIds }, {
    headers: getUserHeaders()
  });
}

export async function unlinkPca(id: number, pcaId: number): Promise<void> {
  return apiClient.delete<void>(`/api/contracts/${id}/pcas/${pcaId}`, {
    headers: getUserHeaders()
  });
}

export const contractsApi = {
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  getContractPcas,
  linkPcas,
  unlinkPca
};

export default contractsApi;
