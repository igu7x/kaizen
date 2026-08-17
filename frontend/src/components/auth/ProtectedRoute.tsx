import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireSuperadmin?: boolean;
}

/** Chave onde guardamos o destino ao redirecionar um visitante não autenticado para o login. */
export const POST_LOGIN_REDIRECT_KEY = "postLoginRedirect";

export function ProtectedRoute({
  children,
  allowedRoles,
  requireSuperadmin,
}: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Guarda a rota pretendida (ex.: link do PDF de um processo) para voltar a ela após o
    // login. Ignora a home, para não sobrescrever um destino real com "/".
    const destino = location.pathname + location.search;
    if (destino && destino !== "/") {
      try {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, destino);
      } catch {
        /* sessionStorage indisponível: segue sem o retorno */
      }
    }
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (requireSuperadmin && user && !user.is_superadmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
