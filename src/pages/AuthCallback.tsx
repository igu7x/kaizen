/**
 * Página de callback para autenticação SSO
 * Recebe os dados do usuário após autenticação no Keycloak
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Storage from '@/utils/storage';
import { syncUserDiretoria } from '@/utils/userValidator';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = () => {
      try {
        // Obter dados da URL
        const userParam = searchParams.get('user');
        const tokensParam = searchParams.get('tokens');
        const returnUrl = searchParams.get('returnUrl') || '/';
        const errorParam = searchParams.get('error');

        // Se houver erro, mostrar e redirecionar para login
        if (errorParam) {
          setError(errorParam);
          setTimeout(() => {
            navigate('/login?error=' + encodeURIComponent(errorParam));
          }, 3000);
          return;
        }

        // Validar dados recebidos
        if (!userParam || !tokensParam) {
          setError('Dados de autenticação incompletos');
          setTimeout(() => {
            navigate('/login?error=Dados de autenticação incompletos');
          }, 3000);
          return;
        }

        // Decodificar dados
        const userRaw = JSON.parse(decodeURIComponent(userParam));
        const tokens = JSON.parse(decodeURIComponent(tokensParam));

        // Sincronizar campos de diretoria (garantir que diretoria e directorate_code estejam consistentes)
        const user = syncUserDiretoria(userRaw);

        console.log('✅ Autenticação SSO concluída:', user.email, '- Diretoria:', user.diretoria);

        // Salvar dados no localStorage (com campos sincronizados)
        Storage.save('user', user);
        localStorage.setItem('auth_token', tokens.accessToken);
        localStorage.setItem('refresh_token', tokens.refreshToken);
        localStorage.setItem('token_expires_at', tokens.expiresAt.toString());
        localStorage.setItem('is_sso_user', 'true');
        // id_token preservado pra mandar como id_token_hint no logout do Keycloak antigo
        if (tokens.idToken) {
          localStorage.setItem('id_token', tokens.idToken);
        }

        // Limpar selectedDirectorate para que o DirectorateContext use a diretoria do usuário
        localStorage.removeItem('selectedDirectorate');

        // Redirecionar para a página desejada
        // Usar window.location para garantir reload do AuthContext
        window.location.href = returnUrl;

      } catch (err: any) {
        console.error('Erro ao processar callback SSO:', err);
        setError(err.message || 'Erro ao processar autenticação');
        setTimeout(() => {
          navigate('/login?error=Erro ao processar autenticação');
        }, 3000);
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Erro na autenticação</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <p className="text-gray-500 text-sm">Redirecionando para login...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Autenticando...</h2>
            <p className="text-gray-400">Processando dados de autenticação SSO</p>
          </>
        )}
      </div>
    </div>
  );
}
