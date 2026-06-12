import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  PcaRenovacao,
  RenovacaoDetails as RenovacaoDetailsType,
  RenovacaoChecklistItem,
  RenovacaoPontoControle,
  RenovacaoPontoControleComTarefas,
  RenovacaoTarefa,
  ChecklistStatus,
  TarefaStatus,
  ValidacaoDgTipo,
  SaveRenovacaoChangesRequest,
} from "@/types";
import { renovacoesDetailsApi } from "@/services/renovacoesApi";
import { formatCurrency, getStatusBadgeClass } from "@/services/pcaApi";
import {
  formatDate,
  formatDateForInput,
  getChecklistStatusBadgeClass,
  getTarefaStatusBadgeClass,
} from "@/services/pcaDetailsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  Building,
  CheckCircle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  AlertTriangle,
  Briefcase,
  RefreshCw,
  ListTodo,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Cores dos indicadores por status
const STATUS_INDICATOR_COLORS: Record<string, string> = {
  "Não Iniciada": "#757575",
  "Em andamento": "#FFA726",
  Concluída: "#66BB6A",
  "Não iniciada": "#757575",
};

function StatusIndicator({ status }: { status: string }) {
  const color = STATUS_INDICATOR_COLORS[status] || "#757575";
  return (
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0 transition-colors duration-300"
      style={{ backgroundColor: color }}
      title={status}
    />
  );
}

interface RenovacaoDetailsProps {
  renovacaoId: number;
}

export function RenovacaoDetails({ renovacaoId }: RenovacaoDetailsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Estados principais
  const [renovacao, setRenovacao] = useState<PcaRenovacao | null>(null);
  const [details, setDetails] = useState<RenovacaoDetailsType | null>(null);
  const [checklist, setChecklist] = useState<RenovacaoChecklistItem[]>([]);
  const [checklistProgress, setChecklistProgress] = useState<number>(0);
  const [pontosControleComTarefas, setPontosControleComTarefas] = useState<
    RenovacaoPontoControleComTarefas[]
  >([]);
  const [tarefas, setTarefas] = useState<RenovacaoTarefa[]>([]);
  const [tarefasOrfas, setTarefasOrfas] = useState<RenovacaoTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados originais para comparação
  const [originalDetails, setOriginalDetails] = useState<{
    validacao_dg_tipo: ValidacaoDgTipo;
    validacao_dg_data: string;
    fase_atual: string;
  } | null>(null);
  const [originalChecklistStatus, setOriginalChecklistStatus] = useState<
    Map<number, ChecklistStatus>
  >(new Map());
  const [originalTarefasStatus, setOriginalTarefasStatus] = useState<
    Map<number, TarefaStatus>
  >(new Map());

  // Estados para campos estáticos
  const [validacaoDgTipo, setValidacaoDgTipo] =
    useState<ValidacaoDgTipo>("Pendente");
  const [validacaoDgData, setValidacaoDgData] = useState<string>("");
  const [faseAtual, setFaseAtual] = useState<string>("");

  // Estados de mudanças locais
  const [localChecklistChanges, setLocalChecklistChanges] = useState<
    Map<number, ChecklistStatus>
  >(new Map());
  const [localTarefasChanges, setLocalTarefasChanges] = useState<
    Map<number, TarefaStatus>
  >(new Map());

  // Estados dos modais
  const [isPontoModalOpen, setIsPontoModalOpen] = useState(false);
  const [isTarefaModalOpen, setIsTarefaModalOpen] = useState(false);
  const [isDeletePontoDialogOpen, setIsDeletePontoDialogOpen] = useState(false);
  const [isDeleteTarefaDialogOpen, setIsDeleteTarefaDialogOpen] =
    useState(false);
  const [isSaveSuccessModalOpen, setIsSaveSuccessModalOpen] = useState(false);
  const [editingPonto, setEditingPonto] =
    useState<RenovacaoPontoControle | null>(null);
  const [editingTarefa, setEditingTarefa] = useState<RenovacaoTarefa | null>(
    null,
  );
  const [deletingPonto, setDeletingPonto] =
    useState<RenovacaoPontoControle | null>(null);
  const [deletingTarefa, setDeletingTarefa] = useState<RenovacaoTarefa | null>(
    null,
  );
  const [selectedPCForTarefa, setSelectedPCForTarefa] = useState<number | null>(
    null,
  );
  const [deletePCWithTarefas, setDeletePCWithTarefas] =
    useState<boolean>(false);

  // Estados dos formulários
  const [pontoForm, setPontoForm] = useState({
    ponto_controle: "",
    data: "",
    proxima_reuniao: "",
  });
  const [tarefaForm, setTarefaForm] = useState({
    tarefa: "",
    responsavel: "",
    prazo: "",
    status: "Não iniciada" as TarefaStatus,
  });
  const [saveResult, setSaveResult] = useState<{
    details: boolean;
    checklist: number;
    tarefas: number;
  } | null>(null);

  const canEdit = user?.role === "MANAGER" || user?.role === "ADMIN";

  // Detecção de mudanças
  const hasUnsavedChanges = useMemo(() => {
    if (!originalDetails) return false;
    const detailsChanged =
      validacaoDgTipo !== originalDetails.validacao_dg_tipo ||
      validacaoDgData !== originalDetails.validacao_dg_data ||
      faseAtual !== originalDetails.fase_atual;
    return (
      detailsChanged ||
      localChecklistChanges.size > 0 ||
      localTarefasChanges.size > 0
    );
  }, [
    validacaoDgTipo,
    validacaoDgData,
    faseAtual,
    originalDetails,
    localChecklistChanges,
    localTarefasChanges,
  ]);

  const changesCount = useMemo(() => {
    let count = 0;
    if (!originalDetails) return count;
    if (validacaoDgTipo !== originalDetails.validacao_dg_tipo) count++;
    if (validacaoDgData !== originalDetails.validacao_dg_data) count++;
    if (faseAtual !== originalDetails.fase_atual) count++;
    count += localChecklistChanges.size;
    count += localTarefasChanges.size;
    return count;
  }, [
    validacaoDgTipo,
    validacaoDgData,
    faseAtual,
    originalDetails,
    localChecklistChanges,
    localTarefasChanges,
  ]);

  // Prevenção de perda de dados
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Atalho Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && canEdit && !saving) {
          handleSaveAllChanges();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, canEdit, saving]);

  // Carregar dados
  useEffect(() => {
    if (renovacaoId) loadData();
  }, [renovacaoId]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await renovacoesDetailsApi.getAllData(renovacaoId);
      setRenovacao(data.renovacao);
      setDetails(data.details);
      setChecklist(data.checklist);
      setChecklistProgress(data.checklistProgress);
      setPontosControleComTarefas(data.pontosControleComTarefas || []);
      setTarefas(data.tarefas);
      setTarefasOrfas(data.tarefasOrfas || []);

      const tipo = data.details?.validacao_dg_tipo || "Pendente";
      const dataVal = data.details?.validacao_dg_data
        ? formatDateForInput(data.details.validacao_dg_data)
        : "";
      const fase = data.details?.fase_atual || "";

      setValidacaoDgTipo(tipo);
      setValidacaoDgData(dataVal);
      setFaseAtual(fase);

      setOriginalDetails({
        validacao_dg_tipo: tipo,
        validacao_dg_data: dataVal,
        fase_atual: fase,
      });

      const checklistMap = new Map<number, ChecklistStatus>();
      data.checklist.forEach((item) => checklistMap.set(item.id, item.status));
      setOriginalChecklistStatus(checklistMap);

      const tarefasMap = new Map<number, TarefaStatus>();
      data.tarefas.forEach((item) => tarefasMap.set(item.id, item.status));
      setOriginalTarefasStatus(tarefasMap);

      setLocalChecklistChanges(new Map());
      setLocalTarefasChanges(new Map());
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  }

  // Handlers de campos estáticos
  function handleValidacaoDgTipoChange(tipo: ValidacaoDgTipo) {
    setValidacaoDgTipo(tipo);
    if (tipo === "Pendente") setValidacaoDgData("");
  }

  function handleChecklistStatusChange(
    item: RenovacaoChecklistItem,
    newStatus: ChecklistStatus,
  ) {
    setChecklist((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
    );
    const originalStatus = originalChecklistStatus.get(item.id);
    setLocalChecklistChanges((prev) => {
      const newMap = new Map(prev);
      if (newStatus === originalStatus) newMap.delete(item.id);
      else newMap.set(item.id, newStatus);
      return newMap;
    });
    // Atualizar progresso
    const completed = checklist.filter((i) =>
      i.id === item.id ? newStatus === "Concluída" : i.status === "Concluída",
    ).length;
    setChecklistProgress(Math.round((completed / checklist.length) * 100));
  }

  function handleTarefaStatusChangeInline(
    tarefa: RenovacaoTarefa,
    newStatus: TarefaStatus,
  ) {
    setTarefas((prev) =>
      prev.map((t) => (t.id === tarefa.id ? { ...t, status: newStatus } : t)),
    );
    setPontosControleComTarefas((prev) =>
      prev.map((pc) => ({
        ...pc,
        tarefas: pc.tarefas.map((t) =>
          t.id === tarefa.id ? { ...t, status: newStatus } : t,
        ),
      })),
    );
    setTarefasOrfas((prev) =>
      prev.map((t) => (t.id === tarefa.id ? { ...t, status: newStatus } : t)),
    );
    const originalStatus = originalTarefasStatus.get(tarefa.id);
    setLocalTarefasChanges((prev) => {
      const newMap = new Map(prev);
      if (newStatus === originalStatus) newMap.delete(tarefa.id);
      else newMap.set(tarefa.id, newStatus);
      return newMap;
    });
  }

  // Salvar todas as mudanças
  async function handleSaveAllChanges() {
    if (validacaoDgTipo === "Data" && !validacaoDgData) {
      toast({
        title: "Erro de validação",
        description: "Selecione uma data para Validação DG",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const changes: SaveRenovacaoChangesRequest = {};
      if (originalDetails) {
        const detailsChanged =
          validacaoDgTipo !== originalDetails.validacao_dg_tipo ||
          validacaoDgData !== originalDetails.validacao_dg_data ||
          faseAtual !== originalDetails.fase_atual;
        if (detailsChanged) {
          changes.details = {
            validacao_dg_tipo: validacaoDgTipo,
            validacao_dg_data:
              validacaoDgTipo === "Data" ? validacaoDgData : null,
            fase_atual: faseAtual || null,
          };
        }
      }
      if (localChecklistChanges.size > 0) {
        changes.checklist_updates = Array.from(
          localChecklistChanges.entries(),
        ).map(([id, status]) => ({ id, status }));
      }
      if (localTarefasChanges.size > 0) {
        changes.tarefas_updates = Array.from(localTarefasChanges.entries()).map(
          ([id, status]) => ({ id, status }),
        );
      }
      const result = await renovacoesDetailsApi.saveAllChanges(
        renovacaoId,
        changes,
      );
      if (result.success) {
        setOriginalDetails({
          validacao_dg_tipo: validacaoDgTipo,
          validacao_dg_data: validacaoDgData,
          fase_atual: faseAtual,
        });
        const newChecklistMap = new Map(originalChecklistStatus);
        localChecklistChanges.forEach((status, id) =>
          newChecklistMap.set(id, status),
        );
        setOriginalChecklistStatus(newChecklistMap);
        const newTarefasMap = new Map(originalTarefasStatus);
        localTarefasChanges.forEach((status, id) =>
          newTarefasMap.set(id, status),
        );
        setOriginalTarefasStatus(newTarefasMap);
        setLocalChecklistChanges(new Map());
        setLocalTarefasChanges(new Map());
        setSaveResult(result.saved_count);
        setIsSaveSuccessModalOpen(true);
      }
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  }

  // CRUD Pontos de Controle
  function openCreatePontoModal() {
    setEditingPonto(null);
    setPontoForm({ ponto_controle: "", data: "", proxima_reuniao: "" });
    setIsPontoModalOpen(true);
  }
  function openEditPontoModal(ponto: RenovacaoPontoControle) {
    setEditingPonto(ponto);
    setPontoForm({
      ponto_controle: ponto.ponto_controle,
      data: formatDateForInput(ponto.data),
      proxima_reuniao: formatDateForInput(ponto.proxima_reuniao),
    });
    setIsPontoModalOpen(true);
  }
  async function handleSavePonto() {
    if (
      !pontoForm.ponto_controle ||
      !pontoForm.data ||
      !pontoForm.proxima_reuniao
    ) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      if (editingPonto) {
        const updated = await renovacoesDetailsApi.updatePontoControle(
          renovacaoId,
          editingPonto.id,
          pontoForm,
        );
        setPontosControleComTarefas((prev) =>
          prev.map((pc) => (pc.id === updated.id ? { ...pc, ...updated } : pc)),
        );
      } else {
        const created = await renovacoesDetailsApi.createPontoControle(
          renovacaoId,
          pontoForm,
        );
        setPontosControleComTarefas((prev) => [
          ...prev,
          { ...created, tarefas: [] },
        ]);
      }
      setIsPontoModalOpen(false);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  }
  async function handleDeletePonto() {
    if (!deletingPonto) return;
    try {
      setSaving(true);
      await renovacoesDetailsApi.deletePontoControle(
        renovacaoId,
        deletingPonto.id,
        deletePCWithTarefas,
      );
      if (!deletePCWithTarefas) {
        const pc = pontosControleComTarefas.find(
          (p) => p.id === deletingPonto.id,
        );
        if (pc && pc.tarefas.length > 0) {
          setTarefasOrfas((prev) => [
            ...prev,
            ...pc.tarefas.map((t) => ({ ...t, ponto_controle_id: null })),
          ]);
        }
      }
      setPontosControleComTarefas((prev) =>
        prev.filter((pc) => pc.id !== deletingPonto.id),
      );
      setIsDeletePontoDialogOpen(false);
      setDeletePCWithTarefas(false);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  }

  // CRUD Tarefas
  function openCreateTarefaModal(pcId: number) {
    setEditingTarefa(null);
    setSelectedPCForTarefa(pcId);
    setTarefaForm({
      tarefa: "",
      responsavel: "",
      prazo: "",
      status: "Não iniciada",
    });
    setIsTarefaModalOpen(true);
  }
  function openEditTarefaModal(tarefa: RenovacaoTarefa) {
    setEditingTarefa(tarefa);
    setSelectedPCForTarefa(tarefa.ponto_controle_id);
    setTarefaForm({
      tarefa: tarefa.tarefa,
      responsavel: tarefa.responsavel,
      prazo: formatDateForInput(tarefa.prazo),
      status: tarefa.status,
    });
    setIsTarefaModalOpen(true);
  }
  async function handleSaveTarefa() {
    if (!tarefaForm.tarefa || !tarefaForm.responsavel || !tarefaForm.prazo) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      if (editingTarefa) {
        const updated = await renovacoesDetailsApi.updateTarefa(
          renovacaoId,
          editingTarefa.id,
          { ...tarefaForm, ponto_controle_id: selectedPCForTarefa },
        );
        setPontosControleComTarefas((prev) =>
          prev.map((pc) => ({
            ...pc,
            tarefas:
              pc.id === selectedPCForTarefa
                ? pc.tarefas.some((t) => t.id === updated.id)
                  ? pc.tarefas.map((t) => (t.id === updated.id ? updated : t))
                  : [...pc.tarefas, updated]
                : pc.tarefas.filter((t) => t.id !== updated.id),
          })),
        );
        setTarefas((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
        if (selectedPCForTarefa === null) {
          setTarefasOrfas((prev) =>
            prev.some((t) => t.id === updated.id)
              ? prev.map((t) => (t.id === updated.id ? updated : t))
              : [...prev, updated],
          );
        } else {
          setTarefasOrfas((prev) => prev.filter((t) => t.id !== updated.id));
        }
      } else {
        const created = await renovacoesDetailsApi.createTarefa(renovacaoId, {
          ...tarefaForm,
          ponto_controle_id: selectedPCForTarefa,
        });
        setTarefas((prev) => [...prev, created]);
        if (selectedPCForTarefa) {
          setPontosControleComTarefas((prev) =>
            prev.map((pc) =>
              pc.id === selectedPCForTarefa
                ? { ...pc, tarefas: [...pc.tarefas, created] }
                : pc,
            ),
          );
        } else {
          setTarefasOrfas((prev) => [...prev, created]);
        }
      }
      setIsTarefaModalOpen(false);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  }
  async function handleDeleteTarefa() {
    if (!deletingTarefa) return;
    try {
      setSaving(true);
      await renovacoesDetailsApi.deleteTarefa(renovacaoId, deletingTarefa.id);
      setTarefas((prev) => prev.filter((t) => t.id !== deletingTarefa.id));
      setPontosControleComTarefas((prev) =>
        prev.map((pc) => ({
          ...pc,
          tarefas: pc.tarefas.filter((t) => t.id !== deletingTarefa.id),
        })),
      );
      setTarefasOrfas((prev) => prev.filter((t) => t.id !== deletingTarefa.id));
      setIsDeleteTarefaDialogOpen(false);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-400">Carregando...</span>
      </div>
    );
  }

  if (!renovacao) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Renovação não encontrada</p>
        <Button
          variant="outline"
          onClick={() => navigate("/contratacoes-ti/renovacoes")}
          className="mt-4"
        >
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/contratacoes-ti/renovacoes")}
          className="w-fit text-gray-600 hover:text-gray-800 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <RefreshCw className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                {renovacao.item_pca} - {renovacao.area_demandante}
              </h1>
              <Badge className={getStatusBadgeClass(renovacao.status)}>
                {renovacao.status}
              </Badge>
            </div>
            <p className="text-gray-500">
              Gestor: {renovacao.gestor_demandante}
            </p>
          </div>
        </div>
      </div>

      {/* Indicador de mudanças não salvas */}
      {hasUnsavedChanges && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <span className="text-yellow-800">
            Você tem {changesCount} alteração(ões) não salva(s)
          </span>
        </div>
      )}

      {/* Informações gerais */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-gray-900">
            Informações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 2xl:gap-6">
            <div>
              <Label className="text-gray-400 text-xs">Contratada</Label>
              <p className="text-gray-900 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400" />
                {renovacao.contratada}
              </p>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Valor Anual</Label>
              <p className="text-gray-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-400" />
                {formatCurrency(renovacao.valor_anual)}
              </p>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">
                Previsão de Renovação
              </Label>
              <p className="text-gray-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                {renovacao.data_estimada_contratacao}
              </p>
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <Label className="text-gray-400 text-xs">Objeto</Label>
              <p className="text-gray-600 text-sm">{renovacao.objeto}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline da Renovação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-blue-600" />
            Timeline da Renovação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Phase Columns - Header + Nodes aligned */}
            <div className="flex w-full">
              {/* Planejamento - 50% */}
              <div className="w-1/2">
                <div className="bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-l-full text-center relative pr-6">
                  Planejamento
                  <svg
                    className="absolute right-0 top-0 h-full w-4 translate-x-full z-10"
                    viewBox="0 0 16 40"
                    preserveAspectRatio="none"
                  >
                    <polygon points="0,0 16,20 0,40" fill="#2563EB" />
                  </svg>
                </div>
                <div className="flex items-center pt-6 pb-8 pl-2">
                  {checklist.map((item, index) => (
                    <div key={item.id} className="flex items-center flex-1">
                      <div className="relative flex-shrink-0">
                        <div className="relative z-10">
                          {canEdit ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="w-9 h-9 rounded-full flex items-center justify-center border-[3px] transition-all duration-300 hover:scale-110 cursor-pointer shadow-sm"
                                  style={{
                                    borderColor:
                                      STATUS_INDICATOR_COLORS[item.status] ||
                                      "#757575",
                                    backgroundColor:
                                      item.status === "Concluída"
                                        ? STATUS_INDICATOR_COLORS[item.status]
                                        : item.status === "Em andamento"
                                          ? `${STATUS_INDICATOR_COLORS[item.status]}20`
                                          : "white",
                                  }}
                                >
                                  {item.status === "Concluída" && (
                                    <Check className="h-4 w-4 text-white" />
                                  )}
                                  {item.status === "Em andamento" && (
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{
                                        backgroundColor:
                                          STATUS_INDICATOR_COLORS[item.status],
                                      }}
                                    />
                                  )}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-48 p-2"
                                side="bottom"
                              >
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-gray-500 px-2 pb-1">
                                    {item.item_nome}
                                  </p>
                                  {(
                                    [
                                      "Não Iniciada",
                                      "Em andamento",
                                      "Concluída",
                                    ] as ChecklistStatus[]
                                  ).map((status) => (
                                    <button
                                      key={status}
                                      onClick={() =>
                                        handleChecklistStatusChange(
                                          item,
                                          status,
                                        )
                                      }
                                      className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-gray-100 flex items-center gap-2 ${item.status === status ? "bg-gray-100 font-medium" : ""}`}
                                    >
                                      <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{
                                          backgroundColor:
                                            STATUS_INDICATOR_COLORS[status] ||
                                            "#757575",
                                        }}
                                      />
                                      {status}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center border-[3px] shadow-sm"
                              style={{
                                borderColor:
                                  STATUS_INDICATOR_COLORS[item.status] ||
                                  "#757575",
                                backgroundColor:
                                  item.status === "Concluída"
                                    ? STATUS_INDICATOR_COLORS[item.status]
                                    : item.status === "Em andamento"
                                      ? `${STATUS_INDICATOR_COLORS[item.status]}20`
                                      : "white",
                              }}
                            >
                              {item.status === "Concluída" && (
                                <Check className="h-4 w-4 text-white" />
                              )}
                              {item.status === "Em andamento" && (
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      STATUS_INDICATOR_COLORS[item.status],
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                        <span
                          className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 font-medium text-center leading-tight whitespace-nowrap"
                          title={item.item_nome}
                        >
                          {item.item_nome}
                        </span>
                      </div>
                      <div className="flex-1 h-[3px] bg-gray-200 mx-1">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: item.status === "Concluída" ? "100%" : "0%",
                            backgroundColor: "#66BB6A",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seleção de Fornecedor - 25% */}
              <div className="w-1/4">
                <div className="bg-emerald-600 text-white text-sm font-semibold py-2 pl-6 pr-4 text-center flex items-center justify-center relative">
                  Seleção de Fornecedor
                  <svg
                    className="absolute right-0 top-0 h-full w-4 translate-x-full z-10"
                    viewBox="0 0 16 40"
                    preserveAspectRatio="none"
                  >
                    <polygon points="0,0 16,20 0,40" fill="#059669" />
                  </svg>
                </div>
                <div className="flex items-center pt-6 pb-8">
                  {[0, 1].map((i) => (
                    <div key={`sel-${i}`} className="flex items-center flex-1">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center border-[3px] border-gray-300 bg-gray-50 shadow-sm opacity-50" />
                      </div>
                      <div className="flex-1 h-[3px] bg-gray-200 mx-1" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Gestão do Contrato - 25% */}
              <div className="w-1/4">
                <div className="bg-amber-500 text-white text-sm font-semibold py-2 pl-6 pr-4 rounded-r-full text-center flex items-center justify-center">
                  Gestão do Contrato
                </div>
                <div className="flex items-center pt-6 pb-8 pr-2">
                  {[0, 1].map((i) => (
                    <div key={`gest-${i}`} className="flex items-center flex-1">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center border-[3px] border-gray-300 bg-gray-50 shadow-sm opacity-50" />
                      </div>
                      {i === 0 && (
                        <div className="flex-1 h-[3px] bg-gray-200 mx-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pontos de Controle */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-gray-900">
              Pontos de Controle
            </CardTitle>
            {canEdit && (
              <Button
                size="sm"
                onClick={openCreatePontoModal}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Novo PC
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pontosControleComTarefas.length === 0 &&
          tarefasOrfas.length === 0 ? (
            <p className="text-gray-400 text-center py-4">
              Nenhum ponto de controle cadastrado
            </p>
          ) : (
            <div className="space-y-4">
              {/* Tarefas órfãs */}
              {tarefasOrfas.length > 0 && (
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm text-yellow-700">
                      Tarefas sem Ponto de Controle
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-100">
                          <TableHead className="text-gray-700 font-bold">
                            Tarefa
                          </TableHead>
                          <TableHead className="text-gray-700 font-bold">
                            Responsável
                          </TableHead>
                          <TableHead className="text-gray-700 font-bold">
                            Prazo
                          </TableHead>
                          <TableHead className="text-gray-700 font-bold">
                            Status
                          </TableHead>
                          {canEdit && (
                            <TableHead className="text-gray-700 font-bold">
                              Ações
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tarefasOrfas.map((tarefa) => (
                          <TableRow key={tarefa.id}>
                            <TableCell className="text-gray-700">
                              {tarefa.tarefa}
                            </TableCell>
                            <TableCell className="text-gray-700">
                              {tarefa.responsavel}
                            </TableCell>
                            <TableCell className="text-gray-700">
                              {formatDate(tarefa.prazo)}
                            </TableCell>
                            <TableCell>
                              {canEdit ? (
                                <Select
                                  value={tarefa.status}
                                  onValueChange={(v: TarefaStatus) =>
                                    handleTarefaStatusChangeInline(tarefa, v)
                                  }
                                >
                                  <SelectTrigger className="w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Não iniciada">
                                      Não iniciada
                                    </SelectItem>
                                    <SelectItem value="Em andamento">
                                      Em andamento
                                    </SelectItem>
                                    <SelectItem value="Concluída">
                                      Concluída
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  className={getTarefaStatusBadgeClass(
                                    tarefa.status,
                                  )}
                                >
                                  {tarefa.status}
                                </Badge>
                              )}
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditTarefaModal(tarefa)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600"
                                    onClick={() => {
                                      setDeletingTarefa(tarefa);
                                      setIsDeleteTarefaDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Pontos de Controle com Tarefas */}
              <Accordion type="multiple" className="space-y-2">
                {pontosControleComTarefas.map((pc) => (
                  <AccordionItem
                    key={pc.id}
                    value={pc.id.toString()}
                    className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-100">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            {pc.ponto_controle}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {pc.tarefas.length} tarefa(s)
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Data: {formatDate(pc.data)}</span>
                          <span>
                            Próx. reunião: {formatDate(pc.proxima_reuniao)}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {canEdit && (
                        <div className="flex gap-2 mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditPontoModal(pc)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar PC
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => {
                              setDeletingPonto(pc);
                              setDeletePCWithTarefas(false);
                              setIsDeletePontoDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Excluir PC
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openCreateTarefaModal(pc.id)}
                            className="ml-auto border-[#0A2547] text-[#0A2547] hover:bg-slate-50"
                            variant="outline"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar Tarefa
                          </Button>
                        </div>
                      )}
                      {pc.tarefas.length === 0 ? (
                        <p className="text-gray-400 text-sm">
                          Nenhuma tarefa neste ponto de controle
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#0A2547]">
                              <TableHead className="text-white">
                                Tarefa
                              </TableHead>
                              <TableHead className="text-white">
                                Responsável
                              </TableHead>
                              <TableHead className="text-white">
                                Prazo
                              </TableHead>
                              <TableHead className="text-white">
                                Status
                              </TableHead>
                              {canEdit && (
                                <TableHead className="text-white">
                                  Ações
                                </TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pc.tarefas.map((tarefa) => (
                              <TableRow
                                key={tarefa.id}
                                className="hover:bg-slate-50"
                              >
                                <TableCell className="text-gray-700">
                                  {tarefa.tarefa}
                                </TableCell>
                                <TableCell className="text-gray-700">
                                  {tarefa.responsavel}
                                </TableCell>
                                <TableCell className="text-gray-700">
                                  {formatDate(tarefa.prazo)}
                                </TableCell>
                                <TableCell>
                                  {canEdit ? (
                                    <Select
                                      value={tarefa.status}
                                      onValueChange={(v: TarefaStatus) =>
                                        handleTarefaStatusChangeInline(
                                          tarefa,
                                          v,
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-36">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Não iniciada">
                                          Não iniciada
                                        </SelectItem>
                                        <SelectItem value="Em andamento">
                                          Em andamento
                                        </SelectItem>
                                        <SelectItem value="Concluída">
                                          Concluída
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge
                                      className={getTarefaStatusBadgeClass(
                                        tarefa.status,
                                      )}
                                    >
                                      {tarefa.status}
                                    </Badge>
                                  )}
                                </TableCell>
                                {canEdit && (
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          openEditTarefaModal(tarefa)
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600"
                                        onClick={() => {
                                          setDeletingTarefa(tarefa);
                                          setIsDeleteTarefaDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão Salvar Flutuante */}
      {canEdit && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            onClick={handleSaveAllChanges}
            disabled={!hasUnsavedChanges || saving}
            className={`shadow-lg ${hasUnsavedChanges ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed opacity-50"}`}
            title="Salvar (Ctrl+S)"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Salvar Mudanças
                {changesCount > 0 && (
                  <Badge className="ml-2 bg-white text-green-600">
                    {changesCount}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Modais */}
      {/* Modal Ponto de Controle */}
      <Dialog open={isPontoModalOpen} onOpenChange={setIsPontoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPonto
                ? "Editar Ponto de Controle"
                : "Novo Ponto de Controle"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ponto de Controle *</Label>
              <Input
                placeholder="Ex: PC-1"
                value={pontoForm.ponto_controle}
                onChange={(e) =>
                  setPontoForm({ ...pontoForm, ponto_controle: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={pontoForm.data}
                onChange={(e) =>
                  setPontoForm({ ...pontoForm, data: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Próxima Reunião *</Label>
              <Input
                type="date"
                value={pontoForm.proxima_reuniao}
                onChange={(e) =>
                  setPontoForm({
                    ...pontoForm,
                    proxima_reuniao: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPontoModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSavePonto} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Tarefa */}
      <Dialog open={isTarefaModalOpen} onOpenChange={setIsTarefaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTarefa ? "Editar Tarefa" : "Nova Tarefa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tarefa *</Label>
              <Input
                placeholder="Descrição da tarefa"
                value={tarefaForm.tarefa}
                onChange={(e) =>
                  setTarefaForm({ ...tarefaForm, tarefa: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Responsável *</Label>
              <Input
                placeholder="Nome do responsável"
                value={tarefaForm.responsavel}
                onChange={(e) =>
                  setTarefaForm({ ...tarefaForm, responsavel: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo *</Label>
              <Input
                type="date"
                value={tarefaForm.prazo}
                onChange={(e) =>
                  setTarefaForm({ ...tarefaForm, prazo: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={tarefaForm.status}
                onValueChange={(v: TarefaStatus) =>
                  setTarefaForm({ ...tarefaForm, status: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Não iniciada">Não iniciada</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTarefaModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveTarefa} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir PC */}
      <AlertDialog
        open={isDeletePontoDialogOpen}
        onOpenChange={setIsDeletePontoDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ponto de Controle</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingPonto &&
              pontosControleComTarefas.find((p) => p.id === deletingPonto.id)
                ?.tarefas.length ? (
                <>
                  Este ponto de controle possui{" "}
                  {
                    pontosControleComTarefas.find(
                      (p) => p.id === deletingPonto.id,
                    )?.tarefas.length
                  }{" "}
                  tarefa(s). O que deseja fazer?
                  <div className="mt-4 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!deletePCWithTarefas}
                        onChange={() => setDeletePCWithTarefas(false)}
                      />
                      Manter tarefas (ficarão sem PC associado)
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={deletePCWithTarefas}
                        onChange={() => setDeletePCWithTarefas(true)}
                      />
                      Excluir tarefas junto com o PC
                    </label>
                  </div>
                </>
              ) : (
                "Tem certeza que deseja excluir este ponto de controle?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePonto}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Excluir Tarefa */}
      <AlertDialog
        open={isDeleteTarefaDialogOpen}
        onOpenChange={setIsDeleteTarefaDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tarefa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarefa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTarefa}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Sucesso */}
      <Dialog
        open={isSaveSuccessModalOpen}
        onOpenChange={setIsSaveSuccessModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Mudanças Salvas!
            </DialogTitle>
          </DialogHeader>
          {saveResult && (
            <div className="py-4">
              <p className="text-gray-600 mb-3">
                As seguintes alterações foram salvas:
              </p>
              <ul className="space-y-1 text-sm">
                {saveResult.details && <li>✓ Campos estáticos atualizados</li>}
                {saveResult.checklist > 0 && (
                  <li>✓ {saveResult.checklist} item(ns) do checklist</li>
                )}
                {saveResult.tarefas > 0 && (
                  <li>✓ {saveResult.tarefas} tarefa(s)</li>
                )}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsSaveSuccessModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
