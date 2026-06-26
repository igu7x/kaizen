import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { useGestao } from "@/contexts/GestaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import {
  Pencil,
  Trash2,
  Plus,
  Link as LinkIcon,
  Target,
  CheckCircle2,
  Clock,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/services/api";
import { metasApi, Meta } from "@/services/metasApi";
import { areasApi, Area } from "@/services/areasApi";
import {
  Objective,
  KeyResult,
  OKRStatus,
  OKRSituation,
  DirectorateInfo,
} from "@/types";
import { OKRStatsCards } from "./OKRStatsCards";
import { CardIndicador } from "./CardIndicador";
import { GraficoRosca } from "./GraficoRosca";
import { useEstrategiaModelo } from "@/contexts/EstrategiaModeloContext";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export function MonitoramentoOKRs() {
  const { objectives, keyResults, refreshData } = useGestao();
  const { user } = useAuth();
  const { selectedDirectorate } = useDirectorate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [krDialogOpen, setKrDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(
    null,
  );
  const [editingKR, setEditingKR] = useState<KeyResult | null>(null);
  const [editingKRStatus, setEditingKRStatus] = useState<KeyResult | null>(
    null,
  );
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>("");

  // Estados de loading e erro
  const [savingObjective, setSavingObjective] = useState(false);
  const [savingKR, setSavingKR] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const [directorates, setDirectorates] = useState<DirectorateInfo[]>([]);
  const [loadingDirectorates, setLoadingDirectorates] = useState(false);
  const [proadLinkDialogOpen, setProadLinkDialogOpen] = useState(false);
  const [savingProadLink, setSavingProadLink] = useState(false);
  const [proadLinkDraft, setProadLinkDraft] = useState("");

  // Modelo de estratégia from context
  const { modelo: activeView } = useEstrategiaModelo();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingMetas, setLoadingMetas] = useState(false);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

  // Apenas ADMIN pode criar/editar/excluir
  const canFullEdit = user?.role === "ADMIN";
  // GESTOR pode apenas alterar o STATUS das KRs
  const canEditStatus = user?.role === "MANAGER" || user?.role === "ADMIN";

  useEffect(() => {
    const loadDirectorates = async () => {
      setLoadingDirectorates(true);
      try {
        const dirs = await api.getDirectorates();
        setDirectorates(dirs);
      } catch (err) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoadingDirectorates(false);
      }
    };

    loadDirectorates();
  }, []);

  // Animação da barra de progresso: cresce de 0 ao valor real
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [animatedProgressMetas, setAnimatedProgressMetas] = useState(0);

  // Load metas and areas when switching to metas view
  const loadMetas = async () => {
    setLoadingMetas(true);
    try {
      const data = await metasApi.getAll();
      setMetas(data);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingMetas(false);
    }
  };

  useEffect(() => {
    if (activeView === "metas") {
      loadMetas();
      areasApi
        .getAll()
        .then(setAreas)
        .catch((err) => undefined);
    }
  }, [activeView]);

  const filteredMetas = useMemo(() => {
    return metas.filter(
      (m) =>
        m.areaSigla === selectedDirectorate ||
        m.areaNome === selectedDirectorate,
    );
  }, [metas, selectedDirectorate]);

  const metaStats = useMemo(() => {
    const total = filteredMetas.length;
    const concluido = filteredMetas.filter(
      (m) => m.status === "CONCLUIDO",
    ).length;
    const emAndamento = filteredMetas.filter(
      (m) => m.status === "EM_ANDAMENTO",
    ).length;
    const aIniciar = filteredMetas.filter(
      (m) => m.status === "NAO_INICIADO",
    ).length;
    return { total, concluido, emAndamento, aIniciar };
  }, [filteredMetas]);

  const situacaoMetas = useMemo(() => {
    const noPrazo = filteredMetas.filter(
      (m) => m.situacao === "NO_PRAZO",
    ).length;
    const finalizado = filteredMetas.filter(
      (m) => m.situacao === "FINALIZADO",
    ).length;
    const emAtraso = filteredMetas.filter(
      (m) => m.situacao === "EM_ATRASO",
    ).length;
    return [
      { name: "No prazo", value: noPrazo },
      { name: "Finalizado", value: finalizado },
      { name: "Em atraso", value: emAtraso },
    ];
  }, [filteredMetas]);

  const progressoMetasPercent = useMemo(() => {
    const total = filteredMetas.length;
    const concluido = filteredMetas.filter(
      (m) => m.status === "CONCLUIDO",
    ).length;
    return total > 0 ? Math.round((concluido / total) * 100) : 0;
  }, [filteredMetas]);

  const handleSaveMeta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const titulo = formData.get("titulo") as string;
    const descricao = formData.get("descricao") as string;
    const areaId = formData.get("areaId") as string;
    const status = formData.get("status") as string;
    const situacao = formData.get("situacao") as string;
    const prazo = formData.get("prazo") as string;

    if (!titulo?.trim() || !areaId) {
      toast.warning("Por favor, preencha os campos obrigatórios.");
      return;
    }

    setSavingMeta(true);
    try {
      if (editingMeta) {
        await metasApi.update(editingMeta.id, {
          titulo: titulo.trim(),
          descricao: descricao?.trim() || undefined,
          areaId: Number(areaId),
          status,
          situacao,
          prazo: prazo?.trim() || undefined,
        });
      } else {
        await metasApi.create({
          titulo: titulo.trim(),
          descricao: descricao?.trim() || undefined,
          areaId: Number(areaId),
          status,
          situacao,
          prazo: prazo?.trim() || undefined,
        });
      }
      await loadMetas();
      setMetaDialogOpen(false);
      setEditingMeta(null);
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDeleteMeta = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta meta?")) {
      try {
        await metasApi.remove(id);
        await loadMetas();
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    }
  };

  const selectedDirectorateInfo = useMemo(() => {
    return directorates.find((d) => d.code === selectedDirectorate) || null;
  }, [directorates, selectedDirectorate]);

  const proadLink = (selectedDirectorateInfo?.proad_link || "")
    .toString()
    .trim();

  // Filtrar por diretoria e ordenar por código para manter posição consistente
  // "KRs Transversais" deve aparecer por último
  const filteredObjectives = useMemo(() => {
    return objectives
      .filter((obj) => obj.directorate === selectedDirectorate)
      .sort((a, b) => {
        // KRs Transversais sempre por último
        const aIsTransversal =
          a.code.toLowerCase().includes("transversa") ||
          a.title?.toLowerCase().includes("transversa");
        const bIsTransversal =
          b.code.toLowerCase().includes("transversa") ||
          b.title?.toLowerCase().includes("transversa");

        if (aIsTransversal && !bIsTransversal) return 1;
        if (!aIsTransversal && bIsTransversal) return -1;

        return a.code.localeCompare(b.code);
      });
  }, [objectives, selectedDirectorate]);

  const filteredKeyResults = useMemo(() => {
    return keyResults.filter((kr) => kr.directorate === selectedDirectorate);
  }, [keyResults, selectedDirectorate]);

  const situacaoOKRs = useMemo(() => {
    const noPrazo = filteredKeyResults.filter(
      (kr) => kr.situation === "NO_PRAZO",
    ).length;
    const finalizado = filteredKeyResults.filter(
      (kr) => kr.situation === "FINALIZADO",
    ).length;
    const emAtraso = filteredKeyResults.filter(
      (kr) => kr.situation === "EM_ATRASO",
    ).length;
    return [
      { name: "No prazo", value: noPrazo },
      { name: "Finalizado", value: finalizado },
      { name: "Em atraso", value: emAtraso },
    ];
  }, [filteredKeyResults]);

  const progressoPercent = useMemo(() => {
    const total = filteredKeyResults.length;
    const concluido = filteredKeyResults.filter(
      (kr) => kr.status === "CONCLUIDO",
    ).length;
    return total > 0 ? Math.round((concluido / total) * 100) : 0;
  }, [filteredKeyResults]);

  // Animar barra de progresso OKRs
  useEffect(() => {
    setAnimatedProgress(0);
    const timer = setTimeout(() => setAnimatedProgress(progressoPercent), 100);
    return () => clearTimeout(timer);
  }, [progressoPercent, activeView]);

  // Animar barra de progresso Metas
  useEffect(() => {
    setAnimatedProgressMetas(0);
    const timer = setTimeout(
      () => setAnimatedProgressMetas(progressoMetasPercent),
      100,
    );
    return () => clearTimeout(timer);
  }, [progressoMetasPercent, activeView]);

  const handleSaveObjective = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const code = formData.get("code") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    // Validação no frontend
    if (!code?.trim() || !title?.trim()) {
      toast.warning(
        "Por favor, preencha os campos obrigatórios: Código e Título",
      );
      return;
    }

    const data = {
      code: code.trim(),
      title: title.trim(),
      description: description?.trim() || "",
      directorate: selectedDirectorate,
    };

    setSavingObjective(true);

    try {
      if (editingObjective) {
        await api.updateObjective(editingObjective.id, data);
      } else {
        const result = await api.createObjective(data);
      }

      await refreshData();
      setDialogOpen(false);
      setEditingObjective(null);

      // Limpar formulário (resetar o form)
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      // Mostrar mensagem de erro específica
      if (error.status === 409) {
      } else if (error.status === 400) {
      } else {
      }
    } finally {
      setSavingObjective(false);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    if (
      confirm(
        "Tem certeza que deseja excluir este objetivo e todos os seus KRs?",
      )
    ) {
      try {
        await api.deleteObjective(id);
        await refreshData();
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    }
  };

  const handleSaveKR = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const objectiveId = formData.get("objectiveId") as string;
    const code = formData.get("code") as string;
    const description = formData.get("description") as string;

    if (!objectiveId || !code?.trim() || !description?.trim()) {
      toast.warning("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const data = {
      objectiveId,
      code: code.trim(),
      description: description.trim(),
      status: formData.get("status") as OKRStatus,
      situation: (formData.get("situation") as OKRSituation) || "NO_PRAZO",
      deadline: formData.get("deadline") as string,
      directorate: selectedDirectorate,
    };

    setSavingKR(true);

    try {
      if (editingKR) {
        await api.updateKeyResult(editingKR.id, data);
      } else {
        await api.createKeyResult(data);
      }
      await refreshData();
      setKrDialogOpen(false);
      setEditingKR(null);
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSavingKR(false);
    }
  };

  const handleSaveKRStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!editingKRStatus) return;

    const data = {
      status: formData.get("status") as OKRStatus,
    };

    setSavingStatus(true);

    try {
      await api.updateKeyResult(editingKRStatus.id, data);
      await refreshData();
      setStatusDialogOpen(false);
      setEditingKRStatus(null);
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDeleteKR = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este KR?")) {
      try {
        await api.deleteKeyResult(id);
        await refreshData();
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    }
  };

  const getStatusBadge = (status: OKRStatus) => {
    const config = {
      CONCLUIDO: {
        variant: "default" as BadgeVariant,
        label: "Concluído",
        className: "bg-green-500 hover:bg-green-600 text-white border-0",
      },
      EM_ANDAMENTO: {
        variant: "default" as BadgeVariant,
        label: "Em andamento",
        className: "bg-yellow-400 hover:bg-yellow-500 text-gray-900 border-0",
      },
      NAO_INICIADO: {
        variant: "default" as BadgeVariant,
        label: "Não iniciado",
        className: "bg-orange-400 hover:bg-orange-500 text-white border-0",
      },
    };
    const { variant, label, className } = config[status];
    return (
      <Badge
        variant={variant}
        className={`${className} whitespace-nowrap min-w-[7rem] justify-center`}
      >
        {label}
      </Badge>
    );
  };

  const getSituationBadge = (situation: OKRSituation) => {
    const config = {
      NO_PRAZO: {
        label: "No prazo",
        className: "bg-blue-500 hover:bg-blue-600 text-white border-0",
      },
      FINALIZADO: {
        label: "Finalizado",
        className: "bg-green-500 hover:bg-green-600 text-white border-0",
      },
      EM_ATRASO: {
        label: "Em atraso",
        className: "bg-red-500 hover:bg-red-600 text-white border-0",
      },
    };
    const { label, className } = config[situation];
    return (
      <Badge
        className={`${className} whitespace-nowrap min-w-[7rem] justify-center`}
      >
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* OKRs View */}
      {activeView === "okrs" && (
        <>
          {/* Layout: Cards + Barra de Progresso à esquerda, Gráfico à direita */}
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Coluna Esquerda: Cards + Barra de Progresso (flex-1 para ocupar espaço restante) */}
            <div className="w-full lg:flex-1 flex flex-col gap-3">
              {/* Cards de Stats em linha (4 colunas) */}
              <OKRStatsCards />

              {/* Barra de Progresso - estilo flat */}
              <div className="flex items-center gap-4 mt-3">
                <span className="text-lg font-bold text-gray-700 whitespace-nowrap">
                  Progresso geral: {progressoPercent}%
                </span>
                <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#22c55e] rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${animatedProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Coluna Direita: Gráfico de Rosca (largura automática baseada no conteúdo) */}
            <div
              className="w-full lg:w-auto flex-shrink-0"
              style={{ overflow: "visible" }}
            >
              <GraficoRosca
                key={`okrs-rosca-${activeView}`}
                title="Situação dos OKRs"
                data={situacaoOKRs}
                colors={["#3b82f6", "#22c55e", "#ef4444"]}
                isMonitoramento={true}
              />
            </div>
          </div>

          {/* Tabela de Objetivos e KRs */}
          <div className="space-y-3">
            {/* Badge de Título - Independente */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-gradient-to-r from-[#1e5a7d] to-[#2980b9] px-6 py-2.5 rounded-lg shadow-md">
                <h3 className="text-white font-bold text-base lg:text-lg tracking-wide">
                  OBJETIVO E DESCRIÇÃO
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative group">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 bg-white text-[#1e5a7d] border-white hover:bg-gray-100 hover:text-[#1e5a7d] transition-all"
                    disabled={
                      loadingDirectorates || (!proadLink && !canFullEdit)
                    }
                    onClick={() => {
                      if (proadLink) {
                        window.open(proadLink, "_blank", "noopener,noreferrer");
                        return;
                      }
                      if (canFullEdit) {
                        setProadLinkDraft(proadLink);
                        setProadLinkDialogOpen(true);
                      }
                    }}
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Link do PROAD
                  </Button>
                  {canFullEdit && proadLink && (
                    <div className="absolute -right-2 -top-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProadLinkDraft(proadLink);
                          setProadLinkDialogOpen(true);
                        }}
                        title="Editar link do PROAD"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 h-[2px] bg-gradient-to-r from-[#1e5a7d]/50 to-transparent min-w-[24px]" />
            </div>

            {/* Tabela */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-gray-100 border-b-2 border-[#1e5a7d]">
                      <tr>
                        <th className="text-left p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700">
                          DESCRIÇÃO
                        </th>
                        <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-32">
                          STATUS
                        </th>
                        <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-32">
                          SITUAÇÃO
                        </th>
                        <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-32 lg:w-40">
                          PRAZO
                        </th>
                        {(canFullEdit || canEditStatus) && (
                          <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-24 lg:w-32">
                            AÇÕES
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredObjectives.map((obj) => {
                        // Converter IDs para string para garantir comparação correta
                        const objKRs = filteredKeyResults.filter(
                          (kr) => String(kr.objectiveId) === String(obj.id),
                        );

                        return (
                          <>
                            {/* Linha do Objetivo */}
                            <tr
                              key={obj.id}
                              className="border-b bg-[#1e5a7d]/5"
                            >
                              <td
                                className="p-2 lg:p-4"
                                colSpan={canFullEdit || canEditStatus ? 5 : 4}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-[#1e5a7d] text-sm lg:text-base">
                                      {obj.code}
                                    </div>
                                    <div className="text-xs lg:text-sm text-gray-700 mt-1">
                                      {obj.title}
                                    </div>
                                  </div>
                                  {canFullEdit && (
                                    <div className="flex gap-1 lg:gap-2 flex-shrink-0">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingObjective(obj);
                                          setDialogOpen(true);
                                        }}
                                        className="h-8 w-8 p-0 hover:bg-blue-50"
                                      >
                                        <Pencil className="h-3 w-3 lg:h-4 lg:w-4 text-blue-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          handleDeleteObjective(obj.id)
                                        }
                                        className="h-8 w-8 p-0 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-3 w-3 lg:h-4 lg:w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {/* Linhas dos KRs */}
                            {objKRs.map((kr, index) => (
                              <tr
                                key={kr.id}
                                className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                              >
                                <td className="p-2 lg:p-4 pl-4 lg:pl-8">
                                  <div className="text-xs lg:text-sm">
                                    <span className="font-semibold text-gray-800">
                                      {kr.code}:
                                    </span>{" "}
                                    <span className="text-gray-600">
                                      {kr.description}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-2 lg:p-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    {getStatusBadge(kr.status)}
                                    {canEditStatus && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingKRStatus(kr);
                                          setStatusDialogOpen(true);
                                        }}
                                        className="h-6 w-6 p-0 hover:bg-blue-50"
                                        title="Alterar status"
                                      >
                                        <Pencil className="h-3 w-3 text-blue-600" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 lg:p-4 text-center">
                                  {getSituationBadge(kr.situation)}
                                </td>
                                <td className="p-2 lg:p-4 text-center text-xs lg:text-sm text-gray-600">
                                  {kr.deadline}
                                </td>
                                {canFullEdit && (
                                  <td className="p-2 lg:p-4">
                                    <div className="flex gap-1 lg:gap-2 justify-center">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingKR(kr);
                                          setKrDialogOpen(true);
                                        }}
                                        className="h-8 w-8 p-0 hover:bg-blue-50"
                                      >
                                        <Pencil className="h-3 w-3 lg:h-4 lg:w-4 text-blue-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteKR(kr.id)}
                                        className="h-8 w-8 p-0 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-3 w-3 lg:h-4 lg:w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  </td>
                                )}
                                {!canFullEdit && canEditStatus && (
                                  <td className="p-2 lg:p-4"></td>
                                )}
                              </tr>
                            ))}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Metas View */}
      {activeView === "metas" && (
        <>
          {/* Layout: Cards + Barra de Progresso à esquerda, Gráfico à direita */}
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="w-full lg:flex-1 flex flex-col gap-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xl:gap-3 2xl:gap-4 w-full h-full">
                <CardIndicador
                  title="Totais"
                  value={metaStats.total}
                  icon={Target}
                  color="blue"
                />
                <CardIndicador
                  title="Concluido"
                  value={metaStats.concluido}
                  icon={CheckCircle2}
                  color="green"
                />
                <CardIndicador
                  title="Em andamento"
                  value={metaStats.emAndamento}
                  icon={Clock}
                  color="yellow"
                />
                <CardIndicador
                  title="A iniciar"
                  value={metaStats.aIniciar}
                  icon={Play}
                  color="orange"
                />
              </div>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-lg font-bold text-gray-700 whitespace-nowrap">
                  Progresso geral: {progressoMetasPercent}%
                </span>
                <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#22c55e] rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${animatedProgressMetas}%` }}
                  />
                </div>
              </div>
            </div>
            <div
              className="w-full lg:w-auto flex-shrink-0"
              style={{ overflow: "visible" }}
            >
              {!loadingMetas && (
                <GraficoRosca
                  key={`metas-rosca-${activeView}-${filteredMetas.length}-${selectedDirectorate}`}
                  title="Situação das Metas"
                  data={situacaoMetas}
                  colors={["#3b82f6", "#22c55e", "#ef4444"]}
                  isMonitoramento={true}
                />
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Badge de Título */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-gradient-to-r from-[#1e5a7d] to-[#2980b9] px-6 py-2.5 rounded-lg shadow-md">
                <h3 className="text-white font-bold text-base lg:text-lg tracking-wide">
                  METAS
                </h3>
              </div>

              <div className="flex-1 h-[2px] bg-gradient-to-r from-[#1e5a7d]/50 to-transparent min-w-[24px]" />
            </div>

            {/* Tabela de Metas */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-gray-100 border-b-2 border-[#1e5a7d]">
                      <tr>
                        <th className="text-left p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700">
                          DESCRIÇÃO
                        </th>
                        <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-32">
                          STATUS
                        </th>
                        <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-32">
                          ÁREA RESPONSÁVEL
                        </th>
                        <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-32 lg:w-40">
                          PRAZO
                        </th>
                        {(canFullEdit || canEditStatus) && (
                          <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-24 lg:w-32">
                            AÇÕES
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {loadingMetas ? (
                        <tr>
                          <td
                            colSpan={canFullEdit || canEditStatus ? 5 : 4}
                            className="p-8 text-center text-gray-500"
                          >
                            Carregando metas...
                          </td>
                        </tr>
                      ) : filteredMetas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={canFullEdit || canEditStatus ? 5 : 4}
                            className="p-8 text-center text-gray-500"
                          >
                            Nenhuma meta encontrada para esta diretoria.
                          </td>
                        </tr>
                      ) : (
                        filteredMetas.map((meta, index) => (
                          <tr
                            key={meta.id}
                            className={`border-b hover:bg-gray-50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                          >
                            <td className="p-2 lg:p-4">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-[#1e5a7d] text-sm lg:text-base">
                                  {meta.titulo}
                                </div>
                                {meta.descricao && (
                                  <div className="text-xs lg:text-sm text-gray-600 mt-1">
                                    {meta.descricao}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-2 lg:p-4 text-center">
                              {getStatusBadge(
                                (meta.status || "NAO_INICIADO") as OKRStatus,
                              )}
                            </td>
                            <td className="p-2 lg:p-4 text-center text-xs lg:text-sm text-gray-700">
                              {meta.areaNome || meta.areaSigla || "-"}
                            </td>
                            <td className="p-2 lg:p-4 text-center text-xs lg:text-sm text-gray-600">
                              {meta.prazo || "-"}
                            </td>
                            {canFullEdit && (
                              <td className="p-2 lg:p-4">
                                <div className="flex gap-1 lg:gap-2 justify-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingMeta(meta);
                                      setMetaDialogOpen(true);
                                    }}
                                    className="h-8 w-8 p-0 hover:bg-blue-50"
                                  >
                                    <Pencil className="h-3 w-3 lg:h-4 lg:w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteMeta(meta.id)}
                                    className="h-8 w-8 p-0 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3 lg:h-4 lg:w-4 text-red-600" />
                                  </Button>
                                </div>
                              </td>
                            )}
                            {!canFullEdit && canEditStatus && (
                              <td className="p-2 lg:p-4"></td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Dialog para Meta - Apenas ADMIN */}
      <Dialog
        open={metaDialogOpen}
        onOpenChange={(open) => {
          if (!savingMeta) setMetaDialogOpen(open);
        }}
      >
        <DialogContent
          className="max-w-lg"
          key={`meta-dialog-${editingMeta?.id || "new"}`}
        >
          <form
            onSubmit={handleSaveMeta}
            key={`meta-form-${editingMeta?.id || "new"}`}
          >
            <DialogHeader>
              <DialogTitle>
                {editingMeta ? "Editar Meta" : "Nova Meta"}
              </DialogTitle>
              <DialogDescription>Preencha os dados da meta</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="metaTitulo">
                  Título <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="metaTitulo"
                  name="titulo"
                  defaultValue={editingMeta?.titulo}
                  required
                  disabled={savingMeta}
                  placeholder="Título da meta"
                />
              </div>
              <div>
                <Label htmlFor="metaDescricao">Descrição</Label>
                <Textarea
                  id="metaDescricao"
                  name="descricao"
                  defaultValue={editingMeta?.descricao || ""}
                  disabled={savingMeta}
                  placeholder="Descrição da meta..."
                />
              </div>
              <div>
                <Label htmlFor="metaArea">
                  Área Responsável <span className="text-red-500">*</span>
                </Label>
                <Select
                  name="areaId"
                  defaultValue={editingMeta?.areaId?.toString()}
                  required
                  disabled={savingMeta}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id.toString()}>
                        {area.sigla || ""} - {area.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="metaStatus">Status</Label>
                <Select
                  name="status"
                  defaultValue={editingMeta?.status || "NAO_INICIADO"}
                  disabled={savingMeta}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAO_INICIADO">A iniciar</SelectItem>
                    <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="metaSituacao">
                  Situação (Calculado Automaticamente)
                </Label>
                <Select
                  name="situacao"
                  defaultValue={editingMeta?.situacao || "NO_PRAZO"}
                  disabled
                >
                  <SelectTrigger className="bg-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_PRAZO">No prazo</SelectItem>
                    <SelectItem value="EM_ATRASO">Em atraso</SelectItem>
                    <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  A situação é atualizada automaticamente com base no status e
                  no prazo.
                </p>
              </div>
              <div>
                <Label htmlFor="metaPrazo">
                  Prazo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="metaPrazo"
                  name="prazo"
                  defaultValue={editingMeta?.prazo || ""}
                  disabled={savingMeta}
                  placeholder="Ex: julho - 2026"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMetaDialogOpen(false)}
                disabled={savingMeta}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingMeta}>
                {savingMeta ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para Objetivo - Apenas ADMIN */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!savingObjective) setDialogOpen(open);
        }}
      >
        <DialogContent
          className="max-w-lg"
          key={`objective-dialog-${editingObjective?.id || "new"}`}
        >
          <form
            onSubmit={handleSaveObjective}
            key={`objective-form-${editingObjective?.id || "new"}`}
          >
            <DialogHeader>
              <DialogTitle>
                {editingObjective ? "Editar Objetivo" : "Novo Objetivo"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do objetivo estratégico
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="code">
                  Código <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={editingObjective?.code}
                  required
                  disabled={savingObjective}
                  placeholder="Ex: OE01"
                />
              </div>
              <div>
                <Label htmlFor="title">
                  Título <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={editingObjective?.title}
                  required
                  disabled={savingObjective}
                  placeholder="Ex: Melhorar a eficiência operacional"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingObjective?.description}
                  disabled={savingObjective}
                  placeholder="Descreva o objetivo estratégico..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={savingObjective}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingObjective}>
                {savingObjective ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para Link do PROAD - Apenas ADMIN */}
      <Dialog
        open={proadLinkDialogOpen}
        onOpenChange={(open) => {
          if (!savingProadLink) setProadLinkDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canFullEdit) return;

              setSavingProadLink(true);
              try {
                const value = proadLinkDraft.toString().trim();
                const payload = value ? value : null;

                await api.updateDirectorateProadLink(
                  selectedDirectorate,
                  payload,
                );

                const dirs = await api.getDirectorates();
                setDirectorates(dirs);
                setProadLinkDialogOpen(false);
              } catch (err: any) {
                const errorMessage =
                  err?.message || err?.toString() || "Erro desconhecido";
              } finally {
                setSavingProadLink(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Link do PROAD</DialogTitle>
              <DialogDescription>
                Informe o link do PROAD para a diretoria {selectedDirectorate}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="proadLink">URL</Label>
                <Input
                  id="proadLink"
                  name="proadLink"
                  value={proadLinkDraft}
                  onChange={(e) => setProadLinkDraft(e.target.value)}
                  disabled={savingProadLink}
                  placeholder="https://..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProadLinkDialogOpen(false)}
                disabled={savingProadLink}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingProadLink}>
                {savingProadLink ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para KR - Apenas ADMIN */}
      <Dialog
        open={krDialogOpen}
        onOpenChange={(open) => {
          if (!savingKR) setKrDialogOpen(open);
        }}
      >
        <DialogContent
          className="max-w-lg"
          key={`kr-dialog-${editingKR?.id || "new"}-${selectedObjectiveId}`}
        >
          <form
            onSubmit={handleSaveKR}
            key={`kr-form-${editingKR?.id || "new"}`}
          >
            <DialogHeader>
              <DialogTitle>{editingKR ? "Editar KR" : "Novo KR"}</DialogTitle>
              <DialogDescription>
                Preencha os dados do Key Result
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="objectiveId">
                  Objetivo <span className="text-red-500">*</span>
                </Label>
                <Select
                  name="objectiveId"
                  defaultValue={editingKR?.objectiveId || selectedObjectiveId}
                  required
                  disabled={savingKR}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredObjectives.map((obj) => (
                      <SelectItem key={obj.id} value={obj.id}>
                        {obj.code} - {obj.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="code">
                  Código <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={editingKR?.code}
                  required
                  disabled={savingKR}
                  placeholder="Ex: KR01"
                />
              </div>
              <div>
                <Label htmlFor="description">
                  Descrição <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingKR?.description}
                  required
                  disabled={savingKR}
                  placeholder="Descreva o Key Result..."
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  name="status"
                  defaultValue={editingKR?.status || "NAO_INICIADO"}
                  required
                  disabled={savingKR}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAO_INICIADO">A iniciar</SelectItem>
                    <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="situation">
                  Situação (Calculado Automaticamente)
                </Label>
                <Select
                  name="situation"
                  defaultValue={editingKR?.situation || "NO_PRAZO"}
                  disabled
                >
                  <SelectTrigger className="bg-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_PRAZO">No prazo</SelectItem>
                    <SelectItem value="EM_ATRASO">Em atraso</SelectItem>
                    <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  A situação é atualizada automaticamente com base no status e
                  no prazo.
                </p>
              </div>
              <div>
                <Label htmlFor="deadline">
                  Prazo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deadline"
                  name="deadline"
                  placeholder="Ex: julho - 2025"
                  defaultValue={editingKR?.deadline}
                  required
                  disabled={savingKR}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setKrDialogOpen(false)}
                disabled={savingKR}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingKR}>
                {savingKR ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para alterar STATUS - GESTOR e ADMIN */}
      <Dialog
        open={statusDialogOpen}
        onOpenChange={(open) => {
          if (!savingStatus) setStatusDialogOpen(open);
        }}
      >
        <DialogContent
          className="max-w-md"
          key={`status-dialog-${editingKRStatus?.id || "none"}`}
        >
          <form
            onSubmit={handleSaveKRStatus}
            key={`status-form-${editingKRStatus?.id || "none"}`}
          >
            <DialogHeader>
              <DialogTitle>Alterar Status do KR</DialogTitle>
              <DialogDescription>
                {editingKRStatus &&
                  `${editingKRStatus.code}: ${editingKRStatus.description}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="status">Novo Status</Label>
                <Select
                  name="status"
                  defaultValue={editingKRStatus?.status}
                  required
                  disabled={savingStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAO_INICIADO">A iniciar</SelectItem>
                    <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusDialogOpen(false)}
                disabled={savingStatus}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingStatus}>
                {savingStatus ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
