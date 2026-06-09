import { apiClient } from './apiClient';

// ============================================================
// INTERFACES
// ============================================================

export interface Ambiente {
  id: number;
  nome: string;
  codigo: string;
  descricao?: string;
  diretoria_raiz?: string;
  ativo: boolean;
  total_areas?: number;
  total_users?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAmbienteDto {
  nome: string;
  codigo: string;
  descricao?: string;
  sigla_raiz: string;
  nome_raiz: string;
}

export interface UpdateAmbienteDto {
  nome?: string;
  descricao?: string;
  ativo?: boolean;
}

// ============================================================
// API FUNCTIONS
// ============================================================

const BASE_URL = '/api/ambientes';

/**
 * Buscar todos os ambientes
 */
export async function getAll(): Promise<Ambiente[]> {
  return apiClient.request<Ambiente[]>(BASE_URL);
}

/**
 * Buscar ambiente por ID
 */
export async function getById(id: number): Promise<Ambiente> {
  return apiClient.request<Ambiente>(`${BASE_URL}/${id}`);
}

/**
 * Criar novo ambiente
 */
export async function create(dto: CreateAmbienteDto): Promise<Ambiente> {
  return apiClient.request<Ambiente>(BASE_URL, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

/**
 * Atualizar ambiente
 */
export async function update(id: number, dto: UpdateAmbienteDto): Promise<Ambiente> {
  return apiClient.request<Ambiente>(`${BASE_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

/**
 * Excluir ambiente
 */
export async function remove(id: number): Promise<void> {
  await apiClient.request(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================
// ADMIN MANAGEMENT
// ============================================================

export interface AmbienteAdmin {
  id: number;
  name: string;
  email: string;
  role: string;
  diretoria: string;
}

/**
 * Listar admins de um ambiente
 */
export async function getAdmins(codigo: string): Promise<AmbienteAdmin[]> {
  return apiClient.request<AmbienteAdmin[]>(`${BASE_URL}/${codigo}/admins`);
}

/**
 * Adicionar admin a um ambiente
 */
export async function addAdmin(codigo: string, data: { email: string; name: string; password?: string }): Promise<AmbienteAdmin> {
  return apiClient.request<AmbienteAdmin>(`${BASE_URL}/${codigo}/admins`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Remover admin de um ambiente
 */
export async function removeAdmin(codigo: string, userId: number): Promise<void> {
  await apiClient.request(`${BASE_URL}/${codigo}/admins/${userId}`, {
    method: 'DELETE',
  });
}

// Export como objeto
export const ambientesApi = {
  getAll,
  getById,
  create,
  update,
  remove,
  getAdmins,
  addAdmin,
  removeAdmin,
};
