import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const SESSION_KEY = 'kaizen_session_started';

/**
 * Força a Home (/) ser a primeira página renderizada ao abrir o sistema
 * ou após login em uma nova sessão do navegador.
 *
 * Usa sessionStorage (limpa ao fechar a aba) para detectar primeira visita da sessão.
 * Respeita links diretos para /login e /auth/callback (flow de autenticação).
 */
export function SessionRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Se ainda não checou, marca a sessão como iniciada
    if (!checked) {
      setChecked(true);
    }
  }, [checked]);

  // Se nunca checou ainda, retorna null pra evitar flash
  // (Estratégia: aguarda 1 tick para setChecked)
  if (!checked && isAuthenticated) {
    const sessionStarted = sessionStorage.getItem(SESSION_KEY);

    // Rotas que não devem disparar o redirect (já tratam auth por conta própria)
    const skipRoutes = ['/login', '/auth/callback', '/'];
    const shouldSkip = skipRoutes.includes(location.pathname);

    if (!sessionStarted && !shouldSkip) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      return <Navigate to="/" replace />;
    }

    // Marca sessão como iniciada mesmo se estamos em rota que skippa
    if (!sessionStarted) {
      sessionStorage.setItem(SESSION_KEY, 'true');
    }
  }

  return <>{children}</>;
}
