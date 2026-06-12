import { Contract } from '@/types';
import { apiClient } from './apiClient';

/**
 * Interface for filtering contracts
 */
export interface ContractFilters {
  startDate?: string;
  endDate?: string;
  contractType?: string;
  searchQuery?: string;
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
  }

  const queryString = queryParams.toString();
  const url = queryString ? `/api/contracts?${queryString}` : '/api/contracts';
  
  return apiClient.get<Contract[]>(url);
}

/**
 * Fetches a single contract by ID
 */
export async function getContractById(id: number): Promise<Contract> {
  return apiClient.get<Contract>(`/api/contracts/${id}`);
}

export const contractsApi = {
  getContracts,
  getContractById
};

export default contractsApi;
