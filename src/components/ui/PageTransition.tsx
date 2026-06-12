import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [key, setKey] = useState(location.pathname);

  useEffect(() => {
    if (location.pathname !== key) {
      setIsAnimating(true);
      setKey(location.pathname);

      // Remove a classe de animação após completar
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [location.pathname, key]);

  return (
    <div
      key={key}
      className={cn(
        "page-transition-wrapper",
        isAnimating && "animate-page-enter",
      )}
    >
      {children}
    </div>
  );
}
