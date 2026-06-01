import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  PcaItem, 
  PcaFullDetails,
  PcaChecklistItem,
  PcaPontoControle,
  PcaTarefa,
  ChecklistStatus,
  TarefaStatus,
  CreatePontoControleDto,
  CreateTarefaDto,
  ValidacaoDgTipo
} from '@/types';
import { pcaApi, formatCurrency, getStatusBadgeClass } from '@/services/pcaApi';
import { 
  pcaDetailsApi, 
  formatDate, 
  formatDateForInput,
  getChecklistStatusClass,
  getTarefaStatusClass
} from '@/services/pcaDetailsApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  FileText,
  DollarSign,
  Calendar,
  User,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  ClipboardCheck,
  Target
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export function PcaItemDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Estados principais
  const [pcaItem, setPcaItem] = useState<PcaItem | null>(null);
  const [fullDetails, setFullDetails] = useState<PcaFullDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados para campos estáticos
  const [faseAtual, setFaseAtual] = useState('');
  const [faseAtualSaved, setFaseAtualSaved] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Estados para modais
  const [isPontoModalOpen, setIsPontoModalOpen] = useState(false);
  const [isTarefaModalOpen, setIsTarefaModalOpen] = useState(false);
  const [isDeletePontoDialogOpen, setIsDeletePontoDialogOpen] = useState(false);
  const [isDeleteTarefaDialogOpen, setIsDeleteTarefaDialogOpen] = useState(false);
  const [selectedPonto, setSelectedPonto] = useState<PcaPontoControle | null>(null);
  const [selectedTarefa, setSelectedTarefa] = useState<PcaTarefa | null>(null);
  const [isEditingPonto, setIsEditingPonto] = useState(false);
  const [isEditingTarefa, setIsEditingTarefa] = useState(false);

  // Estados do formulário de Ponto de Controle
  const [pontoForm, setPontoForm] = useState<CreatePontoControleDto>({
    ponto_controle: '',
    data: '',
    proxima_reuniao: ''
  });

  // Estados do formulário de Tarefa
  const [tarefaForm, setTarefaForm] = useState<CreateTarefaDto>({
    tarefa: '',
    responsavel: '',
    prazo: '',
    status: 'Não iniciada'
  });

  // Verificar permissões
  const canEdit = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const pcaItemId = parseInt(id || '0');

  // Carregar dados
  useEffect(() => {
    if (pcaItemId) {
      loadData();
    }
  }, [pcaItemId]);

  async function loadData() {
    try {
      setLoading(true);
      const [item, details] = await Promise.all([
        pcaApi.getPcaItemById(pcaItemId),
        pcaDetailsApi.getFullDetails(pcaItemId)
      ]);

      if (!item) {
        toast({
          title: 'Item não encontrado',
          description: 'O item PCA solicitado não existe.',
          variant: 'destructive'
        });
        navigate('/contratacoes-ti');
        return;
      }

      setPcaItem(item);
      setFullDetails(details);
      setFaseAtual(details.details.fase_atual || '');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os detalhes do item.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // HANDLERS - CAMPOS ESTÁTICOS
  // ============================================================

  async function handleValidacaoDgChange(tipo: ValidacaoDgTipo) {
    if (!fullDetails) return;

    try {
      const data = tipo === 'Pendente' 
        ? { validacao_dg_tipo: tipo, validacao_dg_data: null }
        : { validacao_dg_tipo: tipo };

      await pcaDetailsApi.updateDetails(pcaItemId, data);
      
      setFullDetails(prev => prev ? {
        ...prev,
        details: { ...prev.details, validacao_dg_tipo: tipo, validacao_dg_data: tipo === 'Pendente' ? null : prev.details.validacao_dg_data }
      } : null);

      if (tipo === 'Pendente') {
        toast({
          title: 'Validação DG atualizada',
          description: 'Status alterado para Pendente'
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar Validação DG:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a Validação DG.',
        variant: 'destructive'
      });
    }
  }

  async function handleValidacaoDataChange(data: string) {
    if (!fullDetails) return;

    try {
      await pcaDetailsApi.updateDetails(pcaItemId, { 
        validacao_dg_tipo: 'Data',
        validacao_dg_data: data 
      });
      
      setFullDetails(prev => prev ? {
        ...prev,
        details: { ...prev.details, validacao_dg_data: data }
      } : null);

      toast({
        title: 'Validação DG atualizada',
        description: 'Data de validação salva com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao atualizar data:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível salvar a data.',
        variant: 'destructive'
      });
    }
  }

  // Debounce para fase atual
  const handleFaseAtualChange = useCallback((value: string) => {
    if (value.length > 20) return;
    
    setFaseAtual(value);
    setFaseAtualSaved(false);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await pcaDetailsApi.updateDetails(pcaItemId, { fase_atual: value || null });
        setFaseAtualSaved(true);
        setTimeout(() => setFaseAtualSaved(false), 2000);
      } catch (error) {
        console.error('Erro ao salvar fase atual:', error);
      }
    }, 1000);

    setDebounceTimer(timer);
  }, [pcaItemId, debounceTimer]);

  // ============================================================
  // HANDLERS - CHECKLIST
  // ============================================================

  async function handleChecklistStatusChange(checklistItem: PcaChecklistItem, status: ChecklistStatus) {
    try {
      await pcaDetailsApi.updateChecklistStatus(pcaItemId, checklistItem.id, status);
      
      // Recarregar dados
      const newDetails = await pcaDetailsApi.getFullDetails(pcaItemId);
      setFullDetails(newDetails);

      toast({
        title: 'Status atualizado',
        description: `${checklistItem.item_nome} alterado para "${status}"`
      });
    } catch (error) {
      console.error('Erro ao atualizar checklist:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive'
      });
    }
  }

  // ============================================================
  // HANDLERS - PONTOS DE CONTROLE
  // ============================================================

  function openAddPontoModal() {
    setPontoForm({ ponto_controle: '', data: '', proxima_reuniao: '' });
    setIsEditingPonto(false);
    setSelectedPonto(null);
    setIsPontoModalOpen(true);
  }

  function openEditPontoModal(ponto: PcaPontoControle) {
    setSelectedPonto(ponto);
    setPontoForm({
      ponto_controle: ponto.ponto_controle,
      data: formatDateForInput(ponto.data),
      proxima_reuniao: formatDateForInput(ponto.proxima_reuniao)
    });
    setIsEditingPonto(true);
    setIsPontoModalOpen(true);
  }

  function openDeletePontoDialog(ponto: PcaPontoControle) {
    setSelectedPonto(ponto);
    setIsDeletePontoDialogOpen(true);
  }

  async function handleSavePonto() {
    // Validações
    if (!pontoForm.ponto_controle.trim()) {
      toast({ title: 'Ponto de controle é obrigatório', variant: 'destructive' });
      return;
    }
    if (!pontoForm.data) {
      toast({ title: 'Data é obrigatória', variant: 'destructive' });
      return;
    }
    if (!pontoForm.proxima_reuniao) {
      toast({ title: 'Próxima reunião é obrigatória', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);

      if (isEditingPonto && selectedPonto) {
        await pcaDetailsApi.updatePontoControle(pcaItemId, selectedPonto.id, pontoForm);
        toast({ title: 'Ponto de controle atualizado com sucesso!' });
      } else {
        await pcaDetailsApi.createPontoControle(pcaItemId, pontoForm);
        toast({ title: 'Ponto de controle criado com sucesso!' });
      }

      setIsPontoModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar ponto de controle:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePonto() {
    if (!selectedPonto) return;

    try {
      setSaving(true);
      await pcaDetailsApi.deletePontoControle(pcaItemId, selectedPonto.id);
      toast({ title: 'Ponto de controle excluído com sucesso!' });
      setIsDeletePontoDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // HANDLERS - TAREFAS
  // ============================================================

  function openAddTarefaModal() {
    setTarefaForm({ tarefa: '', responsavel: '', prazo: '', status: 'Não iniciada' });
    setIsEditingTarefa(false);
    setSelectedTarefa(null);
    setIsTarefaModalOpen(true);
  }

  function openEditTarefaModal(tarefa: PcaTarefa) {
    setSelectedTarefa(tarefa);
    setTarefaForm({
      tarefa: tarefa.tarefa,
      responsavel: tarefa.responsavel,
      prazo: formatDateForInput(tarefa.prazo),
      status: tarefa.status
    });
    setIsEditingTarefa(true);
    setIsTarefaModalOpen(true);
  }

  function openDeleteTarefaDialog(tarefa: PcaTarefa) {
    setSelectedTarefa(tarefa);
    setIsDeleteTarefaDialogOpen(true);
  }

  async function handleSaveTarefa() {
    // Validações
    if (!tarefaForm.tarefa.trim()) {
      toast({ title: 'Tarefa é obrigatória', variant: 'destructive' });
      return;
    }
    if (!tarefaForm.responsavel.trim()) {
      toast({ title: 'Responsável é obrigatório', variant: 'destructive' });
      return;
    }
    if (!tarefaForm.prazo) {
      toast({ title: 'Prazo é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);

      if (isEditingTarefa && selectedTarefa) {
        await pcaDetailsApi.updateTarefa(pcaItemId, selectedTarefa.id, tarefaForm);
        toast({ title: 'Tarefa atualizada com sucesso!' });
      } else {
        await pcaDetailsApi.createTarefa(pcaItemId, tarefaForm);
        toast({ title: 'Tarefa criada com sucesso!' });
      }

      setIsTarefaModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar tarefa:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTarefaStatusChange(tarefa: PcaTarefa, status: TarefaStatus) {
    try {
      await pcaDetailsApi.updateTarefaStatus(pcaItemId, tarefa.id, status);
      toast({ title: 'Status da tarefa atualizado!' });
      loadData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive'
      });
    }
  }

  async function handleDeleteTarefa() {
    if (!selectedTarefa) return;

    try {
      setSaving(true);
      await pcaDetailsApi.deleteTarefa(pcaItemId, selectedTarefa.id);
      toast({ title: 'Tarefa excluída com sucesso!' });
      setIsDeleteTarefaDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir.',
        variant: 'destructive'
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
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Carregando detalhes do item...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!pcaItem || !fullDetails) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Item não encontrado</h3>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/contratacoes-ti')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Esteira
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Button 
            variant="ghost" 
            className="w-fit" 
            onClick={() => navigate('/contratacoes-ti')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Esteira de Contratações
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {pcaItem.item_pca} - {pcaItem.area_demandante}
                </h1>
                <Badge className={getStatusBadgeClass(pcaItem.status)}>
                  {pcaItem.status}
                </Badge>
              </div>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável: {pcaItem.responsavel}
              </p>
            </div>
          </div>
        </div>

        {/* Informações Gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-500 text-xs uppercase">Objeto</Label>
              <p className="mt-1 text-gray-700">{pcaItem.objeto}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-500 text-xs uppercase">Valor Anual</Label>
                <p className="font-medium flex items-center gap-2 mt-1">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  {formatCurrency(pcaItem.valor_anual)}
                </p>
              </div>
              <div>
                <Label className="text-gray-500 text-xs uppercase">Previsão de Contratação</Label>
                <p className="font-medium flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {pcaItem.data_estimada_contratacao}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campos Estáticos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Campos de Controle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Validação DG */}
            <div className="space-y-2">
              <Label>Validação DG</Label>
              <div className="flex flex-col sm:flex-row gap-4">
                <Select 
                  value={fullDetails.details.validacao_dg_tipo}
                  onValueChange={(value: ValidacaoDgTipo) => handleValidacaoDgChange(value)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Data">Data</SelectItem>
                  </SelectContent>
                </Select>

                {fullDetails.details.validacao_dg_tipo === 'Data' && (
                  <div className="flex items-center gap-2">
                    <Label className="text-gray-500 whitespace-nowrap">Data da Validação:</Label>
                    <Input
                      type="date"
                      value={formatDateForInput(fullDetails.details.validacao_dg_data)}
                      onChange={(e) => handleValidacaoDataChange(e.target.value)}
                      disabled={!canEdit}
                      className="w-44"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Fase Atual */}
            <div className="space-y-2">
              <Label>Fase Atual</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Input
                    placeholder="Ex: Planejamento, Execução..."
                    value={faseAtual}
                    onChange={(e) => handleFaseAtualChange(e.target.value)}
                    disabled={!canEdit}
                    maxLength={20}
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    {faseAtual.length}/20
                  </span>
                </div>
                {faseAtualSaved && (
                  <span className="text-green-600 text-sm flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    Salvo
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Checklist de Contratação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {fullDetails.checklist.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium">{item.item_nome}</span>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <Select
                        value={item.status}
                        onValueChange={(value: ChecklistStatus) => handleChecklistStatusChange(item, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Não Iniciada">Não Iniciada</SelectItem>
                          <SelectItem value="Em andamento">Em andamento</SelectItem>
                          <SelectItem value="Concluída">Concluída</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={getChecklistStatusClass(item.status)}>
                        {item.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Barra de Progresso */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progresso</span>
                <span className="text-sm text-gray-500">
                  {fullDetails.checklistProgress.percentual}% ({fullDetails.checklistProgress.concluidos} de {fullDetails.checklistProgress.total} concluídas)
                </span>
              </div>
              <Progress value={fullDetails.checklistProgress.percentual} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Pontos de Controle */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Pontos de Controle
            </CardTitle>
            {canEdit && (
              <Button size="sm" onClick={openAddPontoModal}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Novo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {fullDetails.pontosControle.length > 0 ? (
              <div className="rounded-lg overflow-hidden border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-sky-500 hover:bg-sky-500">
                      <TableHead className="text-white font-bold">Ponto de Controle</TableHead>
                      <TableHead className="text-white font-bold">Data</TableHead>
                      <TableHead className="text-white font-bold">Próxima Reunião</TableHead>
                      {canEdit && <TableHead className="text-white font-bold w-24">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullDetails.pontosControle.map((ponto) => (
                      <TableRow key={ponto.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{ponto.ponto_controle}</TableCell>
                        <TableCell>{formatDate(ponto.data)}</TableCell>
                        <TableCell>{formatDate(ponto.proxima_reuniao)}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openEditPontoModal(ponto)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => openDeletePontoDialog(ponto)}
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
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Nenhum ponto de controle cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tarefas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tarefas
            </CardTitle>
            {canEdit && (
              <Button size="sm" onClick={openAddTarefaModal}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Novo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {fullDetails.tarefas.length > 0 ? (
              <div className="rounded-lg overflow-hidden border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-purple-700 hover:bg-purple-700">
                      <TableHead className="text-white font-bold">Tarefa</TableHead>
                      <TableHead className="text-white font-bold">Responsável</TableHead>
                      <TableHead className="text-white font-bold">Prazo</TableHead>
                      <TableHead className="text-white font-bold">Status</TableHead>
                      {canEdit && <TableHead className="text-white font-bold w-24">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullDetails.tarefas.map((tarefa) => (
                      <TableRow key={tarefa.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{tarefa.tarefa}</TableCell>
                        <TableCell>{tarefa.responsavel}</TableCell>
                        <TableCell>{formatDate(tarefa.prazo)}</TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Select
                              value={tarefa.status}
                              onValueChange={(value: TarefaStatus) => handleTarefaStatusChange(tarefa, value)}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Não iniciada">Não iniciada</SelectItem>
                                <SelectItem value="Em andamento">Em andamento</SelectItem>
                                <SelectItem value="Concluída">Concluída</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={getTarefaStatusClass(tarefa.status)}>
                              {tarefa.status}
                            </Badge>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openEditTarefaModal(tarefa)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => openDeleteTarefaDialog(tarefa)}
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
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Nenhuma tarefa cadastrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Ponto de Controle */}
        <Dialog open={isPontoModalOpen} onOpenChange={setIsPontoModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isEditingPonto ? 'Editar Ponto de Controle' : 'Novo Ponto de Controle'}
              </DialogTitle>
              <DialogDescription>
                {isEditingPonto ? 'Altere os campos desejados.' : 'Preencha os campos para adicionar um novo ponto de controle.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ponto_controle">Ponto de Controle *</Label>
                <Input
                  id="ponto_controle"
                  placeholder="Ex: PC-1, PC-2"
                  value={pontoForm.ponto_controle}
                  onChange={(e) => setPontoForm({ ...pontoForm, ponto_controle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ponto_data">Data *</Label>
                <Input
                  id="ponto_data"
                  type="date"
                  value={pontoForm.data}
                  onChange={(e) => setPontoForm({ ...pontoForm, data: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proxima_reuniao">Próxima Reunião *</Label>
                <Input
                  id="proxima_reuniao"
                  type="date"
                  value={pontoForm.proxima_reuniao}
                  onChange={(e) => setPontoForm({ ...pontoForm, proxima_reuniao: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPontoModalOpen(false)} disabled={saving}>
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
                {isEditingTarefa ? 'Editar Tarefa' : 'Nova Tarefa'}
              </DialogTitle>
              <DialogDescription>
                {isEditingTarefa ? 'Altere os campos desejados.' : 'Preencha os campos para adicionar uma nova tarefa.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tarefa">Tarefa *</Label>
                <Input
                  id="tarefa"
                  placeholder="Ex: Elaborar ETP"
                  value={tarefaForm.tarefa}
                  onChange={(e) => setTarefaForm({ ...tarefaForm, tarefa: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsavel_tarefa">Responsável *</Label>
                <Input
                  id="responsavel_tarefa"
                  placeholder="Nome do responsável"
                  value={tarefaForm.responsavel}
                  onChange={(e) => setTarefaForm({ ...tarefaForm, responsavel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prazo">Prazo *</Label>
                <Input
                  id="prazo"
                  type="date"
                  value={tarefaForm.prazo}
                  onChange={(e) => setTarefaForm({ ...tarefaForm, prazo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status_tarefa">Status</Label>
                <Select
                  value={tarefaForm.status}
                  onValueChange={(value: TarefaStatus) => setTarefaForm({ ...tarefaForm, status: value })}
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
              <Button variant="outline" onClick={() => setIsTarefaModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTarefa} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Exclusão de Ponto */}
        <AlertDialog open={isDeletePontoDialogOpen} onOpenChange={setIsDeletePontoDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o ponto de controle <strong>{selectedPonto?.ponto_controle}</strong>?
                Esta ação não pode ser desfeita.
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
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Exclusão de Tarefa */}
        <AlertDialog open={isDeleteTarefaDialogOpen} onOpenChange={setIsDeleteTarefaDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a tarefa <strong>{selectedTarefa?.tarefa}</strong>?
                Esta ação não pode ser desfeita.
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
      </div>
    </Layout>
  );
}

export default PcaItemDetalhes;

