import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Target,
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
  Cpu,
  Gavel,
  Scale,
  SlidersHorizontal,
  History,
  BookCheck,
  ShieldAlert,
  Bell,
  Plug,
  Boxes,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModulosPermitidosMenu, Diretoria } from "@/services/permissoesApi";
import { areasApi, Area } from "@/services/areasApi";
import { isDomainRoot, getUserDominio } from "@/utils/domain";
import { isProduction } from "@/utils/environment";
import { useEstrategiaModelo } from "@/contexts/EstrategiaModeloContext";

/** 4º nível — sempre folha (tem rota). Hoje só o SGC usa. */
interface SubSubSubMenuItem {
  title: string;
  path: string;
  icon?: LucideIcon;
}

interface SubSubMenuItem {
  title: string;
  /** Opcional: um item do 3º nível pode ser só um agrupador do 4º. */
  path?: string;
  icon?: LucideIcon;
  permissaoCodigo?: string;
  stagingOnly?: boolean;
  children?: SubSubSubMenuItem[];
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
// "Início" não entra aqui: ele já é o atalho fixo no topo do menu (com ícone e rótulo).
const menuItemsCompleto: MenuItem[] = [
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
        permissaoCodigo: "gestao_processos",
        children: [
          {
            title: "Tecnologia da Informação",
            icon: Cpu,
            path: "/gestao-estrategica/processos",
          },
          {
            title: "Apoio Judiciário",
            icon: Gavel,
            path: "/gestao-estrategica/processos-apoio",
          },
        ],
      },
      {
        title: "PDTIC",
        icon: LayoutDashboard,
        path: "/gestao-estrategica/pdtic",
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
            title: "Plano de Contratações Anual",
            path: "/pca",
            permissaoCodigo: "contratacoes_novas",
          },
          {
            title: "Ciclo Orçamentário",
            path: "/ciclo-orcamentario",
            permissaoCodigo: "contratacoes_novas",
          },
        ],
      },
      {
        title: "Planejamento da Contratação",
        icon: FilePlus,
        permissaoCodigo: "contratacoes_novas",
        children: [
          {
            title: "Visão Geral",
            path: "/planejamento-contratacao",
          },
          {
            title: "Avaliação de Riscos",
            path: "/planejamento-contratacao/riscos-contratacoes",
          },
        ],
      },
      {
        title: "Gestão Contratual",
        icon: FileText,
        path: "/contratos-ti",
        permissaoCodigo: "contratos_ti",
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
            icon: Cpu,
            path: "/pessoas/pac/tecnologia-da-informacao",
          },
          {
            title: "Apoio Judiciário",
            icon: Gavel,
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
    title: "Gestão de Riscos e Compliance",
    icon: Scale,
    superAdminOnly: true,
    children: [
      {
        // Todas as telas ainda são placeholder (EmDesenvolvimento) — ver App.tsx.
        title: "Sistema de Gestão de Compliance (SGC)",
        icon: BookCheck,
        children: [
          {
            title: "O que é Gestão de Compliance",
            icon: BookOpen,
            path: "/gestao-riscos/sgc/o-que-e",
          },
          {
            title: "Comitê de Gestão de Compliance",
            icon: Users,
            path: "/gestao-riscos/sgc/comite",
          },
          {
            title: "Política e Objetivos",
            icon: Target,
            path: "/gestao-riscos/sgc/politica-objetivos",
          },
          {
            title: "Escopo do SGC",
            icon: FolderKanban,
            path: "/gestao-riscos/sgc/escopo",
          },
          {
            // Agrupador (4º nível) — não tem tela própria.
            title: "Documentação do SGC",
            icon: FileText,
            children: [
              {
                title: "Atos Normativos",
                icon: Gavel,
                path: "/gestao-riscos/sgc/documentacao/atos-normativos",
              },
              {
                title: "Manuais e POPs",
                icon: BookOpen,
                path: "/gestao-riscos/sgc/documentacao/manuais-pops",
              },
              {
                title: "Arquitetura de Processos",
                icon: Workflow,
                path: "/gestao-riscos/sgc/documentacao/arquitetura-processos",
              },
              {
                title: "Modelos e Formulários",
                icon: FilePlus,
                path: "/gestao-riscos/sgc/documentacao/modelos-formularios",
              },
              {
                title: "Gerenciamento da Informação Documentada",
                icon: Database,
                path: "/gestao-riscos/sgc/documentacao/informacao-documentada",
              },
            ],
          },
          {
            title: "Gestão de Mudanças do SGC",
            icon: RefreshCw,
            path: "/gestao-riscos/sgc/gestao-mudancas",
          },
          {
            title: "Gestão de Riscos do SGC",
            icon: ShieldAlert,
            path: "/gestao-riscos/sgc/gestao-riscos",
          },
          {
            title: "Comunicação do SGC",
            icon: Megaphone,
            path: "/gestao-riscos/sgc/comunicacao",
          },
          {
            title: "Avaliação e Melhorias do SGC",
            icon: BarChart3,
            path: "/gestao-riscos/sgc/avaliacao-melhorias",
          },
        ],
      },
      {
        // Substitui o antigo item "Contratações de TIC" (que era só placeholder).
        title: "Gestão de Riscos de TIC",
        icon: ShieldAlert,
        path: "/gestao-riscos/riscos-tic",
      },
    ],
  },
  {
    // Módulo em construção (porte do SGSI/TJGO). Restrito a superadmin por ora.
    // Nasceu como sub-item de "Gestão de Riscos e Compliance" e virou módulo próprio.
    title: "Sistema de Gestão da Segurança da Informação",
    icon: Shield,
    superAdminOnly: true,
    children: [
      {
        title: "Painel",
        icon: LayoutDashboard,
        path: "/seguranca-informacao/painel",
      },
      {
        title: "Alertas",
        icon: Bell,
        path: "/seguranca-informacao/alertas",
      },
      {
        title: "Instrumentos Normativos",
        icon: BookOpen,
        path: "/seguranca-informacao/instrumentos",
      },
      {
        title: "Ciência e Leitura",
        icon: BookCheck,
        path: "/seguranca-informacao/leitura",
      },
      {
        title: "Obrigações Documentais",
        icon: FileText,
        path: "/seguranca-informacao/documentos",
      },
      {
        title: "Indicadores",
        icon: BarChart3,
        path: "/seguranca-informacao/indicadores",
      },
      {
        title: "Frameworks",
        icon: FolderKanban,
        path: "/seguranca-informacao/frameworks",
      },
      {
        title: "Riscos",
        icon: Shield,
        path: "/seguranca-informacao/riscos",
      },
      {
        title: "Eventos e SLA",
        icon: ShieldAlert,
        path: "/seguranca-informacao/eventos",
      },
      {
        title: "Emissões",
        icon: FilePlus,
        path: "/seguranca-informacao/emissoes",
      },
      {
        title: "Relatórios",
        icon: FileText,
        path: "/seguranca-informacao/relatorios",
      },
      {
        title: "Atas",
        icon: ClipboardList,
        path: "/seguranca-informacao/atas",
      },
      {
        title: "Processos (BPMN)",
        icon: Workflow,
        path: "/seguranca-informacao/processos",
      },
      {
        title: "Matriz de Rastreabilidade",
        icon: Workflow,
        path: "/seguranca-informacao/matriz",
      },
      {
        title: "SBOM",
        icon: Boxes,
        path: "/seguranca-informacao/sbom",
      },
      {
        title: "Integração (API)",
        icon: Plug,
        path: "/seguranca-informacao/integracao",
      },
      {
        title: "Configurações",
        icon: SlidersHorizontal,
        path: "/seguranca-informacao/configuracoes",
      },
      {
        title: "Auditoria",
        icon: History,
        path: "/seguranca-informacao/auditoria",
      },
    ],
  },
  {
    // Trilha de auditoria GLOBAL (todos os módulos/usuários). Só superadmin.
    title: "Auditoria",
    icon: History,
    path: "/auditoria",
    superAdminOnly: true,
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

  expandedMenus: string[];
  toggleMenu: (title: string) => void;
  permissoesSet: Set<string>;
  areas?: Area[];
}

function MenuItemComponent({
  item,
  onNavigate,

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

  // Itens superAdminOnly (no nível do módulo) só aparecem para superadmins
  if (
    item.superAdminOnly &&
    (user as { is_superadmin?: boolean } | null)?.is_superadmin !== true
  ) {
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
        return child.children.some((sub) => location.pathname === sub.path);
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
          )}
        >
          {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
          <span className="flex-1 text-left">{item.title}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </button>

        {isExpanded && (
          <div className="bg-black/20">
            {filteredChildren?.map((child, idx) => {
              const hasSubChildren =
                child.children && child.children.length > 0;
              const isSubActive = child.path
                ? location.pathname === child.path
                : hasSubChildren &&
                  child.children?.some((c) => location.pathname === c.path);
              return (
                <div key={idx}>
                  {hasSubChildren ? (
                    <button
                      onClick={() => toggleMenu(child.title)}
                      className={cn(
                        "w-full flex items-center gap-2 pl-10 pr-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                        isSubActive &&
                          "bg-white/15 text-white border-l-2 border-white ml-2",
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
                        isSubActive &&
                          "bg-white/15 text-white border-l-2 border-white ml-2",
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
                        const isSubSubActive =
                          location.pathname === subChild.path;
                        // 4º nível: item do 3º que agrupa outros em vez de ter rota própria.
                        const netos = subChild.children ?? [];
                        if (netos.length > 0) {
                          const netoAtivo = netos.some(
                            (n) => location.pathname === n.path,
                          );
                          return (
                            <div key={`sub-${idx}-${subIdx}`}>
                              <button
                                onClick={() => toggleMenu(subChild.title)}
                                className={cn(
                                  "w-full flex items-center gap-2 pl-10 pr-4 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors",
                                  netoAtivo && "text-white font-medium",
                                )}
                              >
                                {subChild.icon && (
                                  <subChild.icon className="h-3.5 w-3.5 flex-shrink-0" />
                                )}
                                <span className="flex-1 text-left">
                                  {subChild.title}
                                </span>
                                <ChevronDown
                                  className={cn(
                                    "h-3 w-3 transition-transform duration-200",
                                    expandedMenus.includes(subChild.title) &&
                                      "rotate-180",
                                  )}
                                />
                              </button>
                              {expandedMenus.includes(subChild.title) && (
                                <div className="pl-4">
                                  {netos.map((neto, netoIdx) => (
                                    <Link
                                      key={`neto-${idx}-${subIdx}-${netoIdx}`}
                                      to={neto.path}
                                      className={cn(
                                        "flex items-center gap-2 pl-10 pr-4 py-2 text-sm text-white/50 hover:bg-white/10 hover:text-white transition-colors",
                                        location.pathname === neto.path &&
                                          "text-white font-medium",
                                      )}
                                    >
                                      {neto.icon && (
                                        <neto.icon className="h-3.5 w-3.5 flex-shrink-0" />
                                      )}
                                      <span>{neto.title}</span>
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={`sub-${idx}-${subIdx}`}
                            to={subChild.path || "#"}
                            // onClick={onNavigate} Removido para não fechar a navbar ao clicar
                            className={cn(
                              "flex items-center gap-2 pl-10 pr-4 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors",
                              isSubSubActive && "text-white font-medium",
                            )}
                          >
                            {subChild.icon && (
                              <subChild.icon className="h-3.5 w-3.5 flex-shrink-0" />
                            )}
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

    return menuContent;
  }

  const content = (
    <Link
      to={item.path || "#"}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors",
        isActive && "bg-white/20 text-white border-r-4 border-white",
      )}
    >
      {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
      <span>{item.title}</span>
    </Link>
  );

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

  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const currentPath = location.pathname;
    const expanded: string[] = [];

    const casa = (p?: string) =>
      !!p && (currentPath === p || currentPath.startsWith(p + "/"));

    menuItemsCompleto.forEach((item) => {
      let isItemExpanded = false;

      item.children?.forEach((child) => {
        const isChildActive = casa(child.path);
        const isSubChildActive = child.children?.some((sub) => casa(sub.path));
        // 4º nível: quando a rota ativa está sob um agrupador do 3º nível, os
        // DOIS ancestrais precisam abrir (o do 2º e o próprio agrupador).
        const agrupadorAtivo = child.children?.find((sub) =>
          sub.children?.some((neto) => casa(neto.path)),
        );

        if (isChildActive || isSubChildActive || agrupadorAtivo) {
          isItemExpanded = true;
        }

        if (isSubChildActive || agrupadorAtivo) {
          expanded.push(child.title);
        }

        if (agrupadorAtivo) {
          expanded.push(agrupadorAtivo.title);
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
        const dominios =
          (user as any).dominios && (user as any).dominios.length > 0
            ? (user as any).dominios
            : [getUserDominio(user, loadedAreas)];

        const todosCodigos = new Set<string>();
        for (const dom of dominios) {
          const response = await getModulosPermitidosMenu(dom as Diretoria);
          response.modulos_permitidos.forEach((m) =>
            todosCodigos.add(m.codigo),
          );
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
    const currentPath = location.pathname;

    const casa = (p?: string) =>
      !!p && (currentPath === p || currentPath.startsWith(p + "/"));
    const abrir = (titulo: string) =>
      setExpandedMenus((prev) =>
        prev.includes(titulo) ? prev : [...prev, titulo],
      );

    menuItemsCompleto.forEach((item) => {
      let shouldExpandItem = false;

      item.children?.forEach((child) => {
        const isChildActive = casa(child.path);
        const isSubChildActive = child.children?.some((sub) => casa(sub.path));
        // 4º nível — mesma regra do estado inicial: abre o agrupador junto.
        const agrupadorAtivo = child.children?.find((sub) =>
          sub.children?.some((neto) => casa(neto.path)),
        );

        if (isChildActive || isSubChildActive || agrupadorAtivo) {
          shouldExpandItem = true;
        }

        if (isSubChildActive || agrupadorAtivo) {
          abrir(child.title);
        }

        if (agrupadorAtivo) {
          abrir(agrupadorAtivo.title);
        }
      });

      if (shouldExpandItem) {
        setExpandedMenus((prev) =>
          prev.includes(item.title) ? prev : [...prev, item.title],
        );
      }
    });
  }, [location.pathname]);

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
          "fixed lg:relative left-0 z-50 h-screen lg:h-full overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out flex-shrink-0",
          "top-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "w-64",
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
          <div className="relative flex items-center py-2">
            {/* Alinhado à esquerda com o mesmo px-4/gap-2 dos itens do menu, pra ficar na
                mesma coluna dos ícones em vez de centralizado. */}
            <Link
              to="/"
              onClick={onClose}
              aria-label="Ir para o Início"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <Home className="h-4 w-4 flex-shrink-0" />
              <span>Início</span>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute right-3 lg:hidden text-white hover:bg-white/10"
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
