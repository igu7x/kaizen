import { useState, useMemo } from "react";
import { useGestao } from "@/contexts/GestaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { GraficoRosca } from "./GraficoRosca";
import { KanbanBoard } from "./KanbanBoard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { BoardStatus, ProgramInitiative, Priority } from "@/types";
import { DropResult } from "react-beautiful-dnd";
import { Plus } from "lucide-react";

export function ProgramasEstruturantes() {
  const { programs, programInitiatives, refreshData } = useGestao();
  const { user } = useAuth();
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | Priority>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInitiative, setEditingInitiative] =
    useState<ProgramInitiative | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<BoardStatus>("A_FAZER");

  const canEdit = user?.role === "MANAGER" || user?.role === "ADMIN";

  // Filtrar iniciativas
  const filteredInitiatives = useMemo(() => {
    let filtered = programInitiatives;

    if (selectedProgram) {
      filtered = filtered.filter((i) => i.programId === selectedProgram);
    }

    if (priorityFilter !== "ALL") {
      filtered = filtered.filter((i) => i.priority === priorityFilter);
    }

    return filtered;
  }, [programInitiatives, selectedProgram, priorityFilter]);

  // Dados para o gráfico de progresso
  const progressoData = useMemo(() => {
    const aFazer = filteredInitiatives.filter(
      (i) => i.boardStatus === "A_FAZER",
    ).length;
    const fazendo = filteredInitiatives.filter(
      (i) => i.boardStatus === "FAZENDO",
    ).length;
    const feito = filteredInitiatives.filter(
      (i) => i.boardStatus === "FEITO",
    ).length;

    return [
      { name: "A Fazer", value: aFazer },
      { name: "Fazendo", value: fazendo },
      { name: "Feito", value: feito },
    ];
  }, [filteredInitiatives]);

  // Dados para o gráfico de prioridade
  const prioridadeData = useMemo(() => {
    const sim = filteredInitiatives.filter((i) => i.priority === "SIM").length;
    const nao = filteredInitiatives.filter((i) => i.priority === "NAO").length;

    return [
      { name: "SIM", value: sim },
      { name: "NÃO", value: nao },
    ];
  }, [filteredInitiatives]);

  // Colunas do Kanban
  const kanbanColumns = useMemo(
    () => [
      {
        id: "A_FAZER" as BoardStatus,
        title: "A Fazer",
        items: filteredInitiatives
          .filter((i) => i.boardStatus === "A_FAZER")
          .map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            badge: i.priority === "SIM" ? "Prioridade" : undefined,
          })),
      },
      {
        id: "FAZENDO" as BoardStatus,
        title: "Fazendo",
        items: filteredInitiatives
          .filter((i) => i.boardStatus === "FAZENDO")
          .map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            badge: i.priority === "SIM" ? "Prioridade" : undefined,
          })),
      },
      {
        id: "FEITO" as BoardStatus,
        title: "Feito",
        items: filteredInitiatives
          .filter((i) => i.boardStatus === "FEITO")
          .map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            badge: i.priority === "SIM" ? "Prioridade" : undefined,
          })),
      },
    ],
    [filteredInitiatives],
  );

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !canEdit) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as BoardStatus;

    try {
      await api.updateProgramInitiative(draggableId, {
        boardStatus: newStatus,
      });
      await refreshData();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleSaveInitiative = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      programId: formData.get("programId") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      boardStatus: (formData.get("boardStatus") ||
        selectedColumn) as BoardStatus,
      priority: formData.get("priority") as Priority,
    };

    try {
      if (editingInitiative) {
        await api.updateProgramInitiative(editingInitiative.id, data);
      } else {
        await api.createProgramInitiative(data);
      }
      await refreshData();
      setDialogOpen(false);
      setEditingInitiative(null);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleDeleteInitiative = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta iniciativa?")) {
      try {
        await api.deleteProgramInitiative(id);
        await refreshData();
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    }
  };

  const handleAddInitiative = (columnId: BoardStatus) => {
    setSelectedColumn(columnId);
    setEditingInitiative(null);
    setDialogOpen(true);
  };

  const handleEditInitiative = (id: string) => {
    const initiative = programInitiatives.find((i) => i.id === id);
    if (initiative) {
      setEditingInitiative(initiative);
      setDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards dos Programas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-5 2xl:gap-6">
        {programs.map((program) => (
          <Card
            key={program.id}
            className={`cursor-pointer transition-all ${
              selectedProgram === program.id ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() =>
              setSelectedProgram(
                selectedProgram === program.id ? "" : program.id,
              )
            }
          >
            <CardHeader>
              <CardTitle className="text-base">{program.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{program.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label>Prioridade:</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={priorityFilter === "ALL" ? "default" : "outline"}
                onClick={() => setPriorityFilter("ALL")}
              >
                Selecionar tudo
              </Button>
              <Button
                size="sm"
                variant={priorityFilter === "SIM" ? "default" : "outline"}
                onClick={() => setPriorityFilter("SIM")}
              >
                SIM
              </Button>
              <Button
                size="sm"
                variant={priorityFilter === "NAO" ? "default" : "outline"}
                onClick={() => setPriorityFilter("NAO")}
              >
                NÃO
              </Button>
            </div>
            {selectedProgram && (
              <Badge variant="secondary">
                Programa: {programs.find((p) => p.id === selectedProgram)?.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 2xl:gap-6">
        {/* Gráficos */}
        <div className="space-y-4">
          <GraficoRosca
            title="Progresso"
            data={progressoData}
            colors={["#ef4444", "#f97316", "#22c55e"]}
          />
          <GraficoRosca
            title="Prioridade"
            data={prioridadeData}
            colors={["#3b82f6", "#94a3b8"]}
          />
        </div>

        {/* Kanban Board */}
        <div className="col-span-3">
          <KanbanBoard
            columns={kanbanColumns}
            onDragEnd={handleDragEnd}
            onAdd={canEdit ? handleAddInitiative : undefined}
            onEdit={canEdit ? handleEditInitiative : undefined}
            onDelete={canEdit ? handleDeleteInitiative : undefined}
            canEdit={canEdit}
          />
        </div>
      </div>

      {/* Dialog para Iniciativa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSaveInitiative}>
            <DialogHeader>
              <DialogTitle>
                {editingInitiative ? "Editar Iniciativa" : "Nova Iniciativa"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da iniciativa do programa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="programId">Programa</Label>
                <Select
                  name="programId"
                  defaultValue={editingInitiative?.programId || selectedProgram}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um programa" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((prog) => (
                      <SelectItem key={prog.id} value={prog.id}>
                        {prog.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={editingInitiative?.title}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingInitiative?.description}
                />
              </div>
              <div>
                <Label htmlFor="boardStatus">Status</Label>
                <Select
                  name="boardStatus"
                  defaultValue={
                    editingInitiative?.boardStatus || selectedColumn
                  }
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
              <div>
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  name="priority"
                  defaultValue={editingInitiative?.priority || "NAO"}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIM">SIM</SelectItem>
                    <SelectItem value="NAO">NÃO</SelectItem>
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
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
