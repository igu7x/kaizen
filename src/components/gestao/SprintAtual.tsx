import { useState, useMemo, useEffect } from 'react';
import { useGestao } from '@/contexts/GestaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { KanbanBoard } from './KanbanBoard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/services/api';
import { BoardStatus, Initiative, InitiativeLocation, ExecutionControl } from '@/types';
import { DropResult } from 'react-beautiful-dnd';
import { SprintStatsCards } from './SprintStatsCards';

export function SprintAtual() {
  const { keyResults, initiatives, refreshData } = useGestao();
  const { user } = useAuth();
  const { selectedDirectorate } = useDirectorate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<BoardStatus>('A_FAZER');
  const [executionData, setExecutionData] = useState<ExecutionControl[]>([]);
  
  // Estados controlados para o formulário
  const [formKeyResultId, setFormKeyResultId] = useState<string>('');
  const [formBoardStatus, setFormBoardStatus] = useState<BoardStatus>('A_FAZER');
  const [saving, setSaving] = useState(false);

  const canEdit = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  useEffect(() => {
    loadExecutionData();
  }, []);

  const loadExecutionData = async () => {
    try {
      const data = await api.getExecutionControls();
      setExecutionData(data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  // Filtrar por diretoria
  const filteredInitiatives = useMemo(() => 
    initiatives.filter(init => init.directorate === selectedDirectorate),
    [initiatives, selectedDirectorate]
  );

  const filteredKeyResults = useMemo(() => 
    keyResults.filter(kr => kr.directorate === selectedDirectorate),
    [keyResults, selectedDirectorate]
  );

  const filteredExecutionData = useMemo(() => 
    executionData.filter(item => item.directorate === selectedDirectorate),
    [executionData, selectedDirectorate]
  );

  const sprintInitiatives = useMemo(() => 
    filteredInitiatives.filter(init => init.location === 'SPRINT_ATUAL'),
    [filteredInitiatives]
  );

  // Função helper para mapear iniciativa para item do Kanban
  const mapInitiativeToKanbanItem = (initiative: Initiative) => {
    // Usar String() para garantir comparação correta de IDs
    const kr = filteredKeyResults.find(k => String(k.id) === String(initiative.keyResultId));
    return {
      id: String(initiative.id), // Garantir que o ID é string para o drag-and-drop
      title: initiative.title,
      description: initiative.description,
      badge: kr?.code
    };
  };

  // Colunas do Kanban
  const kanbanColumns = useMemo(() => [
    {
      id: 'A_FAZER' as BoardStatus,
      title: 'A Fazer',
      items: sprintInitiatives
        .filter(i => i.boardStatus === 'A_FAZER')
        .map(mapInitiativeToKanbanItem)
    },
    {
      id: 'FAZENDO' as BoardStatus,
      title: 'Fazendo',
      items: sprintInitiatives
        .filter(i => i.boardStatus === 'FAZENDO')
        .map(mapInitiativeToKanbanItem)
    },
    {
      id: 'FEITO' as BoardStatus,
      title: 'Feito',
      items: sprintInitiatives
        .filter(i => i.boardStatus === 'FEITO')
        .map(mapInitiativeToKanbanItem)
    }
  ], [sprintInitiatives, filteredKeyResults]);

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    
    // Se não há destino ou é o mesmo lugar, não fazer nada
    if (!destination || !canEdit) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId as BoardStatus;
    const oldStatus = source.droppableId as BoardStatus;

    console.log(`[SprintAtual] Movendo iniciativa ${draggableId} de ${oldStatus} para ${newStatus}`);

    try {
      await api.updateInitiative(draggableId, { boardStatus: newStatus });
      await refreshData();
      await loadExecutionData();
    } catch (error: any) {
      console.error('Erro ao atualizar iniciativa:', error);
      alert(`Erro ao mover iniciativa: ${error.message || 'Erro desconhecido'}`);
      // Recarregar para reverter visualmente
      await refreshData();
    }
  };

  const handleSaveInitiative = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    
    // Validação
    if (!formKeyResultId) {
      alert('Por favor, selecione um KR associado.');
      return;
    }
    if (!title?.trim()) {
      alert('Por favor, preencha o título.');
      return;
    }
    
    const data = {
      keyResultId: formKeyResultId,
      title: title.trim(),
      description: description?.trim() || '',
      boardStatus: formBoardStatus,
      location: 'SPRINT_ATUAL' as InitiativeLocation,
      directorate: selectedDirectorate
    };

    setSaving(true);

    try {
      if (editingInitiative) {
        await api.updateInitiative(editingInitiative.id, data);
        alert('Iniciativa atualizada com sucesso!');
      } else {
        await api.createInitiative(data);
        alert('Iniciativa criada com sucesso!');
      }
      await refreshData();
      await loadExecutionData();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Erro ao salvar iniciativa:', error);
      alert(`Erro ao salvar iniciativa: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInitiative = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta iniciativa?')) {
      try {
        await api.deleteInitiative(id);
        await refreshData();
        await loadExecutionData();
      } catch (error) {
        console.error('Erro ao excluir iniciativa:', error);
      }
    }
  };

  const handleAddInitiative = (columnId: BoardStatus) => {
    setSelectedColumn(columnId);
    setEditingInitiative(null);
    // Resetar formulário
    setFormKeyResultId('');
    setFormBoardStatus(columnId);
    setDialogOpen(true);
  };

  const handleEditInitiative = (id: string) => {
    const initiative = filteredInitiatives.find(i => String(i.id) === String(id));
    if (initiative) {
      setEditingInitiative(initiative);
      // Configurar formulário com dados existentes
      setFormKeyResultId(String(initiative.keyResultId || ''));
      setFormBoardStatus(initiative.boardStatus || 'A_FAZER');
      setDialogOpen(true);
    }
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingInitiative(null);
    setFormKeyResultId('');
    setFormBoardStatus('A_FAZER');
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Bolachinhas - Cards de Estatísticas */}
      <SprintStatsCards executionData={filteredExecutionData} />

      {/* Kanban Board - Agora ocupa toda a largura */}
      <KanbanBoard
        title="SPRINT ATUAL"
        columns={kanbanColumns}
        onDragEnd={handleDragEnd}
        onAdd={canEdit ? handleAddInitiative : undefined}
        onEdit={canEdit ? handleEditInitiative : undefined}
        onDelete={canEdit ? handleDeleteInitiative : undefined}
        canEdit={canEdit}
      />

      {/* Dialog para Iniciativa */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!saving && !open) handleCloseDialog();
        else if (open) setDialogOpen(true);
      }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveInitiative}>
            <DialogHeader>
              <DialogTitle>{editingInitiative ? 'Editar Iniciativa' : 'Nova Iniciativa'}</DialogTitle>
              <DialogDescription>
                Preencha os dados da iniciativa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="keyResultId">KR Associado <span className="text-red-500">*</span></Label>
                <Select 
                  value={formKeyResultId} 
                  onValueChange={setFormKeyResultId}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um KR" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredKeyResults.map(kr => (
                      <SelectItem key={kr.id} value={String(kr.id)}>
                        {kr.code} - {kr.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filteredKeyResults.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhum KR disponível. Crie um KR primeiro em "Monitoramento de OKRs".
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="title">Título <span className="text-red-500">*</span></Label>
                <Input 
                  id="title" 
                  name="title" 
                  defaultValue={editingInitiative?.title} 
                  required 
                  disabled={saving}
                  placeholder="Digite o título da iniciativa"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  defaultValue={editingInitiative?.description} 
                  disabled={saving}
                  placeholder="Descrição opcional da iniciativa"
                />
              </div>
              <div>
                <Label htmlFor="boardStatus">Status</Label>
                <Select 
                  value={formBoardStatus} 
                  onValueChange={(val) => setFormBoardStatus(val as BoardStatus)}
                  disabled={saving}
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
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !formKeyResultId}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}