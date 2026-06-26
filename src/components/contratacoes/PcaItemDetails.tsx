import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  PcaItem,
  PcaItemDetails as PcaItemDetailsType,
  PcaChecklistItem,
  PcaChecklistProgress,
  PcaPontoControle,
  PcaPontoControleComTarefas,
  PcaTarefa,
  ChecklistStatus,
  TarefaStatus,
  ValidacaoDgTipo,
  CreatePontoControleDto,
  UpdatePontoControleDto,
  CreateTarefaDto,
  UpdateTarefaDto,
  SaveAllChangesRequest,
} from "@/types";
import {
  pcaDetailsApi,
  formatDate,
  formatDateForInput,
  getChecklistStatusBadgeClass,
  getTarefaStatusBadgeClass,
  saveAllChanges,
} from "@/services/pcaDetailsApi";
import { formatCurrency, getStatusBadgeClass } from "@/services/pcaApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  FileText,
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
  Check,
  ChevronRight,
  ChevronDown,
  ListTodo,
  AlertCircle,
} from "lucide-react";

// Cores dos indicadores por status
const STATUS_INDICATOR_COLORS: Record<string, string> = {
  "Não Iniciada": "#757575", // Cinza
  "Em andamento": "#FFA726", // Amarelo/Laranja
  Concluída: "#66BB6A", // Verde
  "Não iniciada": "#757575", // Variação para tarefas
};

// Componente de indicador visual (bolinha colorida)
function StatusIndicator({ status }: { status: string }) {
  const color = STATUS_INDICATOR_COLORS[status] || "#757575";

  return (
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0 transition-colors duration-300"
      style={{ backgroundColor: color }}
      title={status}
      aria-label={`Status: ${status}`}
    />
  );
}

export function PcaItemDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Estados principais
  const [pcaItem, setPcaItem] = useState<PcaItem | null>(null);
  const [details, setDetails] = useState<PcaItemDetailsType | null>(null);
  const [checklist, setChecklist] = useState<PcaChecklistItem[]>([]);
  const [checklistProgress, setChecklistProgress] =
    useState<PcaChecklistProgress>({ total: 0, concluidos: 0, percentual: 0 });
  const [pontosControle, setPontosControle] = useState<PcaPontoControle[]>([]);
  const [pontosControleComTarefas, setPontosControleComTarefas] = useState<
    PcaPontoControleComTarefas[]
  >([]);
  const [tarefas, setTarefas] = useState<PcaTarefa[]>([]);
  const [tarefasOrfas, setTarefasOrfas] = useState<PcaTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados para hierarquia PC > Tarefas
  const [expandedPCs, setExpandedPCs] = useState<string[]>([]);
  const [selectedPCForTarefa, setSelectedPCForTarefa] = useState<number | null>(
    null,
  );
  const [deletePCWithTarefas, setDeletePCWithTarefas] =
    useState<boolean>(false);

  // Estados originais para comparação (detectar mudanças)
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

  // Estados de mudanças locais (ainda não salvas)
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
  const [editingPonto, setEditingPonto] = useState<PcaPontoControle | null>(
    null,
  );
  const [editingTarefa, setEditingTarefa] = useState<PcaTarefa | null>(null);
  const [deletingPonto, setDeletingPonto] = useState<PcaPontoControle | null>(
    null,
  );
  const [deletingTarefa, setDeletingTarefa] = useState<PcaTarefa | null>(null);

  // Estados do formulário de ponto de controle
  const [pontoForm, setPontoForm] = useState<CreatePontoControleDto>({
    ponto_controle: "",
    data: "",
    proxima_reuniao: "",
  });

  // Estados do formulário de tarefa
  const [tarefaForm, setTarefaForm] = useState<CreateTarefaDto>({
    tarefa: "",
    responsavel: "",
    prazo: "",
    status: "Não iniciada",
  });

  // Estado para o resultado do salvamento
  const [saveResult, setSaveResult] = useState<{
    details: number;
    checklist: number;
    tarefas: number;
  } | null>(null);

  // Verificar se usuário pode editar
  const canEdit = user?.role === "MANAGER" || user?.role === "ADMIN";
  const pcaItemId = parseInt(id || "0");

  // ============================================================
  // DETECÇÃO DE MUDANÇAS NÃO SALVAS
  // ============================================================

  const hasUnsavedChanges = useMemo(() => {
    if (!originalDetails) return false;

    // Verificar mudanças em detalhes
    const detailsChanged =
      validacaoDgTipo !== originalDetails.validacao_dg_tipo ||
      validacaoDgData !== originalDetails.validacao_dg_data ||
      faseAtual !== originalDetails.fase_atual;

    // Verificar mudanças em checklist
    const checklistChanged = localChecklistChanges.size > 0;

    // Verificar mudanças em tarefas
    const tarefasChanged = localTarefasChanges.size > 0;

    return detailsChanged || checklistChanged || tarefasChanged;
  }, [
    validacaoDgTipo,
    validacaoDgData,
    faseAtual,
    originalDetails,
    localChecklistChanges,
    localTarefasChanges,
  ]);

  // Contar número de mudanças
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

  // ============================================================
  // PREVENÇÃO DE PERDA DE DADOS
  // ============================================================

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

  // Atalho de teclado Ctrl+S
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

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

  useEffect(() => {
    if (pcaItemId) {
      loadData();
    }
  }, [pcaItemId]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await pcaDetailsApi.getPcaItemAllDetails(pcaItemId);
      setPcaItem(data.pcaItem);
      setDetails(data.details);
      setChecklist(data.checklist);
      setChecklistProgress(data.checklistProgress);
      setPontosControle(data.pontosControle);
      setPontosControleComTarefas(data.pontosControleComTarefas || []);
      setTarefas(data.tarefas);
      setTarefasOrfas(data.tarefasOrfas || []);

      // Inicializar campos estáticos
      const tipo = data.details?.validacao_dg_tipo || "Pendente";
      const dataVal = data.details?.validacao_dg_data
        ? formatDateForInput(data.details.validacao_dg_data)
        : "";
      const fase = data.details?.fase_atual || "";

      setValidacaoDgTipo(tipo);
      setValidacaoDgData(dataVal);
      setFaseAtual(fase);

      // Guardar valores originais para comparação
      setOriginalDetails({
        validacao_dg_tipo: tipo,
        validacao_dg_data: dataVal,
        fase_atual: fase,
      });

      // Guardar status original do checklist
      const checklistMap = new Map<number, ChecklistStatus>();
      data.checklist.forEach((item) => checklistMap.set(item.id, item.status));
      setOriginalChecklistStatus(checklistMap);

      // Guardar status original das tarefas
      const tarefasMap = new Map<number, TarefaStatus>();
      data.tarefas.forEach((item) => tarefasMap.set(item.id, item.status));
      setOriginalTarefasStatus(tarefasMap);

      // Limpar mudanças locais
      setLocalChecklistChanges(new Map());
      setLocalTarefasChanges(new Map());
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // HANDLERS DOS CAMPOS ESTÁTICOS (sem auto-save)
  // ============================================================

  function handleValidacaoDgTipoChange(tipo: ValidacaoDgTipo) {
    setValidacaoDgTipo(tipo);
    if (tipo === "Pendente") {
      setValidacaoDgData("");
    }
  }

  function handleValidacaoDgDataChange(data: string) {
    setValidacaoDgData(data);
  }

  function handleFaseAtualChange(value: string) {
    if (value.length <= 20) {
      setFaseAtual(value);
    }
  }

  // ============================================================
  // HANDLERS DO CHECKLIST (sem auto-save)
  // ============================================================

  function handleChecklistStatusChange(
    item: PcaChecklistItem,
    newStatus: ChecklistStatus,
  ) {
    // Atualizar estado local para exibição imediata
    setChecklist((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
    );

    // Verificar se é uma mudança real (diferente do original)
    const originalStatus = originalChecklistStatus.get(item.id);

    setLocalChecklistChanges((prev) => {
      const newMap = new Map(prev);
      if (newStatus === originalStatus) {
        // Voltou ao original, remover da lista de mudanças
        newMap.delete(item.id);
      } else {
        // Diferente do original, adicionar à lista de mudanças
        newMap.set(item.id, newStatus);
      }
      return newMap;
    });

    // Recalcular progresso localmente
    const updatedChecklist = checklist.map((i) =>
      i.id === item.id ? { ...i, status: newStatus } : i,
    );
    const concluidos = updatedChecklist.filter(
      (i) => i.status === "Concluída",
    ).length;
    setChecklistProgress({
      total: updatedChecklist.length,
      concluidos,
      percentual: Math.round((concluidos / updatedChecklist.length) * 100),
    });
  }

  // ============================================================
  // HANDLERS DE TAREFAS (status inline sem auto-save)
  // ============================================================

  function handleTarefaStatusChangeInline(
    tarefa: PcaTarefa,
    newStatus: TarefaStatus,
  ) {
    // Atualizar estado local para exibição imediata em todas as estruturas
    setTarefas((prev) =>
      prev.map((t) => (t.id === tarefa.id ? { ...t, status: newStatus } : t)),
    );

    // Atualizar também na estrutura hierárquica (pontosControleComTarefas)
    setPontosControleComTarefas((prev) =>
      prev.map((pc) => ({
        ...pc,
        tarefas: pc.tarefas.map((t) =>
          t.id === tarefa.id ? { ...t, status: newStatus } : t,
        ),
      })),
    );

    // Atualizar também nas tarefas órfãs se necessário
    setTarefasOrfas((prev) =>
      prev.map((t) => (t.id === tarefa.id ? { ...t, status: newStatus } : t)),
    );

    // Verificar se é uma mudança real
    const originalStatus = originalTarefasStatus.get(tarefa.id);

    setLocalTarefasChanges((prev) => {
      const newMap = new Map(prev);
      if (newStatus === originalStatus) {
        newMap.delete(tarefa.id);
      } else {
        newMap.set(tarefa.id, newStatus);
      }
      return newMap;
    });
  }

  // ============================================================
  // SALVAMENTO EM LOTE
  // ============================================================

  async function handleSaveAllChanges() {
    // Validações
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

      // Construir objeto de mudanças
      const changes: SaveAllChangesRequest = {};

      // Verificar mudanças em detalhes
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

      // Adicionar mudanças do checklist
      if (localChecklistChanges.size > 0) {
        changes.checklist_updates = Array.from(
          localChecklistChanges.entries(),
        ).map(([id, status]) => ({
          id,
          status,
        }));
      }

      // Adicionar mudanças das tarefas
      if (localTarefasChanges.size > 0) {
        changes.tarefas_updates = Array.from(localTarefasChanges.entries()).map(
          ([id, status]) => ({
            id,
            status,
          }),
        );
      }

      // Salvar
      const result = await saveAllChanges(pcaItemId, changes);

      if (result.success) {
        // Atualizar valores originais
        setOriginalDetails({
          validacao_dg_tipo: validacaoDgTipo,
          validacao_dg_data: validacaoDgData,
          fase_atual: faseAtual,
        });

        // Atualizar status original do checklist
        const newChecklistMap = new Map(originalChecklistStatus);
        localChecklistChanges.forEach((status, id) => {
          newChecklistMap.set(id, status);
        });
        setOriginalChecklistStatus(newChecklistMap);

        // Atualizar status original das tarefas
        const newTarefasMap = new Map(originalTarefasStatus);
        localTarefasChanges.forEach((status, id) => {
          newTarefasMap.set(id, status);
        });
        setOriginalTarefasStatus(newTarefasMap);

        // Limpar mudanças locais
        setLocalChecklistChanges(new Map());
        setLocalTarefasChanges(new Map());

        // Mostrar modal de sucesso
        setSaveResult(result.saved_count);
        setIsSaveSuccessModalOpen(true);
      } else {
      }
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // HANDLERS DE PONTOS DE CONTROLE (salvamento imediato)
  // ============================================================

  function openAddPontoModal() {
    setEditingPonto(null);
    setPontoForm({ ponto_controle: "", data: "", proxima_reuniao: "" });
    setIsPontoModalOpen(true);
  }

  function openEditPontoModal(ponto: PcaPontoControle) {
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
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      if (editingPonto) {
        const updated = await pcaDetailsApi.updatePontoControle(
          pcaItemId,
          editingPonto.id,
          pontoForm,
        );
        // Optimistic Update
        setPontosControle((prev) =>
          prev.map((p) => (p.id === editingPonto.id ? updated : p)),
        );
        setPontosControleComTarefas((prev) =>
          prev.map((pc) =>
            pc.id === editingPonto.id ? { ...pc, ...updated } : pc,
          ),
        );
      } else {
        const created = await pcaDetailsApi.createPontoControle(
          pcaItemId,
          pontoForm,
        );
        // Optimistic Update - adiciona novo PC com array vazio de tarefas
        setPontosControle((prev) =>
          [...prev, created].sort((a, b) =>
            a.ponto_controle.localeCompare(b.ponto_controle),
          ),
        );
        setPontosControleComTarefas((prev) =>
          [...prev, { ...created, tarefas: [] }].sort((a, b) =>
            a.ponto_controle.localeCompare(b.ponto_controle),
          ),
        );
      }
      setIsPontoModalOpen(false);
    } catch (error: any) {
      // Recarregar em caso de erro para sincronizar
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePonto() {
    if (!deletingPonto) return;

    const deletedPonto = deletingPonto;
    const hadTarefas =
      pontosControleComTarefas.find((pc) => pc.id === deletedPonto.id)
        ?.tarefas || [];

    // Optimistic Update - remove PC imediatamente
    setPontosControle((prev) => prev.filter((p) => p.id !== deletedPonto.id));
    setPontosControleComTarefas((prev) =>
      prev.filter((pc) => pc.id !== deletedPonto.id),
    );

    // Se mantém tarefas, adiciona às órfãs
    if (!deletePCWithTarefas && hadTarefas.length > 0) {
      setTarefasOrfas((prev) => [
        ...prev,
        ...hadTarefas.map((t) => ({ ...t, ponto_controle_id: null })),
      ]);
    }

    setIsDeletePontoDialogOpen(false);
    setDeletingPonto(null);

    try {
      setSaving(true);
      const result = await pcaDetailsApi.deletePontoControle(
        pcaItemId,
        deletedPonto.id,
        deletePCWithTarefas,
      );

      let msg = "Ponto de controle excluído!";
      if (result.tarefas_afetadas > 0) {
        msg += deletePCWithTarefas
          ? ` ${result.tarefas_afetadas} tarefa(s) também excluídas.`
          : ` ${result.tarefas_afetadas} tarefa(s) sem PC.`;
      }
      toast({ title: msg, duration: 3000 });
    } catch (error) {
      // Reverter em caso de erro
      setPontosControle((prev) =>
        [...prev, deletedPonto].sort((a, b) =>
          a.ponto_controle.localeCompare(b.ponto_controle),
        ),
      );
      setPontosControleComTarefas((prev) =>
        [...prev, { ...deletedPonto, tarefas: hadTarefas }].sort((a, b) =>
          a.ponto_controle.localeCompare(b.ponto_controle),
        ),
      );
      if (!deletePCWithTarefas && hadTarefas.length > 0) {
        setTarefasOrfas((prev) =>
          prev.filter((t) => !hadTarefas.some((ht) => ht.id === t.id)),
        );
      }
    } finally {
      setSaving(false);
      setDeletePCWithTarefas(false);
    }
  }

  // ============================================================
  // HANDLERS DE TAREFAS (criação/edição/exclusão imediatas)
  // ============================================================

  function openAddTarefaModal() {
    setEditingTarefa(null);
    setTarefaForm({
      tarefa: "",
      responsavel: "",
      prazo: "",
      status: "Não iniciada",
    });
    setIsTarefaModalOpen(true);
  }

  function openEditTarefaModal(tarefa: PcaTarefa) {
    setEditingTarefa(tarefa);
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
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      if (editingTarefa) {
        const updated = await pcaDetailsApi.updateTarefa(
          pcaItemId,
          editingTarefa.id,
          tarefaForm,
        );

        // Optimistic Update - atualiza em todas as estruturas
        setTarefas((prev) =>
          prev.map((t) => (t.id === editingTarefa.id ? updated : t)),
        );
        setPontosControleComTarefas((prev) =>
          prev.map((pc) => ({
            ...pc,
            tarefas: pc.tarefas.map((t) =>
              t.id === editingTarefa.id ? updated : t,
            ),
          })),
        );

        // Atualizar status original
        setOriginalTarefasStatus((prev) => {
          const newMap = new Map(prev);
          newMap.set(editingTarefa.id, updated.status);
          return newMap;
        });
        // Remover das mudanças locais se houver
        setLocalTarefasChanges((prev) => {
          const newMap = new Map(prev);
          newMap.delete(editingTarefa.id);
          return newMap;
        });
      } else {
        // Criar tarefa com ponto_controle_id se selecionado
        const createData = {
          ...tarefaForm,
          ponto_controle_id: selectedPCForTarefa,
        };
        const created = await pcaDetailsApi.createTarefa(pcaItemId, createData);

        // Optimistic Update
        setTarefas((prev) =>
          [...prev, created].sort(
            (a, b) => new Date(a.prazo).getTime() - new Date(b.prazo).getTime(),
          ),
        );

        // Adiciona ao PC específico ou às órfãs
        if (selectedPCForTarefa) {
          setPontosControleComTarefas((prev) =>
            prev.map((pc) =>
              pc.id === selectedPCForTarefa
                ? {
                  ...pc,
                  tarefas: [...pc.tarefas, created].sort(
                    (a, b) =>
                      new Date(a.prazo).getTime() -
                      new Date(b.prazo).getTime(),
                  ),
                }
                : pc,
            ),
          );
        } else {
          setTarefasOrfas((prev) =>
            [...prev, created].sort(
              (a, b) =>
                new Date(a.prazo).getTime() - new Date(b.prazo).getTime(),
            ),
          );
        }

        // Adicionar ao status original
        setOriginalTarefasStatus((prev) => {
          const newMap = new Map(prev);
          newMap.set(created.id, created.status);
          return newMap;
        });
        toast({ title: "Tarefa criada!", duration: 2000 });
      }
      setIsTarefaModalOpen(false);
      setSelectedPCForTarefa(null);
    } catch (error: any) {
      // Recarregar em caso de erro para sincronizar
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTarefa() {
    if (!deletingTarefa) return;

    const deletedTarefa = deletingTarefa;

    // Optimistic Update - remove tarefa imediatamente de todas as estruturas
    setTarefas((prev) => prev.filter((t) => t.id !== deletedTarefa.id));
    setTarefasOrfas((prev) => prev.filter((t) => t.id !== deletedTarefa.id));
    setPontosControleComTarefas((prev) =>
      prev.map((pc) => ({
        ...pc,
        tarefas: pc.tarefas.filter((t) => t.id !== deletedTarefa.id),
      })),
    );

    // Remover do status original e das mudanças locais
    setOriginalTarefasStatus((prev) => {
      const newMap = new Map(prev);
      newMap.delete(deletedTarefa.id);
      return newMap;
    });
    setLocalTarefasChanges((prev) => {
      const newMap = new Map(prev);
      newMap.delete(deletedTarefa.id);
      return newMap;
    });

    setIsDeleteTarefaDialogOpen(false);
    setDeletingTarefa(null);

    try {
      setSaving(true);
      await pcaDetailsApi.deleteTarefa(pcaItemId, deletedTarefa.id);
    } catch (error) {
      // Reverter em caso de erro
      setTarefas((prev) =>
        [...prev, deletedTarefa].sort(
          (a, b) => new Date(a.prazo).getTime() - new Date(b.prazo).getTime(),
        ),
      );
      if (deletedTarefa.ponto_controle_id) {
        setPontosControleComTarefas((prev) =>
          prev.map((pc) =>
            pc.id === deletedTarefa.ponto_controle_id
              ? {
                ...pc,
                tarefas: [...pc.tarefas, deletedTarefa].sort(
                  (a, b) =>
                    new Date(a.prazo).getTime() - new Date(b.prazo).getTime(),
                ),
              }
              : pc,
          ),
        );
      } else {
        setTarefasOrfas((prev) =>
          [...prev, deletedTarefa].sort(
            (a, b) => new Date(a.prazo).getTime() - new Date(b.prazo).getTime(),
          ),
        );
      }
      setOriginalTarefasStatus((prev) => {
        const newMap = new Map(prev);
        newMap.set(deletedTarefa.id, deletedTarefa.status);
        return newMap;
      });
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (!pcaItem) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">
          Item não encontrado
        </h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/contratacoes-ti")}
        >
          Voltar para Esteira
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (hasUnsavedChanges) {
                if (
                  window.confirm(
                    "Você tem alterações não salvas. Deseja sair mesmo assim?",
                  )
                ) {
                  navigate("/contratacoes-ti");
                }
              } else {
                navigate("/contratacoes-ti");
              }
            }}
            className="mb-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {pcaItem.item_pca} - {pcaItem.area_demandante}
            </h1>
            <Badge className={getStatusBadgeClass(pcaItem.status)}>
              {pcaItem.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Aviso de Alterações Não Salvas */}
      {hasUnsavedChanges && canEdit && (
        <Alert className="bg-amber-50 border-amber-300">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription className="ml-2">
            <span className="font-semibold text-amber-800">
              ⚠️ Você tem {changesCount} alteração
              {changesCount > 1 ? "ões" : ""} não salva
              {changesCount > 1 ? "s" : ""}
            </span>
            <span className="text-amber-700 ml-2">
              Clique em "Salvar Mudanças" para salvar suas edições
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Informações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Informações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-500 text-xs uppercase">Descrição / Demanda da Unidade</Label>
            <p className="mt-1 whitespace-pre-wrap text-gray-700">{pcaItem.description || pcaItem.objeto}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-500 text-xs uppercase">
                Valor Estimado
              </Label>
              <p className="font-medium flex items-center gap-2 mt-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                {formatCurrency(pcaItem.valor_estimado)}
              </p>
            </div>
            <div>
              <Label className="text-gray-500 text-xs uppercase">
                Previsão de Contratação
              </Label>
              <p className="font-medium flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-blue-600" />
                {pcaItem.data_estimada_contratacao}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline da Contratação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-blue-600" />
            Timeline da Contratação
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

      {/* Pontos de Controle e Tarefas - HIERARQUIA */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-sky-600" />
            Pontos de Controle e Tarefas
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={openAddPontoModal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Novo PC
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tarefas Órfãs */}
          {tarefasOrfas.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">Tarefas sem PC associado</span>
                <Badge variant="outline" className="bg-amber-100">
                  {tarefasOrfas.length}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-200">
                    <TableHead className="text-amber-900 font-bold">
                      Tarefa
                    </TableHead>
                    <TableHead className="text-amber-900 font-bold">
                      Responsável
                    </TableHead>
                    <TableHead className="text-amber-900 font-bold">
                      Prazo
                    </TableHead>
                    <TableHead className="text-amber-900 font-bold">
                      Status
                    </TableHead>
                    {canEdit && (
                      <TableHead className="text-amber-900 font-bold w-48">
                        Associar a PC
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarefasOrfas.map((tarefa) => (
                    <TableRow
                      key={tarefa.id}
                      className="bg-white hover:bg-amber-50"
                    >
                      <TableCell className="font-medium">
                        {tarefa.tarefa}
                      </TableCell>
                      <TableCell>{tarefa.responsavel}</TableCell>
                      <TableCell>{formatDate(tarefa.prazo)}</TableCell>
                      <TableCell>
                        <Badge
                          className={getTarefaStatusBadgeClass(tarefa.status)}
                        >
                          {tarefa.status}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Select
                            onValueChange={async (pcId) => {
                              try {
                                await pcaDetailsApi.associarTarefaAPontoControle(
                                  pcaItemId,
                                  tarefa.id,
                                  parseInt(pcId),
                                );
                                toast({ title: "Tarefa associada ao PC!" });
                                loadData();
                              } catch (err: any) {
                                /* erro já tratado pelo apiClient ou ignorado intencionalmente */
                              }
                            }}
                          >
                            <SelectTrigger className="w-40 border-amber-400">
                              <SelectValue placeholder="Selecionar PC" />
                            </SelectTrigger>
                            <SelectContent>
                              {pontosControle.map((pc) => (
                                <SelectItem key={pc.id} value={String(pc.id)}>
                                  {pc.ponto_controle}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Accordion de Pontos de Controle */}
          {pontosControleComTarefas.length === 0 &&
            tarefasOrfas.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <ListTodo className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhum ponto de controle cadastrado</p>
            </div>
          ) : (
            <Accordion
              type="multiple"
              value={expandedPCs}
              onValueChange={setExpandedPCs}
              className="space-y-3"
            >
              {pontosControleComTarefas.map((pc) => (
                <AccordionItem
                  key={pc.id}
                  value={`pc-${pc.id}`}
                  className="border border-sky-200 rounded-lg bg-sky-50 overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-sky-100">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-sky-800">
                          {pc.ponto_controle}
                        </span>
                        <span className="text-sm text-sky-600">|</span>
                        <span className="text-sm text-sky-700">
                          Data: {formatDate(pc.data)}
                        </span>
                        <span className="text-sm text-sky-600">|</span>
                        <span className="text-sm text-sky-700">
                          Próx. Reunião: {formatDate(pc.proxima_reuniao)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="bg-white text-sky-700 border-sky-300"
                        >
                          {pc.tarefas.length}{" "}
                          {pc.tarefas.length === 1 ? "tarefa" : "tarefas"}
                        </Badge>
                        {canEdit && (
                          <div
                            className="flex gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-sky-700 hover:bg-sky-200"
                              onClick={() => openEditPontoModal(pc)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-100"
                              onClick={() => {
                                setDeletingPonto(pc);
                                setDeletePCWithTarefas(false);
                                setIsDeletePontoDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="ml-4 mt-2 bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4
                          className="font-semibold flex items-center gap-2"
                          style={{ color: "#0A2547" }}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Tarefas deste Ponto de Controle
                        </h4>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="hover:bg-slate-50"
                            style={{ borderColor: "#0A2547", color: "#0A2547" }}
                            onClick={() => {
                              setSelectedPCForTarefa(pc.id);
                              openAddTarefaModal();
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Tarefa
                          </Button>
                        )}
                      </div>
                      {pc.tarefas.length === 0 ? (
                        <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                          Nenhuma tarefa cadastrada neste PC
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow style={{ backgroundColor: "#0A2547" }}>
                              <TableHead className="text-white font-bold">
                                Tarefa
                              </TableHead>
                              <TableHead className="text-white font-bold">
                                Responsável
                              </TableHead>
                              <TableHead className="text-white font-bold">
                                Prazo
                              </TableHead>
                              <TableHead className="text-white font-bold">
                                Status
                              </TableHead>
                              {canEdit && (
                                <TableHead className="text-white font-bold w-24">
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
                                <TableCell className="font-medium">
                                  {tarefa.tarefa}
                                </TableCell>
                                <TableCell>{tarefa.responsavel}</TableCell>
                                <TableCell>
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
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Botão Flutuante Salvar Mudanças */}
      {canEdit && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            onClick={handleSaveAllChanges}
            disabled={!hasUnsavedChanges || saving}
            className={`
                            shadow-lg transition-all duration-300
                            ${hasUnsavedChanges
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed opacity-50"
              }
                        `}
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

      {/* Modal de Ponto de Controle */}
      <Dialog open={isPontoModalOpen} onOpenChange={setIsPontoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPonto
                ? "Editar Ponto de Controle"
                : "Novo Ponto de Controle"}
            </DialogTitle>
            <DialogDescription>Preencha os campos abaixo.</DialogDescription>
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
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSavePonto} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Tarefa */}
      <Dialog open={isTarefaModalOpen} onOpenChange={setIsTarefaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTarefa ? "Editar Tarefa" : "Nova Tarefa"}
            </DialogTitle>
            <DialogDescription>Preencha os campos abaixo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tarefa *</Label>
              <Input
                placeholder="Ex: Elaborar ETP"
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
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveTarefa} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação - Excluir Ponto */}
      <AlertDialog
        open={isDeletePontoDialogOpen}
        onOpenChange={(open) => {
          setIsDeletePontoDialogOpen(open);
          if (!open) setDeletePCWithTarefas(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Excluir Ponto de Controle
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Tem certeza que deseja excluir{" "}
                  <strong>{deletingPonto?.ponto_controle}</strong>?
                </p>

                {/* Verificar se tem tarefas */}
                {deletingPonto &&
                  pontosControleComTarefas.find(
                    (pc) => pc.id === deletingPonto.id,
                  )?.tarefas.length ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="font-medium text-amber-800 mb-2">
                      Este ponto possui{" "}
                      {
                        pontosControleComTarefas.find(
                          (pc) => pc.id === deletingPonto.id,
                        )?.tarefas.length
                      }{" "}
                      tarefa(s) associada(s).
                    </p>
                    <p className="text-sm text-amber-700 mb-3">
                      O que deseja fazer com elas?
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteTarefas"
                          checked={!deletePCWithTarefas}
                          onChange={() => setDeletePCWithTarefas(false)}
                          className="text-sky-600"
                        />
                        <span className="text-sm">
                          Manter tarefas (ficarão sem PC associado)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteTarefas"
                          checked={deletePCWithTarefas}
                          onChange={() => setDeletePCWithTarefas(true)}
                          className="text-red-600"
                        />
                        <span className="text-sm text-red-700 font-medium">
                          Excluir tudo (PC e tarefas)
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">
                    Este ponto de controle não possui tarefas associadas.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePonto}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deletePCWithTarefas ? "Excluir Tudo" : "Excluir PC"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação - Excluir Tarefa */}
      <AlertDialog
        open={isDeleteTarefaDialogOpen}
        onOpenChange={setIsDeleteTarefaDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tarefa{" "}
              <strong>{deletingTarefa?.tarefa}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTarefa}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Sucesso ao Salvar */}
      <Dialog
        open={isSaveSuccessModalOpen}
        onOpenChange={setIsSaveSuccessModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-6 w-6" />
              Alterações Salvas com Sucesso!
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">O que foi salvo:</p>
            <ul className="space-y-2">
              {saveResult && saveResult.details > 0 && (
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Campos de acompanhamento atualizados</span>
                </li>
              )}
              {saveResult && saveResult.checklist > 0 && (
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>
                    {saveResult.checklist} item(ns) do checklist atualizado(s)
                  </span>
                </li>
              )}
              {saveResult && saveResult.tarefas > 0 && (
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{saveResult.tarefas} tarefa(s) atualizada(s)</span>
                </li>
              )}
            </ul>
            <p className="text-gray-500 mt-4 text-sm">
              Todas as mudanças foram salvas no sistema.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSaveSuccessModalOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
