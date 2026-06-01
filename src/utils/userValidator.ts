/**
 * Utilitário para validação e sincronização de dados de usuário
 * Garante consistência entre localStorage e backend
 */

import { User } from '@/types';

export interface UserValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    user?: User;
}

export interface DiretoriaValidation {
    isConsistent: boolean;
    diretoria?: string;
    directorate_code?: string;
    message?: string;
}

/**
 * Diretorias conhecidas do sistema (lista de referência, não usada para validação estrita)
 * Novas diretorias podem ser criadas dinamicamente via cadastros_areas
 */
export const DIRETORIAS_VALIDAS = ['SGJT', 'DPE', 'DIJUD', 'DITI', 'DSTI', 'CGJ', 'DG', 'SGP'] as const;
export type DiretoriaValida = string;

/**
 * Valida se uma diretoria é válida
 * Aceita qualquer string não-vazia (o banco de dados é a fonte de verdade)
 */
export function isDiretoriaValida(diretoria: string | null | undefined): diretoria is DiretoriaValida {
    if (!diretoria) return false;
    return diretoria.trim().length > 0;
}

/**
 * Normaliza o nome da diretoria (uppercase)
 */
export function normalizeDiretoria(diretoria: string | null | undefined): string | null {
    if (!diretoria) return null;
    const normalized = diretoria.toUpperCase();
    return isDiretoriaValida(normalized) ? normalized : null;
}

/**
 * Valida e sincroniza campos de diretoria do usuário
 */
export function validateDiretoria(user: Partial<User>): DiretoriaValidation {
    const diretoria = user.diretoria || (user as any).directorate_code;

    if (!diretoria) {
        return {
            isConsistent: false,
            message: 'Usuário sem diretoria definida'
        };
    }

    const normalized = normalizeDiretoria(diretoria);

    if (!normalized) {
        return {
            isConsistent: false,
            diretoria: diretoria,
            message: `Diretoria inválida: ${diretoria}. Valores válidos: ${DIRETORIAS_VALIDAS.join(', ')}`
        };
    }

    // Verificar se ambos os campos estão consistentes
    const hasDirectorateCode = !!(user as any).directorate_code;
    const hasDiretoria = !!user.diretoria;

    if (hasDirectorateCode && hasDiretoria) {
        const dir1 = normalizeDiretoria(user.diretoria);
        const dir2 = normalizeDiretoria((user as any).directorate_code);

        if (dir1 !== dir2) {
            return {
                isConsistent: false,
                diretoria: user.diretoria,
                directorate_code: (user as any).directorate_code,
                message: `Inconsistência: diretoria="${user.diretoria}" != directorate_code="${(user as any).directorate_code}"`
            };
        }
    }

    return {
        isConsistent: true,
        diretoria: normalized,
        directorate_code: normalized
    };
}

/**
 * Sincroniza campos de diretoria no objeto do usuário
 */
export function syncUserDiretoria(user: Partial<User>): User {
    const validation = validateDiretoria(user);

    if (!validation.isConsistent) {
        console.warn('[UserValidator] Inconsistência detectada:', validation.message);
    }

    const diretoria = validation.diretoria || validation.directorate_code;

    return {
        ...user,
        diretoria: diretoria || undefined,
        directorate_code: diretoria || undefined
    } as User;
}

/**
 * Valida dados completos do usuário
 */
export function validateUser(user: Partial<User>): UserValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validações obrigatórias
    if (!user.id) {
        errors.push('ID do usuário é obrigatório');
    }

    if (!user.email) {
        errors.push('E-mail do usuário é obrigatório');
    } else if (!isValidEmail(user.email)) {
        errors.push('E-mail do usuário é inválido');
    }

    if (!user.name) {
        errors.push('Nome do usuário é obrigatório');
    }

    if (!user.role) {
        errors.push('Role do usuário é obrigatório');
    } else if (!['VIEWER', 'MANAGER', 'ADMIN'].includes(user.role)) {
        errors.push(`Role inválida: ${user.role}. Valores válidos: VIEWER, MANAGER, ADMIN`);
    }

    // Validação de diretoria
    const diretoriaValidation = validateDiretoria(user);

    if (!diretoriaValidation.isConsistent) {
        warnings.push(diretoriaValidation.message || 'Problema com diretoria');
    }

    // Se não tem diretoria, é um warning (não erro crítico)
    if (!diretoriaValidation.diretoria) {
        warnings.push('Usuário sem diretoria definida');
    }

    // Sincronizar campos de diretoria
    const syncedUser = syncUserDiretoria(user);

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        user: errors.length === 0 ? syncedUser : undefined
    };
}

/**
 * Valida formato de e-mail
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valida e corrige dados do usuário do localStorage
 */
export function validateAndFixLocalStorageUser(): UserValidationResult | null {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            return null;
        }

        const user = JSON.parse(userStr) as Partial<User>;
        const validation = validateUser(user);

        // Se há warnings, logar no console
        if (validation.warnings.length > 0) {
            console.warn('[UserValidator] Avisos ao validar usuário:', validation.warnings);
        }

        // Se há erros, logar e retornar
        if (validation.errors.length > 0) {
            console.error('[UserValidator] Erros ao validar usuário:', validation.errors);
            return validation;
        }

        // Se o usuário foi sincronizado, atualizar localStorage
        if (validation.user && validation.warnings.length > 0) {
            console.log('[UserValidator] Sincronizando dados do usuário no localStorage');
            localStorage.setItem('user', JSON.stringify(validation.user));
        }

        return validation;
    } catch (error) {
        console.error('[UserValidator] Erro ao validar usuário do localStorage:', error);
        return {
            isValid: false,
            errors: ['Erro ao ler dados do usuário do localStorage'],
            warnings: []
        };
    }
}

/**
 * Hook para validar usuário ao fazer login
 */
export function validateLoginResponse(userData: any): User {
    const validation = validateUser(userData);

    if (!validation.isValid) {
        console.error('[UserValidator] Dados inválidos recebidos do backend:', validation.errors);
        throw new Error(`Dados de usuário inválidos: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
        console.warn('[UserValidator] Avisos nos dados do usuário:', validation.warnings);
    }

    return validation.user!;
}

/**
 * Verifica se usuário tem permissão SGJT
 */
export function isSGJT(user: Partial<User> | null | undefined): boolean {
    if (!user) return false;
    // SUPERADMIN substitui o antigo check de SGJT
    return (user as any).is_superadmin === true;
}

/**
 * Obtém a diretoria normalizada do usuário
 */
export function getUserDiretoria(user: Partial<User> | null | undefined): DiretoriaValida | null {
    if (!user) return null;

    const validation = validateDiretoria(user);
    return validation.diretoria as DiretoriaValida || null;
}

/**
 * Debug: Exibe informações de validação do usuário no console
 */
export function debugUserValidation(user: Partial<User>): void {
    console.group('🔍 User Validation Debug');
    console.log('User Data:', user);

    const validation = validateUser(user);
    console.log('Validation Result:', validation);

    const diretoriaValidation = validateDiretoria(user);
    console.log('Diretoria Validation:', diretoriaValidation);

    console.log('Is SGJT:', isSGJT(user));
    console.log('User Diretoria:', getUserDiretoria(user));

    console.groupEnd();
}
