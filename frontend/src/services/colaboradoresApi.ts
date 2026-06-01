import { apiClient, ApiError } from './apiClient';
import { Directorate } from '@/types';

// ============================================================
// TIPOS
// ============================================================

export interface Colaborador {
    id: number;
    colaborador: string;
    unidade_lotacao: string;
    situacao_funcional: string;
    nome_cc_fc: string | null;
    classe_cc_fc: string | null;
    cargo_efetivo: string | null;
    classe_efetivo: string | null;
    diretoria: Directorate;
    created_at: string;
    updated_at: string;
}

export interface CreateColaboradorDto {
    colaborador: string;
    unidade_lotacao: string;
    situacao_funcional: string;
    nome_cc_fc?: string | null;
    classe_cc_fc?: string | null;
    cargo_efetivo?: string | null;
    classe_efetivo?: string | null;
    diretoria: Directorate;
}

export interface UpdateColaboradorDto {
    colaborador?: string;
    unidade_lotacao?: string;
    situacao_funcional?: string;
    nome_cc_fc?: string | null;
    classe_cc_fc?: string | null;
    cargo_efetivo?: string | null;
    classe_efetivo?: string | null;
    diretoria?: Directorate;
}

export interface Estatisticas {
    total_colaboradores: number;
    total_estatutarios: number;
    total_cedidos: number;
    total_comissionados: number;
    total_terceirizados: number;
    total_residentes: number;
    total_estagiarios: number;
    percentual_estatutarios: number;
    percentual_cedidos: number;
    percentual_comissionados: number;
    percentual_terceirizados: number;
    percentual_residentes: number;
    percentual_estagiarios: number;
}

export const SITUACOES_FUNCIONAIS = [
    'ESTATUTÁRIO',
    'NOMEADO EM COMISSÃO - INSS',
    'CEDIDO',
    'TERCEIRIZADO',
    'RESIDENTE',
    'ESTAGIÁRIO'
] as const;

export type SituacaoFuncional = typeof SITUACOES_FUNCIONAIS[number];

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Busca todos os colaboradores
 * @param diretoria - Filtrar por diretoria (opcional)
 */
export const getColaboradores = async (diretoria?: Directorate): Promise<Colaborador[]> => {
    const params = diretoria ? `?diretoria=${diretoria}` : '';
    return apiClient.get<Colaborador[]>(`/api/colaboradores${params}`);
};

/**
 * Busca estatísticas dos colaboradores
 * @param diretoria - Filtrar por diretoria (opcional)
 */
export const getEstatisticas = async (diretoria?: Directorate): Promise<Estatisticas> => {
    const params = diretoria ? `?diretoria=${diretoria}` : '';
    return apiClient.get<Estatisticas>(`/api/colaboradores/estatisticas${params}`);
};

/**
 * Busca unidades de lotação disponíveis
 */
export const getUnidadesLotacao = async (): Promise<string[]> => {
    return apiClient.get<string[]>('/api/colaboradores/unidades');
};

/**
 * Busca colaborador por ID
 */
export const getColaboradorById = async (id: number): Promise<Colaborador | null> => {
    try {
        return await apiClient.get<Colaborador>(`/api/colaboradores/${id}`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
};

/**
 * Cria novo colaborador
 */
export const createColaborador = async (data: CreateColaboradorDto): Promise<Colaborador> => {
    return apiClient.post<Colaborador>('/api/colaboradores', data);
};

/**
 * Atualiza colaborador existente
 */
export const updateColaborador = async (id: number, data: UpdateColaboradorDto): Promise<Colaborador> => {
    return apiClient.put<Colaborador>(`/api/colaboradores/${id}`, data);
};

/**
 * Deleta colaborador (soft delete)
 */
export const deleteColaborador = async (id: number): Promise<void> => {
    await apiClient.delete<void>(`/api/colaboradores/${id}`);
};

// ============================================================
// ORGANOGRAMA
// ============================================================

/**
 * Busca organograma completo ou filtrado por diretoria
 */
export const getOrganograma = async (diretoria?: string): Promise<any[]> => {
    const params = diretoria ? `?diretoria=${diretoria}` : '';
    return apiClient.get<any[]>(`/api/colaboradores/organograma${params}`);
};

/**
 * Busca diretorias disponíveis no organograma
 */
export const getDiretorias = async (): Promise<string[]> => {
    return apiClient.get<string[]>('/api/colaboradores/organograma/diretorias');
};

/**
 * Busca subordinados diretos de um gestor
 */
export const getSubordinados = async (gestorId: number): Promise<any[]> => {
    return apiClient.get<any[]>(`/api/colaboradores/organograma/subordinados/${gestorId}`);
};

/**
 * Busca gestores por linha (nível hierárquico)
 */
export const getGestoresPorLinha = async (linha: number, diretoria?: string): Promise<any[]> => {
    const params = diretoria ? `?diretoria=${diretoria}` : '';
    return apiClient.get<any[]>(`/api/colaboradores/organograma/linha/${linha}${params}`);
};

/**
 * Busca possíveis pais (áreas superiores) para subordinação
 * @param linha - Linha do organograma (nível)
 * @param diretoria - Diretoria para filtrar (opcional)
 */
export const getPossiveisPais = async (linha: number, diretoria?: string): Promise<any[]> => {
    const params = diretoria ? `?diretoria=${encodeURIComponent(diretoria)}` : '';
    return apiClient.get<any[]>(`/api/colaboradores/organograma/possiveis-pais/${linha}${params}`);
};

/**
 * Cria novo gestor/área no organograma
 */
export const createGestor = async (data: any): Promise<any> => {
    return apiClient.post<any>('/api/colaboradores/organograma', data);
};

/**
 * Atualiza gestor/área existente
 */
export const updateGestor = async (id: number, data: any): Promise<any> => {
    return apiClient.put<any>(`/api/colaboradores/organograma/${id}`, data);
};

/**
 * Deleta gestor/área (soft delete)
 */
export const deleteGestor = async (id: number): Promise<void> => {
    return apiClient.delete<void>(`/api/colaboradores/organograma/${id}`);
};

/**
 * Busca gestor por ID
 */
export const getGestorById = async (id: number): Promise<any> => {
    return apiClient.get<any>(`/api/colaboradores/organograma/${id}`);
};

/**
 * Reordena gestores dentro do mesmo nível (Drag and Drop)
 */
export const reordenarGestores = async (
    linha_organograma: number, 
    nova_ordem: Array<{ id: number; ordem: number }>
): Promise<{ success: boolean; message: string }> => {
    return apiClient.put<{ success: boolean; message: string }>(
        '/api/colaboradores/organograma/reordenar',
        { linha_organograma, nova_ordem }
    );
};

// ============================================================
// EXPORT
// ============================================================

export const colaboradoresApi = {
    getColaboradores,
    getEstatisticas,
    getUnidadesLotacao,
    getColaboradorById,
    createColaborador,
    updateColaborador,
    deleteColaborador,
    // Organograma
    getOrganograma,
    getDiretorias,
    getSubordinados,
    getGestoresPorLinha,
    getPossiveisPais,
    createGestor,
    updateGestor,
    deleteGestor,
    getGestorById,
    reordenarGestores
};

export default colaboradoresApi;

