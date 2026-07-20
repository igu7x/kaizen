import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Target,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Settings,
  Users,
  FileText,
  Megaphone,
  LayoutDashboard,
  ClipboardList,
  FilePlus,
  RefreshCw,
  Shield,
  FolderKanban,
  DollarSign,
  Building2,
  BookOpen,
  GraduationCap,
  Database,
  Code,
  Home,
  Key,
  Workflow,
  BarChart3,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getModulosPermitidosMenu, Diretoria } from "@/services/permissoesApi";
import { areasApi, Area } from "@/services/areasApi";
import { isDomainRoot, getUserDominio } from "@/utils/domain";
import { isProduction } from "@/utils/environment";
import { useEstrategiaModelo } from "@/contexts/EstrategiaModeloContext";

interface SubSubMenuItem {
  title: string;
  path: string;
  permissaoCodigo?: string;
  stagingOnly?: boolean;
}

interface SubMenuItem {
  title: string;
  icon?: LucideIcon;
  path?: string;
  permissaoCodigo?: string;
  stagingOnly?: boolean;
  superAdminOnly?: boolean;
  children?: SubSubMenuItem[];
}

interface MenuItem {
  title: string;
  icon?: LucideIcon;
  path?: string;
  adminOnly?: boolean;
  domainRootOnly?: boolean;
  superAdminOnly?: boolean;
  devOnly?: boolean;
  permissaoCodigo?: string;
  children?: SubMenuItem[];
}

// Menu completo com códigos de permissão
const menuItemsCompleto: MenuItem[] = [
  {
    title: "Início",
    icon: Home,
    path: "/",
  },
  {
    title: "Estratégia",
    icon: Target,
    children: [
      {
        title: "Monitoramento de OKRs",
        icon: Target,
        path: "/gestao-estrategica/okrs",
        permissaoCodigo: "gestao_okrs",
      },
      {
        title: "Escritório de Projetos",
        icon: ClipboardList,
        path: "/gestao-estrategica/execucao",
        permissaoCodigo: "gestao_execucao",
      },
      {
        title: "Escritório de Processos",
        icon: Workflow,
        path: "/gestao-estrategica/processos",
        permissaoCodigo: "gestao_processos",
      },
      {
        title: "Controle de Execução",
        icon: RefreshCw,
        path: "/gestao-estrategica/sprints",
        permissaoCodigo: "gestao_sprint",
        stagingOnly: true,
      },
    ],
  },
  {
    title: "Contratações de TIC",
    icon: DollarSign,
    children: [
      {
        title: "Orçamento",
        icon: FilePlus,
        children: [
          {
            title: "PCA",
            path: "/pca",
            permissaoCodigo: "contratacoes_novas",
          },
          {
            title: "Ciclo Orçamentário",
            path: "/ciclo-orcamentario",
            permissaoCodigo: "contratacoes_novas",
          },

        ]
      },
      {
        title: "Planejamento da Contratação",
        icon: FilePlus,
        path: "/planejamento-contratacao",
        permissaoCodigo: "contratacoes_novas",
      },
      {
        title: "Gestão Contratual",
        icon: FileText,
        path: "/contratos-ti",
        permissaoCodigo: "contratos_ti"
      },
    ],
  },
  {
    title: "Comitês",
    icon: Megaphone,
    path: "/comites",
    permissaoCodigo: "comites",
  },
  {
    title: "Pessoas",
    icon: Users,
    children: [
      {
        // Escondido apenas em produção (stagingOnly); segue visível em local e staging.
        title: "Painel",
        icon: LayoutDashboard,
        path: "/pessoas/painel",
        permissaoCodigo: "pessoas_painel",
        stagingOnly: true,
      },
      {
        title: "Gestão por Competências",
        icon: BookOpen,
        path: "/pessoas/competencias",
        permissaoCodigo: "pessoas_competencias",
      },
      {
        title: "Plano Anual de Capacitação",
        icon: GraduationCap,
        children: [
          {
            title: "Tecnologia da Informação",
            path: "/pessoas/pac/tecnologia-da-informacao",
          },
          {
            title: "Apoio Judiciário",
            path: "/pessoas/pac/apoio-judiciario",
          },
        ],
      },
    ],
  },
  {
    title: "Suporte de T.I",
    icon: BarChart3,
    path: "/painel-indicadores",
    permissaoCodigo: "painel_indicadores",
  },
  {
    title: "Administração",
    icon: Settings,
    adminOnly: true,
    children: [
      { title: "Usuários", icon: Users, path: "/administracao" },
      {
        title: "Cadastros",
        icon: Database,
        path: "/cadastros",
        superAdminOnly: true,
      },
      {
        title: "Permissões Gerais",
        icon: Shield,
        path: "/gerenciamento",
        superAdminOnly: true,
      },
      {
        title: "Permissões de Ações",
        icon: Key,
        path: "/permissoes",
        superAdminOnly: true,
      },
    ],
  },
  {
    title: "Desenvolvimento",
    icon: Code,
    path: "/desenvolvimento",
    adminOnly: true,
    devOnly: true,
  },
];

interface MenuItemComponentProps {
  item: MenuItem;
  onNavigate?: () => void;
  isMinimized?: boolean;
  expandedMenus: string[];
  toggleMenu: (title: string) => void;
  permissoesSet: Set<string>;
  areas?: Area[];
}

function MenuItemComponent({
  item,
  onNavigate,
  isMinimized = false,
  expandedMenus,
  toggleMenu,
  permissoesSet,
  areas,
}: MenuItemComponentProps) {
  const location = useLocation();
  const { user } = useAuth();

  if (item.adminOnly && user?.role !== "ADMIN") {
    return null;
  }

  // Itens devOnly só aparecem para desenvolvedores
  if (item.devOnly && !user?.is_developer) {
    return null;
  }

  if (item.domainRootOnly && !isDomainRoot(user, areas)) {
    return null;
  }

  // Filtrar children baseado nas permissões e ambiente
  let filteredChildren = item.children;
  if (item.children && item.children.length > 0) {
    const userIsSuperAdmin = (user as any)?.is_superadmin === true;
    filteredChildren = item.children.filter((child) => {
      // Itens stagingOnly não aparecem em produção
      if (child.stagingOnly && isProduction()) return false;
      // Itens superAdminOnly só aparecem para superadmins
      if (child.superAdminOnly && !userIsSuperAdmin) return false;
      // Se não tem código de permissão, sempre mostra
      if (!child.permissaoCodigo) return true;
      // Verifica se tem permissão
      return permissoesSet.has(child.permissaoCodigo);
    });

    // Se não sobrou nenhum filho, não mostra o menu pai
    if (filteredChildren.length === 0) {
      return null;
    }
  } else if (item.permissaoCodigo) {
    // Item sem filhos - verificar permissão direta
    if (!permissoesSet.has(item.permissaoCodigo)) {
      return null;
    }
  }

  const hasChildren = filteredChildren && filteredChildren.length > 0;
  const isExpanded = expandedMenus.includes(item.title);

  const isChildActive =
    hasChildren &&
    filteredChildren?.some((child) => {
      if (child.path && location.pathname === child.path) return true;
      if (child.children) {
        return child.children.some(sub => location.pathname === sub.path);
      }
      return false;
    });

  // Verificar se a rota atual corresponde ao item ou começa com o path do item
  const isActive =
    item.path === location.pathname ||
    (item.path && location.pathname.startsWith(item.path + "/")) ||
    isChildActive;

  if (hasChildren) {
    const menuContent = (
      <div>
        <button
          onClick={() => toggleMenu(item.title)}
          className={cn(
            "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors",
            isActive && "bg-white/10 text-white",
            isMinimized && "justify-center",
          )}
        >
          {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
          {!isMinimized && (
            <>
              <span className="flex-1 text-left">{item.title}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isExpanded && "rotate-180",
                )}
              />
            </>
          )}
        </button>

        {!isMinimized && isExpanded && (
          <div className="bg-black/20">
            {filteredChildren?.map((child, idx) => {
              const hasSubChildren = child.children && child.children.length > 0;
              const isSubActive = child.path ? location.pathname === child.path : (hasSubChildren && child.children?.some(c => location.pathname === c.path));
              return (
                <div key={idx}>
                  {hasSubChildren ? (
                    <button
                      onClick={() => toggleMenu(child.title)}
                      className={cn(
                        "w-full flex items-center gap-2 pl-10 pr-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                        isSubActive && "bg-white/15 text-white border-l-2 border-white ml-2",
                      )}
                    >
                      {child.icon && (
                        <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      <span className="flex-1 text-left">{child.title}</span>
                      {/* <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform duration-200",
                          expandedMenus.includes(child.title) && "rotate-180",
                        )}
                      /> */}
                    </button>
                  ) : (
                    <Link
                      to={child.path || "#"}
                      onClick={(e) => {
                        if (onNavigate) onNavigate();
                      }}
                      className={cn(
                        "flex items-center gap-2 pl-10 pr-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                        isSubActive && "bg-white/15 text-white border-l-2 border-white ml-2",
                      )}
                    >
                      {child.icon && (
                        <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      <span>{child.title}</span>
                    </Link>
                  )}
                  {hasSubChildren && expandedMenus.includes(child.title) && (
                    <div className="pl-6">
                      {child.children?.map((subChild, subIdx) => {
                        const isSubSubActive = location.pathname === subChild.path;
                        return (
                          <Link
                            key={`sub-${idx}-${subIdx}`}
                            to={subChild.path}
                            // onClick={onNavigate} Removido para não fechar a navbar ao clicar
                            className={cn(
                              "flex items-center gap-2 pl-10 pr-4 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors",
                              isSubSubActive && "text-white font-medium",
                            )}
                          >
                            <span>{subChild.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

    if (isMinimized && item.icon) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleMenu(item.title)}
                className={cn(
                  "w-full flex items-center justify-center px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors",
                  isActive && "bg-white/10 text-white",
                )}
              >
                <item.icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="p-0">
              <div className="bg-[#002547] rounded-md shadow-lg border border-white/20 min-w-[180px]">
                <div className="px-3 py-2 border-b border-white/10 font-medium text-white text-sm">
                  {item.title}
                </div>
                {filteredChildren?.map((child, idx) => {
                  const hasSubChildren = child.children && child.children.length > 0;
                  const isSubActive = child.path ? location.pathname === child.path : false;
                  return (
                    <div key={idx}>
                      <Link
                        to={child.path || "#"}
                        onClick={(e) => {
                          if (hasSubChildren) e.preventDefault();
                          else if (onNavigate) onNavigate();
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors",
                          isSubActive && "bg-white/15 text-white",
                        )}
                      >
                        {child.icon && <child.icon className="h-3.5 w-3.5" />}
                        <span className={hasSubChildren ? "font-semibold" : ""}>{child.title}</span>
                      </Link>
                      {hasSubChildren && (
                        <div className="pl-4 pb-1">
                          {child.children?.map((subChild, subIdx) => {
                            const isSubSubActive = location.pathname === subChild.path;
                            return (
                              <Link
                                key={`sub-${idx}-${subIdx}`}
                                to={subChild.path}
                                // onClick={onNavigate}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:text-white transition-colors",
                                  isSubSubActive && "text-white font-medium"
                                )}
                              >
                                <span>{subChild.title}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return menuContent;
  }

  const content = (
    <Link
      to={item.path || "#"}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors",
        isActive && "bg-white/20 text-white border-r-4 border-white",
        isMinimized && "justify-center",
      )}
    >
      {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
      {!isMinimized && <span>{item.title}</span>}
    </Link>
  );

  if (isMinimized && item.icon) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{item.title}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { modelo } = useEstrategiaModelo();

  // Dynamic menu items based on strategy model
  const menuItems = useMemo(() => {
    return menuItemsCompleto.map((item) => {
      if (item.title === "Estratégia" && item.children) {
        return {
          ...item,
          children: item.children.map((child) => {
            if (child.path === "/gestao-estrategica/okrs") {
              return {
                ...child,
                title:
                  modelo === "metas"
                    ? "Monitoramento de Metas"
                    : "Monitoramento de OKRs",
              };
            }
            if (child.path === "/gestao-estrategica/execucao") {
              return {
                ...child,
                title:
                  modelo === "metas"
                    ? "Monitoramento de Iniciativas"
                    : "Escritório de Projetos",
              };
            }
            return child;
          }),
        };
      }
      return item;
    });
  }, [modelo]);

  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem("sidebar-minimized");
    return saved === "true";
  });

  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const currentPath = location.pathname;
    const expanded: string[] = [];

    menuItemsCompleto.forEach((item) => {
      let isItemExpanded = false;

      item.children?.forEach((child) => {
        const isChildActive = child.path && (currentPath === child.path || currentPath.startsWith(child.path + "/"));
        const isSubChildActive = child.children?.some(
          (sub) => sub.path && (currentPath === sub.path || currentPath.startsWith(sub.path + "/"))
        );

        if (isChildActive || isSubChildActive) {
          isItemExpanded = true;
        }

        if (isSubChildActive) {
          expanded.push(child.title);
        }
      });

      if (isItemExpanded) {
        expanded.push(item.title);
      }
    });

    return expanded;
  });

  // Estado para armazenar permissões do usuário
  const [permissoesUsuario, setPermissoesUsuario] = useState<string[]>([]);
  const [permissoesCarregadas, setPermissoesCarregadas] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);

  // Carregar permissões da diretoria do usuário
  useEffect(() => {
    const carregarPermissoes = async () => {
      // Carregar áreas da API para verificar is_domain_root (fallback robusto)
      let loadedAreas: Area[] = [];
      try {
        loadedAreas = await areasApi.getAll();
        setAreas(loadedAreas);
      } catch (err) {
        console.warn("[Sidebar] Erro ao carregar áreas:", err);
      }

      // Verificar se é domain root (admin do domínio, ex: SGJT ou CGJ)
      const isRoot = isDomainRoot(user, loadedAreas);

      // Domain root tem acesso a todos os módulos
      if (isRoot) {
        const todosCodigos = menuItemsCompleto.flatMap((item) => {
          const codigos: string[] = [];
          if (item.permissaoCodigo) codigos.push(item.permissaoCodigo);
          if (item.children) {
            item.children.forEach((child) => {
              if (child.permissaoCodigo) codigos.push(child.permissaoCodigo);
            });
          }
          return codigos;
        });

        setPermissoesUsuario(todosCodigos);
        setPermissoesCarregadas(true);
        return;
      }

      // Para outras diretorias, buscar permissões da API (união de todos os domínios do usuário)
      try {
        const dominios = (user as any).dominios && (user as any).dominios.length > 0 
          ? (user as any).dominios 
          : [getUserDominio(user, loadedAreas)];
          
        const todosCodigos = new Set<string>();
        for (const dom of dominios) {
          const response = await getModulosPermitidosMenu(dom as Diretoria);
          response.modulos_permitidos.forEach((m) => todosCodigos.add(m.codigo));
        }

        setPermissoesUsuario(Array.from(todosCodigos));
      } catch (error) {
        // SEGURANÇA: Em caso de erro, NÃO liberar acesso - manter vazio
        setPermissoesUsuario([]);
      } finally {
        setPermissoesCarregadas(true);
      }
    };

    if (user) {
      carregarPermissoes();
    }
  }, [user]);

  // Criar Set de permissões para lookup rápido
  const permissoesSet = useMemo(
    () => new Set(permissoesUsuario),
    [permissoesUsuario],
  );

  useEffect(() => {
    localStorage.setItem("sidebar-minimized", String(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    const currentPath = location.pathname;

    menuItemsCompleto.forEach((item) => {
      let shouldExpandItem = false;

      item.children?.forEach((child) => {
        const isChildActive = child.path && (currentPath === child.path || currentPath.startsWith(child.path + "/"));
        const isSubChildActive = child.children?.some(
          (sub) => sub.path && (currentPath === sub.path || currentPath.startsWith(sub.path + "/"))
        );

        if (isChildActive || isSubChildActive) {
          shouldExpandItem = true;
        }

        if (isSubChildActive) {
          setExpandedMenus((prev) => 
            prev.includes(child.title) ? prev : [...prev, child.title]
          );
        }
      });

      if (shouldExpandItem) {
        setExpandedMenus((prev) => 
          prev.includes(item.title) ? prev : [...prev, item.title]
        );
      }
    });
  }, [location.pathname]);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleMenu = (title: string) => {
    setExpandedMenus((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed lg:relative left-0 z-50 h-screen lg:h-full overflow-y-auto transition-all duration-300 ease-in-out flex-shrink-0",
          "top-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isMinimized ? "w-16" : "w-64",
        )}
        style={{
          backgroundColor: "#002547",
        }}
      >
        <div
          className="sticky top-0 z-10"
          style={{
            backgroundColor: "#002547",
            borderBottomColor: "#ffffff40",
            borderBottomWidth: "1px",
          }}
        >
          <div className="flex items-center justify-between p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMinimize}
              className="hidden lg:flex text-white hover:bg-white/10"
              title={isMinimized ? "Expandir menu" : "Minimizar menu"}
            >
              {isMinimized ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <>
                  <ChevronLeft className="h-5 w-5 mr-2" />
                  <span className="text-xs">Minimizar</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="lg:hidden ml-auto text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="py-2">
          {permissoesCarregadas &&
            menuItems.map((item, index) => (
              <MenuItemComponent
                key={index}
                item={item}
                onNavigate={onClose}
                isMinimized={isMinimized}
                expandedMenus={expandedMenus}
                toggleMenu={toggleMenu}
                permissoesSet={permissoesSet}
                areas={areas}
              />
            ))}
        </nav>
      </aside>
    </>
  );
}
