import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

/**
 * Trilha de navegação reutilizável.
 *
 * Uso:
 *   <Breadcrumbs items={[
 *     { label: 'Estratégia', to: '/gestao-estrategica' },
 *     { label: 'Escritório de Projetos', to: '/gestao-estrategica/execucao' },
 *     { label: 'Atualização do Sistema TIC-JUD' }, // último sem "to" = atual
 *   ]} />
 */
export function Breadcrumbs({
  items,
  className = "",
  showHome = true,
}: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-sm text-gray-500 flex-wrap gap-y-1 ${className}`}
    >
      {showHome && (
        <>
          <Link
            to="/"
            className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5 mx-1.5 text-gray-400 flex-shrink-0" />
        </>
      )}
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isInteractive = !isLast && (item.to || item.onClick);
        return (
          <div key={index} className="inline-flex items-center">
            {isInteractive ? (
              item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="hover:text-gray-800 transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  to={item.to!}
                  className="hover:text-gray-800 transition-colors"
                >
                  {item.label}
                </Link>
              )
            ) : (
              <span className={isLast ? "text-gray-900 font-medium" : ""}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight className="h-3.5 w-3.5 mx-1.5 text-gray-400 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
