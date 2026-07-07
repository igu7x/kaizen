import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import {
  PcaItem,
  PcaStats,
  PcaFilters,
  PcaStatus,
  CreatePcaItemDto,
  UpdatePcaItemDto,
  MESES_ORDENADOS,
} from "@/types";
import { pcaApi, formatCurrency, getStatusBadgeClass } from "@/services/pcaApi";
import { ComparacaoVersoesDialog } from "@/components/contratacoes/ComparacaoVersoesDialog";
import { areasApi } from "@/services/areasApi";
import { pessoasApi, type Pessoa } from "@/services/pessoasApi";
import type { Area, Unidade } from "@/services/areasApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Search as SearchIcon,
  ChevronRight,
  FolderKanban,
  RefreshCw,
  GitCompare,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from "recharts";

function formatMesAno(mesVal: string): string {
  if (!mesVal) return "";
  // Se for data ISO (YYYY-MM-DD), formata para MM/YYYY
  if (mesVal.includes("-")) {
    const parts = mesVal.split("-");
    if (parts.length >= 2) {
      return `${parts[1]}/${parts[0]}`;
    }
  }
  // Mantém legado caso o back ainda mande "Janeiro"
  const mesesMap: Record<string, string> = {
    Janeiro: "01/2026",
    Fevereiro: "02/2026",
    Março: "03/2026",
    Abril: "04/2026",
    Maio: "05/2026",
    Junho: "06/2026",
    Julho: "07/2026",
    Agosto: "08/2026",
    Setembro: "09/2026",
    Outubro: "10/2026",
    Novembro: "11/2026",
    Dezembro: "12/2026",
  };
  return mesesMap[mesVal] || mesVal;
}

// Helpers para normalizar valores do backend
export function normalizePriority(val?: string) {
  if (!val) return "";
  const v = val.toUpperCase();
  if (v === "ALTO" || v === "1") return "Alto";
  if (v === "MEDIO" || v === "MÉDIO" || v === "2") return "Médio";
  if (v === "BAIXO" || v === "3") return "Baixo";
  return val;
}

export function normalizeStep(val?: string) {
  if (!val) return "";
  const v = val.toUpperCase();
  if (v === "PLANEJAMENTO_DA_CONTRATACAO" || v === "PLANEJAMENTO DA CONTRATAÇÃO") return "Planejamento da Contratação";
  if (v === "SELECAO_DE_FORNECEDOR" || v === "SELEÇÃO DE FORNECEDOR") return "Seleção de Fornecedor";
  if (v === "GESTAO_DO_CONTRATO" || v === "GESTÃO DO CONTRATO") return "Gestão do Contrato";
  return val;
}

export function normalizeResourceType(val?: string) {
  if (!val) return "";
  const v = val.toUpperCase();
  if (v === "CUSTEIO") return "Custeio";
  if (v === "INVESTIMENTO") return "Investimento";
  return val;
}

const STEP_COLORS: Record<string, string> = {
  "Não Iniciada": "#9CA3AF",
  "Planejamento da Contratação": "#2563EB",
  "Seleção de Fornecedor": "#F59E0B",
  "Gestão do Contrato": "#16A34A",
  "Concluído": "#8B5CF6",
};

interface EsteiraContratacoesProps {
  anoSelecionado: number;
  setAnoSelecionado: (ano: number) => void;
}

export function EsteiraContratacoes({ anoSelecionado, setAnoSelecionado }: EsteiraContratacoesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { selectedDirectorate } = useDirectorate();

  // Estados principais
  const [items, setItems] = useState<PcaItem[]>([]);
  const [stats, setStats] = useState<PcaStats | null>(null);
  const [filters, setFilters] = useState<PcaFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
  const [versionsList, setVersionsList] = useState<number[]>([]);

  // Estados de filtros ativos
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterMes, setFilterMes] = useState<string>("all");
  const [filterFase, setFilterFase] = useState<string>("all");

  // Estados dos modais
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateVersionDialogOpen, setIsCreateVersionDialogOpen] = useState(false);
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PcaItem | null>(null);

  // Estados do formulário
  const [formData, setFormData] = useState<CreatePcaItemDto>({
    item_pca: "",
    tipo: "Contratação",
    area_demandante: "",
    objeto: "",
    valor_estimado: 0,
    valor_formalizado: 0,
    data_estimada_contratacao: "",
    status: "Não Iniciada",
    ano: 2026,
    process: "",
    description: "",
    justification: "",
    financial_resource_type: "",
    priority: "",
    step: "",
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Listas para comboboxes de área demandante e responsável
  const [areasList, setAreasList] = useState<Area[]>([]);
  const [unidadesList, setUnidadesList] = useState<Unidade[]>([]);
  const [diretoriasList, setDiretoriasList] = useState<Area[]>([]);
  const [pessoasList, setPessoasList] = useState<Pessoa[]>([]);

  // Estados dos comboboxes de busca
  const [areaSearch, setAreaSearch] = useState("");
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);

  // Apenas Superadmin pode editar/criar e somente na versão Atual
  const isSuperAdmin = (user as any)?.is_superadmin === true;
  const canEdit = isSuperAdmin && selectedVersion === undefined;

  // Resetar versao ao mudar ano
  useEffect(() => {
    setSelectedVersion(undefined);
  }, [anoSelecionado]);

  // Carregar dados ao montar ou mudar o ano
  useEffect(() => {
    loadData();
    areasApi
      .getAll()
      .then(setDiretoriasList)
      .catch(() => { });
    pessoasApi
      .getAll(selectedDirectorate || undefined)
      .then(setPessoasList)
      .catch(() => { });
  }, [anoSelecionado, selectedDirectorate, selectedVersion]);

  // Carregar unidades dependendo da diretoria selecionada no formulário
  useEffect(() => {
    if (formData.id_diretoria) {
      areasApi
        .getUnidades(formData.id_diretoria)
        .then(setUnidadesList)
        .catch(() => setUnidadesList([]));
    } else {
      setUnidadesList([]);
    }
  }, [formData.id_diretoria]);

  async function loadData() {
    try {
      setLoading(true);

      let diretoriaId: number | undefined = undefined;
      if (selectedDirectorate) {
        try {
          const allAreas = await areasApi.getAll();
          setAreasList(allAreas);
          const matchedArea = allAreas.find(
            (a) => a.sigla === selectedDirectorate || a.nome === selectedDirectorate
          );
          if (matchedArea) {
            diretoriaId = matchedArea.id;
          }
        } catch (e) {
          // ignore
        }
      }

      const [itemsData, statsData, filtersData, versionsData] = await Promise.all([
        pcaApi.getPcaItems(anoSelecionado, selectedDirectorate || undefined, selectedVersion),
        pcaApi.getPcaStats(anoSelecionado, selectedDirectorate || undefined, selectedVersion),
        pcaApi.getPcaFilters(),
        pcaApi.getPcaVersions(anoSelecionado)
      ]);
      setItems(itemsData);
      setStats(statsData);
      setFilters(filtersData);
      setVersionsList(versionsData);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  }

  // Filtrar itens
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.item_pca.toLowerCase().includes(term) ||
          item.objeto.toLowerCase().includes(term) ||
          item.area_demandante.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      if (filterArea !== "all" && item.area_demandante !== filterArea)
        return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;

      if (filterTipo !== "all" && (item.tipo || "Contratação") !== filterTipo)
        return false;
      if (filterMes !== "all" && item.data_estimada_contratacao !== filterMes)
        return false;

      const itemFase = normalizeStep(item.step) || "Não Iniciada";
      if (filterFase !== "all" && itemFase !== filterFase)
        return false;

      return true;
    });
  }, [
    items,
    searchTerm,
    filterArea,
    filterStatus,
    filterTipo,
    filterMes,
    filterFase,
  ]);

  // --- Gráficos Data Calculations ---
  const chartDataDemandas = useMemo(() => {
    let sumEstimado = 0;
    let sumFormalizado = 0;
    filteredItems.forEach(item => {
      sumEstimado += Number(item.valor_estimado) || 0;
      sumFormalizado += Number(item.valor_formalizado) || 0;
    });
    return [
      { name: "Soma de Valor Total (R$)", valor: sumEstimado, fill: "#2563EB" },
      { name: "Soma de Valor Ano Referência (R$)", valor: sumFormalizado, fill: "#16A34A" }
    ];
  }, [filteredItems]);

  const chartDataValoresPorTipo = useMemo(() => {
    let sumRenovacaoEst = 0;
    let sumRenovacaoForm = 0;
    let sumNovaEst = 0;
    let sumNovaForm = 0;

    filteredItems.forEach(item => {
      const isRenovacao = item.tipo === "Renovação" || item.contract_type === "Renovação";
      const est = Number(item.valor_estimado) || 0;
      const form = Number(item.valor_formalizado) || 0;
      if (isRenovacao) {
        sumRenovacaoEst += est;
        sumRenovacaoForm += form;
      } else {
        sumNovaEst += est;
        sumNovaForm += form;
      }
    });

    return [
      { tipo: "RENOVAÇÃO", estimado: sumRenovacaoEst, formalizado: sumRenovacaoForm },
      { tipo: "NOVA CONTRATAÇÃO", estimado: sumNovaEst, formalizado: sumNovaForm }
    ];
  }, [filteredItems]);

  const chartDataDatasPorTipo = useMemo(() => {
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const counts = months.map(m => ({ name: m, "NOVA CONTRATAÇÃO": 0, "RENOVAÇÃO": 0 }));

    filteredItems.forEach(item => {
      const dataFormatada = formatMesAno(item.data_estimada_contratacao || item.estimated_date || "");
      if (dataFormatada) {
        const parts = dataFormatada.split("/");
        if (parts.length >= 2) {
          const monthIndex = parseInt(parts[0], 10) - 1;
          if (monthIndex >= 0 && monthIndex < 12) {
            const isRenovacao = item.tipo === "Renovação" || item.contract_type === "Renovação";
            if (isRenovacao) {
              counts[monthIndex]["RENOVAÇÃO"] += 1;
            } else {
              counts[monthIndex]["NOVA CONTRATAÇÃO"] += 1;
            }
          }
        }
      }
    });

    return counts;
  }, [filteredItems]);

  const chartDataFaseAtual = useMemo(() => {
    const faseCounts: Record<string, number> = {};
    filteredItems.forEach(item => {
      let rawFase = item.step || item.status || "Não Iniciada";
      if (item.status === "Concluída") rawFase = "Concluído";

      const fase = normalizeStep(rawFase) || rawFase;
      faseCounts[fase] = (faseCounts[fase] || 0) + 1;
    });

    const fallbackColors = ["#EF4444", "#3B82F6", "#F472B6", "#14B8A6"];
    let fallbackIndex = 0;

    return Object.entries(faseCounts).map(([name, value]) => {
      let fill = STEP_COLORS[name];
      if (!fill) {
        fill = fallbackColors[fallbackIndex % fallbackColors.length];
        fallbackIndex++;
      }
      return { name, value, fill };
    }).sort((a, b) => b.value - a.value);
  }, [filteredItems]);

  // Limpar filtros
  function clearFilters() {
    setSearchTerm("");
    setFilterArea("all");
    setFilterStatus("all");

    setFilterTipo("all");
    setFilterMes("all");
    setFilterFase("all");
  }

  // Validar formulário
  function validateForm(): boolean {
    const errors: string[] = [];

    if (!formData.item_pca.trim()) {
      errors.push("Item do PCA é obrigatório");
    } else if (formData.item_pca.length > 50) {
      errors.push("Item do PCA deve ter no máximo 50 caracteres");
    }

    if (!formData.valor_estimado || formData.valor_estimado <= 0) {
      errors.push("Valor anual deve ser maior que zero");
    }

    if (!formData.data_estimada_contratacao) {
      errors.push("Data estimada de contratação é obrigatória");
    }

    setFormErrors(errors);
    return errors.length === 0;
  }

  // Resetar formulário
  function resetForm() {
    setFormData({
      item_pca: "",
      tipo: "Contratação",
      area_demandante: "",
      id_diretoria: undefined,
      id_area_demandante: undefined,
      objeto: "",
      valor_estimado: 0,
      valor_formalizado: 0,
      data_estimada_contratacao: "",
      status: "Não Iniciada",
      ano: anoSelecionado,
      process: "",
      description: "",
      justification: "",
      financial_resource_type: "",
      priority: "",
      step: "",
    });
    setFormErrors([]);
    setAreaSearch("");
    setAreaDropdownOpen(false);
  }

  const handleCurrencyChange = (field: "valor_estimado" | "valor_formalizado", value: string) => {
    const numericStr = value.replace(/\D/g, "");
    const numericValue = numericStr ? parseInt(numericStr, 10) / 100 : 0;
    setFormData((prev) => ({ ...prev, [field]: numericValue }));
  };

  const formatValueBRL = (val?: number | string) => {
    if (val === undefined || val === null || val === "") return "";
    const num = Number(val);
    if (isNaN(num)) return "";
    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  async function handleCreateSnapshot() {
    try {
      setSaving(true);
      await pcaApi.createPcaSnapshot(anoSelecionado);
      toast({
        title: "Versão gerada",
        description: "A versão histórica foi gerada com sucesso.",
        duration: 3000,
      });
      loadData();
      setIsCreateVersionDialogOpen(false);
    } catch (e) {
      toast({
        title: "Erro",
        description: "Não foi possível gerar a versão.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // Abrir modal de adicionar
  function openAddModal() {
    resetForm();
    setIsAddModalOpen(true);
  }

  // Abrir modal de editar
  function openEditModal(item: PcaItem) {
    setSelectedItem(item);
    setFormData({
      item_pca: item.code || item.item_pca,
      tipo: item.contract_type || item.tipo || "Contratação",
      area_demandante: item.directory_acronym || item.area_demandante,
      id_diretoria: item.id_diretoria,
      id_area_demandante: item.id_area_demandante,
      objeto: item.object_name || item.objeto,
      valor_estimado: item.estimated_value_cents ? item.estimated_value_cents / 100 : item.valor_estimado,
      valor_formalizado: item.valor_formalizado || 0,
      data_estimada_contratacao: item.estimated_date || item.data_estimada_contratacao,
      status: item.status,
      ano: item.ano || (item.year ? parseInt(item.year, 10) : anoSelecionado),
      process: item.process || "",
      description: item.description || "",
      justification: item.justification || "",
      financial_resource_type: normalizeResourceType(item.financial_resource_type) || "",
      priority: normalizePriority(item.priority) || "",
      step: normalizeStep(item.step) || "",
    });
    setFormErrors([]);
    setIsEditModalOpen(true);
  }

  // Abrir diálogo de exclusão
  function openDeleteDialog(item: PcaItem) {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  }

  // Criar novo item (Optimistic Update)
  async function handleCreate() {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const created = await pcaApi.createPcaItem(formData);

      // Optimistic Update - adiciona item à lista imediatamente
      setItems((prev) => [...prev, created]);

      // Atualiza stats
      if (stats) {
        const newStats = { ...stats, total: stats.total + 1 };
        if (created.status === "Concluída") newStats.concluidos++;
        else if (created.status === "Em andamento") newStats.emAndamento++;
        else newStats.naoIniciados++;
        // Garantir que valores são números
        newStats.valorTotal =
          (Number(newStats.valorTotal) || 0) +
          (Number(created.valor_estimado) || 0);
        setStats(newStats);
      }

      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  }

  // Atualizar item existente (Optimistic Update)
  async function handleUpdate() {
    if (!selectedItem || !validateForm()) return;

    const oldItem = selectedItem;

    try {
      setSaving(true);
      const updateData: UpdatePcaItemDto = {
        item_pca: formData.item_pca,
        tipo: formData.tipo,
        area_demandante: formData.area_demandante,
        id_diretoria: formData.id_diretoria,
        id_area_demandante: formData.id_area_demandante,
        objeto: formData.objeto,
        valor_estimado: formData.valor_estimado,
        valor_formalizado: formData.valor_formalizado,
        data_estimada_contratacao: formData.data_estimada_contratacao,
        status: formData.status,
        process: formData.process,
        description: formData.description,
        justification: formData.justification,
        financial_resource_type: formData.financial_resource_type,
        priority: formData.priority,
        step: formData.step,
      };

      const updated = await pcaApi.updatePcaItem(selectedItem.id, updateData);

      // Optimistic Update - atualiza item na lista imediatamente
      setItems((prev) =>
        prev.map((i) => (i.id === selectedItem.id ? updated : i)),
      );

      // Atualiza stats se valor ou status mudou
      if (stats) {
        const newStats = { ...stats };
        // Ajusta valor total (garantindo que valores são números)
        const oldValor = Number(oldItem.valor_estimado) || 0;
        const newValor = Number(updated.valor_estimado) || 0;
        newStats.valorTotal =
          (Number(newStats.valorTotal) || 0) - oldValor + newValor;
        // Ajusta status se mudou
        if (oldItem.status !== updated.status) {
          if (oldItem.status === "Concluída") newStats.concluidos--;
          else if (oldItem.status === "Em andamento") newStats.emAndamento--;
          else newStats.naoIniciados--;
          if (updated.status === "Concluída") newStats.concluidos++;
          else if (updated.status === "Em andamento") newStats.emAndamento++;
          else newStats.naoIniciados++;
        }
        setStats(newStats);
      }

      setIsEditModalOpen(false);
      setSelectedItem(null);
      resetForm();
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  }

  // Atualizar status inline (Optimistic Update)
  async function handleStatusChange(item: PcaItem, newStatus: PcaStatus) {
    const oldStatus = item.status;

    // Optimistic Update - Atualiza UI imediatamente
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
    );

    // Atualiza stats localmente
    if (stats) {
      const newStats = { ...stats };
      // Decrementar contador antigo
      if (oldStatus === "Concluída") newStats.concluidos--;
      else if (oldStatus === "Em andamento") newStats.emAndamento--;
      else newStats.naoIniciados--;
      // Incrementar contador novo
      if (newStatus === "Concluída") newStats.concluidos++;
      else if (newStatus === "Em andamento") newStats.emAndamento++;
      else newStats.naoIniciados++;
      setStats(newStats);
    }

    try {
      await pcaApi.updatePcaItemStatus(item.id, newStatus);
      toast({
        title: "Status atualizado",
        description: `Status alterado para "${newStatus}"`,
        duration: 2000,
      });
    } catch (error: any) {
      // Reverter em caso de erro
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: oldStatus } : i)),
      );
      // Reverter stats
      if (stats) {
        const revertStats = { ...stats };
        if (newStatus === "Concluída") revertStats.concluidos--;
        else if (newStatus === "Em andamento") revertStats.emAndamento--;
        else revertStats.naoIniciados--;
        if (oldStatus === "Concluída") revertStats.concluidos++;
        else if (oldStatus === "Em andamento") revertStats.emAndamento++;
        else revertStats.naoIniciados++;
        setStats(revertStats);
      }
    }
  }

  // Excluir item (Optimistic Update)
  async function handleDelete() {
    if (!selectedItem) return;

    const deletedItem = selectedItem;

    // Optimistic Update - remove item da lista imediatamente
    setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));

    // Atualiza stats (garantindo que valores são números)
    if (stats) {
      const newStats = { ...stats, total: stats.total - 1 };
      if (deletedItem.status === "Concluída") newStats.concluidos--;
      else if (deletedItem.status === "Em andamento") newStats.emAndamento--;
      else newStats.naoIniciados--;
      newStats.valorTotal =
        (Number(newStats.valorTotal) || 0) -
        (Number(deletedItem.valor_estimado) || 0);
      setStats(newStats);
    }

    setIsDeleteDialogOpen(false);
    setSelectedItem(null);

    try {
      setSaving(true);
      await pcaApi.deletePcaItem(deletedItem.id);
    } catch (error: any) {
      // Reverter em caso de erro
      setItems((prev) => [...prev, deletedItem]);
      if (stats) {
        const revertStats = { ...stats, total: stats.total + 1 };
        if (deletedItem.status === "Concluída") revertStats.concluidos++;
        else if (deletedItem.status === "Em andamento")
          revertStats.emAndamento++;
        else revertStats.naoIniciados++;
        revertStats.valorTotal =
          (Number(revertStats.valorTotal) || 0) +
          (Number(deletedItem.valor_estimado) || 0);
        setStats(revertStats);
      }
    } finally {
      setSaving(false);
    }
  }

  // Renderizar status badge
  function renderStatusBadge(status: PcaStatus) {
    if (status === "Concluída") return null;
    const label = status === "Em andamento" ? "Demanda em Andamento" : status;
    return (
      <Badge 
        className={`${getStatusBadgeClass(status)} text-center text-[10px] leading-tight px-1 py-0.5 whitespace-normal break-words max-w-full`}
      >
        {label}
      </Badge>
    );
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dados do PCA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition-enter">
      {/* Seletor de Ano */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={String(anoSelecionado)}
            onValueChange={(v) => setAnoSelecionado(parseInt(v))}
          >
            <SelectTrigger className="w-[130px] h-9 font-medium text-sm bg-white text-gray-700 border-gray-300">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={selectedVersion ? String(selectedVersion) : "atual"}
            onValueChange={(v) => setSelectedVersion(v === "atual" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-[180px] h-9 font-medium text-sm bg-white text-gray-700 border-gray-300">
              <SelectValue placeholder="Versão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="atual">Versão {versionsList.length > 0 ? Math.max(...versionsList) + 1 : 1}</SelectItem>
              {versionsList.map(v => (
                <SelectItem key={v} value={String(v)}>Versão {v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canEdit && selectedVersion === undefined && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateVersionDialogOpen(true)}
              disabled={saving}
              className="text-gray-600 h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Gerar Nova Versão
            </Button>
          )}

          {versionsList.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompareDialogOpen(true)}
              className="text-gray-600 h-9"
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Comparar versões
            </Button>
          )}
        </div>
        {canEdit && selectedVersion === undefined && (
          <Button
            onClick={openAddModal}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Item PCA
          </Button>
        )}
      </div>

      {/* Cards de Estatísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 xl:gap-5 2xl:gap-6">
          <Card className="bg-gray-50 border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total de Itens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-50 border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(stats.valorTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-50 border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Concluídos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.concluidos}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-50 border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Em Andamento</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {stats.emAndamento}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-50 border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Não Iniciados</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {stats.naoIniciados}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-5 2xl:gap-6">

        {/* Gráfico 1: Estimativa de valores das demandas */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4 text-center">
            <CardTitle className="text-sm font-semibold text-gray-800">Estimativa de valores das demandas</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDataDemandas}
                  layout="vertical"
                  margin={{ top: 10, right: 90, left: 0, bottom: 20 }}
                >
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" hide />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={31}>
                    <LabelList
                      dataKey="valor"
                      position="right"
                      formatter={(val: number) => formatCurrency(val)}
                      style={{ fontSize: '10px', fontWeight: 500, fill: '#374151' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-2 text-[10px] text-gray-500 font-medium">
              <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#2563EB]" />Soma de Valor Total (R$)</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#16A34A]" />Soma de Valor Ano Referência (R$)</div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Estimativa de valores por Tipo */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4 text-center">
            <CardTitle className="text-sm font-semibold text-gray-800">Estimativa de valores por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDataValoresPorTipo}
                  layout="vertical"
                  margin={{ top: 10, right: 90, left: 30, bottom: 20 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="tipo"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 500 }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="estimado" name="Soma de Valor Total (R$)" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={21}>
                    <LabelList
                      dataKey="estimado"
                      position="right"
                      formatter={(val: number) => formatCurrency(val)}
                      style={{ fontSize: '9px', fontWeight: 500, fill: '#374151' }}
                    />
                  </Bar>
                  <Bar dataKey="formalizado" name="Soma de Valor Ano Referência (R$)" fill="#16A34A" radius={[0, 4, 4, 0]} barSize={21}>
                    <LabelList
                      dataKey="formalizado"
                      position="right"
                      formatter={(val: number) => formatCurrency(val)}
                      style={{ fontSize: '9px', fontWeight: 500, fill: '#374151' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-2 text-[10px] text-gray-500 font-medium">
              <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#2563EB]" />Soma de Valor Total (R$)</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#16A34A]" />Soma de Valor Ano Referência (R$)</div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 3: Estimativa de datas por Tipo */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex flex-col lg:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2 pt-4 px-4 text-center">
            <CardTitle className="text-sm font-semibold text-gray-800">Estimativa de datas por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartDataDatasPorTipo}
                  margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 500 }}
                  />
                  <YAxis hide />
                  <Tooltip />
                  <Legend
                    iconType="plainline"
                    wrapperStyle={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', paddingTop: '10px' }}
                  />
                  <Line
                    type="linear"
                    dataKey="NOVA CONTRATAÇÃO"
                    stroke="#2563EB"
                    strokeWidth={2}
                    activeDot={{ r: 6 }}
                    dot={{ r: 4, strokeWidth: 2 }}
                  >
                    <LabelList dataKey="NOVA CONTRATAÇÃO" position="top" style={{ fontSize: '10px', fontWeight: 600, fill: '#111827' }} />
                  </Line>
                  <Line
                    type="linear"
                    dataKey="RENOVAÇÃO"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    activeDot={{ r: 6 }}
                    dot={{ r: 4, strokeWidth: 2 }}
                  >
                    <LabelList dataKey="RENOVAÇÃO" position="top" style={{ fontSize: '10px', fontWeight: 600, fill: '#111827' }} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 4: Fase Atual */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex flex-col lg:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2 pt-4 px-4 text-center">
            <CardTitle className="text-sm font-semibold text-gray-800">Fase Atual</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col items-center">
            <div className="flex-1 w-full h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={chartDataFaseAtual}
                    cx="35%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                  >
                    {chartDataFaseAtual.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="value" position="inside" style={{ fill: '#FFF', fontSize: '9px', fontWeight: 600 }} />
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="square"
                    wrapperStyle={{ fontSize: '9px', fontWeight: 500, color: '#4B5563', right: '0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Tabela de Itens */}
      <div className="bg-gray-300 rounded-2xl border border-gray-400 overflow-hidden shadow-sm">
        {/* Header da Tabela */}
        <div className="px-6 py-4 bg-gray-200 border-b border-gray-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-bold text-gray-800">Itens PCA</h3>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 h-10 w-60 bg-white border-gray-300 text-sm rounded-xl focus:border-slate-500 focus:ring-slate-500"
                />
              </div>

              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="h-10 w-44 bg-white border-gray-300 text-sm rounded-xl">
                  <SelectValue placeholder="Contratações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Contratações</SelectItem>
                  <SelectItem value="Contratação">Nova</SelectItem>
                  <SelectItem value="Renovação">Renovação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="hidden lg:flex items-center text-sm font-bold text-gray-800">
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger className="w-40 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                  <span className="whitespace-nowrap">Área Demandante</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {filters?.areasDemandantes.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="w-32 text-center">Valor Global</span>
              <span className="w-32 text-center">Valor {anoSelecionado}</span>
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger className="w-32 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                  <span>Prazo</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filters?.meses.map((mes) => (
                    <SelectItem key={mes} value={mes}>
                      {formatMesAno(mes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-28 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                  <span>Situação</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filters?.statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "Em andamento" ? "Demanda em Andamento" : status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canEdit && <span className="w-20 text-center">Ações</span>}
              <span className="w-8"></span>
            </div>
          </div>
        </div>

        {/* Lista de Itens */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center bg-white">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <FolderKanban className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-gray-700 font-semibold text-lg">
              {items.length === 0
                ? "Nenhum item no PCA"
                : "Nenhum item com os filtros selecionados"}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {items.length === 0
                ? "Não há itens cadastrados ainda."
                : "Tente alterar os filtros para ver mais resultados."}
            </p>
            {items.length > 0 && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                onClick={() => navigate(`/contratacoes-ti/item/${item.id}`)}
                className={`group flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-all cursor-pointer ${index !== filteredItems.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                {/* Info do Item (Item + Objeto na mesma coluna) */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex flex-col items-center gap-3 flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${item.tipo === "Renovação"
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/30"
                        : "bg-gradient-to-br from-blue-600 to-blue-800 shadow-blue-600/30"
                        }`}
                    >
                      {item.tipo === "Renovação" ? (
                        <RefreshCw className="h-5 w-5 text-white" />
                      ) : (
                        <FileText className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium leading-none ${item.tipo === "Renovação"
                        ? "text-emerald-600"
                        : "text-blue-600"
                        }`}
                    >
                      {item.tipo === "Renovação" ? "Renovação" : "Nova"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-gray-900 font-semibold text-base truncate group-hover:text-blue-600 transition-colors">
                        {parseInt(item.item_pca, 10) ? `PCA ${parseInt(item.item_pca, 10)}` : `PCA ${item.item_pca}`}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.description || item.objeto}
                    </p>
                  </div>
                </div>

                {/* Colunas da tabela (desktop) */}
                <div className="hidden lg:flex items-center">
                  {/* Área Demandante */}
                  <div className="w-40 text-center">
                    <span className="text-sm text-gray-700 font-medium">
                      {item.area_demandante}
                    </span>
                  </div>

                  {/* Valor Estimado */}
                  <div className="w-32 text-center">
                    <span className="text-sm text-emerald-700 font-bold">
                      {formatCurrency(item.valor_estimado)}
                    </span>
                  </div>

                  {/* Valor Ano Referência */}
                  <div className="w-32 text-center">
                    <span className="text-sm text-gray-700 font-bold">
                      {formatCurrency(item.valor_formalizado)}
                    </span>
                  </div>

                  {/* Prazo */}
                  <div className="w-32 text-center">
                    <span className="text-sm text-gray-700 font-bold">
                      {item.data_estimada_contratacao}
                    </span>
                  </div>



                  {/* Status */}
                  <div className="w-28 flex flex-col justify-center items-center gap-1">
                    {renderStatusBadge(item.status)}
                    {item.contract_ids && item.contract_ids.split(',').map(idStr => {
                      const id = idStr.trim();
                      if (!id) return null;
                      return (
                        <Badge
                          key={id}
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/contratos-ti/${id}`);
                          }}
                          className="cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] leading-tight px-1 py-0.5"
                        >
                          CT: {id}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Ações */}
                  {canEdit && (
                    <div
                      className="w-20 flex justify-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                        onClick={() => openEditModal(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                        onClick={() => openDeleteDialog(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Chevron */}
                  <div className="w-8 flex justify-center">
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                {/* Mobile: info resumida + chevron */}
                <div className="flex lg:hidden items-center gap-2">
                  <div className="flex flex-col items-end gap-1">
                    {renderStatusBadge(item.status)}
                    {item.contract_ids && (
                      <div className="flex gap-1">
                        {item.contract_ids.split(',').map(idStr => {
                          const id = idStr.trim();
                          if (!id) return null;
                          return (
                            <Badge
                              key={id}
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/contratos-ti/${id}`);
                              }}
                              className="cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] leading-tight px-1 py-0.5"
                            >
                              CT: {id}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Adicionar */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Item PCA</DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para adicionar um novo item ao Plano de
              Contratações.
            </DialogDescription>
          </DialogHeader>

          {formErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">
                Corrija os erros abaixo:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                {formErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 py-4">
            {/* Linha 1 - 4 colunas */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item_pca">Item do PCA *</Label>
                <Input
                  id="item_pca"
                  placeholder="230"
                  value={formData.item_pca}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setFormData({ ...formData, item_pca: val });
                  }}
                />
                <p className="text-[10px] text-gray-500">Adicione apenas o número</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ano">Ano *</Label>
                <Input
                  id="ano"
                  type="number"
                  value={formData.ano}
                  onChange={(e) =>
                    setFormData({ ...formData, ano: parseInt(e.target.value) || new Date().getFullYear() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo || "Contratação"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, tipo: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contratação">Nova</SelectItem>
                    <SelectItem value="Renovação">Renovação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_estimada">Data Estimada *</Label>
                <Select
                  value={formData.data_estimada_contratacao}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      data_estimada_contratacao: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_ORDENADOS.map((mes) => (
                      <SelectItem key={mes} value={mes}>
                        {mes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2 - Diretoria (full width) */}
            <div className="space-y-2">
              <Label htmlFor="id_diretoria">Diretoria</Label>
              <Select
                value={formData.id_diretoria ? String(formData.id_diretoria) : undefined}
                onValueChange={(v) => {
                  const dirId = parseInt(v, 10);
                  const unidade = diretoriasList.find(d => d.id === dirId);
                  setFormData({
                    ...formData,
                    id_diretoria: dirId,
                    area_demandante: unidade?.nome || "",
                    id_area_demandante: undefined
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a Diretoria" />
                </SelectTrigger>
                <SelectContent>
                  {diretoriasList.map(dir => (
                    <SelectItem key={dir.id} value={String(dir.id)}>
                      {dir.sigla ? `${dir.sigla} - ${dir.nome}` : dir.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linha 3 - Área Demandante (full width) */}
            <div className="space-y-2">
              <Label htmlFor="id_area_demandante">Área Demandante</Label>
              <Select
                value={formData.id_area_demandante ? String(formData.id_area_demandante) : undefined}
                onValueChange={(v) =>
                  setFormData({ ...formData, id_area_demandante: parseInt(v, 10) })
                }
                disabled={!formData.id_diretoria}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar área responsável..." />
                </SelectTrigger>
                <SelectContent>
                  {unidadesList.map(u => {
                    const dir = diretoriasList.find(d => d.id === formData.id_diretoria);
                    const sigla = dir?.sigla || dir?.nome;
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nome} {sigla ? `(${sigla})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Linha 4 - Objeto (full width) */}
            <div className="space-y-2">
              <Label htmlFor="objeto">Objeto</Label>
              <Input
                id="objeto"
                placeholder="Descrição detalhada da contratação"
                value={formData.objeto}
                onChange={(e) =>
                  setFormData({ ...formData, objeto: e.target.value })
                }
              />
            </div>

            {/* Linha 5 - Demanda da Unidade (full width) */}
            <div className="space-y-2">
              <Label htmlFor="description">Demanda da Unidade</Label>
              <Textarea
                id="description"
                placeholder="Descrição da demanda da unidade"
                rows={2}
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            {/* Linha 6 - Justificativa (full width) */}
            <div className="space-y-2">
              <Label htmlFor="justification">Justificativa</Label>
              <Textarea
                id="justification"
                placeholder="Justificativa da necessidade"
                rows={2}
                value={formData.justification || ""}
                onChange={(e) =>
                  setFormData({ ...formData, justification: e.target.value })
                }
              />
            </div>

            {/* Linha 7 - 3 colunas */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="financial_resource_type">Tipo de Recurso</Label>
                <Select
                  value={formData.financial_resource_type || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, financial_resource_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Investimento">Investimento</SelectItem>
                    <SelectItem value="Custeio">Custeio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Grau de Prioridade</Label>
                <Select
                  value={formData.priority || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alto">Alto</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="step">Etapa</Label>
                <Select
                  value={formData.step || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, step: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planejamento da Contratação">Planejamento da Contratação</SelectItem>
                    <SelectItem value="Seleção de Fornecedor">Seleção de Fornecedor</SelectItem>
                    <SelectItem value="Gestão do Contrato">Gestão do Contrato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 8 - 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_estimado">Valor Global Estimado (R$) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                  <Input
                    id="valor_estimado"
                    className="pl-9"
                    placeholder="0,00"
                    value={formData.valor_estimado ? formatValueBRL(formData.valor_estimado).replace("R$", "").trim() : ""}
                    onChange={(e) => handleCurrencyChange("valor_estimado", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_formalizado">Valor {anoSelecionado} (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                  <Input
                    id="valor_formalizado"
                    className="pl-9"
                    placeholder="0,00"
                    value={formData.valor_formalizado ? formatValueBRL(formData.valor_formalizado).replace("R$", "").trim() : ""}
                    onChange={(e) => handleCurrencyChange("valor_formalizado", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Linha 9 - 1 coluna */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="process">PROAD</Label>
                <Input
                  id="process"
                  placeholder="202xxxx"
                  value={formData.process || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, process: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Editar */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Item PCA {selectedItem?.item_pca}</DialogTitle>
            <DialogDescription>
              Altere os campos desejados e clique em Salvar.
            </DialogDescription>
          </DialogHeader>

          {formErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">
                Corrija os erros abaixo:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                {formErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 py-4">
            {/* Linha 1 - 4 colunas */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_item_pca">Item do PCA *</Label>
                <Input
                  id="edit_item_pca"
                  placeholder="230"
                  value={formData.item_pca}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setFormData({ ...formData, item_pca: val });
                  }}
                />
                <p className="text-[10px] text-gray-500">Adicione apenas o número</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_ano">Ano *</Label>
                <Input
                  id="edit_ano"
                  type="number"
                  value={formData.ano}
                  onChange={(e) =>
                    setFormData({ ...formData, ano: parseInt(e.target.value) || new Date().getFullYear() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_tipo">Tipo *</Label>
                <Select
                  value={formData.tipo || "Contratação"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, tipo: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contratação">Nova</SelectItem>
                    <SelectItem value="Renovação">Renovação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_data_estimada">Data Estimada *</Label>
                <Select
                  value={formData.data_estimada_contratacao}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      data_estimada_contratacao: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_ORDENADOS.map((mes) => (
                      <SelectItem key={mes} value={mes}>
                        {mes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2 - Diretoria (full width) */}
            <div className="space-y-2">
              <Label htmlFor="edit_id_diretoria">Diretoria</Label>
              <Select
                value={formData.id_diretoria ? String(formData.id_diretoria) : undefined}
                onValueChange={(v) => {
                  const dirId = parseInt(v, 10);
                  const unidade = diretoriasList.find(d => d.id === dirId);
                  setFormData({
                    ...formData,
                    id_diretoria: dirId,
                    area_demandante: unidade?.nome || "",
                    id_area_demandante: undefined
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a Diretoria" />
                </SelectTrigger>
                <SelectContent>
                  {diretoriasList.map(dir => (
                    <SelectItem key={dir.id} value={String(dir.id)}>
                      {dir.sigla ? `${dir.sigla} - ${dir.nome}` : dir.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linha 3 - Área Demandante (full width) */}
            <div className="space-y-2">
              <Label htmlFor="edit_id_area_demandante">Área Demandante</Label>
              <Select
                value={formData.id_area_demandante ? String(formData.id_area_demandante) : undefined}
                onValueChange={(v) =>
                  setFormData({ ...formData, id_area_demandante: parseInt(v, 10) })
                }
                disabled={!formData.id_diretoria}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar área responsável..." />
                </SelectTrigger>
                <SelectContent>
                  {unidadesList.map(u => {
                    const dir = diretoriasList.find(d => d.id === formData.id_diretoria);
                    const sigla = dir?.sigla || dir?.nome;
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nome} {sigla ? `(${sigla})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Linha 4 - Objeto (full width) */}
            <div className="space-y-2">
              <Label htmlFor="edit_objeto">Objeto</Label>
              <Input
                id="edit_objeto"
                placeholder="Descrição detalhada da contratação"
                value={formData.objeto}
                onChange={(e) =>
                  setFormData({ ...formData, objeto: e.target.value })
                }
              />
            </div>

            {/* Linha 5 - Demanda da Unidade (full width) */}
            <div className="space-y-2">
              <Label htmlFor="edit_description">Demanda da Unidade</Label>
              <Textarea
                id="edit_description"
                placeholder="Descrição da demanda da unidade"
                rows={2}
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            {/* Linha 6 - Justificativa (full width) */}
            <div className="space-y-2">
              <Label htmlFor="edit_justification">Justificativa</Label>
              <Textarea
                id="edit_justification"
                placeholder="Justificativa da necessidade"
                rows={2}
                value={formData.justification || ""}
                onChange={(e) =>
                  setFormData({ ...formData, justification: e.target.value })
                }
              />
            </div>

            {/* Linha 7 - 3 colunas */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_financial_resource_type">Tipo de Recurso</Label>
                <Select
                  value={formData.financial_resource_type || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, financial_resource_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Investimento">Investimento</SelectItem>
                    <SelectItem value="Custeio">Custeio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_priority">Grau de Prioridade</Label>
                <Select
                  value={formData.priority || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alto">Alto</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_step">Etapa</Label>
                <Select
                  value={formData.step || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, step: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planejamento da Contratação">Planejamento da Contratação</SelectItem>
                    <SelectItem value="Seleção de Fornecedor">Seleção de Fornecedor</SelectItem>
                    <SelectItem value="Gestão do Contrato">Gestão do Contrato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 8 - 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_valor_estimado">Valor Global Estimado (R$) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                  <Input
                    id="edit_valor_estimado"
                    className="pl-9"
                    placeholder="0,00"
                    value={formData.valor_estimado ? formatValueBRL(formData.valor_estimado).replace("R$", "").trim() : ""}
                    onChange={(e) => handleCurrencyChange("valor_estimado", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_valor_formalizado">Valor {anoSelecionado} (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                  <Input
                    id="edit_valor_formalizado"
                    className="pl-9"
                    placeholder="0,00"
                    value={formData.valor_formalizado ? formatValueBRL(formData.valor_formalizado).replace("R$", "").trim() : ""}
                    onChange={(e) => handleCurrencyChange("valor_formalizado", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Linha 9 - 1 coluna */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_process">PROAD</Label>
                <Input
                  id="edit_process"
                  placeholder="202xxxx"
                  value={formData.process || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, process: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o item{" "}
              <strong>{selectedItem?.item_pca}</strong>?
              <br />
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação de Nova Versão */}
      <ComparacaoVersoesDialog
        open={isCompareDialogOpen}
        onOpenChange={setIsCompareDialogOpen}
        ano={anoSelecionado}
        versionsList={versionsList}
      />

      <AlertDialog
        open={isCreateVersionDialogOpen}
        onOpenChange={setIsCreateVersionDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-blue-600" />
              Confirmar Nova Versão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja gerar nova versão do PCA {anoSelecionado}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateSnapshot}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
