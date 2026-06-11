import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { VoltarCadastros } from '@/components/ui/VoltarCadastros';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { useToast } from '@/hooks/use-toast';
import {
  areasApi,
  Area,
  AreaCompleta,
  Unidade,
  CreateAreaDto,
  CreateUnidadeDto,
  UnidadeUsuarios
} from '@/services/areasApi';
import { getUsers } from '@/services/api';
import type { User as UserType } from '@/types';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Icons
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  Users,
  User,
  Eye,
  ArrowLeft,
  Layers,
  Loader2,
  UserCheck,
  Mail,
  Briefcase,
  Crown
} from 'lucide-react';

export default function Areas() {
  const { user } = useAuth();
  const { devEnvironment } = useDirectorate();
  const { toast } = useToast();

  // Estados principais
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingArea, setLoadingArea] = useState(false);
  const [saving, setSaving] = useState(false);

  // Área selecionada (para ver detalhes e unidades)
  const [areaSelecionada, setAreaSelecionada] = useState<AreaCompleta | null>(null);

  // Modal states - Área
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [modalConfirmDeleteOpen, setModalConfirmDeleteOpen] = useState(false);
  const [itemParaDeletar, setItemParaDeletar] = useState<{ id: number; nome: string; tipo: 'area' | 'unidade' } | null>(null);
  const [modalInfoCompletaOpen, setModalInfoCompletaOpen] = useState(false);
  const [areaVisualizar, setAreaVisualizar] = useState<Area | null>(null);

  // Modal states - Ver usuários da unidade
  const [modalUsuariosOpen, setModalUsuariosOpen] = useState(false);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [unidadeUsuarios, setUnidadeUsuarios] = useState<UnidadeUsuarios | null>(null);

  // Modal states - Unidade
  const [modalUnidadeOpen, setModalUnidadeOpen] = useState(false);
  const [modalUnidadeMode, setModalUnidadeMode] = useState<'create' | 'edit'>('create');
  const [editingUnidade, setEditingUnidade] = useState<Unidade | null>(null);

  // Form data - Área
  const [formData, setFormData] = useState<CreateAreaDto>({
    nome: '',
    sigla: '',
    subordinacao: '',
    gestor: '',
    cargo_gestor: '',
    foto_gestor: '',
    subdiretor: '',
    cargo_subdiretor: '',
    foto_subdiretor: '',
    gerido_por_unidade_superior: false,
    colaboradores_vinculados: ''
  });

  // Busca de gestor (usuários do sistema)
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [gestorSearch, setGestorSearch] = useState('');
  const [showGestorDropdown, setShowGestorDropdown] = useState(false);
  const [subdiretorSearch, setSubdiretorSearch] = useState('');
  const [showSubdiretorDropdown, setShowSubdiretorDropdown] = useState(false);
  const [responsavelSearch, setResponsavelSearch] = useState('');
  const [showResponsavelDropdown, setShowResponsavelDropdown] = useState(false);

  // Form data - Unidade
  const [formUnidade, setFormUnidade] = useState<CreateUnidadeDto>({
    nome: '',
    descricao: '',
    responsavel: '',
    cargo_responsavel: '',
    unidade_superior_id: null
  });

  // Drag and drop states
  const [linhas, setLinhas] = useState<Area[][]>([[]]);
  const [draggedItem, setDraggedItem] = useState<{ linha: number; index: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ linha: number; index: number } | null>(null);

  // Permissões
  const canEdit = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

  const loadAreas = useCallback(async () => {
    try {
      setLoading(true);
      // Se devEnvironment está ativo, filtra por domínio do ambiente selecionado
      const allAreas = devEnvironment ? await areasApi.getByDominio(devEnvironment) : await areasApi.getAll();
      setAreas(allAreas);
    } catch (error) {
      console.error('Erro ao carregar áreas:', error);
    } finally {
      setLoading(false);
    }
  }, [toast, devEnvironment]);

  useEffect(() => {
    loadAreas();
    getUsers(devEnvironment || undefined).then(setAllUsers).catch(console.error);
  }, [loadAreas]);

  // Carregar área completa com unidades
  const loadAreaCompleta = useCallback(async (areaId: number) => {
    try {
      setLoadingArea(true);
      const data = await areasApi.getAreaCompleta(areaId);
      setAreaSelecionada(data);
    } catch (error) {
      console.error('Erro ao carregar área:', error);
    } finally {
      setLoadingArea(false);
    }
  }, [toast]);

  // Organizar áreas em linhas para drag and drop
  useEffect(() => {
    if (areas.length === 0) {
      setLinhas([[]]);
      return;
    }

    const linhasMap = new Map<number, Area[]>();
    areas.forEach(area => {
      const linha = area.ordem_linha ?? 0;
      if (!linhasMap.has(linha)) {
        linhasMap.set(linha, []);
      }
      linhasMap.get(linha)!.push(area);
    });

    // Ordenar por posição dentro de cada linha
    linhasMap.forEach((areasLinha) => {
      areasLinha.sort((a, b) => (a.ordem_posicao ?? 0) - (b.ordem_posicao ?? 0));
    });

    // Converter para array
    const linhasArray: Area[][] = [];
    const maxLinha = Math.max(...Array.from(linhasMap.keys()), 0);
    for (let i = 0; i <= maxLinha; i++) {
      linhasArray.push(linhasMap.get(i) || []);
    }

    // Garantir que sempre tenha pelo menos uma linha
    if (linhasArray.length === 0 || (linhasArray.length === 1 && linhasArray[0].length === 0)) {
      setLinhas([[]]);
    } else {
      setLinhas(linhasArray);
    }
  }, [areas]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleOpenModal = (mode: 'create' | 'edit', area?: Area) => {
    setModalMode(mode);
    if (mode === 'edit' && area) {
      setEditingArea(area);
      setFormData({
        nome: area.nome,
        sigla: area.sigla || '',
        subordinacao: area.subordinacao || '',
        gestor: area.gestor || '',
        cargo_gestor: area.cargo_gestor || '',
        foto_gestor: area.foto_gestor || '',
        subdiretor: area.subdiretor || '',
        cargo_subdiretor: area.cargo_subdiretor || '',
        foto_subdiretor: area.foto_subdiretor || '',
        gerido_por_unidade_superior: area.gerido_por_unidade_superior || false,
        colaboradores_vinculados: area.colaboradores_vinculados || ''
      });
      setGestorSearch(area.gestor || '');
      setSubdiretorSearch(area.subdiretor || '');
    } else {
      setEditingArea(null);
      setFormData({
        nome: '',
        sigla: '',
        subordinacao: '',
        gestor: '',
        cargo_gestor: '',
        foto_gestor: '',
        subdiretor: '',
        cargo_subdiretor: '',
        foto_subdiretor: '',
        gerido_por_unidade_superior: false,
        colaboradores_vinculados: ''
      });
      setGestorSearch('');
      setSubdiretorSearch('');
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingArea(null);
    setFormData({
      nome: '',
      sigla: '',
      subordinacao: '',
      gestor: '',
      cargo_gestor: '',
      foto_gestor: '',
      subdiretor: '',
      cargo_subdiretor: '',
      foto_subdiretor: '',
      gerido_por_unidade_superior: false,
      colaboradores_vinculados: ''
    });
    setGestorSearch('');
    setSubdiretorSearch('');
  };

  const handleSave = async () => {
    if (saving) return;

    if (!formData.nome.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da área é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.sigla.trim()) {
      toast({
        title: 'Erro',
        description: 'A sigla da área é obrigatória',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        await areasApi.create(formData);
      } else if (editingArea) {
        await areasApi.update(editingArea.id, formData);
      }

      handleCloseModal();
      await loadAreas();
    } catch (error: any) {
      // apiClient já exibe erro globalmente, log apenas para debug
      console.error('[Areas] Falha ao salvar área:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemParaDeletar) return;

    try {
      if (itemParaDeletar.tipo === 'unidade') {
        await areasApi.removeUnidade(itemParaDeletar.id);
        if (areaSelecionada) {
          await loadAreaCompleta(areaSelecionada.id);
        }
      } else {
        await areasApi.remove(itemParaDeletar.id);
        setAreaSelecionada(null);
        await loadAreas();
      }
      setModalConfirmDeleteOpen(false);
      setItemParaDeletar(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  // ============================================================
  // HANDLERS - UNIDADES
  // ============================================================

  const handleSelecionarArea = (area: Area) => {
    loadAreaCompleta(area.id);
  };

  const handleVoltarParaAreas = () => {
    setAreaSelecionada(null);
  };

  const handleVerUsuariosUnidade = async (unidadeId: number) => {
    setModalUsuariosOpen(true);
    setUnidadeUsuarios(null);
    setUsuariosLoading(true);
    try {
      const data = await areasApi.getUnidadeUsuarios(unidadeId);
      setUnidadeUsuarios(data);
    } catch (err: any) {
      console.error('Erro ao carregar usuários da unidade:', err);
    } finally {
      setUsuariosLoading(false);
    }
  };

  const handleOpenModalUnidade = (mode: 'create' | 'edit', unidade?: Unidade) => {
    setModalUnidadeMode(mode);
    if (mode === 'edit' && unidade) {
      setEditingUnidade(unidade);
      setFormUnidade({
        nome: unidade.nome,
        descricao: unidade.descricao || '',
        responsavel: unidade.responsavel || '',
        cargo_responsavel: unidade.cargo_responsavel || '',
        unidade_superior_id: unidade.unidade_superior_id || null
      });
    } else {
      setEditingUnidade(null);
      setFormUnidade({
        nome: '',
        descricao: '',
        responsavel: '',
        cargo_responsavel: '',
        unidade_superior_id: null
      });
    }
    setModalUnidadeOpen(true);
  };

  const handleCloseModalUnidade = () => {
    setModalUnidadeOpen(false);
    setEditingUnidade(null);
    setFormUnidade({
      nome: '',
      descricao: '',
      responsavel: '',
      cargo_responsavel: '',
      unidade_superior_id: null
    });
  };

  const handleSaveUnidade = async () => {
    try {
      if (!formUnidade.nome.trim()) {
        toast({
          title: 'Erro',
          description: 'O nome da unidade é obrigatório',
          variant: 'destructive'
        });
        return;
      }

      if (!areaSelecionada) return;

      if (modalUnidadeMode === 'create') {
        await areasApi.createUnidade(areaSelecionada.id, formUnidade);
      } else if (editingUnidade) {
        await areasApi.updateUnidade(editingUnidade.id, formUnidade);
      }

      handleCloseModalUnidade();
      await loadAreaCompleta(areaSelecionada.id);
    } catch (error) {
      console.error('Erro ao salvar unidade:', error);
    }
  };

  // ============================================================
  // DRAG AND DROP
  // ============================================================

  const handleDragStart = (e: React.DragEvent, linha: number, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ linha, index }));
    setTimeout(() => setDraggedItem({ linha, index }), 0);
  };

  const handleDragOver = (e: React.DragEvent, linha: number, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget({ linha, index });
  };

  const handleDragOverLinha = (e: React.DragEvent, linha: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const areasNaLinha = linhas[linha] || [];
    setDragOverTarget({ linha, index: areasNaLinha.length });
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, targetLinha: number, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) {
      setDraggedItem(null);
      setDragOverTarget(null);
      return;
    }

    // Clonar linhas
    const novasLinhas = linhas.map(l => [...l]);

    // Remover da posição original
    const [itemMovido] = novasLinhas[draggedItem.linha].splice(draggedItem.index, 1);

    // Ajustar índice se movendo na mesma linha para frente
    let finalIndex = targetIndex;
    if (draggedItem.linha === targetLinha && targetIndex > draggedItem.index) {
      finalIndex = targetIndex - 1;
    }

    // Garantir que a linha 0 não fique vazia
    if (draggedItem.linha === 0 && novasLinhas[0].length === 0 && targetLinha !== 0) {
      toast({
        title: 'Atenção',
        description: 'A primeira linha deve ter pelo menos uma área',
        variant: 'destructive'
      });
      setDraggedItem(null);
      setDragOverTarget(null);
      return;
    }

    // Inserir na nova posição
    novasLinhas[targetLinha].splice(finalIndex, 0, itemMovido);

    // Remover linhas vazias (exceto a primeira)
    const linhasLimpas = novasLinhas.filter((l, i) => i === 0 || l.length > 0);

    setLinhas(linhasLimpas);

    // Salvar ordenação
    await salvarOrdenacao(linhasLimpas);

    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDropNovaLinha = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) {
      setDraggedItem(null);
      setDragOverTarget(null);
      return;
    }

    // Verificar se a linha 0 ficaria vazia
    if (draggedItem.linha === 0 && linhas[0].length === 1) {
      toast({
        title: 'Atenção',
        description: 'A primeira linha deve ter pelo menos uma área',
        variant: 'destructive'
      });
      setDraggedItem(null);
      setDragOverTarget(null);
      return;
    }

    const novasLinhas = linhas.map(l => [...l]);
    const [itemMovido] = novasLinhas[draggedItem.linha].splice(draggedItem.index, 1);

    // Criar nova linha
    novasLinhas.push([itemMovido]);

    // Remover linhas vazias (exceto a primeira)
    const linhasLimpas = novasLinhas.filter((l, i) => i === 0 || l.length > 0);

    setLinhas(linhasLimpas);

    await salvarOrdenacao(linhasLimpas);

    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const salvarOrdenacao = async (linhasParaSalvar: Area[][]) => {
    try {
      const ordenacao: { id: number; ordem_linha: number; ordem_posicao: number }[] = [];

      linhasParaSalvar.forEach((linha, linhaIndex) => {
        linha.forEach((area, posIndex) => {
          ordenacao.push({
            id: area.id,
            ordem_linha: linhaIndex,
            ordem_posicao: posIndex
          });
        });
      });

      await areasApi.updateOrdenacao(ordenacao);
    } catch (error) {
      console.error('Erro ao salvar ordenação:', error);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  const parseSiglaENome = (nome: string): { sigla: string; nomeCompleto: string } => {
    const trimmed = (nome || '').trim();

    // Ex: "DTI: Diretoria de ..." ou "DTI - Diretoria de ..."
    const prefixMatch = trimmed.match(/^([A-Z]{2,6})\s*[:\-]\s*(.+)$/);
    if (prefixMatch) {
      return { sigla: prefixMatch[1].trim(), nomeCompleto: prefixMatch[2].trim() };
    }

    // Ex: "Diretoria de ... (DTI)"
    const suffixMatch = trimmed.match(/^(.*)\(([^)]+)\)\s*$/);
    if (suffixMatch) {
      return { sigla: suffixMatch[2].trim(), nomeCompleto: suffixMatch[1].trim() };
    }

    return { sigla: trimmed, nomeCompleto: trimmed };
  };

  const renderCardArea = (area: Area, linha: number, index: number) => {
    const isDragging = draggedItem?.linha === linha && draggedItem?.index === index;
    const isDragOver = dragOverTarget?.linha === linha && dragOverTarget?.index === index;

    // Se tiver sigla no banco, usa ela. Senão tenta fazer o parse do nome.
    let sigla = area.sigla;
    let nomeExibicao = area.nome;

    if (!sigla) {
      const parsed = parseSiglaENome(area.nome);
      sigla = parsed.sigla;
      nomeExibicao = parsed.nomeCompleto;
    }

    return (
      <div
        key={area.id}
        draggable={canEdit}
        onDragStart={canEdit ? (e) => handleDragStart(e, linha, index) : undefined}
        onDragOver={canEdit ? (e) => handleDragOver(e, linha, index) : undefined}
        onDragLeave={canEdit ? handleDragLeave : undefined}
        onDrop={canEdit ? (e) => handleDrop(e, linha, index) : undefined}
        onDragEnd={canEdit ? handleDragEnd : undefined}
        onClick={() => handleSelecionarArea(area)}
        className={`
          group bg-white hover:bg-slate-50
          border border-slate-200 hover:border-slate-300
          rounded-xl p-4 text-left transition-all duration-300
          hover:shadow-md
          ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
          ${isDragging ? 'opacity-50 scale-95' : ''}
          ${isDragOver ? 'border-green-500 border-2 bg-green-50' : ''}
          min-w-[180px] max-w-[220px] flex-shrink-0
        `}
        title={area.nome}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4a7a9e] to-[#2d5a7e] flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-slate-900 font-bold text-lg group-hover:text-blue-600 transition-colors">
            {sigla}
          </h3>
          <p className="text-slate-600 text-xs leading-snug">
            {nomeExibicao}
          </p>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER - TELA DA ÁREA SELECIONADA (COM UNIDADES)
  // ============================================================

  const renderTelaAreaSelecionada = () => {
    if (!areaSelecionada) return null;

    return (
      <div className="space-y-6">
        {/* Header com botão voltar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleVoltarParaAreas}
              variant="ghost"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4a7a9e] to-[#2d5a7e] flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{areaSelecionada.nome}</h2>
                {areaSelecionada.subordinacao && (
                  <p className="text-slate-500 text-sm">Subordinado a: {areaSelecionada.subordinacao}</p>
                )}
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex gap-2">
              <Button
                onClick={() => handleOpenModal('edit', areaSelecionada)}
                variant="outline"
                className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar Área
              </Button>
              <Button
                onClick={() => {
                  setItemParaDeletar({ id: areaSelecionada.id, nome: areaSelecionada.nome, tipo: 'area' });
                  setModalConfirmDeleteOpen(true);
                }}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          )}
        </div>

        {/* Informações da Área */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 xl:gap-5">
            {areaSelecionada.gestor && (
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Gestor</p>
                <p className="text-gray-900 font-medium">{areaSelecionada.gestor}</p>
                {areaSelecionada.cargo_gestor && (
                  <p className="text-gray-500 text-sm">{areaSelecionada.cargo_gestor}</p>
                )}
              </div>
            )}
            {areaSelecionada.subdiretor && (
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Sub-diretor</p>
                <p className="text-gray-900 font-medium">{areaSelecionada.subdiretor}</p>
                {areaSelecionada.cargo_subdiretor && (
                  <p className="text-gray-500 text-sm">{areaSelecionada.cargo_subdiretor}</p>
                )}
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Gerido por Unidade Superior</p>
              <p className="text-gray-900">
                {areaSelecionada.gerido_por_unidade_superior
                  ? `Sim${areaSelecionada.subordinacao ? ` — ${areaSelecionada.subordinacao}` : ''}`
                  : 'Não'}
              </p>
            </div>
            {areaSelecionada.colaboradores_vinculados && (
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Colaboradores</p>
                <p className="text-gray-900">{areaSelecionada.colaboradores_vinculados}</p>
              </div>
            )}
          </div>
        </div>

        {/* Unidades */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#4a7a9e]" />
              <h3 className="text-gray-900 font-semibold">
                Unidades ({areaSelecionada.unidades?.length || 0})
              </h3>
            </div>
            {canCreate && (
              <Button
                onClick={() => handleOpenModalUnidade('create')}
                className="bg-[#5A8A7A] hover:bg-[#4A7A6A] text-white"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Unidade
              </Button>
            )}
          </div>

          {loadingArea ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : !areaSelecionada.unidades || areaSelecionada.unidades.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Nenhuma unidade cadastrada nesta área.
              {canCreate && ' Clique em "Nova Unidade" para criar.'}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Renderizar unidades principais (sem subordinação ou com pai inexistente) */}
              {areaSelecionada.unidades
                .filter(u => {
                  // Sem subordinação é principal
                  if (!u.unidade_superior_id) return true;
                  // Se o pai não existe mais, também é tratada como principal
                  const paiExiste = areaSelecionada.unidades.some(p => p.id === u.unidade_superior_id);
                  return !paiExiste;
                })
                .map((unidade) => (
                  <div key={unidade.id}>
                    {/* Unidade Principal */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4a7a9e] to-[#2d5a7e] flex items-center justify-center">
                          <Layers className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{unidade.nome}</h4>
                          {unidade.responsavel && (
                            <p className="text-sm text-gray-500">
                              <Users className="inline-block w-3 h-3 mr-1" />
                              {unidade.responsavel}
                              {unidade.cargo_responsavel && ` - ${unidade.cargo_responsavel}`}
                            </p>
                          )}
                          {unidade.descricao && (
                            <p className="text-sm text-gray-400 mt-1">{unidade.descricao}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleVerUsuariosUnidade(unidade.id)}
                          className="h-8 w-8 p-0 hover:bg-emerald-50"
                          title="Ver usuários"
                        >
                          <Users className="h-4 w-4 text-emerald-600" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenModalUnidade('edit', unidade)}
                              className="h-8 w-8 p-0 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setItemParaDeletar({ id: unidade.id, nome: unidade.nome, tipo: 'unidade' });
                                setModalConfirmDeleteOpen(true);
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Unidades Subordinadas (cascateadas) */}
                    {areaSelecionada.unidades
                      .filter(sub => sub.unidade_superior_id === unidade.id)
                      .map((subUnidade) => (
                        <div
                          key={subUnidade.id}
                          className="flex items-center justify-between p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors mt-2"
                          style={{ marginLeft: '60px' }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6a9abe] to-[#4a7a9e] flex items-center justify-center flex-shrink-0">
                              <Layers className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-800">{subUnidade.nome}</h4>
                              {subUnidade.responsavel && (
                                <p className="text-sm text-gray-500">
                                  <Users className="inline-block w-3 h-3 mr-1" />
                                  {subUnidade.responsavel}
                                  {subUnidade.cargo_responsavel && ` - ${subUnidade.cargo_responsavel}`}
                                </p>
                              )}
                              {subUnidade.descricao && (
                                <p className="text-sm text-gray-400 mt-1">{subUnidade.descricao}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleVerUsuariosUnidade(subUnidade.id)}
                              className="h-8 w-8 p-0 hover:bg-emerald-100"
                              title="Ver usuários"
                            >
                              <Users className="h-4 w-4 text-emerald-600" />
                            </Button>
                            {canEdit && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenModalUnidade('edit', subUnidade)}
                                  className="h-8 w-8 p-0 hover:bg-blue-200"
                                >
                                  <Edit className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setItemParaDeletar({ id: subUnidade.id, nome: subUnidade.nome, tipo: 'unidade' });
                                    setModalConfirmDeleteOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER - TELA DE LISTA DE ÁREAS
  // ============================================================

  const renderTelaListaAreas = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#4a7a9e] to-[#2d5a7e] flex items-center justify-center shadow-lg">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Áreas</h1>
            <p className="text-slate-500 text-sm">Cadastro de Áreas</p>
          </div>
        </div>
        {canCreate && (
          <Button
            onClick={() => handleOpenModal('create')}
            className="bg-[#5A8A7A] hover:bg-[#4A7A6A] text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Área
          </Button>
        )}
      </div>

      {/* Lista de Áreas */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Carregando áreas...</div>
      ) : areas.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Nenhuma área cadastrada.
        </div>
      ) : (
        <div className="space-y-3">
          {linhas.map((areasLinha, linhaIndex) => (
            <div
              key={linhaIndex}
              className="min-h-[90px] p-2"
              onDragOver={canEdit ? (e) => handleDragOverLinha(e, linhaIndex) : undefined}
              onDrop={canEdit ? (e) => handleDrop(e, linhaIndex, areasLinha.length) : undefined}
            >
              <div className="flex flex-wrap gap-4">
                {areasLinha.map((area, index) => renderCardArea(area, linhaIndex, index))}
                {areasLinha.length === 0 && (
                  <div className="text-slate-400 text-sm italic p-4">
                    Arraste uma área para esta linha
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Área para criar nova linha */}
          {canEdit && draggedItem && (
            <div
              className="min-h-[80px] p-4 rounded-xl border-2 border-dashed border-green-400/50 bg-green-500/10 flex items-center justify-center"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={handleDropNovaLinha}
            >
              <p className="text-green-400/70 text-sm">Solte aqui para criar uma nova linha</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="page-transition-enter">
        <VoltarCadastros />
        {/* Conteúdo principal - condicional */}
        {areaSelecionada ? renderTelaAreaSelecionada() : renderTelaListaAreas()}
      </div>

      {/* Modal Criar/Editar Área */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? 'Nova Área' : 'Editar Área'}
            </DialogTitle>
            <DialogDescription>
              {modalMode === 'create'
                ? 'Preencha os dados para criar uma nova área'
                : 'Edite os dados da área'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div>
              <Label htmlFor="nome">Nome da Área *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Diretoria de Tecnologia da Informação"
                className="mt-1"
              />
            </div>

            {/* Sigla */}
            <div>
              <Label htmlFor="sigla">Sigla *</Label>
              <Input
                id="sigla"
                maxLength={10}
                value={formData.sigla}
                onChange={(e) => setFormData({ ...formData, sigla: e.target.value })}
                placeholder="Ex: DTI (máx. 10 caracteres)"
                className="mt-1"
              />
            </div>

            {/* Subordinação */}
            <div>
              <Label htmlFor="subordinacao">Subordinação</Label>
              <Select
                value={formData.subordinacao || '_none_'}
                onValueChange={(value) => {
                  const sub = value === '_none_' ? '' : value;
                  setFormData({
                    ...formData,
                    subordinacao: sub,
                    gerido_por_unidade_superior: !!sub,
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a área superior" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">{areaSelecionada?.nome || 'Diretoria'} (área principal)</SelectItem>
                  {areas
                    .filter(a => a.id !== editingArea?.id)
                    .map(a => (
                      <SelectItem key={a.id} value={a.nome}>
                        {a.sigla ? `${a.sigla} — ${a.nome}` : a.nome}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Gestor */}
            <div className="relative">
              <Label htmlFor="gestor">Gestor</Label>
              <Input
                id="gestor"
                value={gestorSearch}
                onChange={(e) => {
                  setGestorSearch(e.target.value);
                  setShowGestorDropdown(true);
                  if (!e.target.value) setFormData({ ...formData, gestor: '' });
                }}
                onFocus={() => { if (gestorSearch.length > 0) setShowGestorDropdown(true); }}
                placeholder="Digite para buscar..."
                className="mt-1"
              />
              {showGestorDropdown && gestorSearch.trim().length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {allUsers
                    .filter(u => u.name.toLowerCase().includes(gestorSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(u => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0"
                        onClick={() => {
                          setFormData({ ...formData, gestor: u.name });
                          setGestorSearch(u.name);
                          setShowGestorDropdown(false);
                        }}
                      >
                        <span className="font-medium">{u.name}</span>
                        {(u as any).diretoria && <span className="text-xs text-gray-500 ml-2">({(u as any).diretoria})</span>}
                      </button>
                    ))
                  }
                  {allUsers.filter(u => u.name.toLowerCase().includes(gestorSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">Nenhum usuário encontrado</div>
                  )}
                </div>
              )}
            </div>

            {/* Cargo do Gestor */}
            <div>
              <Label htmlFor="cargo_gestor">Cargo do Gestor</Label>
              <Input
                id="cargo_gestor"
                value={formData.cargo_gestor}
                onChange={(e) => setFormData({ ...formData, cargo_gestor: e.target.value })}
                placeholder="Cargo do gestor"
                className="mt-1"
              />
            </div>

            {/* Foto do Gestor */}
            <div>
              <Label htmlFor="foto_gestor">Foto do Gestor (URL)</Label>
              <Input
                id="foto_gestor"
                value={formData.foto_gestor}
                onChange={(e) => setFormData({ ...formData, foto_gestor: e.target.value })}
                placeholder="URL da foto do gestor"
                className="mt-1"
              />
            </div>

            {/* Sub-diretor */}
            <div className="relative">
              <Label htmlFor="subdiretor">Sub-diretor</Label>
              <Input
                id="subdiretor"
                value={subdiretorSearch}
                onChange={(e) => {
                  setSubdiretorSearch(e.target.value);
                  setShowSubdiretorDropdown(true);
                  if (!e.target.value) setFormData({ ...formData, subdiretor: '' });
                }}
                onFocus={() => { if (subdiretorSearch.length > 0) setShowSubdiretorDropdown(true); }}
                placeholder="Digite para buscar..."
                className="mt-1"
              />
              {showSubdiretorDropdown && subdiretorSearch.trim().length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {allUsers
                    .filter(u => u.name.toLowerCase().includes(subdiretorSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(u => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0"
                        onClick={() => {
                          setFormData({ ...formData, subdiretor: u.name });
                          setSubdiretorSearch(u.name);
                          setShowSubdiretorDropdown(false);
                        }}
                      >
                        <span className="font-medium">{u.name}</span>
                        {(u as any).diretoria && <span className="text-xs text-gray-500 ml-2">({(u as any).diretoria})</span>}
                      </button>
                    ))
                  }
                  {allUsers.filter(u => u.name.toLowerCase().includes(subdiretorSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">Nenhum usuário encontrado</div>
                  )}
                </div>
              )}
            </div>

            {/* Cargo do Sub-diretor */}
            <div>
              <Label htmlFor="cargo_subdiretor">Cargo do Sub-diretor</Label>
              <Input
                id="cargo_subdiretor"
                value={formData.cargo_subdiretor}
                onChange={(e) => setFormData({ ...formData, cargo_subdiretor: e.target.value })}
                placeholder="Cargo do sub-diretor"
                className="mt-1"
              />
            </div>

            {/* Foto do Sub-diretor */}
            <div>
              <Label htmlFor="foto_subdiretor">Foto do Sub-diretor (URL)</Label>
              <Input
                id="foto_subdiretor"
                value={formData.foto_subdiretor}
                onChange={(e) => setFormData({ ...formData, foto_subdiretor: e.target.value })}
                placeholder="URL da foto do sub-diretor"
                className="mt-1"
              />
            </div>

            {/* Colaboradores Vinculados */}
            <div>
              <Label htmlFor="colaboradores_vinculados">Colaboradores Vinculados</Label>
              <Input
                id="colaboradores_vinculados"
                value={formData.colaboradores_vinculados}
                onChange={(e) => setFormData({ ...formData, colaboradores_vinculados: e.target.value })}
                placeholder="Lista de colaboradores (separados por vírgula)"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseModal} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving} className="bg-[#5A8A7A] hover:bg-[#4A7A6A]">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                modalMode === 'create' ? 'Criar' : 'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={modalConfirmDeleteOpen} onOpenChange={setModalConfirmDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Deseja realmente excluir {itemParaDeletar?.tipo === 'unidade' ? 'a unidade' : 'a área'} <strong>"{itemParaDeletar?.nome}"</strong>?
              <br />
              <span className="text-red-500">
                {itemParaDeletar?.tipo === 'area'
                  ? 'Todas as unidades vinculadas também serão excluídas.'
                  : 'Esta ação não pode ser desfeita.'}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConfirmDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar/Editar Unidade */}
      <Dialog open={modalUnidadeOpen} onOpenChange={setModalUnidadeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modalUnidadeMode === 'create' ? 'Nova Unidade' : 'Editar Unidade'}
            </DialogTitle>
            <DialogDescription>
              {modalUnidadeMode === 'create'
                ? `Criar unidade na área "${areaSelecionada?.nome}"`
                : 'Edite os dados da unidade'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div>
              <Label htmlFor="unidade_nome">Nome *</Label>
              <Input
                id="unidade_nome"
                value={formUnidade.nome}
                onChange={(e) => setFormUnidade({ ...formUnidade, nome: e.target.value })}
                placeholder="Nome da unidade"
                className="mt-1"
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="unidade_descricao">Descrição</Label>
              <Textarea
                id="unidade_descricao"
                value={formUnidade.descricao}
                onChange={(e) => setFormUnidade({ ...formUnidade, descricao: e.target.value })}
                placeholder="Descrição da unidade"
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Responsável */}
            <div className="relative">
              <Label htmlFor="unidade_responsavel">Gestor</Label>
              <Input
                id="unidade_responsavel"
                value={formUnidade.responsavel}
                onChange={(e) => {
                  setFormUnidade({ ...formUnidade, responsavel: e.target.value });
                  setResponsavelSearch(e.target.value);
                  setShowResponsavelDropdown(true);
                }}
                onFocus={() => {
                  setResponsavelSearch(formUnidade.responsavel || '');
                  setShowResponsavelDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowResponsavelDropdown(false), 200)}
                placeholder="Buscar pessoa..."
                className="mt-1"
                autoComplete="off"
              />
              {showResponsavelDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {allUsers
                    .filter(u => u.name.toLowerCase().includes((formUnidade.responsavel || '').toLowerCase()))
                    .slice(0, 20)
                    .map(u => (
                      <div
                        key={u.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onMouseDown={() => {
                          setFormUnidade({ ...formUnidade, responsavel: u.name });
                          setShowResponsavelDropdown(false);
                        }}
                      >
                        {u.name}
                      </div>
                    ))
                  }
                  {allUsers.filter(u => u.name.toLowerCase().includes((formUnidade.responsavel || '').toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</div>
                  )}
                </div>
              )}
            </div>

            {/* Cargo do Responsável */}
            <div>
              <Label htmlFor="unidade_cargo">Cargo do Gestor</Label>
              <Input
                id="unidade_cargo"
                value={formUnidade.cargo_responsavel}
                onChange={(e) => setFormUnidade({ ...formUnidade, cargo_responsavel: e.target.value })}
                placeholder="Cargo do responsável"
                className="mt-1"
              />
            </div>

            {/* Subordinação a outra unidade */}
            <div>
              <Label htmlFor="unidade_subordinacao">Subordinação a outra unidade</Label>
              <Select
                value={formUnidade.unidade_superior_id?.toString() || 'none'}
                onValueChange={(value) => setFormUnidade({
                  ...formUnidade,
                  unidade_superior_id: value === 'none' ? null : parseInt(value)
                })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a unidade superior (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{areaSelecionada?.nome || 'Diretoria'}</SelectItem>
                  {areaSelecionada?.unidades
                    ?.filter(u =>
                      u.id !== editingUnidade?.id && // Não pode ser subordinada a si mesma
                      !u.unidade_superior_id // Só mostra unidades principais (que não têm subordinação)
                    )
                    .map(unidade => (
                      <SelectItem key={unidade.id} value={unidade.id.toString()}>
                        {unidade.nome}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Somente unidades principais podem ter subordinados
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModalUnidade}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUnidade} className="bg-[#5A8A7A] hover:bg-[#4A7A6A]">
              {modalUnidadeMode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Ver usuários da unidade */}
      <Dialog open={modalUsuariosOpen} onOpenChange={setModalUsuariosOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              {unidadeUsuarios?.unidade?.nome || 'Usuários da Unidade'}
            </DialogTitle>
            {unidadeUsuarios?.unidade?.descricao && (
              <DialogDescription>{unidadeUsuarios.unidade.descricao}</DialogDescription>
            )}
          </DialogHeader>

          {usuariosLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : unidadeUsuarios ? (
            <div className="space-y-6 py-2">
              {/* Gestor */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-600" /> Gestor da Unidade
                </h3>
                {unidadeUsuarios.gestor ? (
                  <Card className="border border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <UserCheck className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{unidadeUsuarios.gestor.nome}</p>
                          {unidadeUsuarios.gestor.cargo && (
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <Briefcase className="h-3 w-3" /> {unidadeUsuarios.gestor.cargo}
                            </p>
                          )}
                          {unidadeUsuarios.gestor.email && (
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <Mail className="h-3 w-3" /> {unidadeUsuarios.gestor.email}
                            </p>
                          )}
                          {unidadeUsuarios.gestor.role && (
                            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-800">
                              {unidadeUsuarios.gestor.role}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500 text-center">
                    Nenhum gestor definido para esta unidade.
                  </div>
                )}
              </div>

              {/* Colaboradores */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" /> Colaboradores ({unidadeUsuarios.colaboradores.length})
                </h3>
                {unidadeUsuarios.colaboradores.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500 text-center">
                    Nenhum colaborador cadastrado nesta unidade.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unidadeUsuarios.colaboradores.map(c => (
                      <Card key={c.pessoa_id} className="border border-gray-200 hover:border-blue-300 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{c.nome}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                                {c.cargo && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" /> {c.cargo}
                                  </span>
                                )}
                                {c.email && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> {c.email}
                                  </span>
                                )}
                              </div>
                            </div>
                            {c.user_role && (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 flex-shrink-0">
                                {c.user_role}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalUsuariosOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout >
  );
}
