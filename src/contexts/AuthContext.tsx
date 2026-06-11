import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '@/types';
import { api } from '@/services/api';
import Storage from '@/utils/storage';
import { ApiError, AuthError, NetworkError, apiClient, API_BASE_URL } from '@/services/apiClient';
import {
  validateAndFixLocalStorageUser,
  validateLoginResponse,
  syncUserDiretoria,
  debugUserValidation
} from '@/utils/userValidator';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há usuário e token salvos
    const savedUser = Storage.load<User | null>('user', null);
    const token = localStorage.getItem('auth_token');
    const isSsoUser = localStorage.getItem('is_sso_user') === 'true';

    // Se tiver usuário salvo
    if (savedUser) {
      // Validar e corrigir dados do usuário (sincroniza campos de diretoria)
      const validation = validateAndFixLocalStorageUser();

      if (validation?.user) {
        // Usar usuário validado e sincronizado
        console.log('[AuthContext] Usuário validado:', {
          id: validation.user.id,
          diretoria: validation.user.diretoria,
          directorate_code: (validation.user as any).directorate_code
        });
        setUser(validation.user);
      } else {
        // Fallback: usar usuário salvo como está
        setUser(savedUser);
      }

      // Se for usuário SSO, verificar se o token ainda é válido
      if (isSsoUser && token) {
        const expiresAt = localStorage.getItem('token_expires_at');
        if (expiresAt && Date.now() > parseInt(expiresAt)) {
          // Token expirado, tentar renovar
          refreshSsoToken();
        }
      }

      // Hidrata campos de perfil pessoal (foto, matrícula, cargo/função, unidade)
      // que não vêm no callback SSO/login local — em background, sem bloquear a UI.
      // Falha silenciosa: se a chamada não rolar (offline/token inválido), seguimos
      // com o que tem no localStorage.
      (async () => {
        try {
          const fresh = await api.getMeuPerfil();
          setUser((prev) => {
            const merged: User = {
              ...(prev || savedUser),
              diretoria: fresh.diretoria ?? prev?.diretoria ?? savedUser?.diretoria,
              dominio: (fresh as any).dominio ?? (prev as any)?.dominio ?? (savedUser as any)?.dominio,
              directorate_code: (fresh as any).directorate_code ?? (prev as any)?.directorate_code ?? (savedUser as any)?.directorate_code,
              foto_perfil: fresh.foto_perfil ?? null,
              matricula: fresh.matricula ?? null,
              cargo_funcao: fresh.cargo_funcao ?? null,
              unidade_nome: fresh.unidade_nome ?? null,
              cargo_efetivo: fresh.cargo_efetivo ?? null,
              codigo: fresh.codigo ?? null,
            };
            Storage.save('user', merged);
            return merged;
          });
        } catch (err) {
          console.warn('[AuthContext] Falha ao hidratar perfil — usando dados do localStorage', err);
        }
      })();
    }
    setLoading(false);
  }, []);

  // Renovar token SSO
  const refreshSsoToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        // Sem refresh token, fazer logout
        handleLogout();
        return;
      }

      const response = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
      }>('/api/auth/sso/refresh', { refreshToken });

      localStorage.setItem('auth_token', response.accessToken);
      localStorage.setItem('refresh_token', response.refreshToken);
      localStorage.setItem('token_expires_at', response.expiresAt.toString());
    } catch (error) {
      console.error('Erro ao renovar token SSO:', error);
      // Falha ao renovar, fazer logout
      handleLogout();
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const loggedUser = await api.login(email, password);

      if (!loggedUser) {
        throw new Error('Credenciais inválidas');
      }

      setUser(loggedUser);
      Storage.save('user', loggedUser);
      localStorage.removeItem('is_sso_user'); // Login local
    } catch (error) {
      // Propagar erro com mensagem apropriada
      if (error instanceof ApiError) {
        if (error.status === 401) {
          throw new Error('E-mail ou senha incorretos.');
        }
        throw new Error(error.message);
      }

      if (error instanceof NetworkError) {
        throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
      }

      if (error instanceof AuthError) {
        throw new Error(error.message);
      }

      // Erro genérico
      throw new Error('Erro ao fazer login. Tente novamente.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    Storage.remove('user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('is_sso_user');
    localStorage.removeItem('id_token');

    // Limpar cache de dados
    Storage.remove('gestao_objectives');
    Storage.remove('gestao_keyResults');
    Storage.remove('gestao_initiatives');
    Storage.remove('gestao_programs');
    Storage.remove('gestao_programInitiatives');
    Storage.remove('gestao_executionControls');
  };

  const logout = async (): Promise<void> => {
    const isSsoUser = localStorage.getItem('is_sso_user') === 'true';
    // Captura o id_token ANTES do handleLogout (ele limpa o localStorage).
    // Sem id_token_hint, Keycloak antigo (TJGO) retorna "Parâmetros ausentes: id_token_hint".
    const idTokenHint = localStorage.getItem('id_token') || '';

    try {
      await api.logout();
    } catch (error) {
      console.warn('Erro no logout:', error);
    } finally {
      handleLogout();

      // Se for usuário SSO, redirecionar para logout do Keycloak
      if (isSsoUser) {
        const currentUrl = window.location.origin;
        const params = new URLSearchParams({ redirect: currentUrl + '/login' });
        if (idTokenHint) {
          params.set('id_token_hint', idTokenHint);
        }
        window.location.href = `${API_BASE_URL}/api/auth/sso/logout?${params.toString()}`;
        return;
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
