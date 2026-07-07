import { apiClient } from "./apiClient";

// ============================================================
// INTERFACES
// ============================================================

export interface Area {
  id: number;
  nome: string;
  sigla?: string;
  subordinacao?: string;
  gestor?: string;
  gestor_user_id?: number | null;
  cargo_gestor?: string;
  subdiretor?: string;
  subdiretor_user_id?: number | null;
  cargo_subdiretor?: string;
  gerido_por_unidade_superior: boolean;
  ordem_linha: number;
  ordem_posicao: number;
  ativo: boolean;
  dominio?: string;
  is_domain_root?: boolean;
  codigo_api?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAreaDto {
  nome: string;
  sigla?: string;
  subordinacao?: string;
  gestor?: string;
  cargo_gestor?: string;
  subdiretor?: string;
  cargo_subdiretor?: string;
  gerido_por_unidade_superior?: boolean;
  codigo_api?: string;
}

export interface UpdateAreaDto {
  nome?: string;
  sigla?: string;
  subordinacao?: string;
  gestor?: string;
  cargo_gestor?: string;
  subdiretor?: string;
  cargo_subdiretor?: string;
  gerido_por_unidade_superior?: boolean;
  codigo_api?: string;
}

// ============================================================
// INTERFACES DE UNIDADES
// ============================================================

export interface Unidade {
  id: number;
  area_id: number;
  nome: string;
  sigla?: string;
  descricao?: string;
  responsavel?: string;
  cargo_responsavel?: string;
  responsavel_user_id?: number | null;
  unidade_superior_id?: number | null;
  unidade_superior_nome?: string;
  ordem: number;
  ativo: boolean;
  codigo_api?: string;
  created_at: string;
  updated_at: string;
}

export interface AreaCompleta extends Area {
  unidades: Unidade[];
}

export interface CreateUnidadeDto {
  nome: string;
  sigla?: string;
  descricao?: string;
  responsavel?: string;
  cargo_responsavel?: string;
  unidade_superior_id?: number | null;
  codigo_api?: string;
}

export interface UpdateUnidadeDto {
  nome?: string;
  sigla?: string;
  descricao?: string;
  responsavel?: string;
  cargo_responsavel?: string;
  unidade_superior_id?: number | null;
  ordem?: number;
  codigo_api?: string;
}

// ============================================================
// API FUNCTIONS
// ============================================================

const BASE_URL = "/api/areas";

/**
 * Buscar todas as áreas (filtradas por domínio do usuário logado)
 */
export async function getAll(): Promise<Area[]> {
  return apiClient.request<Area[]>(BASE_URL);
}

/**
 * Buscar áreas de um domínio específico (dev mode)
 */
export async function getByDominio(dominio: string): Promise<Area[]> {
  return apiClient.request<Area[]>(
    `${BASE_URL}?dominio=${encodeURIComponent(dominio)}`,
  );
}

/**
 * Buscar todas as áreas de todos os domínios (apenas para admin SGJT)
 */
export async function getAllGlobal(): Promise<Area[]> {
  return apiClient.request<Area[]>(`${BASE_URL}?all=true`);
}

/**
 * Buscar área por ID
 */
export async function getById(id: number): Promise<Area> {
  return apiClient.request<Area>(`${BASE_URL}/${id}`);
}

/**
 * Criar nova área
 */
export async function create(dto: CreateAreaDto): Promise<Area> {
  return apiClient.request<Area>(BASE_URL, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

/**
 * Atualizar área
 */
export async function update(id: number, dto: UpdateAreaDto): Promise<Area> {
  return apiClient.request<Area>(`${BASE_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

/**
 * Excluir área
 */
export async function remove(id: number): Promise<void> {
  await apiClient.request(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
}

/**
 * Atualizar ordenação (drag and drop)
 */
export async function updateOrdenacao(
  ordenacao: { id: number; ordem_linha: number; ordem_posicao: number }[],
): Promise<void> {
  await apiClient.request(`${BASE_URL}/ordenacao`, {
    method: "PUT",
    body: JSON.stringify({ ordenacao }),
  });
}

/**
 * Buscar áreas para select/dropdown
 */
export async function getForSelect(): Promise<{ id: number; nome: string }[]> {
  return apiClient.request<{ id: number; nome: string }[]>(
    `${BASE_URL}/select`,
  );
}

/**
 * Buscar área completa com unidades
 */
export async function getAreaCompleta(id: number): Promise<AreaCompleta> {
  return apiClient.request<AreaCompleta>(`${BASE_URL}/${id}/completa`);
}

// ============================================================
// FUNÇÕES DE UNIDADES
// ============================================================

/**
 * Buscar unidades de uma área
 */
export async function getAllUnidades(
  dominio?: string,
): Promise<(Unidade & { area_nome?: string; area_sigla?: string })[]> {
  const url = dominio
    ? `${BASE_URL}/unidades/all?dominio=${encodeURIComponent(dominio)}`
    : `${BASE_URL}/unidades/all`;
  return apiClient.request<
    (Unidade & { area_nome?: string; area_sigla?: string })[]
  >(url);
}

export async function getUnidades(areaId: number): Promise<Unidade[]> {
  return apiClient.request<Unidade[]>(`${BASE_URL}/${areaId}/unidades`);
}

/**
 * Criar unidade em uma área
 */
export async function createUnidade(
  areaId: number,
  dto: CreateUnidadeDto,
): Promise<Unidade> {
  return apiClient.request<Unidade>(`${BASE_URL}/${areaId}/unidades`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

/**
 * Atualizar unidade
 */
export async function updateUnidade(
  id: number,
  dto: UpdateUnidadeDto,
): Promise<Unidade> {
  return apiClient.request<Unidade>(`${BASE_URL}/unidades/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

/**
 * Excluir unidade
 */
export async function removeUnidade(id: number): Promise<void> {
  await apiClient.request(`${BASE_URL}/unidades/${id}`, {
    method: "DELETE",
  });
}

export interface UnidadeUsuarios {
  unidade: { id: number; nome: string; descricao: string | null };
  gestor: {
    user_id: number | null;
    nome: string;
    email: string | null;
    role: string | null;
    cargo: string | null;
  } | null;
  colaboradores: Array<{
    pessoa_id: number;
    nome: string;
    cargo: string | null;
    email: string | null;
    user_id: number | null;
    user_role: string | null;
  }>;
}

export async function getUnidadeUsuarios(
  unidadeId: number,
): Promise<UnidadeUsuarios> {
  return apiClient.request<UnidadeUsuarios>(
    `${BASE_URL}/unidades/${unidadeId}/usuarios`,
  );
}

/**
 * Reordenar unidades (trocar posições)
 */
export async function reorderUnidades(
  areaId: number,
  ordenacao: { id: number; ordem: number }[],
): Promise<void> {
  await apiClient.request(`${BASE_URL}/${areaId}/unidades/reorder`, {
    method: "PUT",
    body: JSON.stringify({ ordenacao }),
  });
}

// Export como objeto
export const areasApi = {
  getAll,
  getByDominio,
  getAllGlobal,
  getById,
  create,
  update,
  remove,
  updateOrdenacao,
  getForSelect,
  getAreaCompleta,
  // Unidades
  getAllUnidades,
  getUnidades,
  createUnidade,
  updateUnidade,
  removeUnidade,
  reorderUnidades,
  getUnidadeUsuarios,
};
