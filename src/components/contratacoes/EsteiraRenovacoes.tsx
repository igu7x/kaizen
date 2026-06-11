import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  PcaRenovacao,
  RenovacaoStats,
  RenovacaoFilters,
  PcaStatus,
  CreateRenovacaoDto,
  UpdateRenovacaoDto,
  MESES_ORDENADOS
} from '@/types';
import { renovacoesApi } from '@/services/renovacoesApi';
import { formatCurrency, getStatusBadgeClass } from '@/services/pcaApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Briefcase,
  Search as SearchIcon,
  ChevronRight,
  FolderKanban,
  RefreshCw
} from 'lucide-react';

// Converter nome do mês para formato MM/YYYY
function formatMesAno(mesNome: string): string {
  const mesesMap: Record<string, string> = {
    'Janeiro': '01/2026', 'Fevereiro': '02/2026', 'Março': '03/2026',
    'Abril': '04/2026', 'Maio': '05/2026', 'Junho': '06/2026',
    'Julho': '07/2026', 'Agosto': '08/2026', 'Setembro': '09/2026',
    'Outubro': '10/2026', 'Novembro': '11/2026', 'Dezembro': '12/2026'
  };
  return mesesMap[mesNome] || mesNome;
}

export function EsteiraRenovacoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estados principais
  const [items, setItems] = useState<PcaRenovacao[]>([]);
  const [stats, setStats] = useState<RenovacaoStats | null>(null);
  const [filters, setFilters] = useState<RenovacaoFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados de filtros ativos
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGestor, setFilterGestor] = useState<string>('all');
  const [filterMes, setFilterMes] = useState<string>('all');

  // Estados dos modais
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PcaRenovacao | null>(null);

  // Estados do formulário
  const [formData, setFormData] = useState<CreateRenovacaoDto>({
    item_pca: '',
    area_demandante: '',
    gestor_demandante: '',
    contratada: '',
    objeto: '',
    valor_anual: 0,
    data_estimada_contratacao: '',
    status: 'Não Iniciada'
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Verificar se usuário pode editar (MANAGER ou ADMIN)
  const canEdit = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  // Carregar dados ao montar o componente
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [itemsData, statsData, filtersData] = await Promise.all([
        renovacoesApi.getAll(),
        renovacoesApi.getStats(),
        renovacoesApi.getFilters()
      ]);
      
      console.log('📊 Dados carregados:', {
        items: Array.isArray(itemsData) ? itemsData.length : 0,
        stats: statsData,
        filters: filtersData
      });
      
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setStats(statsData || null);
      setFilters(filtersData || null);
    } catch (error: any) {
      console.error('❌ Erro ao carregar dados:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Erro desconhecido';
      // Garantir que arrays estão inicializados mesmo em caso de erro
      setItems([]);
      setStats(null);
      setFilters(null);
    } finally {
      setLoading(false);
    }
  }

  // Filtrar itens
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.item_pca.toLowerCase().includes(term) ||
          item.objeto.toLowerCase().includes(term) ||
          item.area_demandante.toLowerCase().includes(term) ||
          item.gestor_demandante.toLowerCase().includes(term) ||
          item.contratada.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      if (filterArea !== 'all' && item.area_demandante !== filterArea) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (filterGestor !== 'all' && item.gestor_demandante !== filterGestor) return false;
      if (filterMes !== 'all' && item.data_estimada_contratacao !== filterMes) return false;
      return true;
    });
  }, [items, searchTerm, filterArea, filterStatus, filterGestor, filterMes]);

  // Limpar todos os filtros
  function clearFilters() {
    setSearchTerm('');
    setFilterArea('all');
    setFilterStatus('all');
    setFilterGestor('all');
    setFilterMes('all');
  }

  // Abrir modal de adicionar
  function openAddModal() {
    setFormData({
      item_pca: '',
      area_demandante: '',
      gestor_demandante: '',
      contratada: '',
      objeto: '',
      valor_anual: 0,
      data_estimada_contratacao: '',
      status: 'Não Iniciada'
    });
    setFormErrors([]);
    setIsAddModalOpen(true);
  }

  // Abrir modal de editar
  function openEditModal(item: PcaRenovacao) {
    setSelectedItem(item);
    setFormData({
      item_pca: item.item_pca,
      area_demandante: item.area_demandante,
      gestor_demandante: item.gestor_demandante,
      contratada: item.contratada,
      objeto: item.objeto,
      valor_anual: item.valor_anual,
      data_estimada_contratacao: item.data_estimada_contratacao,
      status: item.status
    });
    setFormErrors([]);
    setIsEditModalOpen(true);
  }

  // Abrir dialog de deletar
  function openDeleteDialog(item: PcaRenovacao) {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  }

  // Validar formulário
  function validateForm(): boolean {
    const errors: string[] = [];
    
    if (!formData.item_pca.trim()) errors.push('Item PCA é obrigatório');
    if (formData.item_pca.length > 50) errors.push('Item PCA deve ter no máximo 50 caracteres');
    if (!formData.area_demandante.trim()) errors.push('Área Demandante é obrigatória');
    if (!formData.gestor_demandante.trim()) errors.push('Gestor Demandante é obrigatório');
    if (formData.gestor_demandante.length > 255) errors.push('Gestor Demandante deve ter no máximo 255 caracteres');
    if (!formData.contratada.trim()) errors.push('Contratada é obrigatória');
    if (formData.contratada.length > 255) errors.push('Contratada deve ter no máximo 255 caracteres');
    if (!formData.objeto.trim()) errors.push('Objeto é obrigatório');
    if (formData.objeto.length < 10) errors.push('Objeto deve ter pelo menos 10 caracteres');
    if (!formData.valor_anual || formData.valor_anual <= 0) errors.push('Valor anual deve ser maior que zero');
    if (!formData.data_estimada_contratacao) errors.push('Data estimada de renovação é obrigatória');
    
    setFormErrors(errors);
    return errors.length === 0;
  }

  // Criar nova renovação
  async function handleCreate() {
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      console.log('📝 Criando renovação:', formData);
      const created = await renovacoesApi.create(formData);
      console.log('✅ Renovação criada:', created);
      
      // Optimistic update (garantindo que valores são números)
      setItems(prev => [...prev, created]);
      setStats(prev => prev ? {
        ...prev,
        total: prev.total + 1,
        valorTotal: (Number(prev.valorTotal) || 0) + (Number(created.valor_anual) || 0),
        naoIniciados: prev.naoIniciados + 1
      } : null);
      
      setIsAddModalOpen(false);
      toast({
        title: 'Renovação criada',
        description: `${created.item_pca} foi adicionada com sucesso.`
      });
      
      // Recarregar filtros
      const filtersData = await renovacoesApi.getFilters();
      setFilters(filtersData);
    } catch (error: any) {
      console.error('❌ Erro ao criar renovação:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Erro desconhecido';
      const statusCode = error?.response?.status;
      
      let description = `Não foi possível criar a renovação.`;
      if (statusCode === 403) {
        description = 'Você não tem permissão para criar renovações. Apenas gestores e administradores podem realizar esta operação.';
      } else if (statusCode === 409) {
        description = errorMessage;
      } else if (errorMessage) {
        description = errorMessage;
      }
    } finally {
      setSaving(false);
    }
  }

  // Atualizar renovação
  async function handleUpdate() {
    if (!selectedItem || !validateForm()) return;
    
    try {
      setSaving(true);
      const updated = await renovacoesApi.update(selectedItem.id, formData);
      
      // Optimistic update
      setItems(prev => prev.map(item => item.id === updated.id ? updated : item));
      
      // Atualizar stats se valor mudou (garantindo que valores são números)
      if (selectedItem.valor_anual !== updated.valor_anual) {
        setStats(prev => prev ? {
          ...prev,
          valorTotal: (Number(prev.valorTotal) || 0) - (Number(selectedItem.valor_anual) || 0) + (Number(updated.valor_anual) || 0)
        } : null);
      }
      
      setIsEditModalOpen(false);
      toast({
        title: 'Renovação atualizada',
        description: `${updated.item_pca} foi atualizada com sucesso.`
      });
      
      // Recarregar filtros
      const filtersData = await renovacoesApi.getFilters();
      setFilters(filtersData);
    } catch (error: any) {
      console.error('Erro ao atualizar:', error);
    } finally {
      setSaving(false);
    }
  }

  // Deletar renovação
  async function handleDelete() {
    if (!selectedItem) return;
    
    try {
      setSaving(true);
      await renovacoesApi.delete(selectedItem.id);
      
      // Optimistic update (garantindo que valores são números)
      setItems(prev => prev.filter(item => item.id !== selectedItem.id));
      setStats(prev => prev ? {
        ...prev,
        total: prev.total - 1,
        valorTotal: (Number(prev.valorTotal) || 0) - (Number(selectedItem.valor_anual) || 0),
        naoIniciados: selectedItem.status === 'Não Iniciada' ? prev.naoIniciados - 1 : prev.naoIniciados,
        emAndamento: selectedItem.status === 'Em andamento' ? prev.emAndamento - 1 : prev.emAndamento,
        concluidos: selectedItem.status === 'Concluída' ? prev.concluidos - 1 : prev.concluidos,
      } : null);
      
      setIsDeleteDialogOpen(false);
      toast({
        title: 'Renovação excluída',
        description: `${selectedItem.item_pca} foi excluída com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao excluir:', error);
    } finally {
      setSaving(false);
    }
  }

  // Atualizar status inline
  async function handleStatusChange(item: PcaRenovacao, newStatus: PcaStatus) {
    const oldStatus = item.status;
    
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    setStats(prev => {
      if (!prev) return null;
      const newStats = { ...prev };
      if (oldStatus === 'Não Iniciada') newStats.naoIniciados--;
      if (oldStatus === 'Em andamento') newStats.emAndamento--;
      if (oldStatus === 'Concluída') newStats.concluidos--;
      if (newStatus === 'Não Iniciada') newStats.naoIniciados++;
      if (newStatus === 'Em andamento') newStats.emAndamento++;
      if (newStatus === 'Concluída') newStats.concluidos++;
      return newStats;
    });

    try {
      await renovacoesApi.updateStatus(item.id, newStatus);
      toast({
        title: 'Status atualizado',
        description: `Status de ${item.item_pca} alterado para ${newStatus}.`
      });
    } catch (error) {
      // Rollback
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: oldStatus } : i));
      setStats(prev => {
        if (!prev) return null;
        const newStats = { ...prev };
        if (newStatus === 'Não Iniciada') newStats.naoIniciados--;
        if (newStatus === 'Em andamento') newStats.emAndamento--;
        if (newStatus === 'Concluída') newStats.concluidos--;
        if (oldStatus === 'Não Iniciada') newStats.naoIniciados++;
        if (oldStatus === 'Em andamento') newStats.emAndamento++;
        if (oldStatus === 'Concluída') newStats.concluidos++;
        return newStats;
      });
      
      console.error('Erro ao atualizar status:', error);
    }
  }

  // Navegação para detalhes removida (não implementada ainda)

  // Renderizar status badge
  function renderStatusBadge(status: PcaStatus) {
    return (
      <Badge className={getStatusBadgeClass(status)}>
        {status}
      </Badge>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando renovações...</p>
        </div>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        {/* Cabeçalho Compacto */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Renovações - PCA 2026
            </h2>
          </div>
          {canEdit && (
            <Button onClick={openAddModal} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Nova Renovação
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
                    <Briefcase className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total de Renovações</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
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
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.valorTotal)}</p>
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
                    <p className="text-sm text-gray-500">Concluídas</p>
                    <p className="text-2xl font-bold text-green-600">{stats.concluidos}</p>
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
                    <p className="text-2xl font-bold text-amber-600">{stats.emAndamento}</p>
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
                    <p className="text-sm text-gray-500">Não Iniciadas</p>
                    <p className="text-2xl font-bold text-gray-600">{stats.naoIniciados}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela de Itens */}
        <div className="bg-gray-300 rounded-2xl border border-gray-400 overflow-hidden shadow-sm">
          {/* Header da Tabela */}
          <div className="px-6 py-4 bg-gray-200 border-b border-gray-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-gray-800">Renovações</h3>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Buscar renovação..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 h-10 w-60 bg-white border-gray-300 text-sm rounded-xl focus:border-slate-500 focus:ring-slate-500"
                  />
                </div>
                <Select value={filterGestor} onValueChange={setFilterGestor}>
                  <SelectTrigger className="h-10 w-48 bg-white border-gray-300 text-sm rounded-xl">
                    <SelectValue placeholder="Gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Gestores</SelectItem>
                    {filters?.gestores.map(gestor => (
                      <SelectItem key={gestor} value={gestor}>{gestor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden lg:flex items-center text-lg font-bold text-gray-800">
                <Select value={filterArea} onValueChange={setFilterArea}>
                  <SelectTrigger className="w-32 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-lg font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                    <span>Área</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {filters?.areasDemandantes.map(area => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="w-36 text-center">Valor Estimado</span>
                <Select value={filterMes} onValueChange={setFilterMes}>
                  <SelectTrigger className="w-44 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-lg font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                    <span>Prazo Estimado</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {filters?.meses.map(mes => (
                      <SelectItem key={mes} value={mes}>{formatMesAno(mes)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-36 border-0 !bg-transparent shadow-none h-auto p-0 justify-center gap-1 text-lg font-bold text-gray-800 hover:text-gray-600 focus:ring-0 focus:ring-offset-0 focus:outline-none">
                    <span>Status</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Não Iniciada">Não Iniciada</SelectItem>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Concluída">Concluída</SelectItem>
                  </SelectContent>
                </Select>
                <span className="w-24 text-center">Ações</span>
                <span className="w-10"></span>
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
                  ? 'Nenhuma renovação cadastrada'
                  : 'Nenhuma renovação com os filtros selecionados'
                }
              </p>
              <p className="text-gray-400 text-sm mt-2">
                {items.length === 0
                  ? 'Não há renovações cadastradas ainda.'
                  : 'Tente alterar os filtros para ver mais resultados.'}
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
                  onClick={() => navigate(`/contratacoes-ti/renovacoes/item/${item.id}`)}
                  className={`group flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-all cursor-pointer ${index !== filteredItems.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  {/* Info do Item (Item + Objeto na mesma coluna) */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/30">
                      <RefreshCw className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-gray-900 font-semibold text-base truncate group-hover:text-emerald-600 transition-colors">
                          {item.item_pca}
                        </h4>
                        {item.gestor_demandante && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            — Responsável: {item.gestor_demandante}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {item.objeto}
                      </p>
                    </div>
                  </div>

                  {/* Colunas da tabela (desktop) */}
                  <div className="hidden lg:flex items-center">
                    {/* Área Demandante */}
                    <div className="w-32 text-center">
                      <span className="text-sm text-gray-700 font-medium">{item.area_demandante}</span>
                    </div>

                    {/* Valor Estimado */}
                    <div className="w-36 text-center">
                      <span className="text-sm text-emerald-700 font-bold">
                        {formatCurrency(item.valor_anual)}
                      </span>
                    </div>

                    {/* Prazo Estimado */}
                    <div className="w-44 text-center">
                      <span className="text-sm text-gray-700 font-bold">
                        {formatMesAno(item.data_estimada_contratacao)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="w-36 flex justify-center">
                      {renderStatusBadge(item.status)}
                    </div>

                    {/* Ações */}
                    <div className="w-24 flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <>
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
                        </>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className="w-10 flex justify-center">
                      <ChevronRight className="h-6 w-6 text-gray-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>

                  {/* Mobile: info resumida + chevron */}
                  <div className="flex lg:hidden items-center gap-2">
                    {renderStatusBadge(item.status)}
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
              <DialogTitle>Nova Renovação</DialogTitle>
              <DialogDescription>
                Preencha os campos abaixo para adicionar uma nova renovação ao PCA.
              </DialogDescription>
            </DialogHeader>
            
            {formErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {formErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item_pca">Item do PCA *</Label>
                  <Input
                    id="item_pca"
                    placeholder="Ex: PCA 300"
                    value={formData.item_pca}
                    onChange={(e) => setFormData({ ...formData, item_pca: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area_demandante">Área Demandante *</Label>
                  <Input
                    id="area_demandante"
                    placeholder="Ex: CITEC, CSTI..."
                    value={formData.area_demandante}
                    onChange={(e) => setFormData({ ...formData, area_demandante: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gestor_demandante">Gestor Demandante *</Label>
                <Input
                  id="gestor_demandante"
                  placeholder="Nome completo do gestor"
                  value={formData.gestor_demandante}
                  onChange={(e) => setFormData({ ...formData, gestor_demandante: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contratada">Contratada *</Label>
                <Input
                  id="contratada"
                  placeholder="Nome da empresa contratada"
                  value={formData.contratada}
                  onChange={(e) => setFormData({ ...formData, contratada: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objeto">Objeto *</Label>
                <Textarea
                  id="objeto"
                  placeholder="Descrição detalhada do objeto da renovação (mínimo 10 caracteres)"
                  value={formData.objeto}
                  onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_anual">Valor Anual (R$) *</Label>
                  <Input
                    id="valor_anual"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.valor_anual || ''}
                    onChange={(e) => setFormData({ ...formData, valor_anual: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_estimada">Data Estimada de Renovação *</Label>
                  <Select 
                    value={formData.data_estimada_contratacao} 
                    onValueChange={(value) => setFormData({ ...formData, data_estimada_contratacao: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o mês..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES_ORDENADOS.map(mes => (
                        <SelectItem key={mes} value={mes}>{mes}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: PcaStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não Iniciada">Não Iniciada</SelectItem>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Concluída">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Editar */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Renovação</DialogTitle>
              <DialogDescription>
                Atualize os campos abaixo.
              </DialogDescription>
            </DialogHeader>
            
            {formErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {formErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_item_pca">Item do PCA *</Label>
                  <Input
                    id="edit_item_pca"
                    placeholder="Ex: PCA 300"
                    value={formData.item_pca}
                    onChange={(e) => setFormData({ ...formData, item_pca: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_area_demandante">Área Demandante *</Label>
                  <Input
                    id="edit_area_demandante"
                    placeholder="Ex: CITEC, CSTI..."
                    value={formData.area_demandante}
                    onChange={(e) => setFormData({ ...formData, area_demandante: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_gestor_demandante">Gestor Demandante *</Label>
                <Input
                  id="edit_gestor_demandante"
                  placeholder="Nome completo do gestor"
                  value={formData.gestor_demandante}
                  onChange={(e) => setFormData({ ...formData, gestor_demandante: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_contratada">Contratada *</Label>
                <Input
                  id="edit_contratada"
                  placeholder="Nome da empresa contratada"
                  value={formData.contratada}
                  onChange={(e) => setFormData({ ...formData, contratada: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_objeto">Objeto *</Label>
                <Textarea
                  id="edit_objeto"
                  placeholder="Descrição detalhada do objeto da renovação"
                  value={formData.objeto}
                  onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_valor_anual">Valor Anual (R$) *</Label>
                  <Input
                    id="edit_valor_anual"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.valor_anual || ''}
                    onChange={(e) => setFormData({ ...formData, valor_anual: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_data_estimada">Data Estimada de Renovação *</Label>
                  <Select 
                    value={formData.data_estimada_contratacao} 
                    onValueChange={(value) => setFormData({ ...formData, data_estimada_contratacao: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o mês..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES_ORDENADOS.map(mes => (
                        <SelectItem key={mes} value={mes}>{mes}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: PcaStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não Iniciada">Não Iniciada</SelectItem>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Concluída">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleUpdate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Atualizar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a renovação <strong>{selectedItem?.item_pca}</strong>?
                <br /><br />
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-red-600 hover:bg-red-700">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
}

