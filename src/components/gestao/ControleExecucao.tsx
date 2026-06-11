import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { Pencil, Plus, Trash2, GripVertical } from "lucide-react";
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
import {
  ExecutionControl,
  InitiativeLocation,
  ExecutionProgress,
} from "@/types";
import { api } from "@/services/api";
import { SprintStatsCards } from "./SprintStatsCards";
import { useToast } from "@/hooks/use-toast";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export function ControleExecucao() {
  const { user } = useAuth();
  const { selectedDirectorate } = useDirectorate();
  const { toast } = useToast();
  const [executionData, setExecutionData] = useState<ExecutionControl[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExecutionControl | null>(null);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>("all");

  // Gestor e Admin podem editar e excluir
  const canEdit = user?.role === "MANAGER" || user?.role === "ADMIN";

  // ============================================================
  // DRAG AND DROP STATES
  // ============================================================
  const [draggedItem, setDraggedItem] = useState<{
    planProgram: string;
    index: number;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    planProgram: string;
    index: number;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.getExecutionControls();
      setExecutionData(data);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Filtrar por diretoria
  const filteredData = useMemo(() => {
    return executionData.filter(
      (item) => item.directorate === selectedDirectorate,
    );
  }, [executionData, selectedDirectorate]);

  // Obter lista única de Planos/Programas
  const planPrograms = useMemo(() => {
    const unique = Array.from(
      new Set(filteredData.map((item) => item.planProgram)),
    );
    return unique.sort();
  }, [filteredData]);

  // Filtrar por Plano/Programa selecionado
  const displayData = useMemo(() => {
    if (selectedPlanFilter === "all") {
      return filteredData;
    }
    return filteredData.filter(
      (item) => item.planProgram === selectedPlanFilter,
    );
  }, [filteredData, selectedPlanFilter]);

  // Agrupar dados por Plano/Programa e ordenar pela ordem salva
  const groupedData = useMemo(() => {
    const groups: Record<string, ExecutionControl[]> = {};
    displayData.forEach((item) => {
      if (!groups[item.planProgram]) {
        groups[item.planProgram] = [];
      }
      groups[item.planProgram].push(item);
    });

    // Ordenar itens dentro de cada grupo pela ordem salva
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const linhaA = a.ordemLinha ?? 0;
        const linhaB = b.ordemLinha ?? 0;
        if (linhaA !== linhaB) return linhaA - linhaB;
        return (a.ordemPosicao ?? 0) - (b.ordemPosicao ?? 0);
      });
    });

    return groups;
  }, [displayData]);

  // ============================================================
  // DRAG AND DROP HANDLERS
  // ============================================================

  const handleDragStart = (
    e: React.DragEvent,
    planProgram: string,
    index: number,
  ) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ planProgram, index }),
    );
    setTimeout(() => setDraggedItem({ planProgram, index }), 0);
  };

  const handleDragOver = (
    e: React.DragEvent,
    planProgram: string,
    index: number,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedItem !== null && draggedItem.planProgram === planProgram) {
      setDragOverTarget({ planProgram, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetPlanProgram: string,
    targetIndex: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem || draggedItem.planProgram !== targetPlanProgram) {
      setDraggedItem(null);
      setDragOverTarget(null);
      return;
    }

    const items = [...groupedData[targetPlanProgram]];
    const sourceIndex = draggedItem.index;

    // Remover do índice original
    const [movedItem] = items.splice(sourceIndex, 1);

    // Ajustar índice se movendo para frente
    let finalIndex = targetIndex;
    if (targetIndex > sourceIndex) {
      finalIndex = targetIndex - 1;
    }

    // Inserir no novo índice
    items.splice(finalIndex, 0, movedItem);

    // Preparar ordenação para salvar no backend
    const ordenacao = items.map((item, idx) => ({
      id: parseInt(item.id),
      linha: 0,
      posicao: idx,
    }));

    try {
      await api.updateExecutionControlOrdenacao(ordenacao);
      await loadData();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }

    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: ExecutionControl = {
      id: editingItem?.id || Date.now().toString(),
      planProgram: formData.get("planProgram") as string,
      krProjectInitiative: formData.get("krProjectInitiative") as string,
      backlogTasks: formData.get("backlogTasks") as string,
      sprintStatus: formData.get("sprintStatus") as InitiativeLocation,
      sprintTasks: formData.get("sprintTasks") as string,
      progress: formData.get("progress") as ExecutionProgress,
      directorate: selectedDirectorate,
    };

    try {
      if (editingItem) {
        await api.updateExecutionControl(editingItem.id, data);
      } else {
        await api.createExecutionControl(data);
      }
      await loadData();
      setDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este item?")) {
      try {
        await api.deleteExecutionControl(id);
        await loadData();
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    }
  };

  const getStatusBadge = (status: InitiativeLocation) => {
    const config = {
      SPRINT_ATUAL: {
        label: "Sprint Atual",
        className: "bg-yellow-400 hover:bg-yellow-500 text-gray-900 border-0",
      },
      FORA_SPRINT: {
        label: "Fora da Sprint",
        className: "bg-orange-400 hover:bg-orange-500 text-white border-0",
      },
      CONCLUIDA: {
        label: "Concluída",
        className: "bg-green-500 hover:bg-green-600 text-white border-0",
      },
      BACKLOG: {
        label: "Backlog",
        className: "bg-[#2d6a7f] hover:bg-[#245566] text-white border-0",
      },
      EM_FILA: {
        label: "Em Fila",
        className: "bg-orange-400 hover:bg-orange-500 text-white border-0",
      },
    };
    const { label, className } = config[status] || config.FORA_SPRINT;
    return <Badge className={className}>{label}</Badge>;
  };

  const getProgressBadge = (progress: ExecutionProgress) => {
    const config = {
      FAZENDO: {
        label: "Fazendo",
        className: "bg-yellow-400 hover:bg-yellow-500 text-gray-900 border-0",
      },
      FEITO: {
        label: "Feito",
        className: "bg-green-500 hover:bg-green-600 text-white border-0",
      },
      A_FAZER: {
        label: "A Fazer",
        className: "bg-orange-400 hover:bg-orange-500 text-white border-0",
      },
    };
    const { label, className } = config[progress];
    return <Badge className={className}>{label}</Badge>;
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Bolachinhas - Cards de Estatísticas da Sprint */}
      <SprintStatsCards executionData={filteredData} />

      {/* Filtro de Plano/Programa e Botão Nova Linha */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Label
            htmlFor="planFilter"
            className="text-sm font-medium whitespace-nowrap text-white"
          >
            Plano/Programa:
          </Label>
          <Select
            value={selectedPlanFilter}
            onValueChange={setSelectedPlanFilter}
          >
            <SelectTrigger id="planFilter" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Exibir todos</SelectItem>
              {planPrograms.map((plan) => (
                <SelectItem key={plan} value={plan}>
                  {plan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canEdit && (
          <Button
            onClick={() => {
              setEditingItem(null);
              setDialogOpen(true);
            }}
            className="bg-[#2d7a5e] hover:bg-[#236249] w-full sm:w-auto"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Linha
          </Button>
        )}
      </div>

      {/* Tabelas separadas por Plano/Programa */}
      <div className="space-y-8">
        {Object.entries(groupedData).map(([planProgram, items]) => (
          <div key={planProgram} className="space-y-3">
            {/* Badge de Título do Plano - Independente */}
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-[#2d7a5e] to-[#3d9973] px-6 py-2.5 rounded-lg shadow-md">
                <h3 className="text-white font-bold text-base lg:text-lg tracking-wide">
                  {planProgram}
                </h3>
              </div>
              <div className="flex-1 h-[2px] bg-gradient-to-r from-[#2d7a5e]/50 to-transparent ml-4" />
            </div>

            {/* Tabela */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-gray-100 border-b-2 border-[#2d7a5e]">
                      <tr>
                        {canEdit && <th className="w-10 p-2"></th>}
                        <th className="text-left p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700">
                          KR / PROJETO
                        </th>
                        <th className="text-left p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700">
                          TAREFAS PLANEJADAS (BACKLOG)
                        </th>
                        <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-32">
                          STATUS
                        </th>
                        <th className="text-left p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700">
                          TAREFAS DA SPRINT ATUAL
                        </th>
                        <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-32">
                          PROGRESSO
                        </th>
                        {canEdit && (
                          <th className="text-center p-2 lg:p-4 font-semibold text-xs lg:text-sm text-gray-700 w-24 lg:w-32">
                            AÇÕES
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {items.map((item, index) => {
                        const isDragging =
                          draggedItem?.planProgram === planProgram &&
                          draggedItem?.index === index;
                        const isDragOver =
                          dragOverTarget?.planProgram === planProgram &&
                          dragOverTarget?.index === index;

                        return (
                          <tr
                            key={item.id}
                            draggable={canEdit}
                            onDragStart={
                              canEdit
                                ? (e) => handleDragStart(e, planProgram, index)
                                : undefined
                            }
                            onDragOver={
                              canEdit
                                ? (e) => handleDragOver(e, planProgram, index)
                                : undefined
                            }
                            onDragLeave={canEdit ? handleDragLeave : undefined}
                            onDrop={
                              canEdit
                                ? (e) => handleDrop(e, planProgram, index)
                                : undefined
                            }
                            onDragEnd={canEdit ? handleDragEnd : undefined}
                            className={`border-b transition-all duration-200 ${
                              isDragging
                                ? "opacity-50 bg-blue-100"
                                : isDragOver
                                  ? "bg-green-100 border-t-2 border-green-500"
                                  : index % 2 === 0
                                    ? "bg-white hover:bg-gray-50"
                                    : "bg-gray-50/50 hover:bg-gray-100"
                            } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                          >
                            {canEdit && (
                              <td className="p-2 text-center">
                                <GripVertical className="h-4 w-4 text-gray-400 inline-block" />
                              </td>
                            )}
                            <td className="p-2 lg:p-4 text-xs lg:text-sm text-gray-800 font-medium">
                              {item.krProjectInitiative}
                            </td>
                            <td className="p-2 lg:p-4 text-xs lg:text-sm text-gray-600">
                              {item.backlogTasks || "-"}
                            </td>
                            <td className="p-2 lg:p-4 text-center">
                              {getStatusBadge(item.sprintStatus)}
                            </td>
                            <td className="p-2 lg:p-4 text-xs lg:text-sm text-gray-600">
                              {item.sprintTasks || "-"}
                            </td>
                            <td className="p-2 lg:p-4 text-center">
                              {getProgressBadge(item.progress)}
                            </td>
                            {canEdit && (
                              <td className="p-2 lg:p-4">
                                <div className="flex gap-1 lg:gap-2 justify-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingItem(item);
                                      setDialogOpen(true);
                                    }}
                                    className="h-8 w-8 p-0 hover:bg-blue-50"
                                  >
                                    <Pencil className="h-3 w-3 lg:h-4 lg:w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(item.id);
                                    }}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Dialog para Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Editar Item" : "Novo Item"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do controle de execução
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="planProgram">Plano / Programa</Label>
                <Input
                  id="planProgram"
                  name="planProgram"
                  defaultValue={editingItem?.planProgram}
                  required
                />
              </div>
              <div>
                <Label htmlFor="krProjectInitiative">KR / Projeto</Label>
                <Input
                  id="krProjectInitiative"
                  name="krProjectInitiative"
                  defaultValue={editingItem?.krProjectInitiative}
                  required
                />
              </div>
              <div>
                <Label htmlFor="backlogTasks">
                  Tarefas Planejadas (Backlog)
                </Label>
                <Textarea
                  id="backlogTasks"
                  name="backlogTasks"
                  defaultValue={editingItem?.backlogTasks}
                />
              </div>
              <div>
                <Label htmlFor="sprintStatus">Status</Label>
                <Select
                  name="sprintStatus"
                  defaultValue={editingItem?.sprintStatus || "FORA_SPRINT"}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SPRINT_ATUAL">Sprint Atual</SelectItem>
                    <SelectItem value="FORA_SPRINT">Fora da Sprint</SelectItem>
                    <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sprintTasks">Tarefas da Sprint Atual</Label>
                <Textarea
                  id="sprintTasks"
                  name="sprintTasks"
                  defaultValue={editingItem?.sprintTasks}
                />
              </div>
              <div>
                <Label htmlFor="progress">Progresso</Label>
                <Select
                  name="progress"
                  defaultValue={editingItem?.progress || "A_FAZER"}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A_FAZER">A Fazer</SelectItem>
                    <SelectItem value="FAZENDO">Fazendo</SelectItem>
                    <SelectItem value="FEITO">Feito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#2d7a5e] hover:bg-[#236249]">
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
