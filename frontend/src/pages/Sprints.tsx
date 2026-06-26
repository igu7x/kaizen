import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { useAuth } from "@/contexts/AuthContext";
import { isDomainRoot } from "@/utils/domain";
import { areasApi, Area } from "@/services/areasApi";
import {
  Loader2,
  ChevronsUpDown,
  Check,
  Pencil,
  Trash2,
  CheckCircle,
  Plus,
  MoreHorizontal,
  User,
  Calendar,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSprints,
  getTodosSprints,
  Sprint,
  formatarPeriodoSprint,
  getLabelStatusSprint,
  getCorStatusSprint,
} from "@/services/sprintsApi";
import {
  cadastrosProjetosApi,
  Projeto,
  Entrega,
  TarefaEntrega,
} from "@/services/cadastrosProjetosApi";
import { getUsers } from "@/services/api";
import type { User as UserType } from "@/types";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

// Interface para tarefa com dados relacionados para o Backlog
interface TarefaBacklog extends TarefaEntrega {
  entrega_nome: string;
  sprint_nome: string | null;
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

// Tipos de abas disponíveis
type TabType = "lista" | "backlog" | "sprint-atual";

export default function Sprints() {
  const { toast } = useToast();
  const { selectedDirectorate } = useDirectorate();
  const { user } = useAuth();
  const location = useLocation();
  // Sempre enviar a diretoria — o backend filtra por domínio (multi-tenant)
  const dirFiltro = selectedDirectorate || undefined;

  // Áreas para isDomainRoot
  const [domainAreas, setDomainAreas] = useState<Area[]>([]);
  useEffect(() => {
    areasApi.getAll().then(setDomainAreas).catch(console.error);
  }, []);

  // Estado de animação
  const [isAnimating, setIsAnimating] = useState(true);

  // Estado da aba ativa
  const [activeTab, setActiveTab] = useState<TabType>("lista");

  // Estados principais
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntregas, setLoadingEntregas] = useState(false);

  // Filtros (Sprints)
  const [projetoFilter, setProjetoFilter] = useState<string>("todos");
  const [entregaFilter, setEntregaFilter] = useState<string>("todos");
  const [projetoComboOpen, setProjetoComboOpen] = useState(false);
  const [entregaComboOpen, setEntregaComboOpen] = useState(false);

  // Estados do Backlog
  const [backlogProjetoSelecionado, setBacklogProjetoSelecionado] = useState<
    number | null
  >(null);
  const [backlogEntregas, setBacklogEntregas] = useState<Entrega[]>([]);
  const [backlogEntregaFilter, setBacklogEntregaFilter] =
    useState<string>("todos");
  const [backlogTarefas, setBacklogTarefas] = useState<TarefaBacklog[]>([]);
  const [loadingBacklog, setLoadingBacklog] = useState(false);
  const [sprintsLista, setSprintsLista] = useState<Sprint[]>([]);
  const [backlogProjetoSearch, setBacklogProjetoSearch] = useState("");
  const [backlogEntregaComboOpen, setBacklogEntregaComboOpen] = useState(false);

  // Estados do Modal de Edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<TarefaBacklog | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    nome: "",
    responsavel: "",
    sprint_id: "",
    status: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<UserType[]>(
    [],
  );
  const [responsavelPopoverOpen, setResponsavelPopoverOpen] = useState(false);

  // Estados do Sprint Atual
  const [sprintAtualProjetoSelecionado, setSprintAtualProjetoSelecionado] =
    useState<number | null>(null);
  const [sprintAtualEntregas, setSprintAtualEntregas] = useState<Entrega[]>([]);
  const [sprintAtualEntregaFilter, setSprintAtualEntregaFilter] =
    useState<string>("todos");
  const [sprintAtualTarefas, setSprintAtualTarefas] = useState<TarefaBacklog[]>(
    [],
  );
  const [loadingSprintAtual, setLoadingSprintAtual] = useState(false);
  const [sprintAtualProjetoSearch, setSprintAtualProjetoSearch] = useState("");
  const [sprintAtualEntregaComboOpen, setSprintAtualEntregaComboOpen] =
    useState(false);
  const [draggedTask, setDraggedTask] = useState<TarefaBacklog | null>(null);

  // Animação de entrada da página
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // ============================================================
  // EFEITOS
  // ============================================================

  // Carregar projetos baseado na diretoria selecionada no contexto
  useEffect(() => {
    const loadProjetos = async () => {
      try {
        const data = await cadastrosProjetosApi.getProjetos(dirFiltro);
        setProjetos(data);
        // Reset filtros de projeto e entrega quando mudar diretoria
        setProjetoFilter("todos");
        setEntregaFilter("todos");
        setProjetoComboOpen(false);
        // Reset backlog quando mudar diretoria
        setBacklogProjetoSelecionado(null);
        setBacklogEntregas([]);
        setBacklogTarefas([]);
        setBacklogEntregaFilter("todos");
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    };
    loadProjetos();
  }, [selectedDirectorate]);

  // Carregar entregas quando projeto é selecionado
  useEffect(() => {
    const loadEntregas = async () => {
      if (projetoFilter === "todos") {
        setEntregas([]);
        setEntregaFilter("todos");
        return;
      }

      setLoadingEntregas(true);
      try {
        const projeto = await cadastrosProjetosApi.getProjetoById(
          parseInt(projetoFilter),
        );
        setEntregas(projeto.entregas || []);
        setEntregaFilter("todos");
        setEntregaComboOpen(false);
      } catch (error) {
        setEntregas([]);
      } finally {
        setLoadingEntregas(false);
      }
    };
    loadEntregas();
  }, [projetoFilter]);

  // Carregar sprints com filtros
  useEffect(() => {
    const loadSprints = async () => {
      setLoading(true);
      try {
        const filters: any = {};

        // Backend lida com filtragem de domínio automaticamente
        filters.diretoria = selectedDirectorate;

        if (projetoFilter !== "todos") {
          filters.projeto_id = parseInt(projetoFilter);
        }

        if (entregaFilter !== "todos") {
          filters.entrega_id = parseInt(entregaFilter);
        }

        const data = await getSprints(filters);
        setSprints(data);
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoading(false);
      }
    };
    loadSprints();
  }, [selectedDirectorate, projetoFilter, entregaFilter, toast]);

  // Carregar lista de sprints e usuários para os dropdowns do backlog
  useEffect(() => {
    const loadSprintsLista = async () => {
      try {
        const data = await getTodosSprints();
        setSprintsLista(data);
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    };
    const loadUsuarios = async () => {
      try {
        const usersData = await getUsers(selectedDirectorate || undefined);
        setUsuariosDisponiveis(usersData.filter((u) => u.status === "ACTIVE"));
      } catch (error) {
        console.warn("Erro ao carregar usuários:", error);
      }
    };
    loadSprintsLista();
    loadUsuarios();
  }, []);

  // Carregar entregas e tarefas quando projeto é selecionado no Backlog
  useEffect(() => {
    const loadBacklogData = async () => {
      if (!backlogProjetoSelecionado) {
        setBacklogEntregas([]);
        setBacklogTarefas([]);
        setBacklogEntregaFilter("todos");
        return;
      }

      setLoadingBacklog(true);
      try {
        // Buscar projeto com entregas
        const projeto = await cadastrosProjetosApi.getProjetoById(
          backlogProjetoSelecionado,
        );
        const entregasList = projeto.entregas || [];
        setBacklogEntregas(entregasList);

        // Buscar todas as tarefas de todas as entregas do projeto
        const todasTarefas: TarefaBacklog[] = [];
        for (const entrega of entregasList) {
          const tarefas = await cadastrosProjetosApi.getTarefasEntrega(
            entrega.id,
          );
          tarefas.forEach((tarefa) => {
            const sprintInfo = sprintsLista.find(
              (s) => s.id === tarefa.sprint_id,
            );
            todasTarefas.push({
              ...tarefa,
              entrega_nome: entrega.nome,
              sprint_nome: sprintInfo?.nome || tarefa.sprint || null,
            });
          });
        }
        setBacklogTarefas(todasTarefas);
        setBacklogEntregaFilter("todos");
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoadingBacklog(false);
      }
    };
    loadBacklogData();
  }, [backlogProjetoSelecionado, sprintsLista, toast]);

  // Encontrar o sprint atual (em execução)
  const sprintEmExecucao =
    sprintsLista.find((s) => s.status === "em_andamento") ||
    sprintsLista.find((s) => {
      const hoje = new Date();
      const inicio = new Date(s.data_inicio);
      const fim = new Date(s.data_fim);
      return hoje >= inicio && hoje <= fim;
    }) ||
    sprintsLista[0];

  // Carregar entregas e tarefas quando projeto é selecionado no Sprint Atual
  useEffect(() => {
    const loadSprintAtualData = async () => {
      if (!sprintAtualProjetoSelecionado || !sprintEmExecucao) {
        setSprintAtualEntregas([]);
        setSprintAtualTarefas([]);
        setSprintAtualEntregaFilter("todos");
        return;
      }

      setLoadingSprintAtual(true);
      try {
        // Buscar projeto com entregas
        const projeto = await cadastrosProjetosApi.getProjetoById(
          sprintAtualProjetoSelecionado,
        );
        const entregasList = projeto.entregas || [];
        setSprintAtualEntregas(entregasList);

        // Buscar todas as tarefas de todas as entregas do projeto que estão no sprint atual
        const todasTarefas: TarefaBacklog[] = [];
        for (const entrega of entregasList) {
          const tarefas = await cadastrosProjetosApi.getTarefasEntrega(
            entrega.id,
          );
          tarefas
            .filter((tarefa) => tarefa.sprint_id === sprintEmExecucao.id)
            .forEach((tarefa) => {
              const sprintInfo = sprintsLista.find(
                (s) => s.id === tarefa.sprint_id,
              );
              todasTarefas.push({
                ...tarefa,
                entrega_nome: entrega.nome,
                sprint_nome: sprintInfo?.nome || tarefa.sprint || null,
              });
            });
        }
        setSprintAtualTarefas(todasTarefas);
        setSprintAtualEntregaFilter("todos");
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoadingSprintAtual(false);
      }
    };
    loadSprintAtualData();
  }, [sprintAtualProjetoSelecionado, sprintEmExecucao, sprintsLista, toast]);

  // Filtrar tarefas do backlog por entrega
  const tarefasBacklogFiltradas =
    backlogEntregaFilter === "todos"
      ? backlogTarefas
      : backlogTarefas.filter(
          (t) => t.entrega_id.toString() === backlogEntregaFilter,
        );

  // Filtrar projetos do backlog por diretoria (baseado nas áreas de execução)
  const projetosBacklogPorDiretoria = isDomainRoot(user, domainAreas)
    ? projetos
    : projetos.filter((p) => {
        // Verificar se o projeto tem áreas de execução que pertencem à diretoria selecionada
        if (p.areasExecucao && p.areasExecucao.length > 0) {
          return p.areasExecucao.some(
            (area) => area.diretoria === selectedDirectorate,
          );
        }
        // Fallback: usar o campo areas_execucao_diretorias (string com siglas separadas por vírgula)
        if (p.areas_execucao_diretorias) {
          return p.areas_execucao_diretorias
            .split(",")
            .map((d) => d.trim())
            .includes(selectedDirectorate);
        }
        // Se não tem áreas de execução definidas, não mostrar para diretorias específicas
        return false;
      });

  // Filtrar projetos do backlog por pesquisa e ordenar alfabeticamente
  const projetosBacklogFiltrados = (
    backlogProjetoSearch.trim()
      ? projetosBacklogPorDiretoria.filter(
          (p) =>
            (p.nome || "")
              .toLowerCase()
              .includes(backlogProjetoSearch.toLowerCase()) ||
            (p.codigo || "")
              .toLowerCase()
              .includes(backlogProjetoSearch.toLowerCase()),
        )
      : projetosBacklogPorDiretoria
  ).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  // Filtrar tarefas do Sprint Atual por role do usuário
  // Viewers veem apenas suas próprias tarefas, Managers e Admins veem todas
  const tarefasSprintAtualPorRole =
    user?.role === "VIEWER"
      ? sprintAtualTarefas.filter(
          (t) =>
            t.responsavel &&
            user.name &&
            t.responsavel.toLowerCase() === user.name.toLowerCase(),
        )
      : sprintAtualTarefas;

  // Filtrar tarefas do Sprint Atual por entrega
  const tarefasSprintAtualFiltradas =
    sprintAtualEntregaFilter === "todos"
      ? tarefasSprintAtualPorRole
      : tarefasSprintAtualPorRole.filter(
          (t) => t.entrega_id.toString() === sprintAtualEntregaFilter,
        );

  // Filtrar projetos do Sprint Atual por pesquisa
  const projetosSprintAtualFiltrados = sprintAtualProjetoSearch.trim()
    ? projetosBacklogPorDiretoria.filter(
        (p) =>
          (p.nome || "")
            .toLowerCase()
            .includes(sprintAtualProjetoSearch.toLowerCase()) ||
          (p.codigo || "")
            .toLowerCase()
            .includes(sprintAtualProjetoSearch.toLowerCase()),
      )
    : projetosBacklogPorDiretoria;

  // Obter projeto selecionado no Sprint Atual
  const projetoSelecionadoSprintAtual = projetosBacklogPorDiretoria.find(
    (p) => p.id === sprintAtualProjetoSelecionado,
  );

  // Agrupar tarefas por status para o Kanban
  const tarefasAFazer = tarefasSprintAtualFiltradas.filter(
    (t) => t.status === "a_fazer",
  );
  const tarefasFazendo = tarefasSprintAtualFiltradas.filter(
    (t) => t.status === "fazendo",
  );
  const tarefasFeito = tarefasSprintAtualFiltradas.filter(
    (t) => t.status === "feito",
  );

  // Funções de Drag and Drop
  const handleDragStart = (tarefa: TarefaBacklog) => {
    setDraggedTask(tarefa);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (novoStatus: "a_fazer" | "fazendo" | "feito") => {
    if (!draggedTask) return;

    try {
      await cadastrosProjetosApi.updateTarefaEntrega(draggedTask.id, {
        status: novoStatus,
      });

      // Atualizar estado local imediatamente para UX responsiva
      setSprintAtualTarefas((prev) =>
        prev.map((t) =>
          t.id === draggedTask.id ? { ...t, status: novoStatus } : t,
        ),
      );

      toast({
        title: "Sucesso",
        description: `Tarefa movida para "${novoStatus === "a_fazer" ? "A Fazer" : novoStatus === "fazendo" ? "Fazendo" : "Feito"}"`,
      });
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setDraggedTask(null);
    }
  };

  // Função para atualizar status da tarefa
  const handleUpdateTarefaStatus = async (
    tarefaId: number,
    novoStatus: "a_fazer" | "fazendo" | "feito",
  ) => {
    try {
      await cadastrosProjetosApi.updateTarefaEntrega(tarefaId, {
        status: novoStatus,
      });
      // Recarregar tarefas
      if (backlogProjetoSelecionado) {
        const projeto = await cadastrosProjetosApi.getProjetoById(
          backlogProjetoSelecionado,
        );
        const entregasList = projeto.entregas || [];
        const todasTarefas: TarefaBacklog[] = [];
        for (const entrega of entregasList) {
          const tarefas = await cadastrosProjetosApi.getTarefasEntrega(
            entrega.id,
          );
          tarefas.forEach((tarefa) => {
            const sprintInfo = sprintsLista.find(
              (s) => s.id === tarefa.sprint_id,
            );
            todasTarefas.push({
              ...tarefa,
              entrega_nome: entrega.nome,
              sprint_nome: sprintInfo?.nome || tarefa.sprint || null,
            });
          });
        }
        setBacklogTarefas(todasTarefas);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Função para abrir modal de edição
  const handleOpenEditModal = (tarefa: TarefaBacklog) => {
    setTarefaEditando(tarefa);
    setEditForm({
      nome: tarefa.nome,
      responsavel: tarefa.responsavel || "",
      sprint_id: tarefa.sprint_id?.toString() || "",
      status: tarefa.status,
    });
    setEditModalOpen(true);
  };

  // Função para salvar edição da tarefa
  const handleSaveEdit = async () => {
    if (!tarefaEditando) return;

    setSavingEdit(true);
    try {
      await cadastrosProjetosApi.updateTarefaEntrega(tarefaEditando.id, {
        nome: editForm.nome,
        responsavel: editForm.responsavel || undefined,
        sprint_id: editForm.sprint_id
          ? parseInt(editForm.sprint_id)
          : undefined,
        status: editForm.status,
      });

      // Recarregar tarefas
      if (backlogProjetoSelecionado) {
        const projeto = await cadastrosProjetosApi.getProjetoById(
          backlogProjetoSelecionado,
        );
        const entregasList = projeto.entregas || [];
        const todasTarefas: TarefaBacklog[] = [];
        for (const entrega of entregasList) {
          const tarefas = await cadastrosProjetosApi.getTarefasEntrega(
            entrega.id,
          );
          tarefas.forEach((tarefa) => {
            const sprintInfo = sprintsLista.find(
              (s) => s.id === tarefa.sprint_id,
            );
            todasTarefas.push({
              ...tarefa,
              entrega_nome: entrega.nome,
              sprint_nome: sprintInfo?.nome || tarefa.sprint || null,
            });
          });
        }
        setBacklogTarefas(todasTarefas);
      }

      setEditModalOpen(false);
      setTarefaEditando(null);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSavingEdit(false);
    }
  };

  // Função para obter label do status da tarefa
  const getLabelStatusTarefa = (status: string): string => {
    switch (status) {
      case "feito":
        return "Feito";
      case "fazendo":
        return "Fazendo";
      case "a_fazer":
      default:
        return "A Fazer";
    }
  };

  // Função para obter cor do badge de status
  const getCorBadgeStatus = (status: string): string => {
    switch (status) {
      case "feito":
        return "bg-green-100 text-green-700 border-green-200";
      case "fazendo":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "a_fazer":
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Layout>
      <div
        className={`space-y-4 lg:space-y-6 ${isAnimating ? "page-transition-enter" : ""}`}
      >
        {/* Trilha de navegação */}
        <Breadcrumbs
          items={[
            { label: "Gestão Estratégica", to: "/gestao-estrategica" },
            { label: "Controle de Execução" },
          ]}
        />

        {/* Header — barra azul + label da seção + título */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div
              className="w-1.5 h-12 rounded-full"
              style={{
                background: "linear-gradient(180deg, #0A2547 0%, #1565C0 100%)",
              }}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Gestão Estratégica
              </p>
              <h1 className="text-2xl font-bold text-slate-800">
                Controle de Execução
              </h1>
            </div>
          </div>

        </div>

        {/* Tabs de navegação */}
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab("lista")}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-medium transition-all border-2",
              activeTab === "lista"
                ? "bg-[#4169E1] text-white border-[#4169E1]"
                : "bg-white text-gray-700 border-gray-300 hover:border-[#4169E1] hover:text-[#4169E1]",
            )}
          >
            Sprints
          </button>
          <button
            onClick={() => setActiveTab("backlog")}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-medium transition-all border-2",
              activeTab === "backlog"
                ? "bg-[#4169E1] text-white border-[#4169E1]"
                : "bg-white text-gray-700 border-gray-300 hover:border-[#4169E1] hover:text-[#4169E1]",
            )}
          >
            Backlog
          </button>
          <button
            onClick={() => setActiveTab("sprint-atual")}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-medium transition-all border-2",
              activeTab === "sprint-atual"
                ? "bg-[#4169E1] text-white border-[#4169E1]"
                : "bg-white text-gray-700 border-gray-300 hover:border-[#4169E1] hover:text-[#4169E1]",
            )}
          >
            Sprint Atual
          </button>
        </div>

        {/* Conteúdo da aba Sprints */}
        {activeTab === "lista" && (
          <>
            {/* Filtros */}
            <div className="flex items-end gap-6 flex-wrap">
              {/* Projeto - Combobox com pesquisa */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-600">
                  Projeto
                </label>
                <Popover
                  open={projetoComboOpen}
                  onOpenChange={setProjetoComboOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={projetoComboOpen}
                      className="w-[320px] justify-between bg-white font-normal"
                    >
                      <span className="truncate">
                        {projetoFilter === "todos"
                          ? "Todos os Projetos"
                          : (() => {
                              const projeto = projetos.find(
                                (p) => p.id.toString() === projetoFilter,
                              );
                              if (!projeto) return "Selecionar Projeto";
                              return projeto.codigo
                                ? `${projeto.codigo} - ${projeto.nome}`
                                : projeto.nome;
                            })()}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput placeholder="Pesquisar projeto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="todos"
                            onSelect={() => {
                              setProjetoFilter("todos");
                              setProjetoComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                projetoFilter === "todos"
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            Todos os Projetos
                          </CommandItem>
                          {projetos.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.codigo || ""} ${p.nome}`}
                              onSelect={() => {
                                setProjetoFilter(p.id.toString());
                                setProjetoComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  projetoFilter === p.id.toString()
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <span className="truncate">
                                {p.codigo ? `${p.codigo} - ${p.nome}` : p.nome}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Entrega - Combobox com pesquisa */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-600">
                  Entrega
                </label>
                <Popover
                  open={entregaComboOpen}
                  onOpenChange={setEntregaComboOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={entregaComboOpen}
                      disabled={projetoFilter === "todos" || loadingEntregas}
                      className="w-[320px] justify-between bg-white font-normal disabled:opacity-50"
                    >
                      <span className="truncate">
                        {loadingEntregas ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando...
                          </span>
                        ) : entregaFilter === "todos" ? (
                          "Todas as Entregas"
                        ) : (
                          entregas.find(
                            (e) => e.id.toString() === entregaFilter,
                          )?.nome || "Selecionar Entrega"
                        )}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput placeholder="Pesquisar entrega..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma entrega encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="todos"
                            onSelect={() => {
                              setEntregaFilter("todos");
                              setEntregaComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                entregaFilter === "todos"
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            Todas as Entregas
                          </CommandItem>
                          {entregas.map((e) => (
                            <CommandItem
                              key={e.id}
                              value={e.nome}
                              onSelect={() => {
                                setEntregaFilter(e.id.toString());
                                setEntregaComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 flex-shrink-0",
                                  entregaFilter === e.id.toString()
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <span className="truncate">{e.nome}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Tabela de Sprints */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#4169E1] hover:bg-[#4169E1]">
                      <TableHead className="font-semibold text-white text-center">
                        Ciclo
                      </TableHead>
                      <TableHead className="font-semibold text-white text-center">
                        Período
                      </TableHead>
                      <TableHead className="font-semibold text-white text-center">
                        Tarefas Planejadas
                      </TableHead>
                      <TableHead className="font-semibold text-white text-center">
                        Tarefas Concluídas
                      </TableHead>
                      <TableHead className="font-semibold text-white text-center">
                        Tarefas Remanejadas
                      </TableHead>
                      <TableHead className="font-semibold text-white text-center">
                        Progresso
                      </TableHead>
                      <TableHead className="font-semibold text-white text-center">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sprints.map((sprint) => (
                      <TableRow
                        key={sprint.id}
                        className="hover:bg-gray-50 border-b"
                      >
                        <TableCell className="font-medium text-center py-3">
                          {sprint.nome}
                        </TableCell>
                        <TableCell className="text-center text-gray-600 py-3">
                          {formatarPeriodoSprint(
                            sprint.data_inicio,
                            sprint.data_fim,
                          )}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          {sprint.tarefas_planejadas > 0
                            ? sprint.tarefas_planejadas
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          {sprint.tarefas_concluidas > 0
                            ? sprint.tarefas_concluidas
                            : "-"}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          {sprint.tarefas_remanejadas > 0 ? (
                            <span className="text-orange-600 font-medium">
                              {sprint.tarefas_remanejadas}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2 justify-center">
                            {sprint.tarefas_planejadas > 0 ? (
                              <>
                                <div className="w-24 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full transition-all"
                                    style={{ width: `${sprint.progresso}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-600 w-12">
                                  {sprint.progresso}%
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <span
                            className={`text-sm font-medium ${getCorStatusSprint(sprint.status)}`}
                          >
                            {getLabelStatusSprint(sprint.status)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}

        {/* Conteúdo da aba Backlog */}
        {activeTab === "backlog" && (
          <div className="flex gap-6">
            {/* Sidebar - Lista de Projetos */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-[#4169E1] px-4 py-3">
                  <h3 className="text-white font-semibold text-center">
                    Lista de Projetos
                  </h3>
                </div>
                <div className="p-2 border-b border-gray-200">
                  <Input
                    placeholder="Pesquisar projeto..."
                    value={backlogProjetoSearch}
                    onChange={(e) => setBacklogProjetoSearch(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
                  {projetosBacklogFiltrados.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Nenhum projeto encontrado
                    </div>
                  ) : (
                    projetosBacklogFiltrados.map((projeto) => (
                      <button
                        key={projeto.id}
                        onClick={() => setBacklogProjetoSelecionado(projeto.id)}
                        className={cn(
                          "w-full px-4 py-3 text-left text-sm transition-colors border-b border-gray-100 last:border-b-0",
                          backlogProjetoSelecionado === projeto.id
                            ? "bg-[#4169E1] text-white font-medium"
                            : "hover:bg-gray-50 text-gray-700",
                        )}
                      >
                        {projeto.nome}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="flex-1 space-y-4">
              {/* Filtro de Entrega - Combobox com pesquisa */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-slate-600">
                  Entrega
                </label>
                <Popover
                  open={backlogEntregaComboOpen}
                  onOpenChange={setBacklogEntregaComboOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={backlogEntregaComboOpen}
                      disabled={
                        !backlogProjetoSelecionado ||
                        backlogEntregas.length === 0
                      }
                      className="w-[320px] justify-between bg-white font-normal disabled:opacity-50"
                    >
                      <span className="truncate">
                        {backlogEntregaFilter === "todos"
                          ? "Todas as Entregas"
                          : backlogEntregas.find(
                              (e) => e.id.toString() === backlogEntregaFilter,
                            )?.nome || "Selecionar Entrega"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput placeholder="Pesquisar entrega..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma entrega encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="todos"
                            onSelect={() => {
                              setBacklogEntregaFilter("todos");
                              setBacklogEntregaComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                backlogEntregaFilter === "todos"
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            Todas as Entregas
                          </CommandItem>
                          {backlogEntregas.map((entrega) => (
                            <CommandItem
                              key={entrega.id}
                              value={entrega.nome}
                              onSelect={() => {
                                setBacklogEntregaFilter(entrega.id.toString());
                                setBacklogEntregaComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 flex-shrink-0",
                                  backlogEntregaFilter === entrega.id.toString()
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <span className="truncate">{entrega.nome}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tabela de Tarefas */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {loadingBacklog ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : !backlogProjetoSelecionado ? (
                  <div className="py-12 text-center text-gray-500">
                    Selecione um projeto para visualizar as tarefas
                  </div>
                ) : backlogEntregas.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-gray-400 mb-2">
                      <svg
                        className="w-16 h-16 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium mb-1">
                      Nenhuma entrega cadastrada neste projeto
                    </p>
                    <p className="text-gray-400 text-sm mb-4">
                      Adicione entregas no Escritório de Projetos para ver as
                      tarefas aqui
                    </p>
                    <a
                      href="/controle-execucao"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Ir para Escritório de Projetos
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </a>
                  </div>
                ) : tarefasBacklogFiltradas.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    Nenhuma tarefa encontrada nas entregas deste projeto
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#4169E1] hover:bg-[#4169E1]">
                        <TableHead className="font-semibold text-white w-[35%]">
                          Nome da Tarefa
                        </TableHead>
                        <TableHead className="font-semibold text-white text-center w-[15%]">
                          Ciclo
                        </TableHead>
                        <TableHead className="font-semibold text-white text-center w-[20%]">
                          Responsável
                        </TableHead>
                        <TableHead className="font-semibold text-white text-center w-[15%]">
                          Status
                        </TableHead>
                        <TableHead className="font-semibold text-white text-center w-[15%]">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tarefasBacklogFiltradas.map((tarefa) => (
                        <TableRow
                          key={tarefa.id}
                          className="hover:bg-gray-50 border-b"
                        >
                          <TableCell className="font-medium py-3 text-blue-600">
                            {tarefa.nome}
                          </TableCell>
                          <TableCell className="text-center py-3 text-gray-600">
                            {tarefa.sprint_nome || "-"}
                          </TableCell>
                          <TableCell className="text-center py-3 text-gray-600">
                            {tarefa.responsavel || "-"}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium border",
                                getCorBadgeStatus(tarefa.status),
                              )}
                            >
                              {getLabelStatusTarefa(tarefa.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-500 hover:text-amber-600"
                                title="Editar"
                                onClick={() => handleOpenEditModal(tarefa)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              {tarefa.status !== "feito" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-gray-500 hover:text-green-600"
                                  title="Marcar como Feito"
                                  onClick={() =>
                                    handleUpdateTarefaStatus(tarefa.id, "feito")
                                  }
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo da aba Sprint Atual */}
        {activeTab === "sprint-atual" && (
          <div className="flex gap-6">
            {/* Sidebar - Lista de Projetos */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-[#4169E1] px-4 py-3">
                  <h3 className="text-white font-semibold text-center">
                    Lista de Projetos
                  </h3>
                </div>
                <div className="p-2 border-b border-gray-200">
                  <Input
                    placeholder="Pesquisar projeto..."
                    value={sprintAtualProjetoSearch}
                    onChange={(e) =>
                      setSprintAtualProjetoSearch(e.target.value)
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
                  {projetosSprintAtualFiltrados.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Nenhum projeto encontrado
                    </div>
                  ) : (
                    projetosSprintAtualFiltrados.map((projeto) => (
                      <button
                        key={projeto.id}
                        onClick={() =>
                          setSprintAtualProjetoSelecionado(projeto.id)
                        }
                        className={cn(
                          "w-full px-4 py-3 text-left text-sm transition-colors border-b border-gray-100 last:border-b-0",
                          sprintAtualProjetoSelecionado === projeto.id
                            ? "bg-[#4169E1] text-white font-medium"
                            : "hover:bg-gray-50 text-gray-700",
                        )}
                      >
                        {projeto.nome}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Conteúdo Principal - Kanban */}
            <div className="flex-1 space-y-4">
              {/* Header com Sprint Atual, Projeto Selecionado e Filtro de Entrega */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Destaque do Sprint Atual, Projeto e Responsável */}
                <div className="flex items-center gap-3 flex-wrap">
                  {sprintEmExecucao && (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <div>
                        <span className="text-sm text-blue-600 font-medium">
                          Sprint atual:{" "}
                        </span>
                        <span className="text-sm font-bold text-blue-800">
                          {sprintEmExecucao.nome} (
                          {formatarPeriodoSprint(
                            sprintEmExecucao.data_inicio,
                            sprintEmExecucao.data_fim,
                          )}
                          )
                        </span>
                      </div>
                    </div>
                  )}
                  {projetoSelecionadoSprintAtual && (
                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
                      <FolderKanban className="h-5 w-5 text-indigo-600" />
                      <div>
                        <span className="text-sm text-indigo-600 font-medium">
                          Projeto:{" "}
                        </span>
                        <span className="text-sm font-bold text-indigo-800">
                          {projetoSelecionadoSprintAtual.nome}
                        </span>
                      </div>
                    </div>
                  )}
                  {user?.role === "VIEWER" && (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                      <User className="h-5 w-5 text-gray-600" />
                      <div>
                        <span className="text-sm text-gray-600 font-medium">
                          Responsável:{" "}
                        </span>
                        <span className="text-sm font-bold text-gray-800">
                          {user.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtro de Entrega */}
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-slate-600">
                    Entrega
                  </label>
                  <Popover
                    open={sprintAtualEntregaComboOpen}
                    onOpenChange={setSprintAtualEntregaComboOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={sprintAtualEntregaComboOpen}
                        disabled={
                          !sprintAtualProjetoSelecionado ||
                          sprintAtualEntregas.length === 0
                        }
                        className="w-[280px] justify-between bg-white font-normal disabled:opacity-50"
                      >
                        <span className="truncate">
                          {sprintAtualEntregaFilter === "todos"
                            ? "Todas as Entregas"
                            : sprintAtualEntregas.find(
                                (e) =>
                                  e.id.toString() === sprintAtualEntregaFilter,
                              )?.nome || "Selecionar Entrega"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0">
                      <Command>
                        <CommandInput placeholder="Pesquisar entrega..." />
                        <CommandList>
                          <CommandEmpty>
                            Nenhuma entrega encontrada.
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="todos"
                              onSelect={() => {
                                setSprintAtualEntregaFilter("todos");
                                setSprintAtualEntregaComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  sprintAtualEntregaFilter === "todos"
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              Todas as Entregas
                            </CommandItem>
                            {sprintAtualEntregas.map((entrega) => (
                              <CommandItem
                                key={entrega.id}
                                value={entrega.nome}
                                onSelect={() => {
                                  setSprintAtualEntregaFilter(
                                    entrega.id.toString(),
                                  );
                                  setSprintAtualEntregaComboOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 flex-shrink-0",
                                    sprintAtualEntregaFilter ===
                                      entrega.id.toString()
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <span className="truncate">{entrega.nome}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Kanban Board */}
              {loadingSprintAtual ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : !sprintAtualProjetoSelecionado ? (
                <div className="bg-white rounded-lg border border-gray-200 py-12 text-center text-gray-500">
                  Selecione um projeto para visualizar o Kanban
                </div>
              ) : !sprintEmExecucao ? (
                <div className="bg-white rounded-lg border border-gray-200 py-12 text-center text-gray-500">
                  Nenhum sprint em execução no momento
                </div>
              ) : sprintAtualEntregas.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 py-12 text-center">
                  <div className="text-gray-400 mb-2">
                    <svg
                      className="w-16 h-16 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium mb-1">
                    Nenhuma entrega cadastrada neste projeto
                  </p>
                  <p className="text-gray-400 text-sm">
                    Adicione entregas no Escritório de Projetos
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 xl:gap-5 2xl:gap-6">
                  {/* Coluna A Fazer */}
                  <div
                    className="bg-gray-100 rounded-lg overflow-hidden"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop("a_fazer")}
                  >
                    <div className="bg-[#6B7280] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">
                          A Fazer
                        </span>
                        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                          {tarefasAFazer.length}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 space-y-3 min-h-[400px] max-h-[calc(100vh-400px)] overflow-y-auto">
                      {tarefasAFazer.map((tarefa) => (
                        <div
                          key={tarefa.id}
                          draggable
                          onDragStart={() => handleDragStart(tarefa)}
                          className={cn(
                            "bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow transition-shadow",
                            draggedTask?.id === tarefa.id && "opacity-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                              <span className="text-sm text-gray-800">
                                {tarefa.nome}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                          {tarefa.responsavel && (
                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                              <User className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {tarefa.responsavel}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {tarefasAFazer.length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-8">
                          Nenhuma tarefa
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coluna Fazendo */}
                  <div
                    className="bg-gray-100 rounded-lg overflow-hidden"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop("fazendo")}
                  >
                    <div className="bg-[#4169E1] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">
                          Fazendo
                        </span>
                        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                          {tarefasFazendo.length}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 space-y-3 min-h-[400px] max-h-[calc(100vh-400px)] overflow-y-auto">
                      {tarefasFazendo.map((tarefa) => (
                        <div
                          key={tarefa.id}
                          draggable
                          onDragStart={() => handleDragStart(tarefa)}
                          className={cn(
                            "bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow transition-shadow",
                            draggedTask?.id === tarefa.id && "opacity-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-5 h-5 rounded-full bg-blue-500 flex-shrink-0" />
                              <span className="text-sm text-gray-800">
                                {tarefa.nome}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                          {tarefa.responsavel && (
                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                              <User className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {tarefa.responsavel}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {tarefasFazendo.length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-8">
                          Nenhuma tarefa
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coluna Feito */}
                  <div
                    className="bg-gray-100 rounded-lg overflow-hidden"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop("feito")}
                  >
                    <div className="bg-[#22C55E] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">Feito</span>
                        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                          {tarefasFeito.length}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 space-y-3 min-h-[400px] max-h-[calc(100vh-400px)] overflow-y-auto">
                      {tarefasFeito.map((tarefa) => (
                        <div
                          key={tarefa.id}
                          draggable
                          onDragStart={() => handleDragStart(tarefa)}
                          className={cn(
                            "bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow transition-shadow",
                            draggedTask?.id === tarefa.id && "opacity-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                              <span className="text-sm text-gray-800">
                                {tarefa.nome}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                          {tarefa.responsavel && (
                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                              <User className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {tarefa.responsavel}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {tarefasFeito.length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-8">
                          Nenhuma tarefa
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição de Tarefa */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-nome">Nome da Tarefa</Label>
              <Input
                id="edit-nome"
                value={editForm.nome}
                onChange={(e) =>
                  setEditForm({ ...editForm, nome: e.target.value })
                }
                placeholder="Nome da tarefa"
              />
            </div>
            <div className="grid gap-2">
              <Label>Responsável</Label>
              <Popover
                open={responsavelPopoverOpen}
                onOpenChange={setResponsavelPopoverOpen}
                modal={true}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={responsavelPopoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    {editForm.responsavel || "Selecione o responsável"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0 z-[100]"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Pesquisar responsável..." />
                    <CommandList>
                      <CommandEmpty>
                        Nenhum responsável encontrado.
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="sem-responsavel"
                          onSelect={() => {
                            setEditForm({ ...editForm, responsavel: "" });
                            setResponsavelPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !editForm.responsavel
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          Sem responsável
                        </CommandItem>
                        {usuariosDisponiveis.map((usuario) => (
                          <CommandItem
                            key={usuario.id}
                            value={usuario.name}
                            onSelect={() => {
                              setEditForm({
                                ...editForm,
                                responsavel: usuario.name,
                              });
                              setResponsavelPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                editForm.responsavel === usuario.name
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {usuario.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-sprint">Sprint</Label>
              <Select
                value={editForm.sprint_id || "a-definir"}
                onValueChange={(value) =>
                  setEditForm({
                    ...editForm,
                    sprint_id: value === "a-definir" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar Sprint" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-definir">A definir</SelectItem>
                  {sprintsLista.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id.toString()}>
                      {sprint.nome} (
                      {formatarPeriodoSprint(
                        sprint.data_inicio,
                        sprint.data_fim,
                      )}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_fazer">A Fazer</SelectItem>
                  <SelectItem value="fazendo">Fazendo</SelectItem>
                  <SelectItem value="feito">Feito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={savingEdit}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editForm.nome.trim()}
            >
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
