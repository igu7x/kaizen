import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

interface RouteAnimationWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper que aplica animação automática em TODAS as mudanças de rota.
 * Detecta quando a URL muda e aplica a classe 'page-transition-enter' por 400ms.
 */
export function RouteAnimationWrapper({
  children,
}: RouteAnimationWrapperProps) {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Trigger animation on route change
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className={isAnimating ? "page-transition-enter" : ""}>{children}</div>
  );
}
