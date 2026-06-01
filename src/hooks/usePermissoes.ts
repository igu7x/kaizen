import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { permissoesApi, PermissaoUsuario, Diretoria, MinhasPermissoes } from '@/services/permissoesApi';
import { Directorate } from '@/types';
import { areasApi, Area } from '@/services/areasApi';

export interface UsePermissoesReturn {
    // Estado
    loading: boolean;
    permissoes: PermissaoUsuario[];
    diretoriaUsuario: Diretoria | null;

    // Verificações
    podeAcessar: (abaCodigo: string) => boolean;
    apenasPropriaDiretoria: (abaCodigo: string) => boolean;
    isSGJT: boolean;
    isDomainRoot: boolean;

    // Diretorias disponíveis (para dropdown de filtro)
    diretoriasDisponiveis: Directorate[];

    // Áreas carregadas do banco de dados
    areas: Area[];

    // Função para recarregar
    recarregar: () => Promise<void>;
}

/**
 * Hook para gerenciar permissões do usuário logado
 */
export function usePermissoes(): UsePermissoesReturn {
    const { user, isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(true);
    const [permissoes, setPermissoes] = useState<PermissaoUsuario[]>([]);
    const [diretoriaUsuario, setDiretoriaUsuario] = useState<Diretoria | null>(null);
    const [areas, setAreas] = useState<Area[]>([]);

    const carregarPermissoes = useCallback(async () => {
        if (!isAuthenticated || !user) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            // Carregar permissões e áreas em paralelo
            const [dados, areasData] = await Promise.all([
                permissoesApi.getMinhasPermissoes(),
                areasApi.getAll()
            ]);
            setPermissoes(dados.permissoes);
            setDiretoriaUsuario(dados.diretoria);
            setAreas(areasData);
        } catch (error) {
            console.error('Erro ao carregar permissões:', error);
            // Se falhar, assume diretoria do usuário
            setDiretoriaUsuario((user as any).diretoria || 'SGJT');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        carregarPermissoes();
    }, [carregarPermissoes]);

    // Verificar se o usuário é domain root (admin de domínio)
    const isRoot = useMemo(() => {
        // SUPERADMIN always has root powers
        if ((user as any)?.is_superadmin === true) return true;
        if (!diretoriaUsuario) return false;
        const area = areas.find(a => (a.sigla || a.nome) === diretoriaUsuario);
        if (area?.is_domain_root) return true;
        return false;
    }, [diretoriaUsuario, areas, user]);

    // Domínio do usuário
    const userDominio = useMemo(() => {
        const area = areas.find(a => (a.sigla || a.nome) === diretoriaUsuario);
        return area?.dominio || 'SGJT';
    }, [diretoriaUsuario, areas]);

    // Verificar se pode acessar uma aba
    const podeAcessar = useCallback((abaCodigo: string): boolean => {
        // Durante carregamento, permite acesso para evitar flickering
        if (loading) return true;

        // Domain root sempre pode acessar tudo
        if (isRoot) return true;

        // Verificar nas permissões carregadas
        const permissao = permissoes.find(p => p.aba_codigo === abaCodigo);
        return permissao?.pode_acessar ?? false;
    }, [loading, isRoot, permissoes]);

    // Verificar se deve mostrar apenas própria diretoria
    const apenasPropriaDiretoria = useCallback((abaCodigo: string): boolean => {
        // Domain root vê todas as diretorias do domínio
        if (isRoot) return false;

        // Verificar nas permissões
        const permissao = permissoes.find(p => p.aba_codigo === abaCodigo);
        return permissao?.apenas_propria_diretoria ?? true;
    }, [isRoot, permissoes]);

    // Manter isSGJT para compatibilidade, mas agora baseado em domain root
    const isSGJT = isRoot;

    // Diretorias disponíveis para o usuário (dinâmico por domínio)
    const diretoriasDisponiveis = useMemo((): Directorate[] => {
        // Domain root pode ver todas as áreas do seu domínio
        if (isRoot) {
            return areas
                .filter(a => a.dominio === userDominio)
                .map(area => area.sigla || area.nome);
        }

        // Outros usuários só veem a própria diretoria
        if (diretoriaUsuario) {
            return [diretoriaUsuario as Directorate];
        }

        return [];
    }, [isRoot, userDominio, diretoriaUsuario, areas]);

    return {
        loading,
        permissoes,
        diretoriaUsuario,
        podeAcessar,
        apenasPropriaDiretoria,
        isSGJT,
        isDomainRoot: isRoot,
        diretoriasDisponiveis,
        areas,
        recarregar: carregarPermissoes
    };
}

export default usePermissoes;







