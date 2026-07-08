import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { VoltarCadastros } from "@/components/ui/VoltarCadastros";
import { isProduction } from "@/utils/environment";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Calendar,
  Users,
  Target,
  AlertTriangle,
  FileText,
  ArrowLeft,
  ChevronDown,
  Package,
  Pencil,
  Upload,
  FileDown,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  cadastrosProjetosApi,
  Projeto,
  CreateProjetoDto,
  Colaborador,
  Area,
  CreateEntregaDto,
  CreateRiscoDto,
  CreateEntraveDto,
  TarefaEntrega,
  CreateTarefaEntregaDto,
} from "@/services/cadastrosProjetosApi";
import {
  planosProgramasApi,
  InstrumentoAncoragem,
} from "@/services/planosProgramasApi";
import { areasApi, Area as AreaDiretoria, Unidade } from "@/services/areasApi";
import { generateTAPPdf, validateTAPFields } from "@/utils/generateTAP";
import {
  getTodosSprints,
  Sprint,
  formatarPeriodoSprint,
} from "@/services/sprintsApi";
import { getUsers } from "@/services/api";
import type { User as UserType } from "@/types";
import {
  permissoesTapApi,
  type MinhaPermissaoTap,
} from "@/services/permissoesTapApi";

// ============================================================
// HELPERS
// ============================================================

// Formatar data para input type="date" (YYYY-MM-DD)
const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
};

// Formatar data ISO (vinda do Postgres DATE) para exibição pt-BR sem deslocamento de fuso
const formatDatePtBr = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  const ymd = dateString.substring(0, 10);
  const date = new Date(ymd + "T00:00:00");
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
};

const statusLabels: Record<string, string> = {
  planejado: "Planejado",
  em_execucao: "Em Execução",
  suspenso: "Suspenso",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const statusColors: Record<string, string> = {
  planejado: "bg-blue-100 text-blue-800",
  em_execucao: "bg-green-100 text-green-800",
  suspenso: "bg-yellow-100 text-yellow-800",
  concluido: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-red-100 text-red-800",
};

const saudeColors: Record<string, string> = {
  verde: "bg-green-500",
  amarelo: "bg-yellow-500",
  vermelho: "bg-red-500",
};

const saudeLabels: Record<string, string> = {
  verde: "Saudável",
  amarelo: "Atenção",
  vermelho: "Crítico",
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

// Função para extrair sigla do nome da diretoria
const extrairSigla = (nome: string): string => {
  const match = nome.match(/\(([^)]+)\)/);
  return match ? match[1] : nome;
};

// ============================================================
// HELPER: Status do TAP
// ============================================================
function getTapStatus(projeto: Projeto): {
  label: string;
  color: string;
  step: number;
} {
  // Verificar requisitos do TAP - usar contadores da view quando entregas/instrumentos não estão carregados
  const hasEntregas =
    (projeto.entregas && projeto.entregas.length > 0) ||
    (projeto.total_entregas && Number(projeto.total_entregas) > 0);
  const hasInstrumentos =
    (projeto.instrumentos && projeto.instrumentos.length > 0) ||
    (projeto.total_instrumentos && Number(projeto.total_instrumentos) > 0);

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

  if (!valid) {
    return { label: "Pendente", color: "bg-gray-400 text-white", step: 0 };
  }
  if (projeto.tap_validado_patrocinador_em) {
    return { label: "TAP Vigente", color: "bg-green-600 text-white", step: 3 };
  }
  if (projeto.tap_validado_diretor_em) {
    return { label: "Validado 2/3", color: "bg-blue-500 text-white", step: 2 };
  }
  if (projeto.tap_validado_gestor_em) {
    return { label: "Validado 1/3", color: "bg-blue-400 text-white", step: 1 };
  }
  return { label: "Proposta", color: "bg-amber-500 text-white", step: 0 };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function Cadastros() {
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedDirectorate } = useDirectorate();
  const currentUserId = user?.id ? parseInt(String(user.id)) : undefined;
  // Sempre enviar a diretoria — o backend filtra por domínio (multi-tenant)
  const dirFiltro = selectedDirectorate || undefined;

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [ancoragemFilter, setAncoragemFilter] = useState<string>("todos");
  const [execucaoFilter, setExecucaoFilter] = useState<string>("todos");
  const [gestorFilter, setGestorFilter] = useState<string>("todos");
  const [patrocinadorFilter, setPatrocinadorFilter] = useState<string>("todos");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">(
    "create",
  );
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [editingFromViewMode, setEditingFromViewMode] = useState(false); // Rastreia se edição veio da tela de visualização

  // Permissão TAP: usuário pode editar APENAS os 13 campos do TAP em projetos da sua diretoria
  const [permissaoTap, setPermissaoTap] = useState<MinhaPermissaoTap | null>(
    null,
  );
  const [tapEditSession, setTapEditSession] = useState(false); // edição atual veio do botão "Editar TAP"?

  // Visualização de detalhes do projeto
  const [viewingProject, setViewingProject] = useState<Projeto | null>(null);
  const [showMoreEntregas, setShowMoreEntregas] = useState(false);
  const [showAddEntrega, setShowAddEntrega] = useState(false);
  const [newEntregaNome, setNewEntregaNome] = useState("");
  const [newEntregaAreaId, setNewEntregaAreaId] = useState<number | null>(null);
  const [newEntregaPrazo, setNewEntregaPrazo] = useState("");
  const [cameFromPlano, setCameFromPlano] = useState(false); // Se veio de um plano/programa

  // Visualização de detalhes da entrega
  const [viewingEntrega, setViewingEntrega] = useState<any | null>(null);
  const [tarefasEntrega, setTarefasEntrega] = useState<TarefaEntrega[]>([]);
  const [loadingTarefas, setLoadingTarefas] = useState(false);
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
  const [sprintsDisponiveis, setSprintsDisponiveis] = useState<Sprint[]>([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<UserType[]>(
    [],
  );
  const [itemParaDeletar, setItemParaDeletar] = useState<{
    tipo: "tarefa" | "entrega";
    id: number;
    nome: string;
  } | null>(null);
  const [modalConfirmDeleteOpen, setModalConfirmDeleteOpen] = useState(false);

  // Modal de edição de entrega
  const [modalEditEntregaOpen, setModalEditEntregaOpen] = useState(false);
  const [entregaEditando, setEntregaEditando] = useState<any | null>(null);
  const [editEntregaNome, setEditEntregaNome] = useState("");
  const [editEntregaAreaId, setEditEntregaAreaId] = useState<number | null>(
    null,
  );
  const [editEntregaPrazo, setEditEntregaPrazo] = useState("");

  // Upload de evidência
  const [uploadingEvidencia, setUploadingEvidencia] = useState<number | null>(
    null,
  );
  const evidenciaInputRef = useRef<HTMLInputElement>(null);
  const [evidenciaEntregaId, setEvidenciaEntregaId] = useState<number | null>(
    null,
  );

  // Form data
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [diretorias, setDiretorias] = useState<AreaDiretoria[]>([]); // Áreas de cadastros_areas (SGJT, DTI, etc)
  const [unidadesDiretorias, setUnidadesDiretorias] = useState<
    (Unidade & { diretoria_sigla?: string })[]
  >([]); // Unidades das diretorias selecionadas
  const [instrumentos, setInstrumentos] = useState<InstrumentoAncoragem[]>([]);
  const [buscaPatrocinador, setBuscaPatrocinador] = useState("");
  const [buscaGestor, setBuscaGestor] = useState("");
  const [showPatrocinadorList, setShowPatrocinadorList] = useState(false);
  const [showGestorList, setShowGestorList] = useState(false);

  // Formulário do projeto
  const [formData, setFormData] = useState<CreateProjetoDto>({
    codigo: "",
    nome: "",
    descricao_sintetica: "",
    objetivo: "",
    contexto_justificativa: "",
    patrocinador_id: undefined,
    gestor_id: undefined,
    ancoragem_estrategica_plano_gestao: false,
    ancoragem_estrategica_pep: false,
    ancoragem_estrategica_programa_x: false,
    instrumentos_ids: [],
    escopo_sintetico: "",
    fora_do_escopo: "",
    data_prevista_inicio: "",
    data_prevista_conclusao: "",
    status: "planejado",
    prioridade: "media",
    complexidade: "media",
    abrangencia: "uma_unidade",
    havera_contratacao: false,
    valor_estimado_contratacao: undefined,
    saude: "verde",
    saude_justificativa: "",
    tap_vinculado: "",
    observacoes_gerais: "",
    areas_execucao: [],
    areas_vinculadas_ids: [],
    entregas: [],
    riscos: [],
    entraves: [],
  });

  // Entregas temporárias (para criação)
  const [tempEntregas, setTempEntregas] = useState<CreateEntregaDto[]>([]);
  const [novaEntrega, setNovaEntrega] = useState({
    nome: "",
    area_responsavel_id: null as number | null,
    prazo_estimado: "",
  });
  const [entregaAreaSearch, setEntregaAreaSearch] = useState("");
  const [showEntregaAreaDropdown, setShowEntregaAreaDropdown] = useState(false);

  // TAP validation
  const [tapMissingFields, setTapMissingFields] = useState<string[]>([]);
  const [tapValidationDialogOpen, setTapValidationDialogOpen] = useState(false);

  // Riscos temporários
  const [tempRiscos, setTempRiscos] = useState<CreateRiscoDto[]>([]);
  const [novoRisco, setNovoRisco] = useState({
    descricao: "",
    probabilidade: "",
    impacto: "",
    tratamento: "",
  });

  // Entraves temporários
  const [tempEntraves, setTempEntraves] = useState<CreateEntraveDto[]>([]);
  const [novoEntrave, setNovoEntrave] = useState({ descricao: "" });

  // Carregar dados na inicialização e quando diretoria muda
  useEffect(() => {
    loadProjetos();
    loadAuxiliares();
  }, [selectedDirectorate]);

  // Carrega permissão TAP do usuário logado (uma vez)
  useEffect(() => {
    permissoesTapApi
      .minha()
      .then(setPermissaoTap)
      .catch(() => setPermissaoTap({ temPermissao: false, diretoria: null }));
  }, []);

  // Verificar se há um ID de projeto na URL para abrir diretamente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projetoId = params.get("id");
    const fromPlano = params.get("from") === "plano";

    if (projetoId && projetos.length > 0) {
      const projeto = projetos.find((p) => p.id === parseInt(projetoId));
      if (projeto) {
        // Marcar se veio de um plano/programa
        if (fromPlano) {
          setCameFromPlano(true);
        }
        handleViewProject(projeto);
        // Limpar o parâmetro da URL após abrir o projeto
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [projetos]);

  const loadProjetos = async () => {
    try {
      setLoading(true);
      // Carregar projetos filtrados pela diretoria selecionada
      // Superadmin/SGJT vê todos os projetos sem filtro de diretoria
      const data = await cadastrosProjetosApi.getProjetos(dirFiltro);
      setProjetos(data);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  };

  const loadAuxiliares = async () => {
    // Backend lida com filtragem de domínio automaticamente
    const dirParam = selectedDirectorate;

    // Carregar cada recurso independentemente para não falhar tudo se um falhar
    try {
      const colabs = await cadastrosProjetosApi.getColaboradores(dirParam);

      setColaboradores(colabs);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }

    try {
      const areasData = await cadastrosProjetosApi.getAreas(dirParam);

      setAreas(areasData);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }

    try {
      // Backend GET /api/areas já filtra por domínio do usuário logado
      const allDiretorias = await areasApi.getAll();

      setDiretorias(allDiretorias);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }

    try {
      const instrumentosData =
        await planosProgramasApi.getInstrumentosParaAncoragem(dirParam);

      setInstrumentos(instrumentosData);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }

    try {
      const sprintsData = await getTodosSprints();
      setSprintsDisponiveis(sprintsData);
    } catch (error) {
      console.warn("Erro ao carregar sprints:", error);
    }

    try {
      const usersData = await getUsers(selectedDirectorate || undefined);
      setUsuariosDisponiveis(usersData.filter((u) => u.status === "ACTIVE"));
    } catch (error) {
      console.warn("Erro ao carregar usuários:", error);
    }
  };

  // Filtrar colaboradores baseado nas diretorias selecionadas
  const filteredColaboradores = useMemo(() => {
    // Se nenhuma diretoria selecionada, mostra todos
    if (
      !formData.areas_vinculadas_ids ||
      formData.areas_vinculadas_ids.length === 0
    ) {
      return colaboradores;
    }

    // IDs das áreas (diretorias) selecionadas
    const areaIdsSelecionados = formData.areas_vinculadas_ids;

    return colaboradores.filter((c) => {
      // Manter o colaborador se ele for o patrocinador ou gestor selecionado atualmente
      if (c.id === formData.patrocinador_id || c.id === formData.gestor_id)
        return true;

      // Verificar se a área do colaborador está entre as selecionadas
      return areaIdsSelecionados.includes(c.area_id);
    });
  }, [
    colaboradores,
    formData.areas_vinculadas_ids,
    formData.patrocinador_id,
    formData.gestor_id,
  ]);

  // Carregar unidades das diretorias selecionadas
  useEffect(() => {
    const fetchUnidades = async () => {
      const ids = formData.areas_vinculadas_ids || [];
      if (ids.length === 0) {
        setUnidadesDiretorias([]);
        return;
      }
      try {
        const promises = ids.map(async (areaId) => {
          const unidades = await areasApi.getUnidades(areaId);
          const dir = diretorias.find((d) => d.id === areaId);
          const sigla = dir?.sigla || dir?.nome || "";
          return unidades.map((u) => ({ ...u, diretoria_sigla: sigla }));
        });
        const results = await Promise.all(promises);
        const todasUnidades = results.flat();
        setUnidadesDiretorias(todasUnidades);

        // Limpar areas_execucao que não pertencem mais às diretorias selecionadas
        const idsValidos = new Set(todasUnidades.map((u) => u.id));
        setFormData((prev) => {
          const current = prev.areas_execucao || [];
          const filtered = current.filter((id) => idsValidos.has(id));
          if (filtered.length !== current.length) {
            return { ...prev, areas_execucao: filtered };
          }
          return prev;
        });
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    };
    fetchUnidades();
  }, [formData.areas_vinculadas_ids, diretorias]);

  // Opções de filtro derivadas dos projetos cadastrados
  const areasDosProjetos = useMemo(() => {
    const nomes = new Set<string>();
    projetos.forEach((p) => {
      if (p.areas_execucao_diretorias) {
        p.areas_execucao_diretorias.split(",").forEach((nome) => {
          const trimmed = nome.trim();
          if (trimmed) nomes.add(trimmed);
        });
      }
    });
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projetos]);

  const gestoresDeProjetos = useMemo(() => {
    const ids = new Set(projetos.map((p) => p.gestor_id).filter(Boolean));
    return colaboradores.filter((c) => ids.has(c.id));
  }, [projetos, colaboradores]);

  const patrocinadoresDeProjetos = useMemo(() => {
    const ids = new Set(projetos.map((p) => p.patrocinador_id).filter(Boolean));
    return colaboradores.filter((c) => ids.has(c.id));
  }, [projetos, colaboradores]);

  // Filtrar projetos e ordenar alfabeticamente
  const filteredProjetos = useMemo(() => {
    return projetos
      .filter((projeto) => {
        const matchesSearch =
          (projeto.nome || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (projeto.codigo || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (projeto.tap_id || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (projeto.patrocinador_nome || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (projeto.gestor_nome || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());

        const matchesStatus =
          statusFilter === "todos" || projeto.status === statusFilter;

        // Filtro de Ancoragem Estratégica (usando instrumentos cadastrados)
        const matchesAncoragem =
          ancoragemFilter === "todos" ||
          projeto.instrumentos?.some(
            (inst) => inst.instrumento_id.toString() === ancoragemFilter,
          ) ||
          Array.from(
            new Set(
              (projeto.instrumentos_nomes || "").split(", ").filter(Boolean),
            ),
          ).some((nome) => {
            const instrumento = instrumentos.find(
              (i) => i.id.toString() === ancoragemFilter,
            );
            return (
              instrumento &&
              nome.toLowerCase().includes(instrumento.nome.toLowerCase())
            );
          });

        // Filtro de Execução (áreas)
        const matchesExecucao =
          execucaoFilter === "todos" ||
          projeto.areas_execucao_diretorias
            ?.toLowerCase()
            .includes(execucaoFilter.toLowerCase());

        // Filtro de Gestor
        const matchesGestor =
          gestorFilter === "todos" ||
          projeto.gestor_id?.toString() === gestorFilter;

        // Filtro de Patrocinador
        const matchesPatrocinador =
          patrocinadorFilter === "todos" ||
          projeto.patrocinador_id?.toString() === patrocinadorFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesAncoragem &&
          matchesExecucao &&
          matchesGestor &&
          matchesPatrocinador
        );
      })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  }, [
    projetos,
    searchTerm,
    statusFilter,
    ancoragemFilter,
    execucaoFilter,
    gestorFilter,
    patrocinadorFilter,
    instrumentos,
  ]);

  const handleUpdateProjectStatus = async (
    projetoId: number,
    novoStatus: string,
  ) => {
    try {
      await cadastrosProjetosApi.updateProjeto(projetoId, {
        status: novoStatus as any,
      });
      await loadProjetos();

      if (viewingProject && viewingProject.id === projetoId) {
        const projetoAtualizado =
          await cadastrosProjetosApi.getProjetoById(projetoId);
        setViewingProject(projetoAtualizado);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Inicia edição via permissão TAP: abre o modal em modo 'edit' mas marca a sessão como TAP-only.
  const handleEditarTap = () => {
    if (!selectedProjeto) return;
    setTapEditSession(true);
    setModalMode("edit");
  };

  // Cache do resultado do check de permissão TAP por projeto aberto (consulta o backend
  // pra alinhar com areas_vinculadas_ids — não dá pra calcular só com a sigla local).
  const [podeEditarTapProjeto, setPodeEditarTapProjeto] = useState(false);
  useEffect(() => {
    if (
      !selectedProjeto?.id ||
      !permissaoTap?.temPermissao ||
      modalMode !== "view"
    ) {
      setPodeEditarTapProjeto(false);
      return;
    }
    let canceled = false;
    permissoesTapApi
      .podeEditarProjeto(selectedProjeto.id)
      .then((r) => {
        if (!canceled) setPodeEditarTapProjeto(!!r.podeEditar);
      })
      .catch(() => {
        if (!canceled) setPodeEditarTapProjeto(false);
      });
    return () => {
      canceled = true;
    };
  }, [selectedProjeto?.id, permissaoTap?.temPermissao, modalMode]);

  // Abrir modal
  const handleOpenModal = async (
    mode: "create" | "edit" | "view",
    projeto?: Projeto,
  ) => {
    setModalMode(mode);
    setTapEditSession(false); // reset; só vira true via handleEditarTap
    setTapMissingFields([]);

    // Rastrear se a edição foi iniciada da tela de visualização
    setEditingFromViewMode(mode === "edit" && viewingProject !== null);

    // Limpar estados primeiro
    setTempEntregas([]);
    setTempRiscos([]);
    setTempEntraves([]);

    if (projeto && (mode === "edit" || mode === "view")) {
      // Buscar projeto completo da API
      try {
        const projetoCompleto = await cadastrosProjetosApi.getProjetoById(
          projeto.id,
        );
        setSelectedProjeto(projetoCompleto);

        // Preencher formulário
        setFormData({
          codigo: projetoCompleto.codigo || "",
          nome: projetoCompleto.nome,
          descricao_sintetica: projetoCompleto.descricao_sintetica || "",
          objetivo: projetoCompleto.objetivo || "",
          contexto_justificativa: projetoCompleto.contexto_justificativa || "",
          patrocinador_id: projetoCompleto.patrocinador_id || undefined,
          gestor_id: projetoCompleto.gestor_id || undefined,
          ancoragem_estrategica_plano_gestao:
            projetoCompleto.ancoragem_estrategica_plano_gestao,
          ancoragem_estrategica_pep: projetoCompleto.ancoragem_estrategica_pep,
          ancoragem_estrategica_programa_x:
            projetoCompleto.ancoragem_estrategica_programa_x,
          instrumentos_ids:
            projetoCompleto.instrumentos?.map((i) => i.instrumento_id) || [],
          escopo_sintetico: projetoCompleto.escopo_sintetico || "",
          fora_do_escopo: projetoCompleto.fora_do_escopo || "",
          data_prevista_inicio: formatDateForInput(
            projetoCompleto.data_prevista_inicio,
          ),
          data_prevista_conclusao: formatDateForInput(
            projetoCompleto.data_prevista_conclusao,
          ),
          status: projetoCompleto.status,
          prioridade: projetoCompleto.prioridade,
          complexidade: projetoCompleto.complexidade,
          abrangencia: projetoCompleto.abrangencia,
          havera_contratacao: projetoCompleto.havera_contratacao,
          valor_estimado_contratacao:
            projetoCompleto.valor_estimado_contratacao || undefined,
          saude: projetoCompleto.saude,
          saude_justificativa: projetoCompleto.saude_justificativa || "",
          tap_vinculado: projetoCompleto.tap_vinculado || "",
          observacoes_gerais: projetoCompleto.observacoes_gerais || "",
          areas_execucao:
            projetoCompleto.areasExecucao?.map((a) => a.area_id) || [],
          areas_vinculadas_ids: projetoCompleto.areas_vinculadas_ids || [],
        });

        // Preencher nomes de patrocinador e gestor nos campos de busca
        const patrocinador = colaboradores.find(
          (c) => c.id === projetoCompleto.patrocinador_id,
        );
        const gestor = colaboradores.find(
          (c) => c.id === projetoCompleto.gestor_id,
        );
        setBuscaPatrocinador(patrocinador?.nome || "");
        setBuscaGestor(gestor?.nome || "");

        // Preencher entregas, riscos e entraves
        if (projetoCompleto.entregas && projetoCompleto.entregas.length > 0) {
          setTempEntregas(
            projetoCompleto.entregas.map((e) => ({
              nome: e.nome,
              descricao: e.descricao || undefined,
              status: e.status,
              area_responsavel_id: e.area_responsavel_id,
              ordem: e.ordem,
              prazo_estimado: e.prazo_estimado || null,
              areas_responsaveis: [],
            })),
          );
        }

        if (projetoCompleto.riscos && projetoCompleto.riscos.length > 0) {
          setTempRiscos(
            projetoCompleto.riscos.map((r) => ({
              descricao: r.descricao,
              probabilidade: r.probabilidade,
              impacto: r.impacto,
              tratamento: r.tratamento || undefined,
              observacoes: r.observacoes || undefined,
            })),
          );
        }

        if (projetoCompleto.entraves && projetoCompleto.entraves.length > 0) {
          setTempEntraves(
            projetoCompleto.entraves.map((e) => ({
              descricao: e.descricao,
              data_identificacao: e.data_identificacao,
              observacoes: e.observacoes || undefined,
            })),
          );
        }

        // Limpar campos de entrada para evitar duplicação
        setNovaEntrega({ nome: "", area_responsavel_id: null });
        setNovoRisco({
          descricao: "",
          probabilidade: "",
          impacto: "",
          tratamento: "",
        });
        setNovoEntrave({ descricao: "" });
      } catch (error) {
        return;
      }
    } else {
      // Novo projeto - resetar tudo

      setSelectedProjeto(null);
      setFormData({
        codigo: "",
        nome: "",
        descricao_sintetica: "",
        objetivo: "",
        contexto_justificativa: "",
        patrocinador_id: undefined,
        gestor_id: undefined,
        ancoragem_estrategica_plano_gestao: false,
        ancoragem_estrategica_pep: false,
        ancoragem_estrategica_programa_x: false,
        instrumentos_ids: [],
        escopo_sintetico: "",
        fora_do_escopo: "",
        data_prevista_inicio: "",
        data_prevista_conclusao: "",
        status: "planejado",
        prioridade: "media",
        complexidade: "media",
        abrangencia: "uma_unidade",
        havera_contratacao: false,
        valor_estimado_contratacao: undefined,
        saude: "verde",
        saude_justificativa: "",
        tap_vinculado: "",
        observacoes_gerais: "",
        areas_execucao: [],
        areas_vinculadas_ids: [],
      });
      setBuscaPatrocinador("");
      setBuscaGestor("");
    }

    setShowModal(true);
  };

  // Salvar projeto
  const handleSave = async () => {
    if (!formData.nome?.trim()) {
      toast({
        title: "Erro",
        description: "O nome do projeto é obrigatório",
        variant: "destructive",
      });
      return;
    }

    // Validação extra no modo edição: campos críticos não podem ser removidos
    if (modalMode === "edit") {
      const camposFaltando: string[] = [];
      if (!formData.nome?.trim()) camposFaltando.push("Nome do Projeto");
      if (!selectedDirectorate) camposFaltando.push("Diretoria");
      if (!formData.areas_execucao || formData.areas_execucao.length === 0)
        camposFaltando.push("Área Responsável");

      if (camposFaltando.length > 0) {
        toast({
          title: "Não é possível salvar",
          description: `Os seguintes campos obrigatórios não podem ser removidos: ${camposFaltando.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Adicionar automaticamente itens preenchidos nos campos temporários (se houver)
      let entregasParaSalvar = [...tempEntregas];
      let riscosParaSalvar = [...tempRiscos];
      let entravesParaSalvar = [...tempEntraves];

      // Se há uma entrega sendo digitada (campo não vazio), adicionar
      if (novaEntrega.nome && novaEntrega.nome.trim() !== "") {
        entregasParaSalvar.push({
          nome: novaEntrega.nome.trim(),
          area_responsavel_id: novaEntrega.area_responsavel_id,
          prazo_estimado: novaEntrega.prazo_estimado || null,
          status: "nao_iniciada",
          ordem: entregasParaSalvar.length,
          areas_responsaveis: [],
        });
        // Limpar campo após adicionar
        setNovaEntrega({
          nome: "",
          area_responsavel_id: null,
          prazo_estimado: "",
        });
      }

      // Se há um risco sendo digitado (campo não vazio), adicionar
      if (novoRisco.descricao && novoRisco.descricao.trim() !== "") {
        riscosParaSalvar.push({
          descricao: novoRisco.descricao.trim(),
          probabilidade: novoRisco.probabilidade || "possivel",
          impacto: novoRisco.impacto || "medio",
          tratamento: novoRisco.tratamento?.trim() || undefined,
        });
        // Limpar campo após adicionar
        setNovoRisco({
          descricao: "",
          probabilidade: "",
          impacto: "",
          tratamento: "",
        });
      }

      // Se há um entrave sendo digitado (campo não vazio), adicionar
      if (novoEntrave.descricao && novoEntrave.descricao.trim() !== "") {
        entravesParaSalvar.push({
          descricao: novoEntrave.descricao.trim(),
        });
        // Limpar campo após adicionar
        setNovoEntrave({ descricao: "" });
      }

      let dataToSend: any = {
        ...formData,
        diretoria: selectedDirectorate,
        entregas: entregasParaSalvar,
        riscos: riscosParaSalvar,
        entraves: entravesParaSalvar,
      };

      // Sessão TAP-only: o usuário entrou via "Editar TAP" — só envia os 13 campos do TAP.
      // Qualquer alteração feita em outros campos é descartada antes do PUT.
      if (tapEditSession && modalMode === "edit") {
        const TAP_PAYLOAD_KEYS = [
          "nome",
          "tap_vinculado",
          "data_prevista_inicio",
          "data_prevista_conclusao",
          "objetivo",
          "contexto_justificativa",
          "patrocinador_id",
          "gestor_id",
          "escopo_sintetico",
          "fora_do_escopo",
          "entregas",
          "instrumentos_ids",
          "prioridade",
          "complexidade",
        ];
        const filtered: any = {};
        for (const k of TAP_PAYLOAD_KEYS) {
          if ((dataToSend as any)[k] !== undefined)
            filtered[k] = (dataToSend as any)[k];
        }
        dataToSend = filtered;
      }

      if (modalMode === "create") {
        await cadastrosProjetosApi.createProjeto(dataToSend);
      } else if (modalMode === "edit" && selectedProjeto) {
        await cadastrosProjetosApi.updateProjeto(
          selectedProjeto.id,
          dataToSend,
        );
        const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
          selectedProjeto.id,
        );

        // Só atualiza a visualização se a edição veio da tela de visualização
        if (editingFromViewMode) {
          setViewingProject(projetoAtualizado);
        }
        setSelectedProjeto(projetoAtualizado);
      }

      setShowModal(false);
      await loadProjetos();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Excluir projeto
  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este projeto?")) return;

    try {
      await cadastrosProjetosApi.deleteProjeto(id);

      loadProjetos();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Adicionar entrega temporária
  const handleAddEntrega = () => {
    if (!novaEntrega.nome.trim()) {
      toast({
        title: "Atenção",
        description: "Digite o nome da entrega",
        variant: "destructive",
      });
      return;
    }
    const novaEntregaObj = {
      ...novaEntrega,
      prazo_estimado: novaEntrega.prazo_estimado || null,
      status: "nao_iniciada" as const,
      ordem: tempEntregas.length,
      areas_responsaveis: [],
    };

    setTempEntregas((prev) => {
      const updated = [...prev, novaEntregaObj];

      return updated;
    });
    setNovaEntrega({ nome: "", area_responsavel_id: null, prazo_estimado: "" });
    toast({
      title: "Entrega adicionada",
      description: `"${novaEntrega.nome}" foi adicionada à lista`,
    });
  };

  // Proposta TAP - Validar campos e gerar PDF
  const handlePropostaTAP = async () => {
    // Build a temporary project object for validation
    const projetoParaValidar = {
      ...formData,
      entregas:
        tempEntregas.length > 0
          ? tempEntregas.map((e, i) => ({
              id: i,
              projeto_id: 0,
              nome: e.nome,
              descricao: null,
              status: "nao_iniciada" as const,
              quantidade_sprints: 0,
              ordem: i,
              area_responsavel_id: e.area_responsavel_id,
              area_responsavel_nome:
                areas.find((a) => a.id === e.area_responsavel_id)?.nome_area ||
                null,
              prazo_estimado: e.prazo_estimado || null,
            }))
          : [],
      instrumentos:
        formData.instrumentos_ids?.map((id) => ({ id, nome: "", tipo: "" })) ||
        [],
    } as any;

    const { valid, missingFields } = validateTAPFields(projetoParaValidar);

    if (!valid) {
      setTapMissingFields(missingFields);
      setTapValidationDialogOpen(true);
      return;
    }

    // Todos os requisitos preenchidos
    setTapMissingFields([]);
    setTapValidationDialogOpen(true);
  };

  // Map TAP field names to formData field identifiers for red highlighting
  const tapFieldMap: Record<string, string> = {
    "Nome do Projeto": "nome",
    "Nº do Proad": "tap_vinculado",
    "Data Prevista de Início": "data_prevista_inicio",
    "Data Prevista de Conclusão": "data_prevista_conclusao",
    Objetivo: "objetivo",
    "Contexto e Justificativa": "contexto_justificativa",
    Patrocinador: "patrocinador_id",
    Gestor: "gestor_id",
    Escopo: "escopo_sintetico",
    "Fora do Escopo": "fora_do_escopo",
    "Entregas (pelo menos 1)": "entregas",
    "Ancoragem Estratégica (pelo menos 1)": "instrumentos",
    Prioridade: "prioridade",
    Complexidade: "complexidade",
    Abrangência: "abrangencia",
  };

  const isTapFieldMissing = (fieldKey: string): boolean => {
    return tapMissingFields.some((f) => tapFieldMap[f] === fieldKey);
  };

  // Adicionar risco temporário
  const handleAddRisco = () => {
    if (!novoRisco.descricao.trim()) {
      toast({
        title: "Atenção",
        description: "Digite a descrição do risco",
        variant: "destructive",
      });
      return;
    }
    setTempRiscos((prev) => [
      ...prev,
      {
        ...novoRisco,
        probabilidade: novoRisco.probabilidade || "possivel",
        impacto: novoRisco.impacto || "medio",
      },
    ]);
    setNovoRisco({
      descricao: "",
      probabilidade: "",
      impacto: "",
      tratamento: "",
    });
  };

  // Adicionar entrave temporário
  const handleAddEntrave = () => {
    if (!novoEntrave.descricao.trim()) {
      toast({
        title: "Atenção",
        description: "Digite a descrição do entrave",
        variant: "destructive",
      });
      return;
    }
    setTempEntraves((prev) => [...prev, novoEntrave]);
    setNovoEntrave({ descricao: "" });
  };

  // Toggle área de execução
  // Área Responsável: seleção ÚNICA — escolher outra substitui a atual; escolher a mesma remove.
  const toggleAreaExecucao = (areaId: number) => {
    setFormData((prev) => ({
      ...prev,
      areas_execucao: (prev.areas_execucao || []).includes(areaId)
        ? []
        : [areaId],
    }));
  };

  // Diretoria: seleção ÚNICA — trocar substitui a atual e limpa a área responsável
  // (as unidades disponíveis dependem da diretoria escolhida).
  const handleAdicionarDiretoria = (value: string) => {
    const areaId = parseInt(value);
    if (!areaId || formData.areas_vinculadas_ids?.includes(areaId)) return;
    setFormData((prev) => ({
      ...prev,
      areas_vinculadas_ids: [areaId],
      areas_execucao: [],
    }));
  };

  // Remover a diretoria do projeto (limpa também a área responsável vinculada a ela)
  const handleRemoverDiretoria = (_areaId: number) => {
    setFormData((prev) => ({
      ...prev,
      areas_vinculadas_ids: [],
      areas_execucao: [],
    }));
  };

  // Abrir visualização de detalhes do projeto
  const handleViewProject = async (projeto: Projeto) => {
    try {
      const projetoCompleto = await cadastrosProjetosApi.getProjetoById(
        projeto.id,
      );
      setViewingProject(projetoCompleto);
      setShowMoreEntregas(false);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Atualizar status do projeto inline
  const handleUpdateProjetoStatus = async (novoStatus: string) => {
    if (!viewingProject) return;
    try {
      await cadastrosProjetosApi.updateProjeto(viewingProject.id, {
        status: novoStatus,
      });
      const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
        viewingProject.id,
      );
      setViewingProject(projetoAtualizado);
      loadProjetos();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Atualizar status da entrega inline
  const handleUpdateEntregaStatus = async (
    entregaId: number,
    novoStatus: string,
  ) => {
    if (!viewingProject) return;
    try {
      await cadastrosProjetosApi.updateEntrega(entregaId, {
        status: novoStatus,
      });
      const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
        viewingProject.id,
      );
      setViewingProject(projetoAtualizado);
      loadProjetos();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Abrir modal de edição de entrega
  const handleEditEntrega = (entrega: any) => {
    setEntregaEditando(entrega);
    setEditEntregaNome(entrega.nome);
    setEditEntregaAreaId(entrega.area_responsavel_id || null);
    setEditEntregaPrazo(
      entrega.prazo_estimado ? entrega.prazo_estimado.substring(0, 10) : "",
    );
    setModalEditEntregaOpen(true);
  };

  // Salvar edição de entrega
  const handleSaveEditEntrega = async () => {
    if (!entregaEditando || !viewingProject) return;
    if (!editEntregaNome.trim()) {
      toast({
        title: "Erro",
        description: "Digite o nome da entrega",
        variant: "destructive",
      });
      return;
    }

    try {
      await cadastrosProjetosApi.updateEntrega(entregaEditando.id, {
        nome: editEntregaNome.trim(),
        area_responsavel_id: editEntregaAreaId,
        prazo_estimado: editEntregaPrazo || null,
      });
      const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
        viewingProject.id,
      );
      setViewingProject(projetoAtualizado);
      loadProjetos();
      setModalEditEntregaOpen(false);
      setEntregaEditando(null);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Excluir entrega
  const handleDeleteEntrega = async (entregaId: number) => {
    if (!viewingProject) return;

    try {
      await cadastrosProjetosApi.deleteEntrega(entregaId);
      const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
        viewingProject.id,
      );
      setViewingProject(projetoAtualizado);
      loadProjetos();
      setModalConfirmDeleteOpen(false);
      setItemParaDeletar(null);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // ============================================================
  // HELPER - CÁLCULO AUTOMÁTICO DE STATUS DA ENTREGA
  // ============================================================

  const calcularStatusEntrega = (tarefas: TarefaEntrega[]): string => {
    if (tarefas.length === 0) return "nao_iniciada";

    const todasAFazer = tarefas.every((t) => t.status === "a_fazer");
    const todasFeitas = tarefas.every((t) => t.status === "feito");

    if (todasAFazer) return "nao_iniciada";
    if (todasFeitas) return "concluida";
    return "em_andamento";
  };

  // Carregar tarefas quando abrir uma entrega
  const loadTarefasEntrega = async (entregaId: number) => {
    try {
      setLoadingTarefas(true);
      const tarefas = await cadastrosProjetosApi.getTarefasEntrega(entregaId);

      setTarefasEntrega(tarefas);
    } catch (error) {
      setTarefasEntrega([]);
    } finally {
      setLoadingTarefas(false);
    }
  };

  // Carregar tarefas quando viewingEntrega mudar
  useEffect(() => {
    if (viewingEntrega?.id) {
      loadTarefasEntrega(viewingEntrega.id);
    } else {
      setTarefasEntrega([]);
    }
  }, [viewingEntrega?.id]);

  // Atualizar status da entrega automaticamente quando tarefas mudam
  // Nota: O backend já recalcula o status, mas mantemos para UX imediato
  useEffect(() => {
    if (!viewingEntrega || loadingTarefas) return;

    const novoStatus = calcularStatusEntrega(tarefasEntrega);

    if (viewingEntrega.status !== novoStatus) {
      setViewingEntrega((prev: any) =>
        prev ? { ...prev, status: novoStatus } : prev,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasEntrega, viewingEntrega?.id, loadingTarefas]);

  // ============================================================
  // HANDLERS - TAREFAS DE ENTREGA
  // ============================================================

  const handleAtualizarStatusTarefaEntrega = async (
    tarefaId: number,
    novoStatus: string,
  ) => {
    try {
      // Atualizar no backend
      await cadastrosProjetosApi.updateTarefaEntrega(tarefaId, {
        status: novoStatus,
      });

      // Atualizar estado local
      setTarefasEntrega((prev) =>
        prev.map((t) =>
          t.id === tarefaId
            ? { ...t, status: novoStatus as TarefaEntrega["status"] }
            : t,
        ),
      );

      // Recarregar projeto para refletir mudanças na entrega
      if (viewingProject) {
        const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
          viewingProject.id,
        );
        setViewingProject(projetoAtualizado);
      }

      toast({
        title: "Status atualizado",
        description: `Status alterado para ${novoStatus === "a_fazer" ? "A Fazer" : novoStatus === "fazendo" ? "Fazendo" : "Feito"}`,
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
        responsavel: tarefa.responsavel || "",
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
        description: "Digite o nome da tarefa",
        variant: "destructive",
      });
      return;
    }

    if (!viewingEntrega?.id) {
      toast({
        title: "Erro",
        description: "Entrega não selecionada",
        variant: "destructive",
      });
      return;
    }

    try {
      if (tarefaEntregaEditando) {
        // Editar tarefa existente

        const tarefaAtualizada = await cadastrosProjetosApi.updateTarefaEntrega(
          tarefaEntregaEditando.id,
          {
            nome: novaTarefaEntrega.nome,
            sprint_id: novaTarefaEntrega.sprint_id
              ? Number(novaTarefaEntrega.sprint_id)
              : undefined,
            responsavel: novaTarefaEntrega.responsavel || undefined,
            status: novaTarefaEntrega.status,
          },
        );

        setTarefasEntrega((prev) =>
          prev.map((t) =>
            t.id === tarefaEntregaEditando.id ? tarefaAtualizada : t,
          ),
        );
      } else {
        // Criar nova tarefa

        const novaTarefa = await cadastrosProjetosApi.createTarefaEntrega(
          viewingEntrega.id,
          {
            nome: novaTarefaEntrega.nome,
            sprint_id: novaTarefaEntrega.sprint_id
              ? Number(novaTarefaEntrega.sprint_id)
              : undefined,
            responsavel: novaTarefaEntrega.responsavel || undefined,
            status: novaTarefaEntrega.status,
          },
        );

        setTarefasEntrega((prev) => [...prev, novaTarefa]);
      }

      // Recarregar projeto para refletir mudanças
      if (viewingProject) {
        const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
          viewingProject.id,
        );
        setViewingProject(projetoAtualizado);
      }

      setModalTarefaEntregaOpen(false);
      setTarefaEntregaEditando(null);
      setNovaTarefaEntrega({
        nome: "",
        sprint_id: "",
        responsavel: "",
        status: "a_fazer",
      });
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleExcluirTarefaEntrega = async (tarefaId: number) => {
    try {
      await cadastrosProjetosApi.deleteTarefaEntrega(tarefaId);
      setTarefasEntrega((prev) => prev.filter((t) => t.id !== tarefaId));

      // Recarregar projeto para refletir mudanças
      if (viewingProject) {
        const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
          viewingProject.id,
        );
        setViewingProject(projetoAtualizado);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setModalConfirmDeleteOpen(false);
      setItemParaDeletar(null);
    }
  };

  const handleConfirmarExclusao = () => {
    if (!itemParaDeletar) return;

    if (itemParaDeletar.tipo === "tarefa") {
      handleExcluirTarefaEntrega(itemParaDeletar.id);
    } else if (itemParaDeletar.tipo === "entrega") {
      handleDeleteEntrega(itemParaDeletar.id);
    }
  };

  // Adicionar nova entrega inline
  const handleAddEntregaInline = async () => {
    if (!viewingProject || !newEntregaNome.trim()) {
      toast({
        title: "Atenção",
        description: "Digite o nome da entrega",
        variant: "destructive",
      });
      return;
    }

    try {
      await cadastrosProjetosApi.createEntrega(viewingProject.id, {
        nome: newEntregaNome.trim(),
        area_responsavel_id: newEntregaAreaId,
        prazo_estimado: newEntregaPrazo || null,
        status: "nao_iniciada",
        ordem: viewingProject.entregas?.length || 0,
      });

      const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
        viewingProject.id,
      );
      setViewingProject(projetoAtualizado);
      loadProjetos();

      // Limpar formulário
      setNewEntregaNome("");
      setNewEntregaAreaId(null);
      setNewEntregaPrazo("");
      setShowAddEntrega(false);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Upload de evidência
  const handleUploadEvidencia = async (entregaId: number, file: File) => {
    if (!file || file.type !== "application/pdf") {
      toast({
        title: "Erro",
        description: "Apenas arquivos PDF são permitidos.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "O arquivo deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingEvidencia(entregaId);
    try {
      await cadastrosProjetosApi.uploadEvidencia(entregaId, file);
      if (viewingProject) {
        const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
          viewingProject.id,
        );
        setViewingProject(projetoAtualizado);
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
      if (viewingProject) {
        const projetoAtualizado = await cadastrosProjetosApi.getProjetoById(
          viewingProject.id,
        );
        setViewingProject(projetoAtualizado);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setUploadingEvidencia(null);
    }
  };

  // Renderizar visualização de detalhes do projeto
  const renderProjectDetails = () => {
    if (!viewingProject) return null;

    const entregas = viewingProject.entregas || [];
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
        {/* Botão Voltar acima de tudo */}
        <Button
          variant="outline"
          onClick={() => {
            setViewingProject(null);
            if (cameFromPlano) {
              window.history.back();
            }
          }}
          className="bg-white border-gray-300 text-gray-700 font-medium"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        {/* Header do Projeto com link Ver Detalhes */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 shadow-sm overflow-hidden flex">
          <div className="w-1.5 bg-blue-500" />
          <div className="flex-1 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-blue-600">
                {viewingProject.nome}
              </h2>
              {viewingProject.descricao_sintetica && (
                <p className="text-gray-500 text-sm mt-1">
                  {viewingProject.descricao_sintetica}
                </p>
              )}
            </div>
            <button
              onClick={() => handleOpenModal("view", viewingProject)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 hover:underline"
            >
              <Eye className="h-4 w-4" />
              Ver detalhes
            </button>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-3">
          {/* Botão Gerar TAP (só após 3 validações e sem tap_id) */}
          {viewingProject?.tap_validado_patrocinador_em &&
            !viewingProject?.tap_id && (
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!viewingProject) return;
                  try {
                    const projeto = await cadastrosProjetosApi.gerarTapId(
                      viewingProject.id,
                    );
                    setViewingProject(projeto);
                    generateTAPPdf(projeto);
                  } catch (error) {
                    /* erro já tratado pelo apiClient ou ignorado intencionalmente */
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-medium"
                size="sm"
              >
                <FileText className="mr-2 h-4 w-4" />
                Gerar TAP
              </Button>
            )}

          {/* Botão Visualizar TAP (quando já tem tap_id gerado) */}
          {viewingProject?.tap_id && (
            <Button
              variant="secondary"
              onClick={() => {
                if (!viewingProject) return;
                generateTAPPdf(viewingProject);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
              size="sm"
            >
              <FileText className="mr-2 h-4 w-4" />
              Visualizar TAP
            </Button>
          )}
        </div>

        {/* Validação do TAP - 3 Camadas */}
        {viewingProject && validateTAPFields(viewingProject).valid && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Validação do TAP
            </h4>
            <div className="flex items-center gap-4">
              {/* Camada 1 - Gestor */}
              <div
                className={cn(
                  "flex-1 rounded-lg border p-3 text-center",
                  viewingProject.tap_validado_gestor_em
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50 border-gray-200",
                )}
              >
                <p className="text-xs text-gray-500 mb-1">Camada 1 - Gestor</p>
                <p className="text-sm font-medium">
                  {viewingProject.gestor_nome || "-"}
                </p>
                {viewingProject.tap_validado_gestor_em ? (
                  <div className="mt-1">
                    <Badge className="bg-green-600 text-white text-xs">
                      Validado
                    </Badge>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(
                        viewingProject.tap_validado_gestor_em,
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ) : (
                  <div className="mt-1">
                    {undefined as any}
                    {currentUserId &&
                    viewingProject.gestor_user_id &&
                    Number(viewingProject.gestor_user_id) ===
                      Number(currentUserId) ? (
                      <div className="flex flex-col gap-1 items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateTAPPdf(viewingProject);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Visualizar TAP
                        </Button>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-gray-400"
                      >
                        Pendente
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <span className="text-gray-300 text-lg">&rarr;</span>

              {/* Camada 2 - Diretor */}
              <div
                className={cn(
                  "flex-1 rounded-lg border p-3 text-center",
                  viewingProject.tap_validado_diretor_em
                    ? "bg-green-50 border-green-200"
                    : !viewingProject.tap_validado_gestor_em
                      ? "bg-gray-100 border-gray-200 opacity-50"
                      : "bg-gray-50 border-gray-200",
                )}
              >
                <p className="text-xs text-gray-500 mb-1">Camada 2 - Diretor</p>
                <p className="text-sm font-medium">
                  {viewingProject.diretoria || "-"}
                </p>
                {viewingProject.tap_validado_diretor_em ? (
                  <div className="mt-1">
                    <Badge className="bg-green-600 text-white text-xs">
                      Validado
                    </Badge>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(
                        viewingProject.tap_validado_diretor_em,
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ) : viewingProject.tap_validado_gestor_em ? (
                  <div className="mt-1">
                    {currentUserId &&
                    viewingProject.diretor_user_id &&
                    Number(viewingProject.diretor_user_id) ===
                      Number(currentUserId) ? (
                      <div className="flex flex-col gap-1 items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateTAPPdf(viewingProject);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Visualizar TAP
                        </Button>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-gray-400"
                      >
                        Aguardando Diretor
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs text-gray-400">
                    Bloqueado
                  </Badge>
                )}
              </div>

              <span className="text-gray-300 text-lg">&rarr;</span>

              {/* Camada 3 - Patrocinador */}
              <div
                className={cn(
                  "flex-1 rounded-lg border p-3 text-center",
                  viewingProject.tap_validado_patrocinador_em
                    ? "bg-green-50 border-green-200"
                    : !viewingProject.tap_validado_diretor_em
                      ? "bg-gray-100 border-gray-200 opacity-50"
                      : "bg-gray-50 border-gray-200",
                )}
              >
                <p className="text-xs text-gray-500 mb-1">
                  Camada 3 - Patrocinador
                </p>
                <p className="text-sm font-medium">
                  {viewingProject.patrocinador_nome || "-"}
                </p>
                {viewingProject.tap_validado_patrocinador_em ? (
                  <div className="mt-1">
                    <Badge
                      className="bg-green-600 text-white text-xs cursor-pointer hover:bg-green-700 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateTAPPdf(viewingProject);
                      }}
                    >
                      TAP Vigente
                    </Badge>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(
                        viewingProject.tap_validado_patrocinador_em,
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ) : viewingProject.tap_validado_diretor_em ? (
                  <div className="mt-1">
                    {currentUserId &&
                    viewingProject.patrocinador_user_id &&
                    Number(viewingProject.patrocinador_user_id) ===
                      Number(currentUserId) ? (
                      <div className="flex flex-col gap-1 items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateTAPPdf(viewingProject);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Visualizar TAP
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-gray-400"
                      >
                        Pendente
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs text-gray-400">
                    Bloqueado
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

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
                  {viewingProject.patrocinador_nome || "-"}
                </p>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Gestor do Projeto</p>
                <p className="text-gray-900">
                  {viewingProject.gestor_nome || "-"}
                </p>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Status</p>
                <div className="h-8 w-[160px] bg-gray-100 text-slate-700 font-medium rounded-md flex items-center px-3 gap-2 text-sm cursor-default border border-gray-200/50">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        viewingProject.status === "concluido"
                          ? "bg-green-500"
                          : viewingProject.status === "em_execucao"
                            ? "bg-blue-500"
                            : viewingProject.status === "suspenso"
                              ? "bg-yellow-500"
                              : viewingProject.status === "cancelado"
                                ? "bg-red-500"
                                : "bg-gray-400"
                      }`}
                    />
                    <span>
                      {statusLabels[viewingProject.status] ||
                        viewingProject.status}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Saúde</p>
                <p className="text-gray-900">
                  {saudeLabels[viewingProject.saude] || viewingProject.saude}
                </p>
              </div>

              <div>
                <p className="text-gray-600 font-medium">Prazo Estimado</p>
                <p className="text-gray-900">
                  {viewingProject.data_prevista_conclusao
                    ? new Date(
                        viewingProject.data_prevista_conclusao,
                      ).toLocaleDateString("pt-BR", {
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA - Entregas */}
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-6 h-[650px] flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Entregas</h3>
              <Button
                onClick={() => setShowAddEntrega(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {/* Formulário de Nova Entrega Inline */}
            {showAddEntrega && (
              <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2 flex-shrink-0">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Nova Entrega
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <Label htmlFor="inline-entrega-nome" className="text-xs">
                      Nome da Entrega
                    </Label>
                    <Input
                      id="inline-entrega-nome"
                      value={newEntregaNome}
                      onChange={(e) => setNewEntregaNome(e.target.value)}
                      placeholder="Descreva a entrega..."
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1 w-[200px]">
                    <Label htmlFor="inline-entrega-area" className="text-xs">
                      Área Responsável
                    </Label>
                    <Select
                      value={newEntregaAreaId?.toString() || ""}
                      onValueChange={(value) =>
                        setNewEntregaAreaId(value ? parseInt(value) : null)
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {areas.map((area) => (
                          <SelectItem key={area.id} value={area.id.toString()}>
                            {area.diretoria} - {area.nome_area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 w-[160px]">
                    <Label htmlFor="inline-entrega-prazo" className="text-xs">
                      Prazo Estimado
                    </Label>
                    <Input
                      id="inline-entrega-prazo"
                      type="date"
                      value={newEntregaPrazo}
                      onChange={(e) => setNewEntregaPrazo(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddEntregaInline}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Salvar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddEntrega(false);
                        setNewEntregaNome("");
                        setNewEntregaPrazo("");
                      }}
                      className="bg-white"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Tabela com Header Azul */}
            <div className="overflow-x-auto overflow-y-auto flex-1">
              {entregas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                  <FolderKanban className="h-16 w-16 mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">
                    Nenhuma entrega cadastrada
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    Adicione entregas para organizar as tarefas do projeto
                  </p>
                  <Button
                    onClick={() => setShowAddEntrega(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeira entrega
                  </Button>
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
                          style={{ width: "25%" }}
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
                          style={{ width: "15%" }}
                        >
                          Status
                        </th>
                        <th
                          className="text-center py-4 px-6 text-white font-semibold text-sm"
                          style={{ width: "15%" }}
                        >
                          Prazo Estimado
                        </th>
                        <th
                          className="text-center py-4 px-6 text-white font-semibold text-sm"
                          style={{ width: "27%" }}
                        >
                          Evidências
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entregas.map((entrega) => {
                        const statusInfo = getStatusTexto(entrega.status);
                        const tarefasDisabled = isProduction();
                        return (
                          <tr
                            key={entrega.id}
                            className={`border-b border-gray-100 transition-colors last:border-b-0 ${tarefasDisabled ? "" : "hover:bg-blue-50 cursor-pointer"}`}
                            onClick={() => {
                              if (!tarefasDisabled) setViewingEntrega(entrega);
                            }}
                          >
                            <td className="py-3 px-6 text-gray-900 text-sm">
                              {entrega.nome}
                            </td>
                            <td className="py-3 px-6 text-gray-900 text-sm text-center">
                              {entrega.area_responsavel_nome || "-"}
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
                                    className={`w-2 h-2 rounded-full ${
                                      entrega.status === "concluida"
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
                            <td className="py-3 px-6 text-gray-900 text-sm text-center">
                              {formatDatePtBr(entrega.prazo_estimado)}
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
                                  </>
                                ) : (
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
                                )}
                              </div>
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

        {/* Modal Editar Entrega */}
        <Dialog
          open={modalEditEntregaOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEntregaEditando(null);
              setEditEntregaNome("");
              setEditEntregaAreaId(null);
            }
            setModalEditEntregaOpen(open);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Entrega</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="editEntregaNome">Nome da Entrega</Label>
                <Input
                  id="editEntregaNome"
                  value={editEntregaNome}
                  onChange={(e) => setEditEntregaNome(e.target.value)}
                  placeholder="Nome da entrega..."
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="editEntregaArea">Área Responsável</Label>
                <Select
                  value={editEntregaAreaId?.toString() || ""}
                  onValueChange={(value) =>
                    setEditEntregaAreaId(value ? parseInt(value) : null)
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione a área responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id.toString()}>
                        {area.diretoria} - {area.nome_area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editEntregaPrazo">Prazo Estimado</Label>
                <Input
                  id="editEntregaPrazo"
                  type="date"
                  value={editEntregaPrazo}
                  onChange={(e) => setEditEntregaPrazo(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setModalEditEntregaOpen(false);
                  setEntregaEditando(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEditEntrega}
                className="bg-[#5A8A7A] hover:bg-[#4A7A6A]"
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Confirmar Exclusão de Entrega */}
        <Dialog
          open={modalConfirmDeleteOpen && itemParaDeletar?.tipo === "entrega"}
          onOpenChange={(open) => {
            if (!open) {
              setModalConfirmDeleteOpen(false);
              setItemParaDeletar(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">
              Deseja realmente excluir a entrega{" "}
              <strong>"{itemParaDeletar?.nome}"</strong>?
              <br />
              <span className="text-red-500 text-sm">
                Todas as tarefas associadas também serão excluídas.
              </span>
            </p>
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
      </div>
    );
  };

  // ============================================================
  // RENDER - DETALHES DA ENTREGA
  // ============================================================
  const renderEntregaDetails = () => {
    if (!viewingEntrega || !viewingProject) return null;
    // Em produção, tarefas não são exibidas — fluxo termina em entregas
    if (isProduction()) return null;

    // Calcular estatísticas das tarefas
    const total = tarefasEntrega.length;
    const naoIniciado = tarefasEntrega.filter(
      (t) => t.status === "a_fazer",
    ).length;
    const emAndamento = tarefasEntrega.filter(
      (t) => t.status === "fazendo",
    ).length;
    const concluido = tarefasEntrega.filter((t) => t.status === "feito").length;
    const progresso = total > 0 ? Math.round((concluido / total) * 100) : 0;

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
                {viewingEntrega.nome}
              </h2>
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setViewingEntrega(null)}
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
                <span className="font-semibold text-gray-800">
                  {concluido} de {total}
                </span>{" "}
                tarefas concluídas
              </p>
            </div>

            {/* Informações da Entrega */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
              <div>
                <p className="text-gray-600 font-medium">Área Responsável</p>
                <p className="text-gray-900">
                  {viewingEntrega.area_responsavel_nome || "-"}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Status</p>
                <div className="h-8 w-[160px] bg-gray-100 text-slate-700 font-medium rounded-md flex items-center px-3 gap-2 text-sm cursor-default border border-gray-200/50">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        viewingEntrega.status === "concluida"
                          ? "bg-green-500"
                          : viewingEntrega.status === "em_andamento"
                            ? "bg-orange-500"
                            : "bg-gray-400"
                      }`}
                    />
                    <span>
                      {viewingEntrega.status === "nao_iniciada"
                        ? "Não Iniciada"
                        : viewingEntrega.status === "em_andamento"
                          ? "Em Andamento"
                          : "Concluída"}
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
              <Button
                onClick={() => handleAbrirModalTarefaEntrega()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nova Tarefa
              </Button>
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
                    <th className="text-center py-4 px-4 text-white font-semibold text-sm">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {loadingTarefas ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-gray-500 text-sm"
                      >
                        Carregando tarefas...
                      </td>
                    </tr>
                  ) : tarefasEntrega.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-gray-500 text-sm"
                      >
                        Nenhuma tarefa cadastrada. Adicione uma tarefa para
                        começar.
                      </td>
                    </tr>
                  ) : (
                    tarefasEntrega.map((tarefa) => (
                      <tr
                        key={tarefa.id}
                        className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-900 text-sm">
                          {tarefa.nome}
                        </td>
                        <td className="py-3 px-4 text-gray-900 text-sm text-center">
                          {tarefa.sprint || "-"}
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
                                  tipo: "tarefa",
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

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
                <Label>Responsável</Label>
                <Select
                  value={novaTarefaEntrega.responsavel || "sem-responsavel"}
                  onValueChange={(value) =>
                    setNovaTarefaEntrega((prev) => ({
                      ...prev,
                      responsavel: value === "sem-responsavel" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="sem-responsavel">
                      Sem responsável
                    </SelectItem>
                    {usuariosDisponiveis.map((usuario) => (
                      <SelectItem key={usuario.id} value={usuario.name}>
                        {usuario.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        {/* Modal Confirmar Exclusão de Tarefa */}
        <Dialog
          open={modalConfirmDeleteOpen && itemParaDeletar?.tipo === "tarefa"}
          onOpenChange={(open) => {
            if (!open) {
              setModalConfirmDeleteOpen(false);
              setItemParaDeletar(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">
              Deseja realmente excluir a tarefa{" "}
              <strong>"{itemParaDeletar?.nome}"</strong>?
              <br />
              <span className="text-gray-500 text-sm">
                Esta ação não pode ser desfeita.
              </span>
            </p>
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
      </div>
    );
  };

  // Se estiver visualizando um projeto, renderizar os detalhes
  // Obter informações da diretoria do usuário
  const userDiretoria =
    (user as any)?.diretoria || (user?.role === "ADMIN" ? "SGJT" : undefined);
  const isSGJT =
    (user as any)?.is_superadmin === true ||
    (user as any)?.is_domain_root === true;

  return (
    <Layout>
      <div className="space-y-4 lg:space-y-6 page-transition-enter">
        <VoltarCadastros />
        {/* Header com título/botões e seletor de diretoria */}
        {viewingProject || viewingEntrega ? null : (
          // Header quando listando projetos
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <FolderKanban className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Projetos</h1>
          </div>
        )}

        {viewingEntrega ? (
          renderEntregaDetails()
        ) : viewingProject ? (
          renderProjectDetails()
        ) : (
          <>
            {/* Área de ações e filtros */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex flex-col gap-4">
                {/* Linha 1: Botão Novo + Filtros principais */}
                <div className="flex flex-wrap gap-3 items-center">
                  {/* Botão Novo */}
                  <Button
                    onClick={() => handleOpenModal("create")}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-2.5 text-sm shadow-lg shadow-green-500/25 transition-all hover:shadow-xl hover:shadow-green-500/30"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Projeto
                  </Button>

                  {/* Filtro Ancoragem Estratégica */}
                  <Select
                    value={ancoragemFilter}
                    onValueChange={setAncoragemFilter}
                  >
                    <SelectTrigger className="w-[180px] bg-white border-gray-200">
                      <SelectValue placeholder="Planos/Programas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Planos/Programas</SelectItem>
                      {instrumentos.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id.toString()}>
                          {inst.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filtro Execução */}
                  <Select
                    value={execucaoFilter}
                    onValueChange={setExecucaoFilter}
                  >
                    <SelectTrigger className="w-[180px] bg-white border-gray-200">
                      <SelectValue placeholder="Área Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as Áreas</SelectItem>
                      {areasDosProjetos.map((area) => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filtro Gestor */}
                  <Select value={gestorFilter} onValueChange={setGestorFilter}>
                    <SelectTrigger className="w-[180px] bg-white border-gray-200">
                      <SelectValue placeholder="Gestor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Gestores</SelectItem>
                      {gestoresDeProjetos.map((colab) => (
                        <SelectItem key={colab.id} value={colab.id.toString()}>
                          {colab.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filtro Patrocinador */}
                  <Select
                    value={patrocinadorFilter}
                    onValueChange={setPatrocinadorFilter}
                  >
                    <SelectTrigger className="w-[180px] bg-white border-gray-200">
                      <SelectValue placeholder="Patrocinador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">
                        Todos Patrocinadores
                      </SelectItem>
                      {patrocinadoresDeProjetos.map((colab) => (
                        <SelectItem key={colab.id} value={colab.id.toString()}>
                          {colab.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Linha 2: Busca e Status */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome, código, patrocinador ou gestor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] bg-white border-gray-200">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Status</SelectItem>
                      <SelectItem value="planejado">Planejado</SelectItem>
                      <SelectItem value="em_execucao">Em Execução</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="cancelado">Descontinuado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Tabela de Projetos */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <FolderKanban className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-semibold">
                      {filteredProjetos.length}
                    </span>
                    <span className="font-normal text-gray-500">
                      projeto(s) encontrado(s)
                    </span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-amber-100">
                        <TableHead className="font-bold text-gray-800">
                          ID
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Nome do Projeto
                        </TableHead>
                        {isSGJT && (
                          <TableHead className="font-bold text-gray-800">
                            Diretoria
                          </TableHead>
                        )}
                        <TableHead className="font-bold text-gray-800 text-center">
                          TAP
                        </TableHead>
                        <TableHead className="font-bold text-gray-800">
                          Gestor
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 text-center">
                          Área Responsável
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 text-center">
                          Status
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 text-center">
                          Ancoragem Estratégica
                        </TableHead>
                        <TableHead className="font-bold text-gray-800 text-center">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell
                            colSpan={isSGJT ? 8 : 7}
                            className="text-center py-8"
                          >
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredProjetos.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={isSGJT ? 8 : 7}
                            className="text-center py-8 text-gray-500"
                          >
                            Nenhum projeto encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProjetos.map((projeto) => {
                          const areasExecucaoNomes =
                            projeto.areas_execucao_diretorias
                              ?.split(", ")
                              .filter(Boolean) || [];
                          // Usar instrumentos_nomes se disponível, senão usar checkboxes antigos como fallback
                          const ancoragens = projeto.instrumentos_nomes
                            ? Array.from(
                                new Set(
                                  projeto.instrumentos_nomes
                                    .split(", ")
                                    .filter(Boolean),
                                ),
                              )
                            : (() => {
                                const anc = [];
                                if (projeto.ancoragem_estrategica_plano_gestao)
                                  anc.push("Plano de Gestão");
                                if (projeto.ancoragem_estrategica_pep)
                                  anc.push("PEP");
                                if (projeto.ancoragem_estrategica_programa_x)
                                  anc.push("Programa X");
                                return anc;
                              })();
                          return (
                            <TableRow
                              key={projeto.id}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => handleViewProject(projeto)}
                            >
                              <TableCell className="font-mono text-sm">
                                {projeto.tap_id || "-"}
                              </TableCell>
                              <TableCell className="font-medium">
                                {projeto.nome}
                              </TableCell>
                              {isSGJT && (
                                <TableCell className="text-sm">
                                  {projeto.areas_vinculadas_ids &&
                                  projeto.areas_vinculadas_ids.length > 0
                                    ? projeto.areas_vinculadas_ids
                                        .map((areaId) => {
                                          const area = diretorias.find(
                                            (d) => d.id === areaId,
                                          );
                                          return (
                                            area?.sigla ||
                                            (area
                                              ? extrairSigla(area.nome)
                                              : null)
                                          );
                                        })
                                        .filter(Boolean)
                                        .join(", ")
                                    : projeto.diretoria || "-"}
                                </TableCell>
                              )}
                              <TableCell
                                className="text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(() => {
                                  const tap = getTapStatus(projeto);
                                  return (
                                    <Badge
                                      className={`${tap.color} text-xs whitespace-nowrap`}
                                    >
                                      {tap.label}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {projeto.gestor_nome || "-"}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {areasExecucaoNomes.length > 0
                                  ? areasExecucaoNomes.join(", ")
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Select
                                  value={projeto.status}
                                  onValueChange={(value) =>
                                    handleUpdateProjectStatus(projeto.id, value)
                                  }
                                >
                                  <SelectTrigger
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 w-[160px] bg-gray-100 border border-gray-200/50 shadow-none hover:bg-gray-200 transition-colors text-slate-700 font-medium rounded-md mx-auto whitespace-nowrap"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <SelectItem value="planejado">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                                        <span>Planejado</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="em_execucao">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <span>Em Execução</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="concluido">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span>Concluído</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="cancelado">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                                        <span>Descontinuado</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {ancoragens.length > 0
                                  ? ancoragens.join(", ")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 justify-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenModal("view", projeto);
                                    }}
                                    title="Visualizar"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenModal("edit", projeto);
                                    }}
                                    title="Editar"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(projeto.id);
                                    }}
                                    title="Excluir"
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Modal de Projeto - sempre disponível para detalhes ou edição */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center justify-between gap-3">
                <span>
                  {modalMode === "create"
                    ? "Novo Projeto"
                    : modalMode === "edit"
                      ? tapEditSession
                        ? "Editar TAP do Projeto"
                        : "Editar Projeto"
                      : "Visualizar Projeto"}
                  {selectedProjeto?.codigo && (
                    <span className="ml-2 text-gray-500 font-mono text-sm">
                      ({selectedProjeto.codigo})
                    </span>
                  )}
                </span>
                {modalMode === "view" && podeEditarTapProjeto && (
                  <Button size="sm" variant="outline" onClick={handleEditarTap}>
                    Editar TAP
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>

            {tapEditSession && modalMode === "edit" && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <strong>Modo Permissão TAP:</strong> apenas os 13 campos que
                compõem o TAP serão salvos. Alterações em outros campos serão
                ignoradas. Escopo: projetos da diretoria{" "}
                <strong>{permissaoTap?.diretoria}</strong>.
              </div>
            )}

            <div className="space-y-4">
              <Accordion
                type="multiple"
                defaultValue={[
                  "identificacao",
                  "governanca",
                  "escopo",
                  "temporalidade",
                  "classificacao",
                  "riscos",
                  "execucao",
                  "entregas",
                  "formalizacao",
                ]}
                className="w-full"
              >
                {/* SEÇÃO: IDENTIFICAÇÃO DO PROJETO */}
                <AccordionItem value="identificacao">
                  <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4" />
                      Identificação do Projeto
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label
                          className={
                            isTapFieldMissing("nome") ? "text-red-600" : ""
                          }
                        >
                          Nome do Projeto *
                        </Label>
                        <Input
                          value={formData.nome}
                          onChange={(e) => {
                            setFormData({ ...formData, nome: e.target.value });
                            setTapMissingFields((prev) =>
                              prev.filter((f) => tapFieldMap[f] !== "nome"),
                            );
                          }}
                          disabled={modalMode === "view"}
                          placeholder="Digite o nome do projeto"
                          className={
                            isTapFieldMissing("nome") ? "border-red-500" : ""
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Descrição Sintética</Label>
                        <Textarea
                          value={formData.descricao_sintetica}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              descricao_sintetica: e.target.value,
                            })
                          }
                          disabled={modalMode === "view"}
                          placeholder="Breve descrição do projeto"
                          rows={3}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label
                          className={
                            isTapFieldMissing("objetivo") ? "text-red-600" : ""
                          }
                        >
                          Objetivo
                        </Label>
                        <Textarea
                          value={formData.objetivo || ""}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              objetivo: e.target.value,
                            });
                            setTapMissingFields((prev) =>
                              prev.filter((f) => tapFieldMap[f] !== "objetivo"),
                            );
                          }}
                          disabled={modalMode === "view"}
                          placeholder="Descreva o objetivo do projeto"
                          rows={3}
                          className={
                            isTapFieldMissing("objetivo")
                              ? "border-red-500"
                              : ""
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label
                          className={
                            isTapFieldMissing("contexto_justificativa")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Contexto e Justificativa
                        </Label>
                        <Textarea
                          value={formData.contexto_justificativa || ""}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              contexto_justificativa: e.target.value,
                            });
                            setTapMissingFields((prev) =>
                              prev.filter(
                                (f) =>
                                  tapFieldMap[f] !== "contexto_justificativa",
                              ),
                            );
                          }}
                          disabled={modalMode === "view"}
                          placeholder="Descreva o contexto e justificativa do projeto"
                          rows={3}
                          className={
                            isTapFieldMissing("contexto_justificativa")
                              ? "border-red-500"
                              : ""
                          }
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO: GOVERNANÇA E RESPONSÁVEIS */}
                <AccordionItem value="governanca">
                  <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Governança e Responsáveis
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <Label
                          className={
                            isTapFieldMissing("patrocinador_id")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Patrocinador (Sponsor)
                        </Label>
                        <Input
                          placeholder="Digite para buscar..."
                          value={buscaPatrocinador}
                          onChange={(e) => {
                            setBuscaPatrocinador(e.target.value);
                            setShowPatrocinadorList(true);
                            if (!e.target.value)
                              setFormData({
                                ...formData,
                                patrocinador_id: undefined,
                              });
                          }}
                          onFocus={() => setShowPatrocinadorList(true)}
                          onBlur={() =>
                            setTimeout(
                              () => setShowPatrocinadorList(false),
                              200,
                            )
                          }
                          disabled={modalMode === "view"}
                          className={
                            isTapFieldMissing("patrocinador_id")
                              ? "border-red-500"
                              : ""
                          }
                        />
                        {showPatrocinadorList &&
                          buscaPatrocinador.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {colaboradores
                                .filter((c) =>
                                  c.nome
                                    .toLowerCase()
                                    .includes(buscaPatrocinador.toLowerCase()),
                                )
                                .map((c) => (
                                  <div
                                    key={c.id}
                                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                                    onMouseDown={() => {
                                      setFormData({
                                        ...formData,
                                        patrocinador_id: c.id,
                                      });
                                      setBuscaPatrocinador(c.nome);
                                      setShowPatrocinadorList(false);
                                    }}
                                  >
                                    {c.nome}
                                  </div>
                                ))}
                              {colaboradores.filter((c) =>
                                c.nome
                                  .toLowerCase()
                                  .includes(buscaPatrocinador.toLowerCase()),
                              ).length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  Nenhum resultado
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                      <div className="relative">
                        <Label
                          className={
                            isTapFieldMissing("gestor_id") ? "text-red-600" : ""
                          }
                        >
                          Gestor
                        </Label>
                        <Input
                          placeholder="Digite para buscar..."
                          value={buscaGestor}
                          onChange={(e) => {
                            setBuscaGestor(e.target.value);
                            setShowGestorList(true);
                            if (!e.target.value)
                              setFormData({
                                ...formData,
                                gestor_id: undefined,
                              });
                          }}
                          onFocus={() => setShowGestorList(true)}
                          onBlur={() =>
                            setTimeout(() => setShowGestorList(false), 200)
                          }
                          disabled={modalMode === "view"}
                          className={
                            isTapFieldMissing("gestor_id")
                              ? "border-red-500"
                              : ""
                          }
                        />
                        {showGestorList && buscaGestor.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {colaboradores
                              .filter((c) =>
                                c.nome
                                  .toLowerCase()
                                  .includes(buscaGestor.toLowerCase()),
                              )
                              .map((c) => (
                                <div
                                  key={c.id}
                                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                                  onMouseDown={() => {
                                    setFormData({
                                      ...formData,
                                      gestor_id: c.id,
                                    });
                                    setBuscaGestor(c.nome);
                                    setShowGestorList(false);
                                  }}
                                >
                                  {c.nome}
                                </div>
                              ))}
                            {colaboradores.filter((c) =>
                              c.nome
                                .toLowerCase()
                                .includes(buscaGestor.toLowerCase()),
                            ).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">
                                Nenhum resultado
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-blue-700 font-semibold mb-2 block">
                          Diretoria
                        </Label>
                        {/* Diretoria selecionada */}
                        {formData.areas_vinculadas_ids &&
                          formData.areas_vinculadas_ids.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {formData.areas_vinculadas_ids.map((id) => {
                                const dir = diretorias.find((d) => d.id === id);
                                if (!dir) return null;
                                return (
                                  <Badge
                                    key={id}
                                    variant="secondary"
                                    className="bg-blue-100 text-blue-800 px-3 py-1.5 text-sm gap-2"
                                  >
                                    {dir.sigla} - {dir.nome}
                                    {modalMode !== "view" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoverDiretoria(id)
                                        }
                                        className="ml-1 hover:text-red-600 transition-colors"
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        {/* Botão para adicionar diretoria */}
                        {modalMode !== "view" && (
                          <Select
                            value=""
                            onValueChange={handleAdicionarDiretoria}
                          >
                            <SelectTrigger className="w-full bg-white border-gray-300 border-dashed">
                              <div className="flex items-center gap-2 text-gray-500">
                                <Plus className="h-4 w-4" />
                                <span>
                                  {formData.areas_vinculadas_ids?.length
                                    ? "Trocar diretoria"
                                    : "Selecione a diretoria do projeto"}
                                </span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {diretorias
                                .filter(
                                  (dir) =>
                                    !formData.areas_vinculadas_ids?.includes(
                                      dir.id,
                                    ),
                                )
                                .map((dir) => (
                                  <SelectItem
                                    key={dir.id}
                                    value={dir.id.toString()}
                                  >
                                    {dir.sigla} - {dir.nome}
                                  </SelectItem>
                                ))}
                              {diretorias.filter(
                                (dir) =>
                                  !formData.areas_vinculadas_ids?.includes(
                                    dir.id,
                                  ),
                              ).length === 0 && (
                                <SelectItem value="none" disabled>
                                  Nenhuma outra diretoria disponível
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Selecione a diretoria do projeto (apenas uma)
                        </p>
                      </div>

                      {formData.areas_vinculadas_ids &&
                        formData.areas_vinculadas_ids.length > 0 && (
                          <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label className="text-blue-700 font-semibold mb-2 block">
                              Área Responsável
                            </Label>
                            {/* Áreas selecionadas como badges */}
                            {formData.areas_execucao &&
                              formData.areas_execucao.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {formData.areas_execucao.map((id) => {
                                    const unidade = unidadesDiretorias.find(
                                      (u) => u.id === id,
                                    );
                                    if (!unidade) return null;
                                    return (
                                      <Badge
                                        key={id}
                                        variant="secondary"
                                        className="bg-blue-100 text-blue-800 px-2 py-1 text-xs gap-1.5"
                                      >
                                        {unidade.nome}
                                        <span className="text-[9px] text-blue-500">
                                          ({unidade.diretoria_sigla})
                                        </span>
                                        {modalMode !== "view" && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleAreaExecucao(id)
                                            }
                                            className="hover:text-red-600"
                                          >
                                            <XCircle className="h-3 w-3" />
                                          </button>
                                        )}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            {/* Dropdown multi-select */}
                            {modalMode !== "view" &&
                              unidadesDiretorias.length > 0 && (
                                <Select
                                  value=""
                                  onValueChange={(value) => {
                                    const id = parseInt(value);
                                    if (id) toggleAreaExecucao(id);
                                  }}
                                >
                                  <SelectTrigger className="w-full bg-white border-gray-300">
                                    <span className="text-gray-500 text-sm">
                                      {formData.areas_execucao?.length
                                        ? "Trocar área responsável..."
                                        : "Selecionar área responsável..."}
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {unidadesDiretorias.map((unidade) => (
                                      <SelectItem
                                        key={unidade.id}
                                        value={unidade.id.toString()}
                                      >
                                        <div className="flex items-center gap-2">
                                          {formData.areas_execucao?.includes(
                                            unidade.id,
                                          ) && (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                                          )}
                                          <span>{unidade.nome}</span>
                                          <span className="text-[10px] text-gray-400 uppercase">
                                            ({unidade.diretoria_sigla})
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            {unidadesDiretorias.length === 0 && (
                              <p className="text-gray-500 text-sm italic py-2">
                                Nenhuma unidade cadastrada nas diretorias
                                selecionadas.
                              </p>
                            )}
                            {modalMode === "view" &&
                              (!formData.areas_execucao ||
                                formData.areas_execucao.length === 0) && (
                                <p className="text-gray-500 text-sm italic py-2">
                                  Nenhuma área responsável selecionada.
                                </p>
                              )}
                          </div>
                        )}
                      <div className="md:col-span-2">
                        <Label
                          className={
                            isTapFieldMissing("instrumentos")
                              ? "text-red-600 font-semibold mb-2 block"
                              : "font-semibold mb-2 block"
                          }
                        >
                          Ancoragem Estratégica (Planos/Programas)
                        </Label>
                        {/* Itens selecionados como badges removíveis */}
                        {formData.instrumentos_ids &&
                          formData.instrumentos_ids.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {formData.instrumentos_ids.map((id) => {
                                const inst = instrumentos.find(
                                  (i) => i.id === id,
                                );
                                if (!inst) return null;
                                return (
                                  <Badge
                                    key={id}
                                    variant="secondary"
                                    className="bg-blue-100 text-blue-800 px-3 py-1.5 text-sm gap-2"
                                  >
                                    {inst.nome}
                                    <span className="text-[10px] text-blue-500 uppercase">
                                      ({inst.tipo})
                                    </span>
                                    {modalMode !== "view" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setFormData({
                                            ...formData,
                                            instrumentos_ids: (
                                              formData.instrumentos_ids || []
                                            ).filter((x) => x !== id),
                                          })
                                        }
                                        className="ml-1 hover:text-red-600 transition-colors"
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        {/* Botão adicionar — Select que mostra apenas os ainda não selecionados */}
                        {modalMode !== "view" && (
                          <Select
                            value=""
                            onValueChange={(value) => {
                              const id = parseInt(value);
                              if (
                                !id ||
                                formData.instrumentos_ids?.includes(id)
                              )
                                return;
                              setFormData({
                                ...formData,
                                instrumentos_ids: [
                                  ...(formData.instrumentos_ids || []),
                                  id,
                                ],
                              });
                              setTapMissingFields((prev) =>
                                prev.filter(
                                  (f) => tapFieldMap[f] !== "instrumentos",
                                ),
                              );
                            }}
                          >
                            <SelectTrigger
                              className={`w-full bg-white border-gray-300 border-dashed ${isTapFieldMissing("instrumentos") ? "border-red-500" : ""}`}
                            >
                              <div className="flex items-center gap-2 text-gray-500">
                                <Plus className="h-4 w-4" />
                                <span>
                                  {formData.instrumentos_ids?.length
                                    ? "Adicionar outro plano/programa"
                                    : "Selecione um ou mais planos/programas"}
                                </span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {instrumentos
                                .filter(
                                  (i) =>
                                    !formData.instrumentos_ids?.includes(i.id),
                                )
                                .map((i) => (
                                  <SelectItem
                                    key={i.id}
                                    value={i.id.toString()}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span>{i.nome}</span>
                                      <span className="text-[10px] text-gray-400 uppercase">
                                        ({i.tipo})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              {instrumentos.length === 0 && (
                                <SelectItem value="none" disabled>
                                  Nenhum plano/programa cadastrado
                                </SelectItem>
                              )}
                              {instrumentos.length > 0 &&
                                instrumentos.filter(
                                  (i) =>
                                    !formData.instrumentos_ids?.includes(i.id),
                                ).length === 0 && (
                                  <SelectItem value="none" disabled>
                                    Todos os planos/programas já foram
                                    adicionados
                                  </SelectItem>
                                )}
                            </SelectContent>
                          </Select>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Selecione um ou mais planos/programas para ancoragem
                          estratégica
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO: ESCOPO */}
                <AccordionItem value="escopo">
                  <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Escopo
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b">
                    <div className="space-y-4">
                      <div>
                        <Label
                          className={
                            isTapFieldMissing("escopo_sintetico")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Escopo
                        </Label>
                        <Textarea
                          value={formData.escopo_sintetico}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              escopo_sintetico: e.target.value,
                            });
                            setTapMissingFields((prev) =>
                              prev.filter(
                                (f) => tapFieldMap[f] !== "escopo_sintetico",
                              ),
                            );
                          }}
                          disabled={modalMode === "view"}
                          placeholder="Descreva o que está incluído no escopo do projeto"
                          rows={4}
                          className={
                            isTapFieldMissing("escopo_sintetico")
                              ? "border-red-500"
                              : ""
                          }
                        />
                      </div>
                      <div>
                        <Label
                          className={
                            isTapFieldMissing("fora_do_escopo")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Fora do Escopo
                        </Label>
                        <Textarea
                          value={formData.fora_do_escopo}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              fora_do_escopo: e.target.value,
                            });
                            setTapMissingFields((prev) =>
                              prev.filter(
                                (f) => tapFieldMap[f] !== "fora_do_escopo",
                              ),
                            );
                          }}
                          disabled={modalMode === "view"}
                          placeholder="Descreva o que NÃO está incluído no escopo do projeto"
                          rows={4}
                          className={
                            isTapFieldMissing("fora_do_escopo")
                              ? "border-red-500"
                              : ""
                          }
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO: TEMPORALIDADE E SITUAÇÃO */}
                <AccordionItem value="temporalidade">
                  <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Temporalidade e Situação
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label
                          className={
                            isTapFieldMissing("data_prevista_inicio")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Data Prevista de Início
                        </Label>
                        <Input
                          type="date"
                          value={formData.data_prevista_inicio}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              data_prevista_inicio: e.target.value,
                            });
                            setTapMissingFields((prev) =>
                              prev.filter(
                                (f) =>
                                  tapFieldMap[f] !== "data_prevista_inicio",
                              ),
                            );
                          }}
                          disabled={modalMode === "view"}
                          className={
                            isTapFieldMissing("data_prevista_inicio")
                              ? "border-red-500"
                              : ""
                          }
                        />
                      </div>
                      <div>
                        <Label
                          className={
                            isTapFieldMissing("data_prevista_conclusao")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Data Prevista de Conclusão
                        </Label>
                        <Input
                          type="date"
                          value={formData.data_prevista_conclusao}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              data_prevista_conclusao: e.target.value,
                            });
                            setTapMissingFields((prev) =>
                              prev.filter(
                                (f) =>
                                  tapFieldMap[f] !== "data_prevista_conclusao",
                              ),
                            );
                          }}
                          disabled={modalMode === "view"}
                          className={
                            isTapFieldMissing("data_prevista_conclusao")
                              ? "border-red-500"
                              : ""
                          }
                        />
                      </div>
                      {/* Status removido - calculado automaticamente pelas entregas */}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO: CLASSIFICAÇÃO PARA GESTÃO DO PORTFÓLIO */}
                <AccordionItem value="classificacao">
                  <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Classificação para Gestão do Portfólio
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label
                          className={
                            isTapFieldMissing("prioridade")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Prioridade Institucional
                        </Label>
                        <Select
                          value={formData.prioridade}
                          onValueChange={(v) => {
                            setFormData({ ...formData, prioridade: v });
                            setTapMissingFields((prev) =>
                              prev.filter(
                                (f) => tapFieldMap[f] !== "prioridade",
                              ),
                            );
                          }}
                          disabled={modalMode === "view"}
                        >
                          <SelectTrigger
                            className={
                              isTapFieldMissing("prioridade")
                                ? "border-red-500"
                                : ""
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="baixa">Baixa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label
                          className={
                            isTapFieldMissing("complexidade")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Complexidade do Projeto
                        </Label>
                        <Select
                          value={formData.complexidade}
                          onValueChange={(v) => {
                            setFormData({ ...formData, complexidade: v });
                            setTapMissingFields((prev) =>
                              prev.filter(
                                (f) => tapFieldMap[f] !== "complexidade",
                              ),
                            );
                          }}
                          disabled={modalMode === "view"}
                        >
                          <SelectTrigger
                            className={
                              isTapFieldMissing("complexidade")
                                ? "border-red-500"
                                : ""
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Haverá Contratação?</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={formData.havera_contratacao || false}
                              onCheckedChange={(checked) =>
                                setFormData({
                                  ...formData,
                                  havera_contratacao: !!checked,
                                })
                              }
                              disabled={modalMode === "view"}
                            />
                            <span>Sim</span>
                          </label>
                          {formData.havera_contratacao && (
                            <Input
                              type="number"
                              placeholder="Item do PCA"
                              value={formData.valor_estimado_contratacao || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  valor_estimado_contratacao:
                                    parseFloat(e.target.value) || undefined,
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-40"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO: EXECUÇÃO E MONITORAMENTO */}
                <AccordionItem value="execucao">
                  <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Execução e Monitoramento
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Saúde do Projeto</Label>
                        <Select
                          value={formData.saude}
                          onValueChange={(v) =>
                            setFormData({ ...formData, saude: v })
                          }
                          disabled={modalMode === "view"}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="verde">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                Saudável (Verde)
                              </div>
                            </SelectItem>
                            <SelectItem value="amarelo">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                Atenção (Amarelo)
                              </div>
                            </SelectItem>
                            <SelectItem value="vermelho">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                Crítico (Vermelho)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Justificativa da Saúde</Label>
                        <Textarea
                          value={formData.saude_justificativa}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              saude_justificativa: e.target.value,
                            })
                          }
                          disabled={modalMode === "view"}
                          placeholder="Justifique o status de saúde do projeto"
                          rows={2}
                        />
                      </div>
                      {selectedProjeto && (
                        <div className="md:col-span-2">
                          <Label>
                            Progresso ({selectedProjeto.progresso_percentual}%)
                          </Label>
                          <Progress
                            value={selectedProjeto.progresso_percentual}
                            className="mt-2"
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            {selectedProjeto.entregas_concluidas || 0} de{" "}
                            {selectedProjeto.total_entregas || 0} entregas
                            concluídas
                          </p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO: ENTREGAS PREVISTAS */}
                <AccordionItem value="entregas">
                  <AccordionTrigger
                    className={`px-4 rounded-t ${isTapFieldMissing("entregas") ? "bg-red-50" : "bg-amber-50"}`}
                  >
                    <div
                      className={`flex items-center gap-2 ${isTapFieldMissing("entregas") ? "text-red-600" : ""}`}
                    >
                      <Package className="h-4 w-4" />
                      Entregas Previstas{" "}
                      {isTapFieldMissing("entregas") && (
                        <span className="text-xs">(obrigatório para TAP)</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b">
                    <div className="space-y-3">
                      {tempEntregas.length === 0 ? (
                        <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded">
                          Nenhuma entrega cadastrada.{" "}
                          {modalMode !== "view" &&
                            "Adicione usando o formulário abaixo."}
                        </p>
                      ) : (
                        <div className="text-sm text-green-600 mb-2">
                          {tempEntregas.length} entrega(s) cadastrada(s)
                        </div>
                      )}
                      {tempEntregas.map((entrega, idx) => {
                        const areaResp = areas.find(
                          (a) => a.id === entrega.area_responsavel_id,
                        );
                        return (
                          <div
                            key={idx}
                            className="p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex-1 font-medium">
                                {entrega.nome}
                              </span>
                              {areaResp && (
                                <Badge variant="outline">
                                  {areaResp.diretoria} - {areaResp.nome_area}
                                </Badge>
                              )}
                              {entrega.prazo_estimado && (
                                <Badge variant="outline" className="text-xs">
                                  Prazo:{" "}
                                  {formatDatePtBr(entrega.prazo_estimado)}
                                </Badge>
                              )}
                              {modalMode !== "view" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setTempEntregas(
                                      tempEntregas.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <XCircle className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {modalMode !== "view" && (
                        <div className="p-3 border-2 border-dashed rounded-lg bg-blue-50 space-y-2">
                          <div className="flex gap-2 items-center flex-wrap">
                            <Input
                              placeholder="Nome da entrega"
                              value={novaEntrega.nome}
                              onChange={(e) =>
                                setNovaEntrega({
                                  ...novaEntrega,
                                  nome: e.target.value,
                                })
                              }
                              className="flex-1 bg-white min-w-[200px]"
                            />
                            <Input
                              type="date"
                              value={novaEntrega.prazo_estimado}
                              onChange={(e) =>
                                setNovaEntrega({
                                  ...novaEntrega,
                                  prazo_estimado: e.target.value,
                                })
                              }
                              className="w-[160px] bg-white"
                              title="Prazo Estimado"
                            />
                          </div>
                          <div className="relative">
                            <Input
                              placeholder="Buscar área responsável..."
                              value={entregaAreaSearch}
                              onChange={(e) => {
                                setEntregaAreaSearch(e.target.value);
                                setShowEntregaAreaDropdown(true);
                              }}
                              onFocus={() => setShowEntregaAreaDropdown(true)}
                              className="bg-white"
                            />
                            {novaEntrega.area_responsavel_id && (
                              <div className="mt-1">
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-800 gap-1.5"
                                >
                                  {
                                    areas.find(
                                      (a) =>
                                        a.id ===
                                        novaEntrega.area_responsavel_id,
                                    )?.diretoria
                                  }{" "}
                                  -{" "}
                                  {
                                    areas.find(
                                      (a) =>
                                        a.id ===
                                        novaEntrega.area_responsavel_id,
                                    )?.nome_area
                                  }
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNovaEntrega({
                                        ...novaEntrega,
                                        area_responsavel_id: null,
                                      });
                                      setEntregaAreaSearch("");
                                    }}
                                    className="hover:text-red-600"
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </button>
                                </Badge>
                              </div>
                            )}
                            {showEntregaAreaDropdown &&
                              entregaAreaSearch.trim().length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                  {areas
                                    .filter((a) => {
                                      const term =
                                        entregaAreaSearch.toLowerCase();
                                      return (
                                        a.nome_area
                                          .toLowerCase()
                                          .includes(term) ||
                                        a.diretoria.toLowerCase().includes(term)
                                      );
                                    })
                                    .map((area) => (
                                      <button
                                        key={area.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0"
                                        onClick={() => {
                                          setNovaEntrega({
                                            ...novaEntrega,
                                            area_responsavel_id: area.id,
                                          });
                                          setEntregaAreaSearch("");
                                          setShowEntregaAreaDropdown(false);
                                        }}
                                      >
                                        <span className="font-medium">
                                          {area.nome_area}
                                        </span>
                                        <span className="text-xs text-gray-500 ml-2">
                                          ({area.diretoria})
                                        </span>
                                      </button>
                                    ))}
                                  {areas.filter((a) => {
                                    const term =
                                      entregaAreaSearch.toLowerCase();
                                    return (
                                      a.nome_area
                                        .toLowerCase()
                                        .includes(term) ||
                                      a.diretoria.toLowerCase().includes(term)
                                    );
                                  }).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-400">
                                      Nenhuma área encontrada
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={handleAddEntrega}
                              variant="outline"
                              className="bg-white"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                              Entrega
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO: FORMALIZAÇÃO */}
                <AccordionItem value="formalizacao">
                  <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Formalização
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label
                          className={
                            isTapFieldMissing("tap_vinculado")
                              ? "text-red-600"
                              : ""
                          }
                        >
                          Nº do Proad
                        </Label>
                        <Input
                          value={formData.tap_vinculado}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              tap_vinculado: e.target.value,
                            });
                            setTapMissingFields((prev) =>
                              prev.filter(
                                (f) => tapFieldMap[f] !== "tap_vinculado",
                              ),
                            );
                          }}
                          disabled={modalMode === "view"}
                          placeholder="Número do Proad"
                          className={
                            isTapFieldMissing("tap_vinculado")
                              ? "border-red-500"
                              : ""
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Observações Gerais</Label>
                        <Textarea
                          value={formData.observacoes_gerais}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              observacoes_gerais: e.target.value,
                            })
                          }
                          disabled={modalMode === "view"}
                          placeholder="Observações adicionais sobre o projeto"
                          rows={3}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                {modalMode === "view" ? "Fechar" : "Cancelar"}
              </Button>
              {modalMode === "view" && selectedProjeto && (
                <Button
                  onClick={() => setModalMode("edit")}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              )}
              {modalMode !== "view" && (
                <>
                  <Button
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {modalMode === "create"
                      ? "Criar Projeto"
                      : "Salvar Alterações"}
                  </Button>
                  <Button
                    onClick={handlePropostaTAP}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Proposta TAP
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de validação TAP */}
        <Dialog
          open={tapValidationDialogOpen}
          onOpenChange={setTapValidationDialogOpen}
        >
          <DialogContent className="max-w-md">
            {tapMissingFields.length > 0 ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    Campos obrigatórios para emissão do TAP
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Os seguintes campos precisam ser preenchidos para gerar a
                    Proposta TAP:
                  </p>
                  <ul className="space-y-1.5">
                    {tapMissingFields.map((field, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <span className="text-gray-800">{field}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <DialogFooter>
                  <Button onClick={() => setTapValidationDialogOpen(false)}>
                    Entendi
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Proposta TAP pronta
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Todos os requisitos para a geração do TAP já estão
                    preenchidos. Salve o projeto para que o TAP entre no fluxo
                    de validação em 3 camadas.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={() => setTapValidationDialogOpen(false)}>
                    OK
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
