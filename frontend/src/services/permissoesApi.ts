import { apiClient } from './apiClient';

// Helper para obter userId do localStorage
const getUserId = (): string | null => {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            return user?.id?.toString() || null;
        }
    } catch (e) {
        console.warn('Erro ao parsear user do localStorage');
    }
    return null;
};

// Tipos — Diretoria agora é dinâmica (qualquer sigla de cadastros_areas)
export type Diretoria = string;

// Fallback estático (usado quando API não está disponível)
export const DIRETORIAS: string[] = ['SGJT', 'DPE', 'DIJUD', 'DITI', 'DSTI', 'CGJ', 'DG', 'SGP'];

// Labels conhecidos (fallback para áreas existentes antes do sistema dinâmico)
export const DIRETORIAS_LABELS: Record<string, string> = {
    'SGJT': 'Secretaria de Governança Judiciária e TI',
    'DPE': 'Diretoria de Processo Eletrônico',
    'DIJUD': 'Diretoria de Informática Judiciária',
    'DITI': 'Diretoria de Tecnologia da Informação',
    'DSTI': 'Diretoria de Suporte em TI',
    'CGJ': 'Corregedoria TJGO',
    'DG': 'Diretoria-Geral',
    'SGP': 'Secretaria-Geral da Presidência'
};

/**
 * Buscar diretorias dinamicamente do backend
 */
export async function getDiretoriasDinamicas(): Promise<string[]> {
    try {
        return await apiClient.get<string[]>('/api/colaboradores/diretorias');
    } catch {
        return DIRETORIAS;
    }
}

export interface Aba {
    codigo: string;
    nome: string;
    descricao: string | null;
    icone: string | null;
    ordem: number;
    ativo: boolean;
}

export interface PermissaoUsuario {
    aba_codigo: string;
    aba_nome: string;
    aba_icone: string | null;
    aba_ordem: number;
    pode_acessar: boolean;
    apenas_propria_diretoria: boolean;
}

export interface PermissaoDiretoria {
    aba_codigo: string;
    aba_nome: string;
    pode_acessar: boolean;
    apenas_propria_diretoria: boolean;
}

export interface MinhasPermissoes {
    diretoria: Diretoria | null;
    permissoes: PermissaoUsuario[];
}

export interface TodasPermissoes {
    abas: Aba[];
    permissoes_por_diretoria: Array<{
        diretoria: Diretoria;
        permissoes: PermissaoDiretoria[];
    }>;
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Buscar todas as abas da plataforma
 */
export const getAbas = async (): Promise<Aba[]> => {
    return apiClient.get<Aba[]>('/api/permissoes/abas');
};

/**
 * Buscar permissões do usuário logado
 */
export const getMinhasPermissoes = async (): Promise<MinhasPermissoes> => {
    const userId = getUserId();
    const headers: Record<string, string> = {};
    if (userId) {
        headers['X-User-Id'] = userId;
    }
    return apiClient.get<MinhasPermissoes>('/api/permissoes/minha', { headers });
};

/**
 * Buscar permissões de um usuário específico
 */
export const getPermissoesUsuario = async (usuarioId: number): Promise<PermissaoUsuario[]> => {
    return apiClient.get<PermissaoUsuario[]>(`/api/permissoes/usuario/${usuarioId}`);
};

/**
 * Verificar se pode acessar uma aba
 */
export const verificarPermissao = async (abaCodigo: string): Promise<{
    pode_acessar: boolean;
    apenas_propria_diretoria: boolean;
    diretoria_usuario: Diretoria | null;
}> => {
    const userId = getUserId();
    const headers: Record<string, string> = {};
    if (userId) {
        headers['X-User-Id'] = userId;
    }
    return apiClient.get(`/api/permissoes/verificar/${abaCodigo}`, { headers });
};

/**
 * Buscar permissões de uma diretoria
 */
export const getPermissoesDiretoria = async (diretoria: Diretoria): Promise<PermissaoDiretoria[]> => {
    return apiClient.get<PermissaoDiretoria[]>(`/api/permissoes/diretoria/${diretoria}`);
};

/**
 * Interface para módulo permitido no menu
 */
export interface ModuloPermitido {
    codigo: string;
    nome: string;
    descricao: string | null;
    apenas_propria_diretoria: boolean;
}

/**
 * Buscar módulos permitidos para o menu (baseado na diretoria)
 */
export const getModulosPermitidosMenu = async (diretoria: Diretoria): Promise<{
    diretoria: Diretoria;
    modulos_permitidos: ModuloPermitido[];
}> => {
    return apiClient.get(`/api/permissoes/menu/${diretoria}`);
};

/**
 * Buscar todas as permissões (apenas SGJT)
 * Não faz logout em caso de erro - pode ser que as tabelas não existam ainda
 */
export const getTodasPermissoes = async (): Promise<TodasPermissoes> => {
    const userId = getUserId();
    const headers: Record<string, string> = {};
    if (userId) {
        headers['X-User-Id'] = userId;
    }
    
    try {
        return await apiClient.get<TodasPermissoes>('/api/permissoes/todas', { headers });
    } catch (error: any) {
        console.warn('Erro ao buscar permissões (tabelas podem não existir):', error.message);
        throw error;
    }
};

/**
 * Atualizar permissões de uma diretoria (apenas SGJT)
 */
export const atualizarPermissoesDiretoria = async (
    diretoria: Diretoria,
    permissoes: Array<{
        aba_codigo: string;
        pode_acessar: boolean;
        apenas_propria_diretoria: boolean;
    }>
): Promise<{ success: boolean; message: string }> => {
    const userId = getUserId();
    const headers: Record<string, string> = {};
    if (userId) {
        headers['X-User-Id'] = userId;
    }
    return apiClient.put(`/api/permissoes/diretoria/${diretoria}`, { permissoes }, { headers });
};

/**
 * Atualizar uma permissão específica (apenas SGJT)
 */
export const atualizarPermissao = async (
    diretoria: Diretoria,
    abaCodigo: string,
    podeAcessar: boolean,
    apenasPropriaDiretoria: boolean
): Promise<{ success: boolean }> => {
    const userId = getUserId();
    const headers: Record<string, string> = {};
    if (userId) {
        headers['X-User-Id'] = userId;
    }
    return apiClient.put(`/api/permissoes/diretoria/${diretoria}/aba/${abaCodigo}`, {
        pode_acessar: podeAcessar,
        apenas_propria_diretoria: apenasPropriaDiretoria
    }, { headers });
};

/**
 * Criar nova aba/módulo (apenas SGJT)
 */
export const criarAba = async (
    codigo: string,
    nome: string,
    descricao: string | null,
    icone: string | null,
    ordem: number
): Promise<{ success: boolean; message: string; aba: Aba }> => {
    const userId = getUserId();
    const headers: Record<string, string> = {};
    if (userId) {
        headers['X-User-Id'] = userId;
    }
    return apiClient.post('/api/permissoes/abas', {
        codigo,
        nome,
        descricao,
        icone,
        ordem
    }, { headers });
};

/**
 * Buscar módulos que existem no sistema mas não foram adicionados às permissões
 */
export const getModulosNaoAdicionados = async (): Promise<Array<{ codigo: string; nome: string; descricao: string }>> => {
    const userId = getUserId();
    const headers: Record<string, string> = {};
    if (userId) {
        headers['X-User-Id'] = userId;
    }
    return apiClient.get('/api/permissoes/modulos-nao-adicionados', { headers });
};

/**
 * Adicionar módulos existentes ao sistema de permissões
 */
export const adicionarModulosExistentes = async (
    codigos: string[]
): Promise<{ success: boolean; message: string; modulos: Aba[] }> => {
    const userId = getUserId();
    const headers: Record<string, string> = {};
    if (userId) {
        headers['X-User-Id'] = userId;
    }
    return apiClient.post('/api/permissoes/adicionar-modulos', {
        codigos
    }, { headers });
};

// ============================================================
// EXPORT
// ============================================================

export const permissoesApi = {
    getAbas,
    getMinhasPermissoes,
    getPermissoesUsuario,
    verificarPermissao,
    getPermissoesDiretoria,
    getTodasPermissoes,
    atualizarPermissoesDiretoria,
    atualizarPermissao,
    criarAba,
    getModulosNaoAdicionados,
    adicionarModulosExistentes
};

export default permissoesApi;

