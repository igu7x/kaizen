import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { isDomainRoot } from "@/utils/domain";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Eye,
  Edit,
  FolderOpen,
  FileText,
  Calendar,
  User,
  ChevronRight,
  Building2,
  FileCheck,
  FolderKanban,
  Target,
  CheckCircle2,
  AlertTriangle,
  Package,
  Search,
  Check,
  Clock,
  Star,
  CircleDot,
  Layers,
  ChevronsUpDown,
  Upload,
  FileDown,
  X,
  Loader2,
  Hourglass,
  RefreshCw,
} from "lucide-react";
import { GraficoRosca } from "./GraficoRosca";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { gestaoEstrategicaApi } from "@/services/gestaoEstrategicaApi";
import {
  cadastrosProjetosApi,
  type Projeto as ProjetoCadastro,
  type Entrega,
  type TarefaEntrega,
  type CreateTarefaEntregaDto,
  type Area,
  type Tep,
} from "@/services/cadastrosProjetosApi";
import { TepDialog } from "@/components/cadastros/TepDialog";
import { generateTAPPdf, validateTAPFields } from "@/utils/generateTAP";
import { generateTEPPdf } from "@/utils/generateTEP";
import { isProduction } from "@/utils/environment";
import type {
  PlanoPrograma,
  PlanoComProjetos,
  ProjetoComTarefas,
  GestaoTarefa,
  GestaoTarefaStatus,
  GestaoTarefaProgresso,
  Directorate,
  User as UserType,
} from "@/types";
import {
  planosProgramasApi,
  InstrumentoPlanejamento,
} from "@/services/planosProgramasApi";
import {
  getTodosSprints,
  Sprint,
  formatarPeriodoSprint,
} from "@/services/sprintsApi";
import { getUsers } from "@/services/api";
import { ProjetoFormDialog } from "@/components/projetos/ProjetoFormDialog";
import {
  permissoesTapApi,
  type MinhaPermissaoTap,
} from "@/services/permissoesTapApi";

const tipoLabels: Record<string, string> = {
  plano: "Plano",
  programa: "Programa",
  estrategia: "Estratégia",
  carteira: "Carteira",
  outro: "Outro",
};

const statusProjetoLabels: Record<string, string> = {
  planejado: "Planejado",
  em_execucao: "Em Execução",
  concluido: "Concluído",
  cancelado: "Descontinuado",
};

const statusProjetoColors: Record<string, string> = {
  planejado: "bg-blue-500 text-white",
  em_execucao: "bg-yellow-500 text-white",
  concluido: "bg-green-500 text-white",
  cancelado: "bg-gray-500 text-white",
};

const prioridadeLabels: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const complexidadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const abrangenciaLabels: Record<string, string> = {
  uma_unidade: "Uma Unidade",
  multiplas_unidades: "Múltiplas Unidades",
  transversal: "Transversal",
};

const saudeLabels: Record<string, string> = {
  verde: "Saudável",
  amarelo: "Atenção",
  vermelho: "Crítico",
};

// Formatar data ISO (vinda do Postgres DATE) para exibição pt-BR sem deslocamento de fuso
const formatDatePtBr = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  const ymd = dateString.substring(0, 10);
  const date = new Date(ymd + "T00:00:00");
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
};

// ============================================================
// EXCEÇÃO (ajuste de produção): o plano/programa "Plano de Transformação Digital" e seus
// projetos (cujos nomes iniciam com "PTD") NÃO são exibidos no Escritório de Projetos.
// ============================================================
function semAcento(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function ehPlanoOculto(nome: string | null | undefined): boolean {
  return semAcento(nome).includes("transformacao digital");
}

function ehProjetoPtd(nome: string | null | undefined): boolean {
  return /^ptd\b/.test(semAcento(nome));
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function EscritorioProjetos() {
  const { user } = useAuth();
  const { selectedDirectorate, setSelectedDirectorate } = useDirectorate();
  const { toast } = useToast();
  const location = useLocation();
  const currentUserId = user?.id ? parseInt(String(user.id)) : undefined;
  // Sempre enviar a diretoria — o backend filtra por domínio (multi-tenant)
  const dirFiltro = selectedDirectorate || undefined;

  // TAP Dialog
  const [tapDialogOpen, setTapDialogOpen] = useState(false);
  const [tapDialogProjeto, setTapDialogProjeto] =
    useState<ProjetoCadastro | null>(null);

  const getTapStatusLocal = (projeto: ProjetoCadastro) => {
    const hasEntregas =
      (projeto.entregas && projeto.entregas.length > 0) ||
      (projeto.total_entregas && Number(projeto.total_entregas) > 0);
    const hasInstrumentos =
      (projeto.instrumentos && projeto.instrumentos.length > 0) ||
      ((projeto as any).total_instrumentos &&
        Number((projeto as any).total_instrumentos) > 0);
    const valid = !!(
      projeto.nome &&
      projeto.tap_vinculado &&
      projeto.data_prevista_inicio &&
      projeto.data_prevista_conclusao &&
      projeto.objetivo &&
      projeto.contexto_justificativa &&
      projeto.patrocinador_id &&
      projeto.gestor_id &&
      projeto.escopo_sintetico &&
      projeto.fora_do_escopo &&
      hasEntregas &&
      hasInstrumentos &&
      projeto.prioridade &&
      projeto.complexidade &&
      projeto.abrangencia
    );
    if (!valid)
      return { label: "Pendente", color: "bg-gray-400 text-white", step: 0 };
    if (projeto.tap_validado_patrocinador_em)
      return {
        label: "TAP Vigente",
        color: "bg-green-600 text-white",
        step: 3,
      };
    if (projeto.tap_validado_diretor_em)
      return {
        label: "Validado 2/3",
        color: "bg-blue-500 text-white",
        step: 2,
      };
    if (projeto.tap_validado_gestor_em)
      return {
        label: "Validado 1/3",
        color: "bg-blue-400 text-white",
        step: 1,
      };
    return { label: "Proposta", color: "bg-amber-500 text-white", step: 0 };
  };

  const getTepStatusLocal = (projeto: ProjetoCadastro) => {
    const p = projeto as any;
    if (p.tep_validado_patrocinador_em)
      return {
        label: "TEP Vigente",
        color: "bg-green-600 text-white",
        step: 3,
      };
    if (p.tep_validado_diretor_em)
      return {
        label: "Validado 2/3",
        color: "bg-blue-500 text-white",
        step: 2,
      };
    if (p.tep_validado_gestor_em)
      return {
        label: "Validado 1/3",
        color: "bg-blue-400 text-white",
        step: 1,
      };
    if (p.tep_versao || p.tep_tipo_encerramento)
      return {
        label: "Em validação",
        color: "bg-amber-500 text-white",
        step: 0,
      };
    return {
      label: "Não iniciado",
      color: "bg-gray-300 text-gray-700",
      step: -1,
    };
  };

  // Reduz o status detalhado em 3 buckets visuais (Pendente / Em processo / Concluído).
  // Usado na tabela e nos filtros — facilita leitura rápida do estado de TAP / TEP.
  type StatusBucket = "pendente" | "em_processo" | "concluido";
  const bucketFromTapLabel = (label: string): StatusBucket => {
    if (label === "TAP Vigente") return "concluido";
    if (label === "Pendente") return "pendente";
    return "em_processo";
  };
  const bucketFromTepLabel = (label: string): StatusBucket => {
    if (label === "TEP Vigente") return "concluido";
    if (label === "Não iniciado") return "pendente";
    return "em_processo";
  };

  const renderStatusBadge = (
    bucket: StatusBucket,
    opts?: { onClick?: (e: React.MouseEvent) => void; tooltip?: string },
  ) => {
    const config = {
      pendente: {
        Icon: Hourglass,
        bg: "bg-gray-100",
        text: "text-gray-700",
        iconColor: "text-gray-500",
        label: "Pendente",
      },
      em_processo: {
        Icon: RefreshCw,
        bg: "bg-orange-100",
        text: "text-orange-800",
        iconColor: "text-orange-500",
        label: "Em processo",
      },
      concluido: {
        Icon: CheckCircle2,
        bg: "bg-emerald-100",
        text: "text-emerald-800",
        iconColor: "text-emerald-600",
        label: "Concluído",
      },
    }[bucket];
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap",
          config.bg,
          opts?.onClick ? "cursor-pointer hover:brightness-95" : "",
        )}
        onClick={opts?.onClick}
        title={opts?.tooltip}
      >
        <config.Icon className={cn("h-3.5 w-3.5", config.iconColor)} />
        <span className={cn("text-xs font-semibold", config.text)}>
          {config.label}
        </span>
      </div>
    );
  };

  const handleTapClick = async (
    e: React.MouseEvent,
    projeto: ProjetoCadastro,
  ) => {
    e.stopPropagation();
    const tap = getTapStatusLocal(projeto);
    if (tap.label === "TAP Vigente") {
      // Buscar projeto completo para gerar PDF
      const projetoCompleto = await cadastrosProjetosApi.getProjetoById(
        projeto.id,
      );
      if (projetoCompleto) generateTAPPdf(projetoCompleto);
    } else {
      // Buscar projeto completo para ter user_ids
      const projetoCompleto = await cadastrosProjetosApi.getProjetoById(
        projeto.id,
      );
      setTapDialogProjeto(projetoCompleto);
      setTapDialogOpen(true);
    }
  };

  const handleTepClick = async (
    e: React.MouseEvent,
    projeto: ProjetoCadastro,
  ) => {
    e.stopPropagation();
    const tep = getTepStatusLocal(projeto);
    if (tep.label === "TEP Vigente") {
      // Buscar projeto completo + TEP para gerar PDF
      const [projetoCompleto, tepData] = await Promise.all([
        cadastrosProjetosApi.getProjetoById(projeto.id),
        cadastrosProjetosApi.getTep(projeto.id).catch(() => null),
      ]);
      if (projetoCompleto && tepData) {
        generateTEPPdf(
          projetoCompleto,
          tepData,
          projetoCompleto.entregas || [],
        );
      }
    } else {
      // Abrir TepDialog (formulário de criação/edição + camadas de validação)
      const projetoCompleto = await cadastrosProjetosApi.getProjetoById(
        projeto.id,
      );
      setTepDialogProjeto(projetoCompleto);
      setTepDialogOpen(true);
    }
  };

  // Estados principais
  const [planos, setPlanos] = useState<InstrumentoPlanejamento[]>([]);
  const [planoSelecionado, setPlanoSelecionado] =
    useState<PlanoComProjetos | null>(null);
  const [planoFiltroId, setPlanoFiltroId] = useState<number | null>(null); // Plano selecionado como filtro
  const [filtroUnidade, setFiltroUnidade] = useState<string>("todos");
  const [todosProjetos, setTodosProjetos] = useState<ProjetoCadastro[]>([]); // Todos os projetos da diretoria
  const [projetosVinculados, setProjetosVinculados] = useState<
    ProjetoCadastro[]
  >([]);
  const [projetoDetalhes, setProjetoDetalhes] =
    useState<ProjetoCadastro | null>(null);
  const [showTepDialog, setShowTepDialog] = useState(false);
  const [projetoTep, setProjetoTep] = useState<Tep | null>(null);
  // Estado dedicado pro fluxo de clique no badge TEP da tabela (independente do botão
  // dentro da tela de detalhes do projeto, que usa showTepDialog + projetoDetalhes).
  const [tepDialogOpen, setTepDialogOpen] = useState(false);
  const [tepDialogProjeto, setTepDialogProjeto] =
    useState<ProjetoCadastro | null>(null);
  // Modal de edição completa do projeto (mesmos campos de Cadastros / Projetos)
  const [projetoEditDialogOpen, setProjetoEditDialogOpen] = useState(false);
  const [projetoEditDialogMode, setProjetoEditDialogMode] = useState<
    "create" | "edit" | "view"
  >("edit");
  // Quando true, o ProjetoFormDialog abre em modo enxuto (só painel de validação do TAP).
  const [projetoEditDialogSlim, setProjetoEditDialogSlim] = useState(false);
  // Quando true, o ProjetoFormDialog abre em "modo Permissão TAP": só os 13 campos do TAP
  // serão enviados no submit. Sinalizado pelo botão "Editar TAP" disponível para usuários
  // com a permissão concedida em Cadastros > Permissões do TAP.
  const [projetoEditDialogTapMode, setProjetoEditDialogTapMode] =
    useState(false);
  // Permissão TAP do usuário logado (carregada uma vez)
  const [permissaoTap, setPermissaoTap] = useState<MinhaPermissaoTap | null>(
    null,
  );
  // Resultado do check de permissão TAP para o projeto atualmente aberto
  const [podeEditarTapProjeto, setPodeEditarTapProjeto] = useState(false);
  const [instrumentoDetalhes, setInstrumentoDetalhes] =
    useState<InstrumentoPlanejamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlano, setLoadingPlano] = useState(false);
  const [loadingProjeto, setLoadingProjeto] = useState(false);
  const [entregaSelecionada, setEntregaSelecionada] = useState<Entrega | null>(
    null,
  );
  const [tarefasEntrega, setTarefasEntrega] = useState<any[]>([]);

  // Estado para tarefas por entrega - carregadas do banco de dados
  const [tarefasPorEntrega, setTarefasPorEntrega] = useState<
    Record<number, TarefaEntrega[]>
  >({});

  // Estados para modal de tarefa de entrega
  const [modalTarefaEntregaOpen, setModalTarefaEntregaOpen] = useState(false);
  const [tarefaEntregaEditando, setTarefaEntregaEditando] = useState<
    any | null
  >(null);
  const [novaTarefaEntrega, setNovaTarefaEntrega] = useState({
    nome: "",
    sprint_id: "",
    responsavel: "",
    status: "a_fazer",
  });

  // Estado para lista de sprints fixos
  const [sprintsDisponiveis, setSprintsDisponiveis] = useState<Sprint[]>([]);

  // Estado para lista de usuários (responsáveis)
  const [usuarios, setUsuarios] = useState<UserType[]>([]);
  const [responsavelPopoverOpen, setResponsavelPopoverOpen] = useState(false);

  // Estados de modais
  const [modalPlanoOpen, setModalPlanoOpen] = useState(false);
  const [modalProjetoOpen, setModalProjetoOpen] = useState(false);
  const [modalTarefaOpen, setModalTarefaOpen] = useState(false);
  const [modalConfirmDeleteOpen, setModalConfirmDeleteOpen] = useState(false);
  const [modalInfoCompletaOpen, setModalInfoCompletaOpen] = useState(false);
  const [modalProjetoInfoCompletaOpen, setModalProjetoInfoCompletaOpen] =
    useState(false);

  // Estado de pesquisa de projetos
  const [buscaProjeto, setBuscaProjeto] = useState("");

  // Estado de filtro por status do projeto
  const [filtroStatus, setFiltroStatus] = useState<
    | "todos"
    | "concluido"
    | "em_execucao"
    | "planejado"
    | "suspenso"
    | "cancelado"
  >("todos");
  const [filtroSituacao, setFiltroSituacao] = useState<
    "todos" | "no_prazo" | "em_atraso" | "finalizado"
  >("todos");
  const [filtroSaude, setFiltroSaude] = useState<
    "todos" | "verde" | "amarelo" | "vermelho"
  >("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<
    "todos" | "alta" | "media" | "baixa"
  >("todos");
  const [filtroTap, setFiltroTap] = useState<
    "todos" | "pendente" | "em_processo" | "concluido"
  >("todos");
  const [filtroTep, setFiltroTep] = useState<
    "todos" | "pendente" | "em_processo" | "concluido"
  >("todos");
  const [filtroGestor, setFiltroGestor] = useState<string>("todos");
  const [activeTab, setActiveTab] = useState<"todos" | "meus">("todos");

  // Estados de edição
  const [novoPlanoNome, setNovoPlanoNome] = useState("");
  const [novoProjetoNome, setNovoProjetoNome] = useState("");
  const [novaTarefaNome, setNovaTarefaNome] = useState("");
  const [projetoIdParaTarefa, setProjetoIdParaTarefa] = useState<number | null>(
    null,
  );
  const [tarefaEditando, setTarefaEditando] = useState<GestaoTarefa | null>(
    null,
  );
  const [projetoEditando, setProjetoEditando] = useState<{
    id: number;
    nome: string;
  } | null>(null);
  const [itemParaDeletar, setItemParaDeletar] = useState<{
    tipo: "plano" | "projeto" | "tarefa" | "tarefaEntrega" | "entrega";
    id: number;
    nome: string;
  } | null>(null);

  // Estados para criação de entregas
  const [modalNovaEntregaOpen, setModalNovaEntregaOpen] = useState(false);
  const [novaEntregaNome, setNovaEntregaNome] = useState("");
  const [novaEntregaAreaId, setNovaEntregaAreaId] = useState<number | null>(
    null,
  );
  const [novaEntregaPrazo, setNovaEntregaPrazo] = useState("");
  const [novaEntregaAreaPopoverOpen, setNovaEntregaAreaPopoverOpen] =
    useState(false);
  const [salvandoEntrega, setSalvandoEntrega] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);

  // Estados para edição de entregas
  const [modalEditEntregaOpen, setModalEditEntregaOpen] = useState(false);
  const [entregaEditando, setEntregaEditando] = useState<Entrega | null>(null);
  const [editEntregaNome, setEditEntregaNome] = useState("");
  const [editEntregaAreaId, setEditEntregaAreaId] = useState<number | null>(
    null,
  );
  const [editEntregaPrazo, setEditEntregaPrazo] = useState("");
  const [editEntregaAreaPopoverOpen, setEditEntregaAreaPopoverOpen] =
    useState(false);
  const [salvandoEditEntrega, setSalvandoEditEntrega] = useState(false);

  // Estados de upload de evidência
  const [uploadingEvidencia, setUploadingEvidencia] = useState<number | null>(
    null,
  );
  const evidenciaInputRef = useRef<HTMLInputElement>(null);
  const [evidenciaEntregaId, setEvidenciaEntregaId] = useState<number | null>(
    null,
  );

  // Estados de drag and drop para tarefas
  const [draggedTarefa, setDraggedTarefa] = useState<{
    projetoId: number;
    index: number;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    projetoId: number;
    index: number;
  } | null>(null);

  // Helper para buscar nome do sprint pelo ID
  const getSprintNome = (sprintId: number | null | undefined): string => {
    if (!sprintId) return "-";
    const sprint = sprintsDisponiveis.find((s) => s.id === sprintId);
    return sprint ? sprint.nome : "-";
  };

  // Calcular estatísticas das tarefas
  const calcularEstatisticasTarefas = () => {
    if (!planoSelecionado) {
      return {
        totalTarefas: 0,
        sprintAtual: 0,
        foraSprint: 0,
        concluida: 0,
        aFazer: 0,
        fazendo: 0,
        progressoConcluido: 0,
        progresso: 0,
      };
    }

    let totalTarefas = 0;
    let sprintAtual = 0;
    let foraSprint = 0;
    let concluida = 0;
    let aFazer = 0;
    let fazendo = 0;
    let progressoConcluido = 0;

    planoSelecionado.projetos.forEach((projeto) => {
      projeto.tarefas.forEach((tarefa) => {
        totalTarefas++;
        if (tarefa.status === "sprint_atual") sprintAtual++;
        if (tarefa.status === "fora_sprint") foraSprint++;
        if (tarefa.status === "concluida") concluida++;
        if (tarefa.progresso === "a_fazer") aFazer++;
        if (tarefa.progresso === "fazendo") fazendo++;
        if (tarefa.progresso === "feito") progressoConcluido++;
      });
    });

    const progresso =
      totalTarefas > 0
        ? Math.round((progressoConcluido / totalTarefas) * 100)
        : 0;

    return {
      totalTarefas,
      sprintAtual,
      foraSprint,
      concluida,
      aFazer,
      fazendo,
      progressoConcluido,
      progresso,
    };
  };

  const estatisticasTarefas = calcularEstatisticasTarefas();

  // Permissões
  const canEdit = user?.role === "ADMIN";
  const canCreate = user?.role === "ADMIN";

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const inicio = Date.now();
      // Carregar planos e projetos em paralelo
      const [planosData, projetosData] = await Promise.all([
        planosProgramasApi.getInstrumentos(dirFiltro),
        cadastrosProjetosApi.getProjetos(dirFiltro),
      ]);
      setPlanos(planosData);
      setTodosProjetos(projetosData);

      // Carregar sprints separadamente para não bloquear a página se falhar
      try {
        const sprintsData = await getTodosSprints();
        setSprintsDisponiveis(sprintsData);
      } catch (sprintError) {
        console.warn(
          "Aviso: Não foi possível carregar os sprints:",
          sprintError,
        );
        // Não bloquear a página, apenas os sprints não estarão disponíveis
      }

      // Carregar usuários da Administração separadamente para não bloquear a página se falhar
      try {
        const usersData = await getUsers(selectedDirectorate || undefined);
        // Filtrar apenas usuários ativos
        setUsuarios(usersData.filter((u) => u.status === "ACTIVE"));
      } catch (usersError) {
        console.warn(
          "Aviso: Não foi possível carregar os usuários:",
          usersError,
        );
        // Não bloquear a página, apenas os usuários não estarão disponíveis
      }

      // Garantir tempo mínimo de loading para a animação ser visível
      const elapsed = Date.now() - inicio;
      if (elapsed < 500) {
        await new Promise((r) => setTimeout(r, 500 - elapsed));
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  }, [selectedDirectorate, toast]);

  const carregarProjetosDoPlano = useCallback(
    async (planoId: number) => {
      try {
        setLoadingPlano(true);
        const [planoData, projetosData, instrumentoData] = await Promise.all([
          gestaoEstrategicaApi.getPlanoCompleto(planoId),
          cadastrosProjetosApi.getProjetosByInstrumentoId(planoId, dirFiltro),
          planosProgramasApi.getInstrumentoById(planoId),
        ]);
        setPlanoSelecionado(planoData);
        setProjetosVinculados(projetosData);
        setInstrumentoDetalhes(instrumentoData);
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoadingPlano(false);
      }
    },
    [toast],
  );

  // Handler para selecionar/deselecionar plano como filtro
  const handleFiltrarPorPlano = async (plano: InstrumentoPlanejamento) => {
    if (planoFiltroId === plano.id) {
      // Deseleciona o filtro
      setPlanoFiltroId(null);
      setPlanoSelecionado(null);
      setInstrumentoDetalhes(null);
      setProjetosVinculados([]);
    } else {
      // Seleciona o plano como filtro
      setPlanoFiltroId(plano.id);
      await carregarProjetosDoPlano(plano.id);
    }
  };

  useEffect(() => {
    carregarDados();
    setPlanoSelecionado(null);
    setPlanoFiltroId(null);
    setProjetoDetalhes(null);
    setEntregaSelecionada(null);
  }, [carregarDados]);

  // Deep-link (Home/Pendências): ao montar, se vier ?projetoId=X&openTap=true
  // ou &openTep=true na URL, busca o projeto e abre direto o diálogo de validação
  // correspondente. Sem esses params o componente segue o fluxo padrão.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projetoIdRaw = params.get("projetoId");
    const openTap = params.get("openTap") === "true";
    const openTep = params.get("openTep") === "true";
    if (!projetoIdRaw || (!openTap && !openTep)) return;
    const projetoId = Number(projetoIdRaw);
    if (!Number.isFinite(projetoId)) return;

    let cancelled = false;
    (async () => {
      try {
        const projeto = await cadastrosProjetosApi.getProjetoById(projetoId);
        if (cancelled || !projeto) return;
        if (openTap) {
          setTapDialogProjeto(projeto);
          setTapDialogOpen(true);
        } else if (openTep) {
          setTepDialogProjeto(projeto);
          setTepDialogOpen(true);
        }
        // Limpa os params da URL pra não re-disparar em re-renders/navegação interna
        const url = new URL(window.location.href);
        ["projetoId", "openTap", "openTep"].forEach((p) =>
          url.searchParams.delete(p),
        );
        window.history.replaceState({}, "", url.toString());
      } catch (err) {
        console.warn(
          "[EscritorioProjetos] Falha no deep-link de TAP/TEP:",
          err,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Carregar áreas para seleção no cadastro de entrega (filtrado por domínio)
  useEffect(() => {
    const carregarAreas = async () => {
      try {
        const areasData =
          await cadastrosProjetosApi.getAreas(selectedDirectorate);
        setAreas(areasData);
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    };
    carregarAreas();
  }, [selectedDirectorate]);

  // Resetar visualização quando clicar no menu "Escritório de Projetos" (mesmo já estando na página)
  useEffect(() => {
    setPlanoFiltroId(null);
    setPlanoSelecionado(null);
    setInstrumentoDetalhes(null);
    setProjetosVinculados([]);
    setProjetoDetalhes(null);
    setEntregaSelecionada(null);
    setBuscaProjeto("");
    setFiltroStatus("todos");
    setFiltroSituacao("todos");
    setFiltroSaude("todos");
    setFiltroPrioridade("todos");
    setFiltroGestor("todos");
    setFiltroUnidade("todos");
  }, [location.key]);

  // Projetos em que o usuário logado é gestor (via cadastros_pessoas.user_id)
  const meusProjetos = useMemo(() => {
    const rawId = user?.id;
    if (rawId === undefined || rawId === null || rawId === "") return [];
    const userIdNum = Number(rawId);
    const userIdStr = String(rawId);
    const fonte = planoFiltroId ? projetosVinculados : todosProjetos;
    return fonte.filter((p) => {
      const guid = (p as any).gestor_user_id;
      if (guid === null || guid === undefined) return false;
      return guid === userIdNum || String(guid) === userIdStr;
    });
  }, [todosProjetos, projetosVinculados, planoFiltroId, user?.id]);

  const ehGestorDeProjeto = meusProjetos.length > 0;

  // Permissão para editar entregas do projeto aberto: ADMIN OU gestor do próprio projeto
  const podeEditarEntregas = useMemo(() => {
    if (!projetoDetalhes) return false;
    if (user?.role === "ADMIN") return true;
    const rawId = user?.id;
    if (rawId === undefined || rawId === null || rawId === "") return false;
    const guid = (projetoDetalhes as any).gestor_user_id;
    if (guid === null || guid === undefined) return false;
    return guid === Number(rawId) || String(guid) === String(rawId);
  }, [projetoDetalhes, user?.id, user?.role]);

  // Permissão TAP: usuário tem a permissão E está vinculado ao projeto via
  // areas_vinculadas_ids (Governança > Diretorias). A verificação é feita no
  // backend (GET /api/permissoes-tap/projeto/:id) sempre que o projeto aberto muda.
  // Não mostrar pra quem já tem podeEditarEntregas (edição completa via "Editar Projeto").
  const podeEditarTap = podeEditarTapProjeto && !podeEditarEntregas;

  // Carrega permissão TAP do usuário logado (uma vez, só pra exibir o nome da diretoria
  // no banner do dialog em modo TAP)
  useEffect(() => {
    permissoesTapApi
      .minha()
      .then(setPermissaoTap)
      .catch(() => setPermissaoTap({ temPermissao: false, diretoria: null }));
  }, []);

  // Consulta permissão TAP para o projeto aberto sempre que ele muda.
  // Backend faz o match contra areas_vinculadas_ids — não dá pra calcular client-side
  // sem expor toda a tabela de diretorias.
  useEffect(() => {
    if (!projetoDetalhes?.id || !permissaoTap?.temPermissao) {
      setPodeEditarTapProjeto(false);
      return;
    }
    let canceled = false;
    permissoesTapApi
      .podeEditarProjeto(projetoDetalhes.id)
      .then((r) => {
        if (!canceled) setPodeEditarTapProjeto(!!r.podeEditar);
      })
      .catch(() => {
        if (!canceled) setPodeEditarTapProjeto(false);
      });
    return () => {
      canceled = true;
    };
  }, [projetoDetalhes?.id, permissaoTap?.temPermissao]);

  // Carrega o TEP do projeto aberto (para indicar pendência de validação no botão)
  useEffect(() => {
    if (
      !projetoDetalhes ||
      (projetoDetalhes.status !== "concluido" &&
        projetoDetalhes.status !== "cancelado")
    ) {
      setProjetoTep(null);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const tep = await cadastrosProjetosApi.getTep(projetoDetalhes.id);
        if (!cancelado) setProjetoTep(tep);
      } catch {
        if (!cancelado) setProjetoTep(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [projetoDetalhes?.id, projetoDetalhes?.status, showTepDialog]);

  // Indica se o TEP está pendente de validação por parte do usuário logado (na sua camada)
  const tepPendenteUsuario = useMemo(() => {
    if (!projetoTep || !projetoDetalhes || !user?.id) return false;
    const uid = Number(user.id);
    if (!uid) return false;
    const gestorUid = Number((projetoDetalhes as any).gestor_user_id);
    const diretorUid = Number((projetoDetalhes as any).diretor_user_id);
    const patrocinadorUid = Number(
      (projetoDetalhes as any).patrocinador_user_id,
    );
    // Camada 1 - Gestor
    if (gestorUid === uid && !projetoTep.tep_validado_gestor_em) return true;
    // Camada 2 - Diretor (gestor já validou)
    if (
      diretorUid === uid &&
      projetoTep.tep_validado_gestor_em &&
      !projetoTep.tep_validado_diretor_em
    )
      return true;
    // Camada 3 - Patrocinador (diretor já validou)
    if (
      patrocinadorUid === uid &&
      projetoTep.tep_validado_diretor_em &&
      !projetoTep.tep_validado_patrocinador_em
    )
      return true;
    return false;
  }, [projetoTep, projetoDetalhes, user?.id]);

  // Indica se o TAP está pendente de validação por parte do usuário logado (na sua camada).
  // Mesma lógica do TEP — só dispara quando o TAP já foi gerado (tem campos preenchidos)
  // e o usuário é o validador da próxima camada pendente.
  const tapPendenteUsuario = useMemo(() => {
    if (!projetoDetalhes || !user?.id) return false;
    // Só faz sentido alertar quando o TAP está pronto pra ser validado
    if (!validateTAPFields(projetoDetalhes).valid) return false;
    // Se já está vigente (camada 3 OK), não há pendência
    if (projetoDetalhes.tap_validado_patrocinador_em) return false;
    const uid = Number(user.id);
    if (!uid) return false;
    const gestorUid = Number((projetoDetalhes as any).gestor_user_id);
    const diretorUid = Number((projetoDetalhes as any).diretor_user_id);
    const patrocinadorUid = Number(
      (projetoDetalhes as any).patrocinador_user_id,
    );
    // Camada 1 - Gestor
    if (gestorUid === uid && !projetoDetalhes.tap_validado_gestor_em)
      return true;
    // Camada 2 - Diretor (gestor já validou)
    if (
      diretorUid === uid &&
      projetoDetalhes.tap_validado_gestor_em &&
      !projetoDetalhes.tap_validado_diretor_em
    )
      return true;
    // Camada 3 - Patrocinador (diretor já validou)
    if (
      patrocinadorUid === uid &&
      projetoDetalhes.tap_validado_diretor_em &&
      !projetoDetalhes.tap_validado_patrocinador_em
    )
      return true;
    return false;
  }, [projetoDetalhes, user?.id]);

  // Se o usuário perde acesso à aba "Meus", volta para "Todos"
  useEffect(() => {
    if (activeTab === "meus" && !ehGestorDeProjeto) {
      setActiveTab("todos");
    }
  }, [activeTab, ehGestorDeProjeto]);

  // Base de projetos: se aba "meus" ativa → só os do usuário; senão, respeita plano selecionado.
  // Exceção: projetos do "Plano de Transformação Digital" (nome iniciando com "PTD") são removidos.
  const projetosBase = (
    activeTab === "meus"
      ? meusProjetos
      : planoFiltroId
        ? projetosVinculados
        : todosProjetos
  ).filter((p) => !ehProjetoPtd(p.nome));

  // O backend já filtra por diretoria em ambos os endpoints (getProjetos e getProjetosByInstrumentoId)
  // Filtrar por unidade se selecionada
  const projetosPorDiretoria =
    filtroUnidade !== "todos"
      ? projetosBase.filter((p) => {
        const areasStr = (p as any).areas_execucao_diretorias || "";
        return areasStr
          .split(", ")
          .some((a: string) => a.trim() === filtroUnidade);
      })
      : projetosBase;

  // Gestores únicos dos projetos (para o filtro)
  const gestoresDeProjetos = [
    ...new Map(
      projetosPorDiretoria
        .filter((p) => p.gestor_id && p.gestor_nome)
        .map((p) => [p.gestor_id, p.gestor_nome as string]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  // Calcular situação de um projeto.
  // Projeto descontinuado (status 'cancelado') fica como 'Encerrado' — não faz sentido
  // apontar atraso pra um projeto que não está mais ativo.
  const getSituacaoProjeto = (
    projeto: Projeto,
  ): "no_prazo" | "em_atraso" | "finalizado" | "encerrado" => {
    if (projeto.status === "cancelado") return "encerrado";
    if (projeto.status === "concluido") return "finalizado";
    if (
      projeto.data_prevista_conclusao &&
      new Date(projeto.data_prevista_conclusao) < new Date()
    )
      return "em_atraso";
    return "no_prazo";
  };

  const situacaoLabels: Record<string, string> = {
    no_prazo: "No prazo",
    em_atraso: "Em atraso",
    finalizado: "Finalizado",
    encerrado: "Encerrado",
  };
  const situacaoColors: Record<string, string> = {
    no_prazo: "bg-blue-100 text-blue-700",
    em_atraso: "bg-red-100 text-red-700",
    finalizado: "bg-green-100 text-green-700",
    encerrado: "bg-gray-100 text-gray-700",
  };

  // Aplicar filtros de status, situação, saúde, prioridade e gestor
  const projetosFiltradosPorCampos = projetosPorDiretoria.filter((projeto) => {
    if (filtroStatus !== "todos" && projeto.status !== filtroStatus)
      return false;
    if (
      filtroSituacao !== "todos" &&
      getSituacaoProjeto(projeto) !== filtroSituacao
    )
      return false;
    if (filtroSaude !== "todos" && (projeto.saude || "verde") !== filtroSaude)
      return false;
    if (
      filtroPrioridade !== "todos" &&
      (projeto.prioridade || "media") !== filtroPrioridade
    )
      return false;
    if (filtroTap !== "todos") {
      const bucket = bucketFromTapLabel(getTapStatusLocal(projeto).label);
      if (bucket !== filtroTap) return false;
    }
    if (filtroTep !== "todos") {
      const bucket = bucketFromTepLabel(getTepStatusLocal(projeto).label);
      if (bucket !== filtroTep) return false;
    }
    if (
      filtroGestor !== "todos" &&
      projeto.gestor_id?.toString() !== filtroGestor
    )
      return false;
    return true;
  });

  // Aplicar filtro de pesquisa e ordenar por prazo mais próximo
  const projetosFiltrados = (
    buscaProjeto.trim()
      ? projetosFiltradosPorCampos.filter(
        (projeto) =>
          (projeto.nome || "")
            .toLowerCase()
            .includes(buscaProjeto.toLowerCase()) ||
          (projeto.codigo || "")
            .toLowerCase()
            .includes(buscaProjeto.toLowerCase()),
      )
      : projetosFiltradosPorCampos
  ).sort((a, b) => {
    const dataA = a.data_prevista_conclusao
      ? new Date(a.data_prevista_conclusao).getTime()
      : Infinity;
    const dataB = b.data_prevista_conclusao
      ? new Date(b.data_prevista_conclusao).getTime()
      : Infinity;
    return dataA - dataB;
  });

  // Calcular estatísticas dos projetos
  const estatisticasProjetos = {
    total: projetosPorDiretoria.length,
    concluidos: projetosPorDiretoria.filter((p) => p.status === "concluido")
      .length,
    emAndamento: projetosPorDiretoria.filter((p) => p.status === "em_execucao")
      .length,
    naoIniciados: projetosPorDiretoria.filter((p) => p.status === "planejado")
      .length,
  };

  // Dados dos gráficos do dashboard
  const dashboardStatusData = useMemo(
    () => [
      {
        name: "Planejado",
        value: projetosPorDiretoria.filter((p) => p.status === "planejado")
          .length,
      },
      {
        name: "Em Execução",
        value: projetosPorDiretoria.filter((p) => p.status === "em_execucao")
          .length,
      },
      {
        name: "Concluído",
        value: projetosPorDiretoria.filter((p) => p.status === "concluido")
          .length,
      },
      {
        name: "Descontinuado",
        value: projetosPorDiretoria.filter((p) => p.status === "cancelado")
          .length,
      },
    ],
    [projetosPorDiretoria],
  );

  const dashboardSituacaoData = useMemo(() => {
    let noPrazo = 0,
      emAtraso = 0,
      finalizado = 0,
      encerrado = 0;
    const now = new Date();
    projetosPorDiretoria.forEach((p) => {
      if (p.status === "cancelado") encerrado++;
      else if (p.status === "concluido") finalizado++;
      else if (
        p.data_prevista_conclusao &&
        new Date(p.data_prevista_conclusao) < now
      )
        emAtraso++;
      else noPrazo++;
    });
    return [
      { name: "No prazo", value: noPrazo },
      { name: "Em atraso", value: emAtraso },
      { name: "Finalizado", value: finalizado },
      { name: "Encerrado", value: encerrado },
    ];
  }, [projetosPorDiretoria]);

  const dashboardSaudeData = useMemo(
    () => [
      {
        name: "Saudável",
        value: projetosPorDiretoria.filter((p) => p.saude === "verde").length,
        color: "#4ade80",
      },
      {
        name: "Atenção",
        value: projetosPorDiretoria.filter((p) => p.saude === "amarelo").length,
        color: "#fbbf24",
      },
      {
        name: "Crítico",
        value: projetosPorDiretoria.filter((p) => p.saude === "vermelho")
          .length,
        color: "#f87171",
      },
    ],
    [projetosPorDiretoria],
  );

  const dashboardPrioridadeData = useMemo(() => {
    const baixa = projetosPorDiretoria.filter(
      (p) => p.prioridade === "baixa",
    ).length;
    const media = projetosPorDiretoria.filter(
      (p) => p.prioridade === "media",
    ).length;
    const alta = projetosPorDiretoria.filter(
      (p) => p.prioridade === "alta",
    ).length;
    const maxVal = Math.max(baixa, media, alta, 1);
    return [
      {
        label: "Baixa",
        value: baixa,
        stars: 1,
        barColor: "bg-blue-500",
        percent: (baixa / maxVal) * 100,
      },
      {
        label: "Média",
        value: media,
        stars: 2,
        barColor: "bg-blue-500",
        percent: (media / maxVal) * 100,
      },
      {
        label: "Alta",
        value: alta,
        stars: 3,
        barColor: "bg-blue-500",
        percent: (alta / maxVal) * 100,
      },
    ];
  }, [projetosPorDiretoria]);

  // ============================================================
  // HANDLERS - PLANOS
  // ============================================================

  const handleCriarPlano = async () => {
    if (!novoPlanoNome.trim() || novoPlanoNome.trim().length < 3) {
      toast({
        title: "Erro",
        description: "O nome do plano deve ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }

    try {
      await gestaoEstrategicaApi.createPlano({
        nome: novoPlanoNome.trim(),
        diretoria: selectedDirectorate,
      });

      setNovoPlanoNome("");
      setModalPlanoOpen(false);
      await carregarDados();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleSelecionarPlano = (plano: InstrumentoPlanejamento) => {
    carregarProjetosDoPlano(plano.id);
  };

  const handleSelecionarInstrumento = (
    instrumento: InstrumentoPlanejamento,
  ) => {
    carregarProjetosDoPlano(instrumento.id);
  };

  const handleVoltarParaPlanos = () => {
    setPlanoFiltroId(null);
    setPlanoSelecionado(null);
    setProjetosVinculados([]);
    setInstrumentoDetalhes(null);
    setProjetoDetalhes(null);
  };

  const handleVoltarParaProjetos = () => {
    setProjetoDetalhes(null);
    setEntregaSelecionada(null);
  };

  const handleVoltarParaEntregas = () => {
    setEntregaSelecionada(null);
  };

  // Upload de evidência
  const handleUploadEvidencia = async (entregaId: number, file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({
        title: "Formato inválido",
        description: "Apenas arquivos PDF são permitidos.",
        variant: "destructive",
      });
      return;
    }
    setUploadingEvidencia(entregaId);
    try {
      await cadastrosProjetosApi.uploadEvidencia(entregaId, file);

      // Recarregar projeto e lista para atualizar status/progresso
      if (projetoDetalhes) {
        const projeto = await cadastrosProjetosApi.getProjetoById(
          projetoDetalhes.id,
        );
        setProjetoDetalhes(projeto);
        // Atualizar na lista de projetos
        const projetosAtualizados =
          await cadastrosProjetosApi.getProjetos(dirFiltro);
        setTodosProjetos(projetosAtualizados);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setUploadingEvidencia(null);
    }
  };

  const handleDeleteEvidencia = async (entregaId: number) => {
    setUploadingEvidencia(entregaId);
    try {
      await cadastrosProjetosApi.deleteEvidencia(entregaId);

      if (projetoDetalhes) {
        const projeto = await cadastrosProjetosApi.getProjetoById(
          projetoDetalhes.id,
        );
        setProjetoDetalhes(projeto);
        // Atualizar na lista de projetos
        const projetosAtualizados =
          await cadastrosProjetosApi.getProjetos(dirFiltro);
        setTodosProjetos(projetosAtualizados);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setUploadingEvidencia(null);
    }
  };

  const handleVerEntregaDetalhes = async (entrega: Entrega) => {
    // Definir a entrega selecionada
    setEntregaSelecionada(entrega);

    // Carregar tarefas da entrega do banco de dados
    try {
      const tarefas = await cadastrosProjetosApi.getTarefasEntrega(entrega.id);

      // Atualizar o estado local com as tarefas do banco
      setTarefasPorEntrega((prev) => ({
        ...prev,
        [entrega.id]: tarefas,
      }));
      setTarefasEntrega(tarefas);

      // Recalcular o status baseado nas tarefas carregadas
      const statusCorreto = calcularStatusEntrega(tarefas);
      if (entrega.status !== statusCorreto) {
        setEntregaSelecionada((prev) =>
          prev ? { ...prev, status: statusCorreto as any } : prev,
        );
      }
    } catch (error) {
      // Em caso de erro, manter o estado vazio
      setTarefasPorEntrega((prev) => ({
        ...prev,
        [entrega.id]: [],
      }));
      setTarefasEntrega([]);
    }
  };

  // ============================================================
  // HELPER - CÁLCULO AUTOMÁTICO DE STATUS DA ENTREGA
  // ============================================================

  const calcularStatusEntrega = (tarefas: any[]): string => {
    if (!tarefas || tarefas.length === 0) return "nao_iniciada";

    const statuses = tarefas.map((t) => t.status || t.progresso || "a_fazer");
    const total = statuses.length;
    const feitos = statuses.filter((s) => s === "feito").length;
    const aFazer = statuses.filter((s) => s === "a_fazer").length;
    const emAndamento = statuses.filter(
      (s) => s === "fazendo" || s === "em_andamento",
    ).length;

    // Regra 1: APENAS se todas as tarefas tiverem concluídas
    if (feitos === total) {
      return "concluida";
    }

    // Regra 2: APENAS se todas as tarefas estiverem marcadas como a fazer
    if (aFazer === total) {
      return "nao_iniciada";
    }

    // Regra 3: se pelo menos uma estiver concluida ou em andamento
    if (feitos > 0 || emAndamento > 0) {
      return "em_andamento";
    }

    return "nao_iniciada";
  };

  // Atualizar status da entrega automaticamente quando tarefas mudam
  useEffect(() => {
    if (!entregaSelecionada) return;

    // Usar tarefasPorEntrega como fonte de verdade
    const tarefasParaCalculo = tarefasPorEntrega[entregaSelecionada.id] || [];
    const novoStatus = calcularStatusEntrega(tarefasParaCalculo);

    if (entregaSelecionada.status !== novoStatus) {
      setEntregaSelecionada((prev: any) =>
        prev ? { ...prev, status: novoStatus } : prev,
      );

      // Atualizar no backend também
      if (entregaSelecionada.projeto_id) {
        cadastrosProjetosApi
          .updateEntrega(entregaSelecionada.id, { status: novoStatus })
          .catch(console.error);
      }
    }
  }, [tarefasPorEntrega, entregaSelecionada?.id, entregaSelecionada?.status]);

  // ============================================================
  // HANDLERS - TAREFAS DE ENTREGA (dados de exemplo)
  // ============================================================

  const handleAtualizarStatusTarefaEntrega = async (
    tarefaId: number,
    novoStatus: string,
  ) => {
    if (!entregaSelecionada) return;

    try {
      // Atualizar no backend
      await cadastrosProjetosApi.updateTarefaEntrega(tarefaId, {
        status: novoStatus as "a_fazer" | "fazendo" | "feito",
      });

      // Atualizar estado local
      setTarefasPorEntrega((prev) => ({
        ...prev,
        [entregaSelecionada.id]: (prev[entregaSelecionada.id] || []).map((t) =>
          t.id === tarefaId ? { ...t, status: novoStatus } : t,
        ),
      }));

      toast({
        title: "Status atualizado",
        description: `Status alterado para ${novoStatus === "a_fazer" ? "A Fazer" : novoStatus === "fazendo" ? "Em Andamento" : "Feito"}`,
      });
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleAbrirModalTarefaEntrega = (tarefa?: any) => {
    if (tarefa) {
      setTarefaEntregaEditando(tarefa);
      setNovaTarefaEntrega({
        nome: tarefa.nome,
        sprint_id: tarefa.sprint_id ? String(tarefa.sprint_id) : "",
        responsavel: tarefa.responsavel,
        status: tarefa.status,
      });
    } else {
      setTarefaEntregaEditando(null);
      setNovaTarefaEntrega({
        nome: "",
        sprint_id: "",
        responsavel: "",
        status: "a_fazer",
      });
    }
    setModalTarefaEntregaOpen(true);
  };

  const handleSalvarTarefaEntrega = async () => {
    if (!novaTarefaEntrega.nome.trim()) {
      toast({
        title: "Erro",
        description: "O nome da tarefa é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!entregaSelecionada) return;

    try {
      if (tarefaEntregaEditando) {
        // Editar tarefa existente via API
        const tarefaAtualizada = await cadastrosProjetosApi.updateTarefaEntrega(
          tarefaEntregaEditando.id,
          {
            nome: novaTarefaEntrega.nome,
            sprint_id: novaTarefaEntrega.sprint_id
              ? Number(novaTarefaEntrega.sprint_id)
              : undefined,
            responsavel: novaTarefaEntrega.responsavel || undefined,
            status: novaTarefaEntrega.status as "a_fazer" | "fazendo" | "feito",
          },
        );
        setTarefasPorEntrega((prev) => ({
          ...prev,
          [entregaSelecionada.id]: (prev[entregaSelecionada.id] || []).map(
            (t) => (t.id === tarefaEntregaEditando.id ? tarefaAtualizada : t),
          ),
        }));
      } else {
        // Criar nova tarefa via API
        const novaTarefa = await cadastrosProjetosApi.createTarefaEntrega(
          entregaSelecionada.id,
          {
            nome: novaTarefaEntrega.nome,
            sprint_id: novaTarefaEntrega.sprint_id
              ? Number(novaTarefaEntrega.sprint_id)
              : undefined,
            responsavel: novaTarefaEntrega.responsavel || undefined,
            status: novaTarefaEntrega.status as "a_fazer" | "fazendo" | "feito",
          },
        );
        setTarefasPorEntrega((prev) => ({
          ...prev,
          [entregaSelecionada.id]: [
            ...(prev[entregaSelecionada.id] || []),
            novaTarefa,
          ],
        }));
      }

      setModalTarefaEntregaOpen(false);
      setTarefaEntregaEditando(null);
      setNovaTarefaEntrega({
        nome: "",
        sprint_id: "",
        responsavel: "",
        status: "a_fazer",
      });
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleExcluirTarefaEntrega = async (tarefaId: number) => {
    if (!entregaSelecionada) return;

    try {
      // Excluir no backend
      await cadastrosProjetosApi.deleteTarefaEntrega(tarefaId);

      // Atualizar estado local
      setTarefasPorEntrega((prev) => ({
        ...prev,
        [entregaSelecionada.id]: (prev[entregaSelecionada.id] || []).filter(
          (t) => t.id !== tarefaId,
        ),
      }));
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setModalConfirmDeleteOpen(false);
      setItemParaDeletar(null);
    }
  };

  const handleVerProjetoDetalhes = async (projetoId: number) => {
    try {
      setLoadingProjeto(true);
      const projeto = await cadastrosProjetosApi.getProjetoById(projetoId);
      setProjetoDetalhes(projeto);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingProjeto(false);
    }
  };

  const handleUpdateEntregaStatus = async (
    entregaId: number,
    novoStatus: string,
  ) => {
    if (!projetoDetalhes) return;
    try {
      await cadastrosProjetosApi.updateEntrega(entregaId, {
        status: novoStatus as any,
      });
      // Recarregar detalhes do projeto
      const projeto = await cadastrosProjetosApi.getProjetoById(
        projetoDetalhes.id,
      );
      setProjetoDetalhes(projeto);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Criar nova entrega no projeto atual
  const handleCriarEntrega = async () => {
    if (!projetoDetalhes || !novaEntregaNome.trim()) {
      toast({
        title: "Atenção",
        description: "Digite o nome da entrega",
        variant: "destructive",
      });
      return;
    }

    // Bloquear prazo da entrega depois do prazo final do projeto
    if (novaEntregaPrazo && projetoDetalhes.data_prevista_conclusao) {
      const prazoEntrega = new Date(novaEntregaPrazo);
      const prazoProjeto = new Date(projetoDetalhes.data_prevista_conclusao);
      if (prazoEntrega > prazoProjeto) {
        toast({
          title: "Prazo inválido",
          description: `O prazo da entrega não pode ser posterior à conclusão prevista do projeto (${prazoProjeto.toLocaleDateString("pt-BR")}).`,
          variant: "destructive",
        });
        return;
      }
    }

    setSalvandoEntrega(true);
    try {
      await cadastrosProjetosApi.createEntrega(projetoDetalhes.id, {
        nome: novaEntregaNome.trim(),
        area_responsavel_id: novaEntregaAreaId,
        status: "nao_iniciada",
        ordem: projetoDetalhes.entregas?.length || 0,
        prazo_estimado: novaEntregaPrazo || null,
      });

      // Recarregar projeto com as novas entregas
      const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
        projetoDetalhes.id,
      );
      setProjetoDetalhes(projetoAtualizado);

      // Limpar formulário e fechar modal
      setNovaEntregaNome("");
      setNovaEntregaAreaId(null);
      setNovaEntregaPrazo("");
      setModalNovaEntregaOpen(false);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSalvandoEntrega(false);
    }
  };

  // Abrir modal de edição de entrega
  const handleAbrirEditEntrega = (entrega: Entrega) => {
    setEntregaEditando(entrega);
    setEditEntregaNome(entrega.nome);
    setEditEntregaAreaId(entrega.area_responsavel_id ?? null);
    setEditEntregaPrazo(
      entrega.prazo_estimado
        ? String(entrega.prazo_estimado).substring(0, 10)
        : "",
    );
    setModalEditEntregaOpen(true);
  };

  // Salvar edição de entrega
  const handleSalvarEditEntrega = async () => {
    if (!entregaEditando || !projetoDetalhes) return;
    if (!editEntregaNome.trim()) {
      toast({
        title: "Atenção",
        description: "Digite o nome da entrega",
        variant: "destructive",
      });
      return;
    }
    if (editEntregaPrazo && projetoDetalhes.data_prevista_conclusao) {
      const prazoEntrega = new Date(editEntregaPrazo);
      const prazoProjeto = new Date(projetoDetalhes.data_prevista_conclusao);
      if (prazoEntrega > prazoProjeto) {
        toast({
          title: "Prazo inválido",
          description: `O prazo da entrega não pode ser posterior à conclusão prevista do projeto (${prazoProjeto.toLocaleDateString("pt-BR")}).`,
          variant: "destructive",
        });
        return;
      }
    }
    setSalvandoEditEntrega(true);
    try {
      await cadastrosProjetosApi.updateEntrega(entregaEditando.id, {
        nome: editEntregaNome.trim(),
        area_responsavel_id: editEntregaAreaId,
        prazo_estimado: editEntregaPrazo || null,
      });
      const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
        projetoDetalhes.id,
      );
      setProjetoDetalhes(projetoAtualizado);
      setModalEditEntregaOpen(false);
      setEntregaEditando(null);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSalvandoEditEntrega(false);
    }
  };

  const handleUpdateProjectStatus = async (
    projetoId: number,
    novoStatus: string,
  ) => {
    try {
      await cadastrosProjetosApi.updateProjeto(projetoId, {
        status: novoStatus as any,
      });

      // Atualizar estado local se for o projeto visualizado
      if (projetoDetalhes && projetoDetalhes.id === projetoId) {
        const projeto = await cadastrosProjetosApi.getProjetoById(projetoId);
        setProjetoDetalhes(projeto);
      }

      // Recarregar lista de projetos vinculados se necessário
      if (planoSelecionado) {
        const projetosData =
          await cadastrosProjetosApi.getProjetosByInstrumentoId(
            planoSelecionado.id,
          );
        setProjetosVinculados(projetosData);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // ============================================================
  // HANDLERS - PROJETOS
  // ============================================================

  const handleCriarProjeto = async () => {
    if (!novoProjetoNome.trim() || novoProjetoNome.trim().length < 3) {
      toast({
        title: "Erro",
        description: "O nome do projeto deve ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (!planoSelecionado) return;

    try {
      // Usar instrumento_id para vincular ao instrumento de planejamento
      await gestaoEstrategicaApi.createProjeto({
        nome: novoProjetoNome.trim(),
        instrumento_id: planoSelecionado.id,
      });

      setNovoProjetoNome("");
      setModalProjetoOpen(false);
      await carregarProjetosDoPlano(planoSelecionado.id);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleEditarProjeto = async () => {
    if (
      !projetoEditando ||
      !novoProjetoNome.trim() ||
      novoProjetoNome.trim().length < 3
    ) {
      toast({
        title: "Erro",
        description: "O nome do projeto deve ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }

    try {
      await gestaoEstrategicaApi.updateProjeto(projetoEditando.id, {
        nome: novoProjetoNome.trim(),
      });

      setNovoProjetoNome("");
      setProjetoEditando(null);
      setModalProjetoOpen(false);
      if (planoSelecionado) {
        await carregarProjetosDoPlano(planoSelecionado.id);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleAbrirModalEditarProjeto = (projeto: {
    id: number;
    nome: string;
  }) => {
    setProjetoEditando(projeto);
    setNovoProjetoNome(projeto.nome);
    setModalProjetoOpen(true);
  };

  // ============================================================
  // HANDLERS - TAREFAS
  // ============================================================

  const handleAbrirModalTarefa = (projetoId: number, tarefa?: GestaoTarefa) => {
    setProjetoIdParaTarefa(projetoId);
    if (tarefa) {
      setTarefaEditando(tarefa);
      setNovaTarefaNome(tarefa.nome);
    } else {
      setTarefaEditando(null);
      setNovaTarefaNome("");
    }
    setModalTarefaOpen(true);
  };

  const handleSalvarTarefa = async () => {
    if (!novaTarefaNome.trim() || novaTarefaNome.trim().length < 3) {
      toast({
        title: "Erro",
        description: "O nome da tarefa deve ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (!planoSelecionado) return;

    try {
      if (tarefaEditando) {
        // Atualizar tarefa existente
        await gestaoEstrategicaApi.updateTarefa(tarefaEditando.id, {
          nome: novaTarefaNome.trim(),
          status: tarefaEditando.status,
          progresso: tarefaEditando.progresso,
        });
      } else {
        // Criar nova tarefa
        await gestaoEstrategicaApi.createTarefa({
          nome: novaTarefaNome.trim(),
          projeto_id: projetoIdParaTarefa!,
        });
      }
      setNovaTarefaNome("");
      setTarefaEditando(null);
      setProjetoIdParaTarefa(null);
      setModalTarefaOpen(false);
      await carregarProjetosDoPlano(planoSelecionado.id);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleAtualizarStatusTarefa = async (
    tarefa: GestaoTarefa,
    novoStatus: GestaoTarefaStatus,
  ) => {
    if (!planoSelecionado) return;
    try {
      await gestaoEstrategicaApi.updateTarefa(tarefa.id, {
        status: novoStatus,
      });
      await carregarProjetosDoPlano(planoSelecionado.id);
      if (projetoDetalhes) {
        const projeto = await cadastrosProjetosApi.getProjetoById(
          projetoDetalhes.id,
        );
        setProjetoDetalhes(projeto);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleAtualizarProgressoTarefa = async (
    tarefa: GestaoTarefa,
    novoProgresso: GestaoTarefaProgresso,
  ) => {
    if (!planoSelecionado) return;
    try {
      await gestaoEstrategicaApi.updateTarefa(tarefa.id, {
        progresso: novoProgresso,
      });
      await carregarProjetosDoPlano(planoSelecionado.id);
      if (projetoDetalhes) {
        const projeto = await cadastrosProjetosApi.getProjetoById(
          projetoDetalhes.id,
        );
        setProjetoDetalhes(projeto);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // ============================================================
  // HANDLERS - EXCLUSÃO
  // ============================================================

  const handleConfirmarExclusao = async () => {
    if (!itemParaDeletar) return;

    try {
      if (itemParaDeletar.tipo === "plano") {
        await gestaoEstrategicaApi.deletePlano(itemParaDeletar.id);

        setPlanoSelecionado(null);
        setPlanoFiltroId(null);
        await carregarDados();
      } else if (itemParaDeletar.tipo === "projeto") {
        await gestaoEstrategicaApi.deleteProjeto(itemParaDeletar.id);

        if (planoSelecionado)
          await carregarProjetosDoPlano(planoSelecionado.id);
      } else if (itemParaDeletar.tipo === "tarefa") {
        await gestaoEstrategicaApi.deleteTarefa(itemParaDeletar.id);

        if (planoSelecionado)
          await carregarProjetosDoPlano(planoSelecionado.id);
      } else if (itemParaDeletar.tipo === "tarefaEntrega") {
        // Tarefa de exemplo - excluir do estado local
        handleExcluirTarefaEntrega(itemParaDeletar.id);
        return; // handleExcluirTarefaEntrega já fecha o modal
      } else if (itemParaDeletar.tipo === "entrega") {
        await cadastrosProjetosApi.deleteEntrega(itemParaDeletar.id);

        if (projetoDetalhes) {
          const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
            projetoDetalhes.id,
          );
          setProjetoDetalhes(projetoAtualizado);
        }
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setItemParaDeletar(null);
      setModalConfirmDeleteOpen(false);
    }
  };

  // ============================================================
  // DRAG AND DROP HANDLERS
  // ============================================================

  const handleDragStart = (
    e: React.DragEvent,
    projetoId: number,
    index: number,
  ) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ projetoId, index }));
    setTimeout(() => setDraggedTarefa({ projetoId, index }), 0);
  };

  const handleDragOver = (
    e: React.DragEvent,
    projetoId: number,
    index: number,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedTarefa !== null && draggedTarefa.projetoId === projetoId) {
      setDragOverTarget({ projetoId, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetProjetoId: number,
    targetIndex: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !draggedTarefa ||
      !planoSelecionado ||
      draggedTarefa.projetoId !== targetProjetoId
    ) {
      setDraggedTarefa(null);
      setDragOverTarget(null);
      return;
    }

    // Encontrar o projeto
    const projeto = planoSelecionado.projetos.find(
      (p) => p.id === targetProjetoId,
    );
    if (!projeto) return;

    const tarefas = [...projeto.tarefas];
    const sourceIndex = draggedTarefa.index;

    // Remover do índice original
    const [movedTarefa] = tarefas.splice(sourceIndex, 1);

    // Ajustar índice se movendo para frente
    let finalIndex = targetIndex;
    if (targetIndex > sourceIndex) {
      finalIndex = targetIndex - 1;
    }

    // Inserir no novo índice
    tarefas.splice(finalIndex, 0, movedTarefa);

    // Preparar ordenação para salvar no backend
    const ordenacao = tarefas.map((tarefa, idx) => ({
      id: tarefa.id,
      ordem: idx,
    }));

    try {
      await gestaoEstrategicaApi.updateOrdenacaoTarefas(ordenacao);
      await carregarProjetosDoPlano(planoSelecionado.id);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }

    setDraggedTarefa(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedTarefa(null);
    setDragOverTarget(null);
  };

  // ============================================================
  // HELPERS DE VISUALIZAÇÃO
  // ============================================================

  const getStatusBadge = (status: GestaoTarefaStatus) => {
    const config = {
      sprint_atual: {
        label: "Sprint Atual",
        className:
          "bg-yellow-400 hover:bg-yellow-500 text-gray-900 border-0 rounded-full px-4",
      },
      fora_sprint: {
        label: "Fora da Sprint",
        className:
          "bg-gray-400 hover:bg-gray-500 text-white border-0 rounded-full px-4",
      },
      concluida: {
        label: "Concluída",
        className:
          "bg-green-500 hover:bg-green-600 text-white border-0 rounded-full px-4",
      },
    };
    const { label, className } = config[status] || config.fora_sprint;
    return <Badge className={className}>{label}</Badge>;
  };

  const getProgressoBadge = (progresso: GestaoTarefaProgresso) => {
    const config = {
      a_fazer: {
        label: "A Fazer",
        className:
          "bg-orange-400 hover:bg-orange-500 text-white border-0 rounded-full px-4",
      },
      fazendo: {
        label: "Fazendo",
        className:
          "bg-yellow-400 hover:bg-yellow-500 text-gray-900 border-0 rounded-full px-4",
      },
      feito: {
        label: "Feito",
        className:
          "bg-green-500 hover:bg-green-600 text-white border-0 rounded-full px-4",
      },
    };
    const { label, className } = config[progresso] || config.a_fazer;
    return <Badge className={className}>{label}</Badge>;
  };

  // Cores para os SelectTrigger
  const getStatusSelectClass = (status: GestaoTarefaStatus) => {
    const classes = {
      sprint_atual:
        "bg-yellow-400 text-gray-900 border-yellow-500 hover:bg-yellow-500",
      fora_sprint: "bg-gray-400 text-white border-gray-500 hover:bg-gray-500",
      concluida: "bg-green-500 text-white border-green-600 hover:bg-green-600",
    };
    return classes[status] || classes.fora_sprint;
  };

  const getProgressoSelectClass = (progresso: GestaoTarefaProgresso) => {
    const classes = {
      a_fazer: "bg-orange-400 text-white border-orange-500 hover:bg-orange-500",
      fazendo:
        "bg-yellow-400 text-gray-900 border-yellow-500 hover:bg-yellow-500",
      feito: "bg-green-500 text-white border-green-600 hover:bg-green-600",
    };
    return classes[progresso] || classes.a_fazer;
  };

  // ============================================================
  // RENDER - PAINEL LATERAL DE ESTATÍSTICAS
  // ============================================================

  // ============================================================
  // RENDER - TELA PRINCIPAL (DESIGN CLEAN)
  // ============================================================

  // Helper para renderizar estrelas de prioridade
  const renderPrioridadeStars = (prioridade: string) => {
    const config: Record<string, { stars: number; label: string }> = {
      alta: { stars: 3, label: "Alta" },
      media: { stars: 2, label: "Média" },
      baixa: { stars: 1, label: "Baixa" },
    };
    const { stars, label } = config[prioridade] || config.media;
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700 font-bold">{label}</span>
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <Star
              key={i}
              className={`h-5 w-5 ${i < stars ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
            />
          ))}
        </div>
      </div>
    );
  };

  // Helper para renderizar saúde do projeto
  const renderSaudeProjeto = (saude: string) => {
    const config: Record<
      string,
      { label: string; bgColor: string; textColor: string; dotColor: string }
    > = {
      verde: {
        label: "Saudável",
        bgColor: "bg-emerald-50",
        textColor: "text-emerald-700",
        dotColor: "bg-emerald-500",
      },
      amarelo: {
        label: "Atenção",
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
        dotColor: "bg-amber-500",
      },
      vermelho: {
        label: "Crítico",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        dotColor: "bg-red-500",
      },
    };
    const { label, bgColor, textColor, dotColor } =
      config[saude] || config.verde;
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${bgColor}`}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className={`text-sm font-semibold ${textColor}`}>{label}</span>
      </div>
    );
  };

  const renderTelaPlanos = () => (
    <div className="space-y-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-gray-400">Carregando dashboard...</span>
        </div>
      ) : (
        <>
          {/* Filtros: Plano/Programa e Unidade */}
          <div
            className="flex flex-wrap items-end gap-4 animate-[fade-in-up_0.4s_ease-out_both]"
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Plano / Programa
              </label>
              <Select
                value={planoFiltroId ? String(planoFiltroId) : "todos"}
                onValueChange={(val) => {
                  if (val === "todos") {
                    setPlanoFiltroId(null);
                    setPlanoSelecionado(null);
                    setInstrumentoDetalhes(null);
                    setProjetosVinculados([]);
                  } else {
                    const plano = planos.find((p) => p.id === parseInt(val));
                    if (plano) handleFiltrarPorPlano(plano);
                  }
                }}
              >
                <SelectTrigger className="h-10 w-[320px] bg-white">
                  <SelectValue placeholder="Todos os Planos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Planos</SelectItem>
                  {planos
                    .filter((plano) => !ehPlanoOculto(plano.nome))
                    .map((plano) => (
                    <SelectItem key={plano.id} value={String(plano.id)}>
                      {plano.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Área
              </label>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger className="h-10 w-[320px] bg-white">
                  <SelectValue placeholder="Todas as Áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Áreas</SelectItem>
                  {(() => {
                    // Extrair áreas únicas diretamente dos projetos carregados
                    const projetosRef = planoFiltroId
                      ? projetosVinculados
                      : todosProjetos;
                    const areasUnicas = new Set<string>();
                    projetosRef.forEach((p) => {
                      const areasStr =
                        (p as any).areas_execucao_diretorias || "";
                      areasStr.split(", ").forEach((nome: string) => {
                        const trimmed = nome.trim();
                        if (trimmed && !trimmed.startsWith("auto:"))
                          areasUnicas.add(trimmed);
                      });
                    });
                    return Array.from(areasUnicas)
                      .sort((a, b) => a.localeCompare(b, "pt-BR"))
                      .map((nomeArea) => (
                        <SelectItem key={nomeArea} value={nomeArea}>
                          {nomeArea}
                        </SelectItem>
                      ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conteúdo com animações - key força remount ao trocar filtros */}
          <div
            key={`dashboard-${planoFiltroId || "all"}-${filtroUnidade}`}
            className="space-y-6"
          >
            {/* Header do Portfólio/Programa */}
            <div
              className="bg-blue-50 rounded-xl border border-blue-100 shadow-sm overflow-hidden flex animate-[fade-in-up_0.4s_ease-out_both]"
              style={{ animationDelay: "80ms" }}
            >
              {/* Barra lateral azul */}
              <div className="w-1.5 bg-blue-500" />
              <div className="flex-1 flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold text-blue-600">
                    {planoFiltroId && instrumentoDetalhes
                      ? instrumentoDetalhes.nome
                      : "Projetos"}
                  </h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {planoFiltroId && instrumentoDetalhes?.objetivo
                      ? instrumentoDetalhes.objetivo
                      : "Portfólio Completo"}
                  </p>
                </div>
                {planoFiltroId && instrumentoDetalhes && (
                  <button
                    onClick={() => setModalInfoCompletaOpen(true)}
                    className="inline-flex items-center gap-2 bg-white border border-blue-500 text-blue-500 hover:bg-blue-100 text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Ver detalhes</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cards de Estatísticas */}
            <div
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4 2xl:gap-5 animate-[fade-in-up_0.4s_ease-out_both]"
              style={{ animationDelay: "160ms" }}
            >
              {/* Card - Total de Projetos */}
              <button
                onClick={() => setFiltroStatus("todos")}
                className={`group relative overflow-hidden rounded-lg bg-gray-100 border transition-all duration-200 text-left ${filtroStatus === "todos"
                    ? "border-slate-400 shadow-lg ring-2 ring-slate-400"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500" />
                <div className="p-4 pl-5 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100">
                    <FolderKanban className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-600 uppercase tracking-wide">
                      Projetos
                    </p>
                    <p className="text-3xl font-bold text-slate-700">
                      {estatisticasProjetos.total}
                    </p>
                  </div>
                </div>
              </button>

              {/* Card - Concluídos */}
              <button
                onClick={() => setFiltroStatus("concluido")}
                className={`group relative overflow-hidden rounded-lg bg-gray-100 border transition-all duration-200 text-left ${filtroStatus === "concluido"
                    ? "border-emerald-400 shadow-lg ring-2 ring-emerald-400"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                <div className="p-4 pl-5 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-600 uppercase tracking-wide">
                      Concluídos
                    </p>
                    <p className="text-3xl font-bold text-emerald-600">
                      {estatisticasProjetos.concluidos}
                    </p>
                  </div>
                </div>
              </button>

              {/* Card - Em Andamento */}
              <button
                onClick={() => setFiltroStatus("em_execucao")}
                className={`group relative overflow-hidden rounded-lg bg-gray-100 border transition-all duration-200 text-left ${filtroStatus === "em_execucao"
                    ? "border-amber-400 shadow-lg ring-2 ring-amber-400"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                <div className="p-4 pl-5 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-600 uppercase tracking-wide">
                      Em Andamento
                    </p>
                    <p className="text-3xl font-bold text-amber-600">
                      {estatisticasProjetos.emAndamento}
                    </p>
                  </div>
                </div>
              </button>

              {/* Card - Não Iniciados */}
              <button
                onClick={() => setFiltroStatus("planejado")}
                className={`group relative overflow-hidden rounded-lg bg-gray-100 border transition-all duration-200 text-left ${filtroStatus === "planejado"
                    ? "border-rose-400 shadow-lg ring-2 ring-rose-400"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
                <div className="p-4 pl-5 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-100">
                    <AlertTriangle className="h-5 w-5 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-600 uppercase tracking-wide">
                      Não Iniciado
                    </p>
                    <p className="text-3xl font-bold text-rose-600">
                      {estatisticasProjetos.naoIniciados}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Dashboard de Gráficos (compacto) */}
            {projetosPorDiretoria.length > 0 && (
              <div
                className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-[fade-in-up_0.4s_ease-out_both]"
                style={{ animationDelay: "240ms" }}
              >
                {/* Status Donut */}
                <GraficoRosca
                  key={`dash-status-${projetosPorDiretoria.length}`}
                  title="Status"
                  data={dashboardStatusData}
                  colors={["#3b82f6", "#eab308", "#22c55e", "#6b7280"]}
                  cardClassName="!h-[280px]"
                  innerRadius={40}
                  outerRadius={65}
                />
                {/* Situação Donut */}
                <GraficoRosca
                  key={`dash-situacao-${projetosPorDiretoria.length}`}
                  title="Situação"
                  data={dashboardSituacaoData}
                  colors={["#3b82f6", "#ef4444", "#16a34a", "#6b7280"]}
                  cardClassName="!h-[280px]"
                  innerRadius={40}
                  outerRadius={65}
                />
                {/* Saúde Bar Chart */}
                <Card className="border border-gray-200 shadow-md rounded-lg flex flex-col !h-[280px]">
                  <CardHeader className="pb-1 py-2 flex-shrink-0">
                    <CardTitle className="text-base leading-none">
                      Saúde
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-2 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboardSaudeData}
                        margin={{ top: 18, right: 5, left: 5, bottom: 0 }}
                      >
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <RechartsTooltip />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={52}>
                          <LabelList
                            dataKey="value"
                            position="top"
                            style={{ fontSize: 11, fontWeight: "bold" }}
                          />
                          {dashboardSaudeData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                {/* Prioridade Horizontal Bars */}
                <Card className="border border-gray-200 shadow-md rounded-lg flex flex-col !h-[280px]">
                  <CardHeader className="pb-1 py-2 flex-shrink-0">
                    <CardTitle className="text-base leading-none">
                      Prioridade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-4 flex flex-col justify-center gap-5">
                    {dashboardPrioridadeData.map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-10 text-right flex-shrink-0">
                          {item.label}
                        </span>
                        <div className="flex gap-0.5 flex-shrink-0">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${s <= item.stars ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                        <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                          <div
                            className={`h-5 rounded ${item.barColor} transition-all duration-700`}
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-6 text-right flex-shrink-0">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Abas: Todos / Meus projetos */}
            {ehGestorDeProjeto && (
              <div
                className="flex gap-1 border-b border-gray-300 animate-[fade-in-up_0.4s_ease-out_both]"
                style={{ animationDelay: "300ms" }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("todos")}
                  className={cn(
                    "px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px",
                    activeTab === "todos"
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700",
                  )}
                >
                  Todos os projetos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("meus")}
                  className={cn(
                    "px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2",
                    activeTab === "meus"
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700",
                  )}
                >
                  Meus projetos
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold",
                      activeTab === "meus"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-200 text-gray-600",
                    )}
                  >
                    {meusProjetos.length}
                  </span>
                </button>
              </div>
            )}

            {/* Tabela de Projetos */}
            <div
              className="bg-gray-300 rounded-2xl border border-gray-400 overflow-hidden shadow-sm animate-[fade-in-up_0.4s_ease-out_both]"
              style={{ animationDelay: "320ms" }}
            >
              {/* Header da Tabela */}
              <div className="px-6 py-4 bg-gray-200 border-b border-gray-400">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-800">
                      {activeTab === "meus"
                        ? "Meus projetos"
                        : planoFiltroId && instrumentoDetalhes
                          ? `Projetos de ${instrumentoDetalhes.nome}`
                          : "Projetos"}
                    </h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Buscar projeto..."
                        value={buscaProjeto}
                        onChange={(e) => setBuscaProjeto(e.target.value)}
                        className="pl-10 pr-4 h-10 w-60 bg-white border-gray-300 text-sm rounded-xl focus:border-slate-500 focus:ring-slate-500"
                      />
                    </div>
                    <Select
                      value={filtroGestor}
                      onValueChange={setFiltroGestor}
                    >
                      <SelectTrigger className="h-10 w-48 bg-white border-gray-300 text-sm rounded-xl">
                        <SelectValue placeholder="Gestor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Gestores</SelectItem>
                        {gestoresDeProjetos.map(([id, nome]) => (
                          <SelectItem key={id} value={id!.toString()}>
                            {nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="hidden lg:flex items-center text-lg font-bold text-gray-800">
                    <span className="w-36 text-center">Progresso</span>
                    <Select
                      value={filtroStatus}
                      onValueChange={(v: any) => setFiltroStatus(v)}
                    >
                      <SelectTrigger className="w-28 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-lg font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                        <span>Status</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="planejado">Planejado</SelectItem>
                        <SelectItem value="em_execucao">Em Execução</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="cancelado">Descontinuado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filtroSituacao}
                      onValueChange={(v: any) => setFiltroSituacao(v)}
                    >
                      <SelectTrigger className="w-28 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-lg font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                        <span>Situação</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="no_prazo">No prazo</SelectItem>
                        <SelectItem value="em_atraso">Em atraso</SelectItem>
                        <SelectItem value="finalizado">Finalizado</SelectItem>
                        <SelectItem value="encerrado">Encerrado</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="w-28 text-center">Prazo</span>
                    <Select
                      value={filtroPrioridade}
                      onValueChange={(v: any) => setFiltroPrioridade(v)}
                    >
                      <SelectTrigger className="w-36 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-lg font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                        <span>Prioridade</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filtroTap}
                      onValueChange={(v: any) => setFiltroTap(v)}
                    >
                      <SelectTrigger className="w-32 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-lg font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                        <span>TAP</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pendente">
                          <div className="flex items-center gap-2">
                            <Hourglass className="h-3 w-3 text-gray-500" />
                            Pendente
                          </div>
                        </SelectItem>
                        <SelectItem value="em_processo">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-3 w-3 text-orange-500" />
                            Em processo
                          </div>
                        </SelectItem>
                        <SelectItem value="concluido">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Concluído
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filtroTep}
                      onValueChange={(v: any) => setFiltroTep(v)}
                    >
                      <SelectTrigger className="w-32 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-lg font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                        <span>TEP</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pendente">
                          <div className="flex items-center gap-2">
                            <Hourglass className="h-3 w-3 text-gray-500" />
                            Pendente
                          </div>
                        </SelectItem>
                        <SelectItem value="em_processo">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-3 w-3 text-orange-500" />
                            Em processo
                          </div>
                        </SelectItem>
                        <SelectItem value="concluido">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Concluído
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="w-10"></span>
                  </div>
                </div>
              </div>

              {/* Lista de Projetos */}
              {loadingPlano ? (
                <div className="text-center py-16 text-gray-400 bg-white">
                  Carregando projetos...
                </div>
              ) : projetosFiltrados.length === 0 ? (
                <div className="py-20 text-center bg-white">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <FolderKanban className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg">
                    {planoFiltroId
                      ? "Nenhum projeto vinculado"
                      : filtroStatus !== "todos" ||
                        filtroSituacao !== "todos" ||
                        filtroSaude !== "todos" ||
                        filtroPrioridade !== "todos" ||
                        filtroTap !== "todos"
                        ? "Nenhum projeto com os filtros selecionados"
                        : "Nenhum projeto encontrado"}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {planoFiltroId
                      ? "Este plano/programa não possui projetos."
                      : "Cadastre projetos em Cadastros → Projetos."}
                  </p>
                </div>
              ) : (
                <div className="bg-white">
                  {projetosFiltrados.map((projeto, index) => {
                    const progresso =
                      (projeto as any).progresso_percentual ||
                      (projeto as any).progresso ||
                      0;
                    const prazoEstimado =
                      (projeto as any).data_prevista_conclusao ||
                        (projeto as any).data_fim_prevista
                        ? new Date(
                          (projeto as any).data_prevista_conclusao ||
                          (projeto as any).data_fim_prevista,
                        ).toLocaleDateString("pt-BR", {
                          month: "2-digit",
                          year: "numeric",
                        })
                        : "—";

                    return (
                      <div
                        key={projeto.id}
                        onClick={() => handleVerProjetoDetalhes(projeto.id)}
                        className={`group flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-all cursor-pointer ${index !== projetosFiltrados.length - 1
                            ? "border-b border-gray-100"
                            : ""
                          }`}
                      >
                        {/* Info do Projeto */}
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0 shadow-lg shadow-slate-600/30">
                            <FolderKanban className="h-6 w-6 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-gray-900 font-semibold text-base truncate group-hover:text-slate-600 transition-colors">
                              {projeto.nome}
                            </h4>
                            {/* Gestor */}
                            {projeto.gestor_nome && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-xs text-slate-500 font-medium">
                                  {projeto.gestor_nome}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Colunas da tabela */}
                        <div className="hidden lg:flex items-center">
                          {/* Progresso */}
                          <div className="w-36 flex flex-col items-center gap-1 px-3 mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-3.5 overflow-hidden">
                              <div
                                className="bg-green-500 h-3.5 rounded-full transition-all"
                                style={{ width: `${progresso}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-700 font-bold">
                              {progresso}%
                            </span>
                          </div>

                          {/* Status */}
                          <div className="w-28 flex justify-center">
                            <Badge
                              className={`${statusProjetoColors[projeto.status || "planejado"]} border-0 text-xs shadow-sm whitespace-nowrap`}
                            >
                              {
                                statusProjetoLabels[
                                projeto.status || "planejado"
                                ]
                              }
                            </Badge>
                          </div>

                          {/* Situação */}
                          <div className="w-28 flex justify-center">
                            <Badge
                              className={`${situacaoColors[getSituacaoProjeto(projeto)]} border-0 text-xs shadow-sm whitespace-nowrap`}
                            >
                              {situacaoLabels[getSituacaoProjeto(projeto)]}
                            </Badge>
                          </div>

                          {/* Prazo */}
                          <div className="w-28 text-center">
                            <span className="text-sm text-gray-700 font-bold bg-gray-100 px-3 py-2 rounded-lg">
                              {prazoEstimado}
                            </span>
                          </div>

                          {/* Prioridade */}
                          <div className="w-36 flex justify-center">
                            {renderPrioridadeStars(
                              projeto.prioridade || "media",
                            )}
                          </div>

                          {/* TAP */}
                          <div className="w-32 flex justify-center">
                            {(() => {
                              const tap = getTapStatusLocal(projeto);
                              const bucket = bucketFromTapLabel(tap.label);
                              return renderStatusBadge(bucket, {
                                onClick: (e) => handleTapClick(e, projeto),
                                tooltip: tap.label,
                              });
                            })()}
                          </div>

                          {/* TEP */}
                          <div className="w-32 flex justify-center">
                            {(() => {
                              const tep = getTepStatusLocal(projeto);
                              const bucket = bucketFromTepLabel(tep.label);
                              return renderStatusBadge(bucket, {
                                onClick: (e) => handleTepClick(e, projeto),
                                tooltip: tep.label,
                              });
                            })()}
                          </div>

                          {/* Chevron */}
                          <div className="w-10 flex justify-center">
                            <ChevronRight className="h-6 w-6 text-gray-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>

                        {/* Chevron mobile */}
                        <ChevronRight className="lg:hidden h-5 w-5 text-gray-400 group-hover:text-slate-600" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* fim do wrapper de animações */}
        </>
      )}
    </div>
  );

  // ============================================================
  // RENDER - TELA DO PLANO (PROJETOS VINCULADOS)
  // ============================================================

  const getProjetoStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      planejado: { label: "Planejado", className: "bg-gray-100 text-gray-700" },
      em_execucao: {
        label: "Em Execução",
        className: "bg-blue-100 text-blue-700",
      },
      concluido: {
        label: "Concluído",
        className: "bg-green-100 text-green-700",
      },
      cancelado: {
        label: "Descontinuado",
        className: "bg-gray-200 text-gray-700",
      },
    };
    const config = configs[status] || configs["planejado"];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getProjetoSaudeBadge = (saude: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      verde: { label: "● Saudável", className: "text-green-600 font-medium" },
      amarelo: { label: "● Atenção", className: "text-yellow-600 font-medium" },
      vermelho: { label: "● Crítico", className: "text-red-600 font-medium" },
    };
    const config = configs[saude] || configs["verde"];
    return <span className={config.className}>{config.label}</span>;
  };

  // ============================================================
  // RENDER - TELA DE DETALHES DO PROJETO
  // ============================================================

  const renderTelaProjetoDetalhes = () => {
    if (!projetoDetalhes) return null;

    const entregas = projetoDetalhes.entregas || [];
    const total = entregas.length;
    const planejado = entregas.filter(
      (e) => e.status === "nao_iniciada",
    ).length;
    const emExecucao = entregas.filter(
      (e) => e.status === "em_andamento",
    ).length;
    const suspenso = 0; // Adicionar campo quando disponível no backend
    const concluido = entregas.filter((e) => e.status === "concluida").length;
    const progresso = total > 0 ? Math.round((concluido / total) * 100) : 0;

    // Função para obter o texto do status sem dropdown
    const getStatusTexto = (status: string) => {
      const labels: Record<string, { text: string; className: string }> = {
        nao_iniciada: { text: "Não Iniciada", className: "text-gray-600" },
        em_andamento: {
          text: "Em Andamento",
          className: "text-orange-600 font-medium",
        },
        concluida: {
          text: "Concluída",
          className: "text-green-600 font-medium",
        },
      };
      return labels[status] || labels["nao_iniciada"];
    };

    return (
      <div className="space-y-6">
        {/* Header do Projeto */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 shadow-sm overflow-hidden flex">
          <div className="w-1.5 bg-blue-500" />
          <div className="flex-1 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-blue-600">
                {projetoDetalhes.nome}
              </h2>
              {projetoDetalhes.descricao_sintetica && (
                <p className="text-gray-500 text-sm mt-1">
                  {projetoDetalhes.descricao_sintetica}
                </p>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => setModalProjetoInfoCompletaOpen(true)}
                className="inline-flex items-center gap-2 bg-white border border-blue-500 text-blue-500 hover:bg-blue-100 text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm flex-shrink-0"
              >
                <Eye className="h-4 w-4" />
                <span>Ver detalhes</span>
              </button>
            )}
          </div>
        </div>

        {/* Botões de ação — Voltar / Editar Projeto */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleVoltarParaProjetos}
            className="bg-white border-gray-300"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          {(podeEditarEntregas || podeEditarTap) && (
            <Button
              onClick={() => {
                setProjetoEditDialogMode("edit");
                setProjetoEditDialogSlim(false);
                // Se NÃO é ADMIN/gestor mas tem permissão TAP, abre em modo TAP-only:
                // o dialog filtra o payload pros 13 campos do TAP no submit e mostra
                // o banner de aviso. Se for ADMIN/gestor, edição completa.
                setProjetoEditDialogTapMode(
                  !podeEditarEntregas && podeEditarTap,
                );
                setProjetoEditDialogOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar Projeto
            </Button>
          )}
        </div>

        {/* Layout de 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5 xl:gap-6 2xl:gap-8">
          {/* COLUNA ESQUERDA - Andamento do Projeto */}
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-5 h-[650px] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              Andamento do Projeto
            </h3>

            {/* Gráfico de Progresso Semicircular */}
            <div className="flex flex-col items-center justify-center mb-6">
              {/* Gráfico Semicircular Verde */}
              <div className="relative w-44 h-24">
                <svg className="w-full h-full" viewBox="0 0 120 65">
                  {/* Background arc - Semicírculo cinza */}
                  <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />

                  {/* Progress arc - Semicírculo verde */}
                  <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(progresso / 100) * 157} 157`}
                    className="transition-all duration-700"
                  />
                </svg>

                {/* Percentual no Centro */}
                <div className="absolute inset-0 flex items-end justify-center pb-1">
                  <span className="text-3xl font-bold text-green-600">
                    {progresso}%
                  </span>
                </div>
              </div>

              {/* Texto de entregas concluídas */}
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-800">
                  {concluido} de {total}
                </span>{" "}
                entregas concluídas
              </p>
            </div>

            {/* Informações Adicionais com Border */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
              <div>
                <p className="text-gray-600 font-medium">Patrocinador</p>
                <p className="text-gray-900">
                  {projetoDetalhes.patrocinador_nome || "-"}
                </p>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Gestor do Projeto</p>
                <p className="text-gray-900">
                  {projetoDetalhes.gestor_nome || "-"}
                </p>
                {projetoDetalhes.diretorias_nomes && (
                  <p className="text-gray-500 text-xs mt-1">
                    {projetoDetalhes.diretorias_nomes}
                  </p>
                )}
              </div>

              <div>
                <p className="text-gray-600 font-medium">Status</p>
                <div className="h-8 w-[160px] bg-gray-100 text-slate-700 font-medium rounded-md flex items-center px-3 gap-2 text-sm cursor-default border border-gray-200/50">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${projetoDetalhes.status === "concluido"
                          ? "bg-green-500"
                          : projetoDetalhes.status === "em_execucao"
                            ? "bg-blue-500"
                            : projetoDetalhes.status === "cancelado"
                              ? "bg-gray-500"
                              : "bg-gray-400"
                        }`}
                    />
                    <span>
                      {statusProjetoLabels[projetoDetalhes.status] ||
                        projetoDetalhes.status}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Saúde</p>
                <p className="text-gray-900">
                  {projetoDetalhes.saude === "verde"
                    ? "Saudável"
                    : projetoDetalhes.saude === "amarelo"
                      ? "Atenção"
                      : projetoDetalhes.saude === "vermelho"
                        ? "Crítico"
                        : "-"}
                </p>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Prazo Estimado</p>
                <p className="text-gray-900">
                  {projetoDetalhes.data_prevista_conclusao
                    ? new Date(
                      projetoDetalhes.data_prevista_conclusao,
                    ).toLocaleDateString("pt-BR", {
                      month: "2-digit",
                      year: "numeric",
                    })
                    : "-"}
                </p>
              </div>
            </div>

            {/* Botões fixos TAP / TEP */}
            <div className="mt-4 flex flex-col gap-2">
              {(() => {
                // "Visualizar TAP" assim que o projeto tem todos os campos obrigatórios
                // do TAP preenchidos (após salvar). Antes disso, "Gerar TAP".
                const tapPronto = validateTAPFields(projetoDetalhes).valid;
                // TAP recusado e aguardando o gestor revalidar.
                const uid = user?.id ? Number(user.id) : null;
                const tapRecusadoParaGestor =
                  !!projetoDetalhes.tap_recusado_em &&
                  !projetoDetalhes.tap_validado_gestor_em &&
                  uid !== null &&
                  Number((projetoDetalhes as any).gestor_user_id) === uid;
                const destacar = tapPendenteUsuario || tapRecusadoParaGestor;
                return (
                  <Button
                    onClick={() => {
                      // Gerar/Visualizar TAP — modo enxuto: só painel de validação.
                      // Edição dos campos do projeto é feita pelo botão "Editar Projeto".
                      setProjetoEditDialogMode(tapPronto ? "view" : "edit");
                      setProjetoEditDialogSlim(true);
                      setProjetoEditDialogOpen(true);
                    }}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full",
                      tapRecusadoParaGestor
                        ? "border-2 border-red-400 bg-red-50 text-red-900 hover:bg-red-100 animate-pulse shadow-md shadow-red-200"
                        : destacar
                          ? "border-2 border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 animate-pulse shadow-md shadow-amber-200"
                          : tapPronto
                            ? "border-sky-500 text-sky-700 hover:bg-sky-50"
                            : "border-amber-500 text-amber-700 hover:bg-amber-50",
                    )}
                  >
                    {destacar ? (
                      <AlertTriangle
                        className={cn(
                          "mr-2 h-4 w-4",
                          tapRecusadoParaGestor
                            ? "text-red-600"
                            : "text-amber-600",
                        )}
                      />
                    ) : (
                      <FileCheck className="mr-2 h-4 w-4" />
                    )}
                    {tapRecusadoParaGestor
                      ? "TAP recusado — revisar"
                      : tapPendenteUsuario
                        ? "Validar TAP — Pendente"
                        : projetoDetalhes.tap_versao &&
                          projetoDetalhes.tap_versao > 0
                          ? tapPronto
                            ? "Visualizar TAP"
                            : "Gerar TAP"
                          : "Visualizar Prévia do TAP"}
                  </Button>
                );
              })()}

              {(() => {
                const tepVigente = !!projetoTep?.tep_validado_patrocinador_em;
                const uid = user?.id ? Number(user.id) : null;
                const tepRecusadoParaGestor =
                  !!projetoTep?.tep_recusado_em &&
                  !projetoTep?.tep_validado_gestor_em &&
                  uid !== null &&
                  Number((projetoDetalhes as any).gestor_user_id) === uid;
                const destacar = tepPendenteUsuario || tepRecusadoParaGestor;
                // TEP só pode ser gerado se o TAP estiver vigente.
                // (Quando o TEP já existe, deixamos abrir pra visualizar/validar mesmo assim.)
                const tapVigente =
                  !!projetoDetalhes.tap_validado_patrocinador_em;
                const tepBloqueadoSemTap = !projetoTep && !tapVigente;
                return (
                  <Button
                    onClick={() => {
                      if (tepBloqueadoSemTap) {
                        toast({
                          title: "TAP precisa estar vigente",
                          description:
                            "Conclua o ciclo de validação do TAP (gestor → diretor → patrocinador) antes de finalizar o projeto.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setShowTepDialog(true);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={tepBloqueadoSemTap}
                    className={cn(
                      "w-full",
                      tepBloqueadoSemTap
                        ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed hover:bg-gray-50"
                        : tepRecusadoParaGestor
                          ? "border-2 border-red-400 bg-red-50 text-red-900 hover:bg-red-100 animate-pulse shadow-md shadow-red-200"
                          : destacar
                            ? "border-2 border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 animate-pulse shadow-md shadow-amber-200"
                            : tepVigente
                              ? "border-indigo-500 text-indigo-700 hover:bg-indigo-50"
                              : "border-amber-500 text-amber-700 hover:bg-amber-50",
                    )}
                    title={
                      tepBloqueadoSemTap
                        ? "Conclua a validação do TAP antes de finalizar o projeto"
                        : undefined
                    }
                  >
                    {destacar ? (
                      <AlertTriangle
                        className={cn(
                          "mr-2 h-4 w-4",
                          tepRecusadoParaGestor
                            ? "text-red-600"
                            : "text-amber-600",
                        )}
                      />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    {tepRecusadoParaGestor
                      ? "TEP recusado — revisar"
                      : tepPendenteUsuario
                        ? "Validar TEP — Pendente"
                        : tepVigente
                          ? "Visualizar TEP"
                          : "Finalizar Projeto"}
                  </Button>
                );
              })()}
            </div>
          </div>

          {/* COLUNA DIREITA - Entregas */}
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-6 h-[650px] flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Entregas</h3>
              {podeEditarEntregas && (
                <Button
                  size="sm"
                  onClick={() => setModalNovaEntregaOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              )}
            </div>

            {/* Tabela com Header Azul */}
            <div className="overflow-x-auto overflow-y-auto flex-1">
              {entregas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                  <Package className="h-16 w-16 mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">
                    Nenhuma entrega cadastrada
                  </p>
                  {podeEditarEntregas ? (
                    <>
                      <p className="text-sm text-gray-400 mb-4">
                        Adicione entregas para organizar as tarefas do projeto
                      </p>
                      <Button
                        onClick={() => setModalNovaEntregaOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar primeira entrega
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Este projeto ainda não possui entregas cadastradas.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Input hidden para upload de evidência */}
                  <input
                    ref={evidenciaInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && evidenciaEntregaId) {
                        handleUploadEvidencia(evidenciaEntregaId, file);
                      }
                      e.target.value = "";
                    }}
                  />

                  <table className="w-full">
                    <thead>
                      <tr className="bg-blue-600">
                        <th
                          className="text-left py-4 px-6 text-white font-semibold text-sm"
                          style={{ width: "23%" }}
                        >
                          Nome da Entrega
                        </th>
                        <th
                          className="text-center py-4 px-6 text-white font-semibold text-sm"
                          style={{ width: "18%" }}
                        >
                          Área Responsável
                        </th>
                        <th
                          className="text-center py-4 px-6 text-white font-semibold text-sm"
                          style={{ width: "13%" }}
                        >
                          Prazo Estimado
                        </th>
                        <th
                          className="text-center py-4 px-6 text-white font-semibold text-sm"
                          style={{ width: "14%" }}
                        >
                          Status
                        </th>
                        <th
                          className="text-center py-4 px-6 text-white font-semibold text-sm"
                          style={{ width: "22%" }}
                        >
                          Evidências
                        </th>
                        <th
                          className="text-center py-4 px-6 text-white font-semibold text-sm"
                          style={{ width: "10%" }}
                        >
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...entregas]
                        .sort((a, b) => {
                          // Ordena por prazo_estimado crescente; entregas sem prazo vão pro fim.
                          // Critério de desempate: nome.
                          const pa = a.prazo_estimado
                            ? String(a.prazo_estimado).slice(0, 10)
                            : "";
                          const pb = b.prazo_estimado
                            ? String(b.prazo_estimado).slice(0, 10)
                            : "";
                          if (pa && pb) {
                            if (pa !== pb) return pa.localeCompare(pb);
                          } else if (pa) {
                            return -1;
                          } else if (pb) {
                            return 1;
                          }
                          return (a.nome || "").localeCompare(
                            b.nome || "",
                            "pt-BR",
                          );
                        })
                        .map((entrega) => {
                          const statusInfo = getStatusTexto(entrega.status);
                          return (
                            <tr
                              key={entrega.id}
                              className={`border-b border-gray-100 transition-colors last:border-b-0 ${isProduction() ? "" : "hover:bg-blue-50 cursor-pointer"}`}
                              onClick={
                                isProduction()
                                  ? undefined
                                  : () => handleVerEntregaDetalhes(entrega)
                              }
                            >
                              <td className="py-3 px-6 text-gray-900 text-sm">
                                {entrega.nome}
                              </td>
                              <td className="py-3 px-6 text-gray-900 text-sm text-center">
                                {entrega.area_responsavel_nome || "-"}
                              </td>
                              <td className="py-3 px-6 text-gray-900 text-sm text-center">
                                {formatDatePtBr(entrega.prazo_estimado)}
                              </td>
                              <td className="py-3 px-6">
                                <div
                                  className="h-8 w-[160px] bg-gray-100 text-slate-700 font-medium rounded-md flex items-center px-3 gap-2 text-sm cursor-default border border-gray-200/50"
                                  style={{
                                    marginLeft: "60%",
                                    transform: "translateX(-50%)",
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-2 h-2 rounded-full ${entrega.status === "concluida"
                                          ? "bg-green-500"
                                          : entrega.status === "em_andamento"
                                            ? "bg-orange-500"
                                            : "bg-gray-400"
                                        }`}
                                    />
                                    <span>
                                      {entrega.status === "nao_iniciada"
                                        ? "Não Iniciada"
                                        : entrega.status === "em_andamento"
                                          ? "Em Andamento"
                                          : "Concluída"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td
                                className="py-3 px-4 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  {uploadingEvidencia === entrega.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                  ) : entrega.evidencia_filename ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                                        onClick={() =>
                                          window.open(
                                            cadastrosProjetosApi.getEvidenciaDownloadUrl(
                                              entrega.id,
                                            ),
                                            "_blank",
                                          )
                                        }
                                        title={entrega.evidencia_filename}
                                      >
                                        <FileDown className="h-4 w-4" />
                                        <span className="text-xs max-w-[100px] truncate">
                                          {entrega.evidencia_filename}
                                        </span>
                                      </Button>
                                      {podeEditarEntregas && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                          onClick={() =>
                                            handleDeleteEvidencia(entrega.id)
                                          }
                                          title="Remover evidência"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </>
                                  ) : podeEditarEntregas ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 px-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 gap-1"
                                      onClick={() => {
                                        setEvidenciaEntregaId(entrega.id);
                                        evidenciaInputRef.current?.click();
                                      }}
                                      title="Enviar PDF de evidência"
                                    >
                                      <Upload className="h-4 w-4" />
                                      <span className="text-xs">PDF</span>
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      —
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td
                                className="py-3 px-4 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {podeEditarEntregas ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={() =>
                                        handleAbrirEditEntrega(entrega)
                                      }
                                      title="Editar entrega"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => {
                                        setItemParaDeletar({
                                          tipo: "entrega",
                                          id: entrega.id,
                                          nome: entrega.nome,
                                        });
                                        setModalConfirmDeleteOpen(true);
                                      }}
                                      title="Excluir entrega"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER - MODAL DE NOVA ENTREGA
  // ============================================================

  const renderModalNovaEntrega = () => {
    return (
      <Dialog
        open={modalNovaEntregaOpen}
        onOpenChange={setModalNovaEntregaOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Nova Entrega
            </DialogTitle>
            <DialogDescription>
              Adicione uma nova entrega ao projeto {projetoDetalhes?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome-entrega">Nome da Entrega</Label>
              <Input
                id="nome-entrega"
                value={novaEntregaNome}
                onChange={(e) => setNovaEntregaNome(e.target.value)}
                placeholder="Ex: Levantamento de requisitos"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="area-entrega">Área Responsável</Label>
              <Popover
                open={novaEntregaAreaPopoverOpen}
                onOpenChange={setNovaEntregaAreaPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={novaEntregaAreaPopoverOpen}
                    className="w-full justify-between font-normal h-auto min-h-10 py-2"
                  >
                    <span className="flex-1 min-w-0 text-left whitespace-normal break-words">
                      {novaEntregaAreaId ? (
                        (() => {
                          const a = areas.find(
                            (x) => x.id === novaEntregaAreaId,
                          );
                          return a
                            ? `${a.diretoria} - ${a.nome_area}`
                            : "Selecione a área responsável";
                        })()
                      ) : (
                        <span className="text-gray-500">
                          Selecione a área responsável
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[80] w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar área..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
                      <CommandGroup>
                        {areas.map((area) => {
                          const label = `${area.diretoria} - ${area.nome_area}`;
                          return (
                            <CommandItem
                              key={area.id}
                              value={label}
                              onSelect={() => {
                                setNovaEntregaAreaId(area.id);
                                setNovaEntregaAreaPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  novaEntregaAreaId === area.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prazo-entrega">Prazo Estimado</Label>
              <Input
                id="prazo-entrega"
                type="date"
                value={novaEntregaPrazo}
                onChange={(e) => setNovaEntregaPrazo(e.target.value)}
                max={
                  projetoDetalhes?.data_prevista_conclusao
                    ? String(projetoDetalhes.data_prevista_conclusao).slice(
                      0,
                      10,
                    )
                    : undefined
                }
              />
              {projetoDetalhes?.data_prevista_conclusao && (
                <p className="text-xs text-gray-500">
                  Conclusão prevista do projeto:{" "}
                  {new Date(
                    projetoDetalhes.data_prevista_conclusao,
                  ).toLocaleDateString("pt-BR")}
                </p>
              )}
              {novaEntregaPrazo &&
                projetoDetalhes?.data_prevista_conclusao &&
                new Date(novaEntregaPrazo) >
                new Date(projetoDetalhes.data_prevista_conclusao) && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Prazo posterior à conclusão prevista do projeto. Ajuste a
                    data antes de salvar.
                  </p>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalNovaEntregaOpen(false);
                setNovaEntregaNome("");
                setNovaEntregaAreaId(null);
                setNovaEntregaPrazo("");
              }}
              disabled={salvandoEntrega}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriarEntrega}
              disabled={
                salvandoEntrega ||
                !novaEntregaNome.trim() ||
                (!!novaEntregaPrazo &&
                  !!projetoDetalhes?.data_prevista_conclusao &&
                  new Date(novaEntregaPrazo) >
                  new Date(projetoDetalhes.data_prevista_conclusao))
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {salvandoEntrega ? "Salvando..." : "Criar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ============================================================
  // RENDER - MODAL DE EDIÇÃO DE ENTREGA
  // ============================================================

  const renderModalEditEntrega = () => {
    return (
      <Dialog
        open={modalEditEntregaOpen}
        onOpenChange={setModalEditEntregaOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Editar Entrega
            </DialogTitle>
            <DialogDescription>
              Altere as informações da entrega do projeto{" "}
              {projetoDetalhes?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-nome-entrega">Nome da Entrega</Label>
              <Input
                id="edit-nome-entrega"
                value={editEntregaNome}
                onChange={(e) => setEditEntregaNome(e.target.value)}
                placeholder="Ex: Levantamento de requisitos"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-area-entrega">Área Responsável</Label>
              <Popover
                open={editEntregaAreaPopoverOpen}
                onOpenChange={setEditEntregaAreaPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={editEntregaAreaPopoverOpen}
                    className="w-full justify-between font-normal h-auto min-h-10 py-2"
                  >
                    <span className="flex-1 min-w-0 text-left whitespace-normal break-words">
                      {editEntregaAreaId ? (
                        (() => {
                          const a = areas.find(
                            (x) => x.id === editEntregaAreaId,
                          );
                          return a
                            ? `${a.diretoria} - ${a.nome_area}`
                            : "Selecione a área responsável";
                        })()
                      ) : (
                        <span className="text-gray-500">
                          Selecione a área responsável
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[80] w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar área..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
                      <CommandGroup>
                        {areas.map((area) => {
                          const label = `${area.diretoria} - ${area.nome_area}`;
                          return (
                            <CommandItem
                              key={area.id}
                              value={label}
                              onSelect={() => {
                                setEditEntregaAreaId(area.id);
                                setEditEntregaAreaPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editEntregaAreaId === area.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-prazo-entrega">Prazo Estimado</Label>
              <Input
                id="edit-prazo-entrega"
                type="date"
                value={editEntregaPrazo}
                onChange={(e) => setEditEntregaPrazo(e.target.value)}
                max={
                  projetoDetalhes?.data_prevista_conclusao
                    ? String(projetoDetalhes.data_prevista_conclusao).slice(
                      0,
                      10,
                    )
                    : undefined
                }
              />
              {projetoDetalhes?.data_prevista_conclusao && (
                <p className="text-xs text-gray-500">
                  Conclusão prevista do projeto:{" "}
                  {new Date(
                    projetoDetalhes.data_prevista_conclusao,
                  ).toLocaleDateString("pt-BR")}
                </p>
              )}
              {editEntregaPrazo &&
                projetoDetalhes?.data_prevista_conclusao &&
                new Date(editEntregaPrazo) >
                new Date(projetoDetalhes.data_prevista_conclusao) && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Prazo posterior à conclusão prevista do projeto. Ajuste a
                    data antes de salvar.
                  </p>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalEditEntregaOpen(false);
                setEntregaEditando(null);
              }}
              disabled={salvandoEditEntrega}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarEditEntrega}
              disabled={
                salvandoEditEntrega ||
                !editEntregaNome.trim() ||
                (!!editEntregaPrazo &&
                  !!projetoDetalhes?.data_prevista_conclusao &&
                  new Date(editEntregaPrazo) >
                  new Date(projetoDetalhes.data_prevista_conclusao))
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {salvandoEditEntrega ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ============================================================
  // RENDER - TELA DE DETALHES DA ENTREGA (TAREFAS)
  // ============================================================

  const renderTelaEntregaDetalhes = () => {
    if (!entregaSelecionada || !projetoDetalhes) return null;

    // Usar tarefasPorEntrega como fonte de verdade (dados do banco)
    const tarefasParaCalculo = tarefasPorEntrega[entregaSelecionada.id] || [];
    const total = tarefasParaCalculo.length;

    const getStatusValue = (t: any) => t.status || t.progresso || "a_fazer";

    const naoIniciado = tarefasParaCalculo.filter(
      (t) => getStatusValue(t) === "a_fazer",
    ).length;
    const emAndamento = tarefasParaCalculo.filter((t) => {
      const s = getStatusValue(t);
      return s === "fazendo" || s === "em_andamento";
    }).length;
    const concluido = tarefasParaCalculo.filter(
      (t) => getStatusValue(t) === "feito",
    ).length;

    // Se a entrega tem evidência PDF, considerar 100% concluída
    const temEvidenciaPdf = !!entregaSelecionada.evidencia_filename;
    const progresso = temEvidenciaPdf
      ? 100
      : total > 0
        ? Math.round((concluido / total) * 100)
        : 0;

    // Função para obter o texto do status da tarefa
    const getStatusTarefaTexto = (status: string) => {
      const labels: Record<string, { text: string; className: string }> = {
        a_fazer: { text: "A Fazer", className: "text-gray-600" },
        fazendo: { text: "Fazendo", className: "text-orange-600 font-medium" },
        feito: { text: "Feito", className: "text-green-600 font-medium" },
      };
      return labels[status] || labels["a_fazer"];
    };

    return (
      <div className="space-y-6">
        {/* Header da Entrega */}
        <div className="flex items-center justify-center">
          <div className="bg-gray-100 rounded-lg border border-gray-200 px-8 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                ENTREGA
              </p>
              <h2 className="text-xl font-bold text-blue-600">
                {entregaSelecionada.nome}
              </h2>
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleVoltarParaEntregas}
            className="bg-white border-gray-300"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        {/* Layout de 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5 xl:gap-6 2xl:gap-8">
          {/* COLUNA ESQUERDA - Andamento da Entrega */}
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-5 h-[650px] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              Andamento da Entrega
            </h3>

            {/* Gráfico de Progresso Semicircular */}
            <div className="flex flex-col items-center justify-center mb-6">
              {/* Gráfico Semicircular Verde */}
              <div className="relative w-44 h-24">
                <svg className="w-full h-full" viewBox="0 0 120 65">
                  {/* Background arc - Semicírculo cinza */}
                  <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />

                  {/* Progress arc - Semicírculo verde */}
                  <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(progresso / 100) * 157} 157`}
                    className="transition-all duration-700"
                  />
                </svg>

                {/* Percentual no Centro */}
                <div className="absolute inset-0 flex items-end justify-center pb-1">
                  <span className="text-3xl font-bold text-green-600">
                    {progresso}%
                  </span>
                </div>
              </div>

              {/* Texto de tarefas concluídas */}
              <p className="mt-2 text-sm text-gray-600">
                {temEvidenciaPdf ? (
                  <span className="font-semibold text-green-600">
                    Concluída por evidência
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-gray-800">
                      {concluido} de {total}
                    </span>{" "}
                    tarefas concluídas
                  </>
                )}
              </p>
            </div>

            {/* Informações Adicionais com Border */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
              <div>
                <p className="text-gray-600 font-medium">Área Responsável</p>
                <p className="text-gray-900">
                  {entregaSelecionada.area_responsavel_nome || "XYZ"}
                </p>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Status</p>
                <div className="h-8 w-[160px] bg-gray-100 text-slate-700 font-medium rounded-md flex items-center px-3 gap-2 text-sm cursor-default border border-gray-200/50">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${entregaSelecionada.status === "concluida" ||
                          temEvidenciaPdf
                          ? "bg-green-500"
                          : entregaSelecionada.status === "em_andamento"
                            ? "bg-orange-500"
                            : "bg-gray-400"
                        }`}
                    />
                    <span>
                      {entregaSelecionada.status === "concluida" ||
                        temEvidenciaPdf
                        ? "Concluída"
                        : entregaSelecionada.status === "em_andamento"
                          ? "Em Andamento"
                          : "Não Iniciada"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Prazo Estimado</p>
                <p className="text-gray-900">mm/aaaa</p>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA - Tarefas */}
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-6 h-[650px] flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Tarefas</h3>
              {canEdit && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleAbrirModalTarefaEntrega()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Tarefa
                </Button>
              )}
            </div>

            {/* Tabela com Header Azul */}
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full">
                <thead>
                  <tr className="bg-blue-600">
                    <th className="text-left py-4 px-4 text-white font-semibold text-sm">
                      Nome da Tarefa
                    </th>
                    <th className="text-center py-4 px-4 text-white font-semibold text-sm">
                      Sprint
                    </th>
                    <th className="text-center py-4 px-4 text-white font-semibold text-sm">
                      Responsável pela execução
                    </th>
                    <th className="text-center py-4 px-4 text-white font-semibold text-sm">
                      Status
                    </th>
                    {canEdit && (
                      <th className="text-center py-4 px-4 text-white font-semibold text-sm">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {/* Usar tarefasPorEntrega - tarefas carregadas do banco de dados (ordenadas alfabeticamente) */}
                  {[...(tarefasPorEntrega[entregaSelecionada.id] || [])]
                    .sort((a, b) =>
                      (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
                    )
                    .map((tarefa) => (
                      <tr
                        key={tarefa.id}
                        className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0"
                      >
                        <td className="py-3 px-4 text-gray-900 text-sm">
                          {tarefa.nome}
                        </td>
                        <td className="py-3 px-4 text-gray-900 text-sm text-center">
                          {getSprintNome(tarefa.sprint_id)}
                        </td>
                        <td className="py-3 px-4 text-gray-900 text-sm text-center">
                          {tarefa.responsavel || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <Select
                            value={tarefa.status || "a_fazer"}
                            onValueChange={(value) =>
                              handleAtualizarStatusTarefaEntrega(
                                tarefa.id,
                                value,
                              )
                            }
                          >
                            <SelectTrigger
                              className="w-[160px] h-7 text-xs bg-gray-100 text-slate-700 font-medium rounded-md border border-gray-200/50 shadow-none hover:bg-gray-200 transition-colors"
                              style={{
                                marginLeft: "60%",
                                transform: "translateX(-50%)",
                              }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="a_fazer">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                                  <span>A Fazer</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="fazendo">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                                  <span>Em Andamento</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="feito">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500" />
                                  <span>Feito</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        {canEdit && (
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() =>
                                  handleAbrirModalTarefaEntrega(tarefa)
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setItemParaDeletar({
                                    tipo: "tarefaEntrega",
                                    id: tarefa.id,
                                    nome: tarefa.nome,
                                  });
                                  setModalConfirmDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTelaPlanoProjetos = () => {
    if (!planoSelecionado || !instrumentoDetalhes) return null;

    return (
      <div className="space-y-6">
        {/* Header com botão voltar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleVoltarParaPlanos}
              variant="ghost"
              className="text-gray-600 hover:bg-gray-100"
              size="sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2d7a5e] to-[#1d5a4e] flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-gray-900 font-bold text-xl">
                  {instrumentoDetalhes.nome}
                </h2>
                <p className="text-gray-500 text-sm">
                  {tipoLabels[instrumentoDetalhes.tipo]} •{" "}
                  {instrumentoDetalhes.versao}
                </p>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:bg-gray-100"
              >
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </div>
          )}
        </div>

        {/* Informações do Instrumento */}
        <div className="bg-gray-200 rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {instrumentoDetalhes.objetivo && (
              <div className="md:col-span-3">
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1 font-bold">
                  Objetivo
                </p>
                <p className="text-gray-900 text-base">
                  {instrumentoDetalhes.objetivo}
                </p>
              </div>
            )}
            {instrumentoDetalhes.ambito_institucional && (
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1 font-bold">
                  Âmbito
                </p>
                <p className="text-gray-900 text-base">
                  {instrumentoDetalhes.ambito_institucional}
                </p>
              </div>
            )}
            {instrumentoDetalhes.responsavel_institucional && (
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1 font-bold">
                  Responsável
                </p>
                <p className="text-gray-900 text-base">
                  {instrumentoDetalhes.responsavel_institucional}
                </p>
              </div>
            )}
            {(instrumentoDetalhes.periodo_vigencia_inicio ||
              instrumentoDetalhes.periodo_vigencia_fim) && (
                <div>
                  <p className="text-gray-500 text-sm uppercase tracking-wider mb-1 font-bold">
                    Vigência
                  </p>
                  <p className="text-gray-900 text-base">
                    {instrumentoDetalhes.periodo_vigencia_inicio
                      ? new Date(
                        instrumentoDetalhes.periodo_vigencia_inicio,
                      ).toLocaleDateString("pt-BR")
                      : "?"}
                    {" → "}
                    {instrumentoDetalhes.periodo_vigencia_fim
                      ? new Date(
                        instrumentoDetalhes.periodo_vigencia_fim,
                      ).toLocaleDateString("pt-BR")
                      : "?"}
                  </p>
                </div>
              )}
          </div>

          {/* Botão Exibir informações completas */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Button
              onClick={() => setModalInfoCompletaOpen(true)}
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Eye className="h-4 w-4 mr-2" />
              Exibir informações completas
            </Button>
          </div>
        </div>

        {/* Projetos Vinculados */}
        <div className="bg-gray-200 rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <FolderKanban className="h-5 w-5 text-[#2d7a5e]" />
            <h3 className="text-gray-900 font-semibold">
              Projetos Vinculados
              <Badge className="ml-2 bg-gray-100 text-gray-700 border-0">
                {projetosFiltrados.length}
              </Badge>
            </h3>
          </div>

          {loadingPlano ? (
            <div className="text-center py-12 text-gray-500">
              Carregando projetos...
            </div>
          ) : projetosFiltrados.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">
                Nenhum projeto vinculado a este plano/programa para esta
                diretoria.
              </p>
              <p className="text-xs mt-2">
                Vincule projetos em Cadastros → Projetos com área de execução
                desta diretoria.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {projetosFiltrados.map((projeto) => {
                const areasExecucao =
                  projeto.diretorias_nomes?.split(", ").filter(Boolean) || [];

                return (
                  <div
                    key={projeto.id}
                    onClick={() => handleVerProjetoDetalhes(projeto.id)}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
                          <FolderKanban className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-gray-900 font-medium group-hover:text-[#2d7a5e] transition-colors">
                              {projeto.nome}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge
                              className={`${statusProjetoColors[projeto.status || "planejado"]} border-0 text-xs`}
                            >
                              {
                                statusProjetoLabels[
                                projeto.status || "planejado"
                                ]
                              }
                            </Badge>
                            {(() => {
                              const tap = getTapStatusLocal(projeto);
                              return (
                                <Badge
                                  className={`${tap.color} border-0 text-xs cursor-pointer hover:opacity-80`}
                                  onClick={(e) => handleTapClick(e, projeto)}
                                >
                                  {tap.label}
                                </Badge>
                              );
                            })()}
                            {areasExecucao.length > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-xs border-blue-200 text-blue-700"
                              >
                                {areasExecucao.join(", ")}
                              </Badge>
                            )}
                          </div>
                          {projeto.gestor_nome && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                              <User className="h-3 w-3" />
                              {projeto.gestor_nome}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Instrumentos Subordinados */}
        {instrumentoDetalhes.instrumentos_subordinados &&
          instrumentoDetalhes.instrumentos_subordinados.length > 0 && (
            <div className="bg-gray-200 rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <ChevronRight className="h-5 w-5 text-purple-500" />
                <h3 className="text-gray-900 font-semibold">
                  Instrumentos Subordinados
                  <Badge className="ml-2 bg-purple-100 text-purple-700 border-0">
                    {instrumentoDetalhes.instrumentos_subordinados.length}
                  </Badge>
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {instrumentoDetalhes.instrumentos_subordinados.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => handleSelecionarInstrumento(sub)}
                    className="bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-lg p-4 text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-gray-800 font-medium">{sub.nome}</p>
                        <p className="text-gray-500 text-xs">
                          {tipoLabels[sub.tipo]}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
      </div>
    );
  };

  // ============================================================
  // RENDER - MODAIS
  // ============================================================

  const renderModais = () => (
    <>
      {/* Modal Criar Plano */}
      <Dialog open={modalPlanoOpen} onOpenChange={setModalPlanoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Plano/Programa</DialogTitle>
            <DialogDescription>
              Digite o nome do novo plano ou programa estratégico.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="nomePlano">Nome do Plano/Programa</Label>
            <Input
              id="nomePlano"
              value={novoPlanoNome}
              onChange={(e) => setNovoPlanoNome(e.target.value)}
              placeholder="Ex: PCA-TIC 2026"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPlanoOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCriarPlano}
              className="bg-[#5A8A7A] hover:bg-[#4A7A6A]"
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar/Editar Projeto */}
      <Dialog
        open={modalProjetoOpen}
        onOpenChange={(open) => {
          if (!open) {
            setProjetoEditando(null);
            setNovoProjetoNome("");
          }
          setModalProjetoOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {projetoEditando ? "Editar KR/Projeto" : "Criar KR/Projeto"}
            </DialogTitle>
            <DialogDescription>
              {projetoEditando ? (
                "Altere o nome do projeto abaixo."
              ) : (
                <>
                  Este projeto será vinculado ao plano:{" "}
                  <strong>{planoSelecionado?.nome}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="nomeProjeto">Nome do KR/PROJETO</Label>
            <Input
              id="nomeProjeto"
              value={novoProjetoNome}
              onChange={(e) => setNovoProjetoNome(e.target.value)}
              placeholder="Ex: Projeto Piscina de Dados"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalProjetoOpen(false);
                setProjetoEditando(null);
                setNovoProjetoNome("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={
                projetoEditando ? handleEditarProjeto : handleCriarProjeto
              }
              className="bg-[#5A8A7A] hover:bg-[#4A7A6A]"
            >
              {projetoEditando ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar/Editar Tarefa */}
      <Dialog open={modalTarefaOpen} onOpenChange={setModalTarefaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tarefaEditando ? "Editar Tarefa" : "Criar Tarefa"}
            </DialogTitle>
            <DialogDescription>
              {tarefaEditando
                ? "Edite as informações da tarefa."
                : "Esta tarefa será adicionada ao projeto selecionado."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="nomeTarefa">Nome da Tarefa</Label>
              <Input
                id="nomeTarefa"
                value={novaTarefaNome}
                onChange={(e) => setNovaTarefaNome(e.target.value)}
                placeholder="Ex: Implementar módulo X"
                className="mt-2"
              />
            </div>
            {tarefaEditando && (
              <>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={tarefaEditando.status}
                    onValueChange={(value) =>
                      setTarefaEditando({
                        ...tarefaEditando,
                        status: value as GestaoTarefaStatus,
                      })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sprint_atual">Sprint Atual</SelectItem>
                      <SelectItem value="fora_sprint">
                        Fora da Sprint
                      </SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Progresso</Label>
                  <Select
                    value={tarefaEditando.progresso}
                    onValueChange={(value) =>
                      setTarefaEditando({
                        ...tarefaEditando,
                        progresso: value as GestaoTarefaProgresso,
                      })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_fazer">A Fazer</SelectItem>
                      <SelectItem value="fazendo">Fazendo</SelectItem>
                      <SelectItem value="feito">Feito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalTarefaOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarTarefa}
              className="bg-[#5A8A7A] hover:bg-[#4A7A6A]"
            >
              {tarefaEditando ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog
        open={modalConfirmDeleteOpen}
        onOpenChange={setModalConfirmDeleteOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              {itemParaDeletar?.tipo === "plano" && (
                <>
                  Deseja realmente excluir o plano{" "}
                  <strong>"{itemParaDeletar.nome}"</strong>?
                  <br />
                  <span className="text-red-500">
                    Todos os projetos e tarefas vinculados também serão
                    excluídos.
                  </span>
                </>
              )}
              {itemParaDeletar?.tipo === "projeto" && (
                <>
                  Deseja realmente excluir o projeto{" "}
                  <strong>"{itemParaDeletar.nome}"</strong>?
                  <br />
                  <span className="text-red-500">
                    Todas as tarefas vinculadas também serão excluídas.
                  </span>
                </>
              )}
              {itemParaDeletar?.tipo === "tarefa" && (
                <>
                  Deseja realmente excluir a tarefa{" "}
                  <strong>"{itemParaDeletar.nome}"</strong>?
                  <br />
                  <span className="text-gray-500">
                    Esta ação não pode ser desfeita.
                  </span>
                </>
              )}
              {itemParaDeletar?.tipo === "tarefaEntrega" && (
                <>
                  Deseja realmente excluir a tarefa{" "}
                  <strong>"{itemParaDeletar.nome}"</strong>?
                  <br />
                  <span className="text-gray-500">
                    Esta ação não pode ser desfeita.
                  </span>
                </>
              )}
              {itemParaDeletar?.tipo === "entrega" && (
                <>
                  Deseja realmente excluir a entrega{" "}
                  <strong>"{itemParaDeletar.nome}"</strong>?
                  <br />
                  <span className="text-red-500">
                    Todas as tarefas e a evidência vinculadas também serão
                    excluídas.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalConfirmDeleteOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmarExclusao}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar/Editar Tarefa de Entrega */}
      <Dialog
        open={modalTarefaEntregaOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTarefaEntregaEditando(null);
            setNovaTarefaEntrega({
              nome: "",
              sprint_id: "",
              responsavel: "",
              status: "a_fazer",
            });
          }
          setModalTarefaEntregaOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tarefaEntregaEditando ? "Editar Tarefa" : "Nova Tarefa"}
            </DialogTitle>
            <DialogDescription>
              {tarefaEntregaEditando
                ? "Edite as informações da tarefa abaixo."
                : "Preencha os dados da nova tarefa."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="nomeTarefaEntrega">Nome da Tarefa</Label>
              <Input
                id="nomeTarefaEntrega"
                value={novaTarefaEntrega.nome}
                onChange={(e) =>
                  setNovaTarefaEntrega((prev) => ({
                    ...prev,
                    nome: e.target.value,
                  }))
                }
                placeholder="Ex: Implementar módulo X"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Sprint</Label>
              <Select
                value={novaTarefaEntrega.sprint_id || "a-definir"}
                onValueChange={(value) =>
                  setNovaTarefaEntrega((prev) => ({
                    ...prev,
                    sprint_id: value === "a-definir" ? "" : value,
                  }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione o sprint" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="a-definir">A definir</SelectItem>
                  {sprintsDisponiveis.map((sprint) => (
                    <SelectItem key={sprint.id} value={String(sprint.id)}>
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
            <div>
              <Label>Responsável pela execução</Label>
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
                    className="w-full mt-2 justify-between font-normal"
                  >
                    {novaTarefaEntrega.responsavel || "Selecione o responsável"}
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
                            setNovaTarefaEntrega((prev) => ({
                              ...prev,
                              responsavel: "",
                            }));
                            setResponsavelPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !novaTarefaEntrega.responsavel
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          Sem responsável
                        </CommandItem>
                        {usuarios.map((usuario) => (
                          <CommandItem
                            key={usuario.id}
                            value={usuario.name}
                            onSelect={() => {
                              setNovaTarefaEntrega((prev) => ({
                                ...prev,
                                responsavel: usuario.name,
                              }));
                              setResponsavelPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                novaTarefaEntrega.responsavel === usuario.name
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
            <div>
              <Label>Status</Label>
              <Select
                value={novaTarefaEntrega.status}
                onValueChange={(value) =>
                  setNovaTarefaEntrega((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
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
              onClick={() => {
                setModalTarefaEntregaOpen(false);
                setTarefaEntregaEditando(null);
                setNovaTarefaEntrega({
                  nome: "",
                  sprint_id: "",
                  responsavel: "",
                  status: "a_fazer",
                });
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarTarefaEntrega}
              className="bg-[#5A8A7A] hover:bg-[#4A7A6A]"
            >
              {tarefaEntregaEditando ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // ============================================================
  // RENDER - MODAL DE INFORMAÇÕES COMPLETAS
  // ============================================================

  const renderModalInfoCompleta = () => {
    if (!instrumentoDetalhes) return null;

    return (
      <Dialog
        open={modalInfoCompletaOpen}
        onOpenChange={setModalInfoCompletaOpen}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2d7a5e] to-[#1d5a4e] flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="block">{instrumentoDetalhes.nome}</span>
                <span className="text-sm font-normal text-gray-500">
                  {tipoLabels[instrumentoDetalhes.tipo]} •{" "}
                  {instrumentoDetalhes.versao}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* SEÇÃO: IDENTIFICAÇÃO */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-blue-900">
                  Identificação do Instrumento
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Nome
                    </p>
                    <p className="text-gray-900 font-medium">
                      {instrumentoDetalhes.nome}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Tipo
                    </p>
                    <p className="text-gray-900">
                      {tipoLabels[instrumentoDetalhes.tipo]}
                    </p>
                  </div>
                </div>
                {instrumentoDetalhes.objetivo && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Objetivo
                    </p>
                    <p className="text-gray-900">
                      {instrumentoDetalhes.objetivo}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Período de Vigência
                    </p>
                    <p className="text-gray-900">
                      {instrumentoDetalhes.periodo_vigencia_inicio
                        ? new Date(
                          instrumentoDetalhes.periodo_vigencia_inicio,
                        ).toLocaleDateString("pt-BR")
                        : "Não definido"}
                      {" → "}
                      {instrumentoDetalhes.periodo_vigencia_fim
                        ? new Date(
                          instrumentoDetalhes.periodo_vigencia_fim,
                        ).toLocaleDateString("pt-BR")
                        : "Não definido"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Versão
                    </p>
                    <p className="text-gray-900">
                      {instrumentoDetalhes.versao || "v1.0"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO: VINCULAÇÃO INSTITUCIONAL */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 px-4 py-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-900">
                  Vinculação Institucional
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Âmbito Institucional
                    </p>
                    <p className="text-gray-900">
                      {instrumentoDetalhes.ambito_institucional ||
                        "Não definido"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      <User className="h-3 w-3 inline mr-1" />
                      Responsável Institucional
                    </p>
                    <p className="text-gray-900">
                      {instrumentoDetalhes.responsavel_institucional ||
                        "Não definido"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Instrumento Superior
                  </p>
                  <p className="text-gray-900">
                    {instrumentoDetalhes.instrumento_superior_nome ||
                      "Nenhum (instrumento raiz)"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Projetos Vinculados
                  </p>
                  <p className="text-gray-900">
                    {instrumentoDetalhes.projetos_nomes ||
                      "Nenhum projeto vinculado"}
                  </p>
                </div>
                {instrumentoDetalhes.total_instrumentos_subordinados &&
                  instrumentoDetalhes.total_instrumentos_subordinados > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Instrumentos Subordinados
                      </p>
                      <p className="text-gray-900">
                        {instrumentoDetalhes.total_instrumentos_subordinados}{" "}
                        instrumento(s)
                      </p>
                    </div>
                  )}
              </div>
            </div>

            {/* SEÇÃO: FORMALIZAÇÃO */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-amber-900">
                  Formalização
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Documento de Formalização
                  </p>
                  {instrumentoDetalhes.documento_formalizacao ? (
                    <a
                      href={instrumentoDetalhes.documento_formalizacao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {instrumentoDetalhes.documento_formalizacao}
                    </a>
                  ) : (
                    <p className="text-gray-900">Não definido</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Histórico de Alterações
                  </p>
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {instrumentoDetalhes.historico_alteracoes ||
                      "Nenhum histórico registrado"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Observações Gerais
                  </p>
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {instrumentoDetalhes.observacoes_gerais ||
                      "Nenhuma observação"}
                  </p>
                </div>
              </div>
            </div>

            {/* SEÇÃO: METADADOS */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <span className="font-semibold text-gray-900">Metadados</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Diretoria
                    </p>
                    <p className="text-gray-900">
                      {instrumentoDetalhes.diretoria}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Criado em
                    </p>
                    <p className="text-gray-900">
                      {new Date(instrumentoDetalhes.created_at).toLocaleString(
                        "pt-BR",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Atualizado em
                    </p>
                    <p className="text-gray-900">
                      {new Date(instrumentoDetalhes.updated_at).toLocaleString(
                        "pt-BR",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button onClick={() => setModalInfoCompletaOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const renderModalProjetoInfoCompleta = () => {
    if (!projetoDetalhes) return null;

    return (
      <Dialog
        open={modalProjetoInfoCompletaOpen}
        onOpenChange={setModalProjetoInfoCompletaOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
                <FolderKanban className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="block">{projetoDetalhes.nome}</span>
                <span className="text-sm font-normal text-gray-500">
                  {projetoDetalhes.codigo} •{" "}
                  {statusProjetoLabels[projetoDetalhes.status]}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* SEÇÃO: IDENTIFICAÇÃO */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-blue-900">
                  Identificação do Projeto
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Nome
                    </p>
                    <p className="text-gray-900 font-medium">
                      {projetoDetalhes.nome}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Código
                    </p>
                    <p className="text-gray-900 font-mono">
                      {projetoDetalhes.codigo}
                    </p>
                  </div>
                </div>
                {projetoDetalhes.descricao_sintetica && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Descrição Sintética
                    </p>
                    <p className="text-gray-900">
                      {projetoDetalhes.descricao_sintetica}
                    </p>
                  </div>
                )}
                {projetoDetalhes.objetivo && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Objetivo
                    </p>
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {projetoDetalhes.objetivo}
                    </p>
                  </div>
                )}
                {projetoDetalhes.contexto_justificativa && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Contexto / Justificativa
                    </p>
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {projetoDetalhes.contexto_justificativa}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO: GOVERNANÇA */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-purple-50 px-4 py-3 flex items-center gap-2">
                <User className="h-4 w-4 text-purple-600" />
                <span className="font-semibold text-purple-900">
                  Governança e Responsáveis
                </span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Patrocinador
                    </p>
                    <p className="text-gray-900">
                      {projetoDetalhes.patrocinador_nome || "Não definido"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Gestor
                    </p>
                    <p className="text-gray-900">
                      {projetoDetalhes.gestor_nome || "Não definido"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Diretoria
                    </p>
                    <p className="text-gray-900">
                      {projetoDetalhes.diretoria || "Não definido"}
                    </p>
                  </div>
                </div>
                {projetoDetalhes.areas_execucao_diretorias && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Áreas de Execução
                    </p>
                    <p className="text-gray-900">
                      {projetoDetalhes.areas_execucao_diretorias}
                    </p>
                  </div>
                )}
                {projetoDetalhes.instrumentos_nomes && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Ancoragem Estratégica
                    </p>
                    <p className="text-gray-900">
                      {projetoDetalhes.instrumentos_nomes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO: TEMPORALIDADE E CLASSIFICAÇÃO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-4 py-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-900">
                    Temporalidade
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Início Previsto
                      </p>
                      <p className="text-gray-900">
                        {projetoDetalhes.data_prevista_inicio
                          ? new Date(
                            projetoDetalhes.data_prevista_inicio,
                          ).toLocaleDateString("pt-BR")
                          : "Não definido"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Conclusão Prevista
                      </p>
                      <p className="text-gray-900">
                        {projetoDetalhes.data_prevista_conclusao
                          ? new Date(
                            projetoDetalhes.data_prevista_conclusao,
                          ).toLocaleDateString("pt-BR")
                          : "Não definido"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Status
                    </p>
                    <Badge
                      className={statusProjetoColors[projetoDetalhes.status]}
                    >
                      {statusProjetoLabels[projetoDetalhes.status]}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-orange-50 px-4 py-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  <span className="font-semibold text-orange-900">
                    Classificação
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Prioridade
                      </p>
                      <p className="text-gray-900">
                        {prioridadeLabels[projetoDetalhes.prioridade] ||
                          projetoDetalhes.prioridade}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Complexidade
                      </p>
                      <p className="text-gray-900">
                        {complexidadeLabels[projetoDetalhes.complexidade] ||
                          projetoDetalhes.complexidade}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Haverá Contratação?
                      </p>
                      <Badge
                        className={
                          projetoDetalhes.havera_contratacao
                            ? "bg-emerald-100 text-emerald-700 border-0"
                            : "bg-gray-100 text-gray-700 border-0"
                        }
                      >
                        {projetoDetalhes.havera_contratacao ? "Sim" : "Não"}
                      </Badge>
                    </div>
                    {projetoDetalhes.havera_contratacao && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                          Valor Estimado
                        </p>
                        <p className="text-gray-900 font-medium">
                          {projetoDetalhes.valor_estimado_contratacao != null
                            ? Number(
                              projetoDetalhes.valor_estimado_contratacao,
                            ).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                            : "Não informado"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO: EXECUÇÃO E SAÚDE */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-amber-900">
                  Execução e Saúde
                </span>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Saúde do Projeto
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${projetoDetalhes.saude === "verde"
                            ? "bg-green-500"
                            : projetoDetalhes.saude === "amarelo"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                      />
                      <span className="font-medium">
                        {saudeLabels[projetoDetalhes.saude] ||
                          projetoDetalhes.saude}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Progresso
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${projetoDetalhes.progresso_percentual}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-bold">
                        {projetoDetalhes.progresso_percentual}%
                      </span>
                    </div>
                  </div>
                </div>
                {projetoDetalhes.saude_justificativa && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Justificativa da Saúde
                    </p>
                    <p className="text-gray-900">
                      {projetoDetalhes.saude_justificativa}
                    </p>
                  </div>
                )}
                {projetoDetalhes.saude_ultima_revisao && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Última Revisão da Saúde
                    </p>
                    <p className="text-gray-900">
                      {new Date(
                        projetoDetalhes.saude_ultima_revisao,
                      ).toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO: ESCOPO */}
            {(projetoDetalhes.escopo_sintetico ||
              projetoDetalhes.fora_do_escopo) && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-cyan-50 px-4 py-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-cyan-600" />
                    <span className="font-semibold text-cyan-900">Escopo</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {projetoDetalhes.escopo_sintetico && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                          Escopo Sintético
                        </p>
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {projetoDetalhes.escopo_sintetico}
                        </p>
                      </div>
                    )}
                    {projetoDetalhes.fora_do_escopo && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                          Fora do Escopo
                        </p>
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {projetoDetalhes.fora_do_escopo}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* SEÇÃO: ANCORAGEM ESTRATÉGICA */}
            {(projetoDetalhes.ancoragem_estrategica_plano_gestao ||
              projetoDetalhes.ancoragem_estrategica_pep ||
              projetoDetalhes.ancoragem_estrategica_programa_x) && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-indigo-50 px-4 py-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-indigo-600" />
                    <span className="font-semibold text-indigo-900">
                      Ancoragem Estratégica
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {projetoDetalhes.ancoragem_estrategica_plano_gestao && (
                        <Badge className="bg-indigo-100 text-indigo-700 border-0">
                          Plano de Gestão
                        </Badge>
                      )}
                      {projetoDetalhes.ancoragem_estrategica_pep && (
                        <Badge className="bg-indigo-100 text-indigo-700 border-0">
                          PEP
                        </Badge>
                      )}
                      {projetoDetalhes.ancoragem_estrategica_programa_x && (
                        <Badge className="bg-indigo-100 text-indigo-700 border-0">
                          Programa X
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* SEÇÃO: TAP — STATUS DETALHADO */}
            {projetoDetalhes.tap_id && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-rose-50 px-4 py-3 flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-rose-600" />
                  <span className="font-semibold text-rose-900">
                    TAP — Termo de Abertura
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Versão
                      </p>
                      <p className="text-gray-900 font-mono">
                        v{projetoDetalhes.tap_versao || 1}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Gerado em
                      </p>
                      <p className="text-gray-900">
                        {projetoDetalhes.tap_gerado_em
                          ? new Date(
                            projetoDetalhes.tap_gerado_em,
                          ).toLocaleString("pt-BR")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Identificador
                      </p>
                      <p className="text-gray-900 font-mono text-sm">
                        {projetoDetalhes.tap_id}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div
                      className={`rounded-md border px-3 py-2 ${projetoDetalhes.tap_validado_gestor_em ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}
                    >
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Gestor
                      </p>
                      <p
                        className={`text-sm font-medium ${projetoDetalhes.tap_validado_gestor_em ? "text-emerald-700" : "text-gray-500"}`}
                      >
                        {projetoDetalhes.tap_validado_gestor_em
                          ? new Date(
                            projetoDetalhes.tap_validado_gestor_em,
                          ).toLocaleString("pt-BR")
                          : "Pendente"}
                      </p>
                    </div>
                    <div
                      className={`rounded-md border px-3 py-2 ${projetoDetalhes.tap_validado_diretor_em ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}
                    >
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Diretor
                      </p>
                      <p
                        className={`text-sm font-medium ${projetoDetalhes.tap_validado_diretor_em ? "text-emerald-700" : "text-gray-500"}`}
                      >
                        {projetoDetalhes.tap_validado_diretor_em
                          ? new Date(
                            projetoDetalhes.tap_validado_diretor_em,
                          ).toLocaleString("pt-BR")
                          : "Pendente"}
                      </p>
                    </div>
                    <div
                      className={`rounded-md border px-3 py-2 ${projetoDetalhes.tap_validado_patrocinador_em ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}
                    >
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Patrocinador
                      </p>
                      <p
                        className={`text-sm font-medium ${projetoDetalhes.tap_validado_patrocinador_em ? "text-emerald-700" : "text-gray-500"}`}
                      >
                        {projetoDetalhes.tap_validado_patrocinador_em
                          ? new Date(
                            projetoDetalhes.tap_validado_patrocinador_em,
                          ).toLocaleString("pt-BR")
                          : "Pendente"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SEÇÃO: FORMALIZAÇÃO E OBSERVAÇÕES */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-gray-600" />
                <span className="font-semibold text-gray-900">
                  Formalização e Observações
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    TAP Vinculado
                  </p>
                  <p className="text-gray-900">
                    {projetoDetalhes.tap_vinculado || "Não definido"}
                  </p>
                </div>
                {projetoDetalhes.observacoes_gerais && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Observações Gerais
                    </p>
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {projetoDetalhes.observacoes_gerais}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO: AUDITORIA */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-600" />
                <span className="font-semibold text-slate-900">Auditoria</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Cadastrado em
                    </p>
                    <p className="text-gray-900 text-sm">
                      {projetoDetalhes.created_at
                        ? new Date(projetoDetalhes.created_at).toLocaleString(
                          "pt-BR",
                        )
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Última Atualização
                    </p>
                    <p className="text-gray-900 text-sm">
                      {projetoDetalhes.updated_at
                        ? new Date(projetoDetalhes.updated_at).toLocaleString(
                          "pt-BR",
                        )
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setModalProjetoInfoCompletaOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================

  // Determinar qual tela renderizar
  const renderConteudoPrincipal = () => {
    if (loadingProjeto) {
      return (
        <div className="text-center py-12 text-gray-500">
          Carregando projeto...
        </div>
      );
    }
    // Tela de detalhes da entrega (tarefas) — bloqueada em produção
    if (entregaSelecionada && projetoDetalhes && !isProduction()) {
      return renderTelaEntregaDetalhes();
    }
    // Tela de detalhes do projeto (entregas)
    if (projetoDetalhes) {
      return renderTelaProjetoDetalhes();
    }
    // Tela principal com filtros de planos e lista de projetos
    return renderTelaPlanos();
  };

  return (
    <div className="flex gap-6">
      {/* Área Principal */}
      <div className="flex-1 min-w-0">{renderConteudoPrincipal()}</div>

      {/* Modais */}
      {renderModais()}
      {renderModalInfoCompleta()}
      {renderModalProjetoInfoCompleta()}
      {renderModalNovaEntrega()}
      {renderModalEditEntrega()}

      {/* Dialog TAP */}
      <Dialog open={tapDialogOpen} onOpenChange={setTapDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Status do TAP
            </DialogTitle>
          </DialogHeader>
          {tapDialogProjeto &&
            (() => {
              const tap = getTapStatusLocal(tapDialogProjeto);
              const isGestor =
                currentUserId &&
                tapDialogProjeto.gestor_user_id === currentUserId;
              const isPatrocinador =
                currentUserId &&
                tapDialogProjeto.patrocinador_user_id === currentUserId;
              const hasPreviousTap = !!tapDialogProjeto.tap_id; // Já teve versão vigente antes

              return (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{tapDialogProjeto.nome}</span>
                  </p>

                  {tap.label === "Pendente" && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700">
                        Projeto com pendências de informações no cadastro.
                      </p>
                    </div>
                  )}

                  {tap.label === "Proposta" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        Projeto pendente de validação pelo gestor.
                      </p>
                      {isGestor && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              generateTAPPdf(tapDialogProjeto);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Visualizar TAP
                          </Button>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => { }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                            como Gestor
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {tap.label === "Validado 1/3" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        Projeto pendente de validação pelo diretor.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            generateTAPPdf(tapDialogProjeto);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Visualizar TAP
                        </Button>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => { }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Validar como
                          Diretor
                        </Button>
                      </div>
                    </div>
                  )}

                  {tap.label === "Validado 2/3" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        Projeto pendente de validação pelo patrocinador.
                      </p>
                      {isPatrocinador && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              generateTAPPdf(tapDialogProjeto);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Visualizar TAP
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                            como Patrocinador
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <Badge className={`${tap.color} text-sm`}>{tap.label}</Badge>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* TEP - Termo de Encerramento do Projeto (apenas superadmin) */}
      {projetoDetalhes && (
        <TepDialog
          open={showTepDialog}
          onOpenChange={setShowTepDialog}
          projeto={projetoDetalhes}
          entregas={projetoDetalhes.entregas || []}
          onFinalized={async () => {
            try {
              const updated = await cadastrosProjetosApi.getProjetoById(
                projetoDetalhes.id,
              );
              setProjetoDetalhes(updated);
              setTodosProjetos((prev) =>
                prev.map((p) =>
                  p.id === updated.id ? { ...p, ...updated } : p,
                ),
              );
            } catch {
              /* erro já tratado pelo apiClient ou ignorado intencionalmente */
            }
          }}
        />
      )}

      {/* TEP - Fluxo de clique direto no badge da tabela: dialog estilo TAP, mostrando
          as fases de validação e o botão "Validar como X" pra quem tem permissão. */}
      <Dialog
        open={tepDialogOpen}
        onOpenChange={(open) => {
          setTepDialogOpen(open);
          if (!open) setTepDialogProjeto(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Status do TEP
            </DialogTitle>
          </DialogHeader>
          {tepDialogProjeto &&
            (() => {
              const tep = getTepStatusLocal(tepDialogProjeto);
              const p = tepDialogProjeto as any;
              const isGestor =
                currentUserId &&
                tepDialogProjeto.gestor_user_id === currentUserId;
              const isPatrocinador =
                currentUserId &&
                tepDialogProjeto.patrocinador_user_id === currentUserId;

              const refreshAfterValidate = async () => {
                const updated = await cadastrosProjetosApi.getProjetoById(
                  tepDialogProjeto.id,
                );
                setTepDialogProjeto(updated);
                cadastrosProjetosApi
                  .getProjetos(dirFiltro)
                  .then(setTodosProjetos);
              };

              const visualizarTepPdf = async () => {
                const tepData = await cadastrosProjetosApi
                  .getTep(tepDialogProjeto.id)
                  .catch(() => null);
                if (tepData)
                  generateTEPPdf(
                    tepDialogProjeto,
                    tepData,
                    tepDialogProjeto.entregas || [],
                  );
              };

              return (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{tepDialogProjeto.nome}</span>
                  </p>

                  {tep.label === "Não iniciado" && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700">
                        TEP ainda não foi iniciado. Acesse o projeto para gerar
                        o termo de encerramento.
                      </p>
                    </div>
                  )}

                  {tep.label === "Em validação" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        TEP pendente de validação pelo gestor.
                      </p>
                      {isGestor && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={visualizarTepPdf}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Visualizar TEP
                          </Button>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => { }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                            como Gestor
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {tep.label === "Validado 1/3" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        TEP pendente de validação pelo diretor.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={visualizarTepPdf}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Visualizar TEP
                        </Button>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => { }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Validar como
                          Diretor
                        </Button>
                      </div>
                    </div>
                  )}

                  {tep.label === "Validado 2/3" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        TEP pendente de validação pelo patrocinador.
                      </p>
                      {isPatrocinador && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={visualizarTepPdf}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Visualizar TEP
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                            como Patrocinador
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <Badge className={`${tep.color} text-sm`}>{tep.label}</Badge>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Edição completa do Projeto (mesmos campos de Cadastros / Projetos) */}
      {projetoDetalhes && (
        <ProjetoFormDialog
          open={projetoEditDialogOpen}
          onOpenChange={(open) => {
            setProjetoEditDialogOpen(open);
            if (!open) setProjetoEditDialogTapMode(false);
          }}
          mode={projetoEditDialogMode}
          onModeChange={setProjetoEditDialogMode}
          slim={projetoEditDialogSlim}
          tapEditMode={projetoEditDialogTapMode}
          tapEditDiretoria={permissaoTap?.diretoria ?? null}
          projetoId={projetoDetalhes.id}
          diretoria={selectedDirectorate || projetoDetalhes.diretoria}
          onSaved={async (projetoSalvo) => {
            try {
              const updated = await cadastrosProjetosApi.getProjetoById(
                projetoSalvo.id,
              );
              setProjetoDetalhes(updated);
              setTodosProjetos((prev) =>
                prev.map((p) =>
                  p.id === updated.id ? { ...p, ...updated } : p,
                ),
              );
            } catch {
              /* erro já tratado pelo apiClient ou ignorado intencionalmente */
            }
          }}
        />
      )}
    </div>
  );
}
