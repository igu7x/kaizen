import { apiClient } from './apiClient';

// ============================================================
// INTERFACES
// ============================================================

export interface Pessoa {
  id: number;
  area_id: number;
  area_nome?: string;
  unidade_id?: number | null;
  unidade_nome?: string;
  nome: string;
  nome_exibicao?: string;
  usuario?: string;
  email?: string;
  situacao?: string;
  cc_fc?: string;
  cc_fc_classe?: string;
  cargo_efetivo?: string;
  cargo_efetivo_classe?: string;
  linha_organograma: number;
  subordinacao_id: number | null;
  ordem: number;
  ativo: boolean;
  user_id?: number | null;
  foto_perfil?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePessoaDto {
  area_id: number;
  unidade_id?: number | null;
  nome: string;
  nome_exibicao?: string;
  usuario?: string;
  email?: string;
  situacao?: string;
  cc_fc?: string;
  cc_fc_classe?: string;
  cargo_efetivo?: string;
  cargo_efetivo_classe?: string;
  linha_organograma?: number;
}

export interface UpdatePessoaDto {
  nome?: string;
  nome_exibicao?: string;
  unidade_id?: number | null;
  usuario?: string;
  email?: string;
  situacao?: string;
  cc_fc?: string;
  cc_fc_classe?: string;
  cargo_efetivo?: string;
  cargo_efetivo_classe?: string;
  linha_organograma?: number;
  subordinacao_id?: number | null;
}

// ============================================================
// API FUNCTIONS
// ============================================================

const BASE_URL = '/api/pessoas';

/**
 * Buscar todas as pessoas (opcionalmente filtradas por domínio)
 */
export async function getAll(dominio?: string): Promise<Pessoa[]> {
  const url = dominio ? `${BASE_URL}?dominio=${encodeURIComponent(dominio)}` : BASE_URL;
  return apiClient.request<Pessoa[]>(url);
}

export async function getByAreaId(areaId: number): Promise<Pessoa[]> {
  return apiClient.request<Pessoa[]>(`${BASE_URL}/area/${areaId}`);
}

/**
 * Buscar pessoas de uma unidade
 */
export async function getByUnidadeId(unidadeId: number): Promise<Pessoa[]> {
  return apiClient.request<Pessoa[]>(`${BASE_URL}/unidade/${unidadeId}`);
}

/**
 * Buscar pessoa por ID
 */
export async function getById(id: number): Promise<Pessoa> {
  return apiClient.request<Pessoa>(`${BASE_URL}/${id}`);
}

export interface PerfilCompleto {
  pessoa_id: number;
  user_id: number | null;
  nome: string;
  nome_exibicao: string | null;
  email: string | null;
  situacao: string | null;
  cc_fc: string | null;
  cc_fc_classe: string | null;
  cargo_efetivo: string | null;
  cargo_efetivo_classe: string | null;
  area_nome: string | null;
  area_sigla: string | null;
  unidade_nome: string | null;
  user_name: string | null;
  user_email: string | null;
  matricula: string | null;
  cargo_funcao: string | null;
  foto_perfil: string | null;
  user_role: string | null;
  user_diretoria: string | null;
}

/**
 * Buscar perfil completo da pessoa (dados consolidados de cadastros_pessoas + users)
 */
export async function getPerfilCompleto(id: number): Promise<PerfilCompleto> {
  return apiClient.request<PerfilCompleto>(`${BASE_URL}/${id}/perfil-completo`);
}

/**
 * Criar nova pessoa
 */
export async function create(dto: CreatePessoaDto): Promise<Pessoa> {
  return apiClient.request<Pessoa>(BASE_URL, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

/**
 * Atualizar pessoa
 */
export async function update(id: number, dto: UpdatePessoaDto): Promise<Pessoa> {
  return apiClient.request<Pessoa>(`${BASE_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

/**
 * Excluir pessoa
 */
export async function remove(id: number): Promise<void> {
  await apiClient.request(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}

// Export como objeto
export const pessoasApi = {
  getAll,
  getByAreaId,
  getByUnidadeId,
  getById,
  getPerfilCompleto,
  create,
  update,
  remove,
};
