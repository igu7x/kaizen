import { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { VoltarCadastros } from '@/components/ui/VoltarCadastros';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { useToast } from '@/hooks/use-toast';
import {
  planosProgramasApi,
  InstrumentoPlanejamento,
  CreateInstrumentoDto
} from '@/services/planosProgramasApi';
import { cadastrosProjetosApi, Projeto } from '@/services/cadastrosProjetosApi';
import { areasApi, Area } from '@/services/areasApi';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// Icons
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  FileText,
  FolderKanban,
  Building2,
  Link2,
  ChevronRight,
  Eye,
  Calendar,
  User,
  FileCheck
} from 'lucide-react';

// Labels
const tipoLabels: Record<string, string> = {
  plano: 'Plano',
  programa: 'Programa',
  estrategia: 'Estratégia',
  carteira: 'Carteira',
  outro: 'Outro'
};

const statusProjetoLabels: Record<string, string> = {
  planejado: 'Planejado',
  em_execucao: 'Em Execução',
  suspenso: 'Suspenso',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
};

const statusProjetoColors: Record<string, string> = {
  planejado: 'bg-blue-400 text-white',
  em_execucao: 'bg-green-500 text-white',
  suspenso: 'bg-yellow-500 text-gray-900',
  concluido: 'bg-emerald-600 text-white',
  cancelado: 'bg-red-500 text-white'
};

export default function PlanosProgramas() {
  const { user } = useAuth();
  const { selectedDirectorate } = useDirectorate();
  const { toast } = useToast();
  // Sempre enviar a diretoria — o backend filtra por domínio (multi-tenant)
  const dirFiltro = selectedDirectorate || undefined;

  // Estados principais
  const [instrumentos, setInstrumentos] = useState<InstrumentoPlanejamento[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Instrumento selecionado (para ver detalhes)
  const [instrumentoSelecionado, setInstrumentoSelecionado] = useState<InstrumentoPlanejamento | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingInstrumento, setEditingInstrumento] = useState<InstrumentoPlanejamento | null>(null);
  const [modalConfirmDeleteOpen, setModalConfirmDeleteOpen] = useState(false);
  const [itemParaDeletar, setItemParaDeletar] = useState<{ id: number; nome: string } | null>(null);
  const [modalInfoCompletaOpen, setModalInfoCompletaOpen] = useState(false);

  // Form data
  const [formData, setFormData] = useState<CreateInstrumentoDto>({
    nome: '',
    tipo: 'plano',
    objetivo: '',
    periodo_vigencia_inicio: '',
    periodo_vigencia_fim: '',
    ambito_institucional: '',
    responsavel_institucional: '',
    instrumento_superior_id: null,
    documento_formalizacao: '',
    versao: 'v1.0',
    historico_alteracoes: '',
    observacoes_gerais: '',
    projetos_ids: [],
    areas_vinculadas_ids: []
  });

  // Permissões
  const canEdit = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

  const loadInstrumentos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await planosProgramasApi.getInstrumentos(dirFiltro);
      setInstrumentos(data);
    } catch (error) {
      console.error('Erro ao carregar instrumentos:', error);
    } finally {
      setLoading(false);
    }
  }, [toast, selectedDirectorate]);

  const loadProjetos = useCallback(async () => {
    try {
      const data = await cadastrosProjetosApi.getProjetos(dirFiltro);
      setProjetos(data);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
    }
  }, [selectedDirectorate]);

  const loadAreas = useCallback(async () => {
    try {
      // Backend GET /api/areas já filtra por domínio do usuário logado
      const allAreas = await areasApi.getAll();
      setAreas(allAreas);
    } catch (error) {
      console.error('Erro ao carregar áreas:', error);
    }
  }, [selectedDirectorate]);

  const loadInstrumentoCompleto = useCallback(async (id: number) => {
    try {
      setLoadingDetalhes(true);
      const data = await planosProgramasApi.getInstrumentoById(id);
      setInstrumentoSelecionado(data);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoadingDetalhes(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInstrumentos();
    loadProjetos();
    loadAreas();
  }, [loadInstrumentos, loadProjetos, loadAreas]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleSelecionarInstrumento = (instrumento: InstrumentoPlanejamento) => {
    loadInstrumentoCompleto(instrumento.id);
  };

  const handleVoltar = () => {
    setInstrumentoSelecionado(null);
  };

  const handleAbrirModalCriar = () => {
    setModalMode('create');
    setEditingInstrumento(null);
    setFormData({
      nome: '',
      tipo: 'plano',
      objetivo: '',
      periodo_vigencia_inicio: '',
      periodo_vigencia_fim: '',
      ambito_institucional: '',
      responsavel_institucional: '',
      instrumento_superior_id: null,
      documento_formalizacao: '',
      versao: 'v1.0',
      historico_alteracoes: '',
      observacoes_gerais: '',
      diretoria: selectedDirectorate,
      projetos_ids: [],
      areas_vinculadas_ids: []
    });
    setModalOpen(true);
  };

  const handleAbrirModalEditar = (instrumento: InstrumentoPlanejamento) => {
    setModalMode('edit');
    setEditingInstrumento(instrumento);
    setFormData({
      nome: instrumento.nome,
      tipo: instrumento.tipo,
      objetivo: instrumento.objetivo || '',
      periodo_vigencia_inicio: instrumento.periodo_vigencia_inicio?.split('T')[0] || '',
      periodo_vigencia_fim: instrumento.periodo_vigencia_fim?.split('T')[0] || '',
      ambito_institucional: instrumento.ambito_institucional || '',
      responsavel_institucional: instrumento.responsavel_institucional || '',
      instrumento_superior_id: instrumento.instrumento_superior_id,
      documento_formalizacao: instrumento.documento_formalizacao || '',
      versao: instrumento.versao || 'v1.0',
      historico_alteracoes: instrumento.historico_alteracoes || '',
      observacoes_gerais: instrumento.observacoes_gerais || '',
      projetos_ids: instrumento.projetos?.map(p => p.projeto_id) || [],
      areas_vinculadas_ids: instrumento.areas_vinculadas_ids || []
    });
    setModalOpen(true);
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim() || formData.nome.trim().length < 3) {
      toast({
        title: 'Erro',
        description: 'O nome deve ter pelo menos 3 caracteres.',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (modalMode === 'edit' && editingInstrumento) {
        await planosProgramasApi.updateInstrumento(editingInstrumento.id, formData);
        
        // Recarregar detalhes se estiver visualizando
        if (instrumentoSelecionado?.id === editingInstrumento.id) {
          await loadInstrumentoCompleto(editingInstrumento.id);
        }
      } else {
        await planosProgramasApi.createInstrumento(formData);
        
      }

      setModalOpen(false);
      await loadInstrumentos();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!itemParaDeletar) return;

    try {
      await planosProgramasApi.deleteInstrumento(itemParaDeletar.id);
      
      setInstrumentoSelecionado(null);
      await loadInstrumentos();
    } catch (error) {
      console.error('Erro ao excluir:', error);
    } finally {
      setItemParaDeletar(null);
      setModalConfirmDeleteOpen(false);
    }
  };

  const toggleProjetoVinculado = (projetoId: number) => {
    const current = formData.projetos_ids || [];
    if (current.includes(projetoId)) {
      setFormData({ ...formData, projetos_ids: current.filter(id => id !== projetoId) });
    } else {
      setFormData({ ...formData, projetos_ids: [...current, projetoId] });
    }
  };

  const toggleAreaVinculada = (areaId: number) => {
    const current = formData.areas_vinculadas_ids || [];
    if (current.includes(areaId)) {
      setFormData({ ...formData, areas_vinculadas_ids: current.filter(id => id !== areaId) });
    } else {
      setFormData({ ...formData, areas_vinculadas_ids: [...current, areaId] });
    }
  };

  // Função para extrair sigla do nome da área
  const extrairSigla = (nome: string): string => {
    const match = nome.match(/\(([^)]+)\)/);
    return match ? match[1] : nome;
  };

  // ============================================================
  // DRAG AND DROP - ORGANIZAÇÃO EM LINHAS
  // ============================================================

  // Estrutura de linhas: cada linha é um array de IDs de instrumentos
  const [linhas, setLinhas] = useState<number[][]>([]);
  const [draggedItem, setDraggedItem] = useState<{ linhaIndex: number, itemIndex: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ linhaIndex: number, itemIndex: number } | null>(null);

  // Inicializar linhas quando instrumentos mudam - usa os dados salvos no banco
  useEffect(() => {
    if (instrumentos.length === 0) {
      setLinhas([]);
      return;
    }

    // Agrupar instrumentos por linha usando os dados do banco
    const linhasMap = new Map<number, { id: number; posicao: number }[]>();

    instrumentos.forEach(inst => {
      const linha = inst.ordem_linha ?? 0;
      const posicao = inst.ordem_posicao ?? 0;

      if (!linhasMap.has(linha)) {
        linhasMap.set(linha, []);
      }
      linhasMap.get(linha)!.push({ id: inst.id, posicao });
    });

    // Ordenar as linhas e os itens dentro de cada linha
    const linhasOrdenadas: number[][] = [];
    const linhasSorted = [...linhasMap.keys()].sort((a, b) => a - b);

    linhasSorted.forEach(linhaNum => {
      const itens = linhasMap.get(linhaNum)!;
      itens.sort((a, b) => a.posicao - b.posicao);
      linhasOrdenadas.push(itens.map(item => item.id));
    });

    // Se não houver nenhuma linha, criar uma com todos os instrumentos
    if (linhasOrdenadas.length === 0) {
      setLinhas([instrumentos.map(i => i.id)]);
    } else {
      setLinhas(linhasOrdenadas);
    }
  }, [instrumentos]);

  // Função para salvar a ordenação no backend
  const salvarOrdenacao = async (novasLinhas: number[][]) => {
    try {
      const ordenacao: { id: number; linha: number; posicao: number }[] = [];

      novasLinhas.forEach((linha, linhaIndex) => {
        linha.forEach((itemId, posicaoIndex) => {
          ordenacao.push({
            id: itemId,
            linha: linhaIndex,
            posicao: posicaoIndex
          });
        });
      });

      await planosProgramasApi.atualizarOrdenacao(ordenacao);
    } catch (error) {
      console.error('Erro ao salvar ordenação:', error);
    }
  };

  const getInstrumentoById = (id: number) => instrumentos.find(i => i.id === id);

  const handleDragStart = (e: React.DragEvent, linhaIndex: number, itemIndex: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ linhaIndex, itemIndex }));
    setTimeout(() => setDraggedItem({ linhaIndex, itemIndex }), 0);
  };

  const handleDragOver = (e: React.DragEvent, linhaIndex: number, itemIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItem !== null) {
      setDragOverTarget({ linhaIndex, itemIndex });
    }
  };

  const handleDragOverLinha = (e: React.DragEvent, linhaIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItem !== null) {
      // Marcar para adicionar no final da linha
      setDragOverTarget({ linhaIndex, itemIndex: -1 });
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (e: React.DragEvent, targetLinhaIndex: number, targetItemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;

    const newLinhas = linhas.map(linha => [...linha]);

    // Remover do local original
    const itemId = newLinhas[draggedItem.linhaIndex][draggedItem.itemIndex];
    newLinhas[draggedItem.linhaIndex].splice(draggedItem.itemIndex, 1);

    // Ajustar índice se movendo na mesma linha para frente
    let finalIndex = targetItemIndex;
    if (targetLinhaIndex === draggedItem.linhaIndex && targetItemIndex > draggedItem.itemIndex) {
      finalIndex = targetItemIndex - 1;
    }

    // Se targetItemIndex é -1, adicionar no final da linha
    if (targetItemIndex === -1) {
      finalIndex = newLinhas[targetLinhaIndex].length;
    }

    // Inserir no novo local
    newLinhas[targetLinhaIndex].splice(finalIndex, 0, itemId);

    // Remover linhas vazias (exceto se for a única)
    const linhasFiltradas = newLinhas.filter(linha => linha.length > 0);

    // Garantir pelo menos uma linha
    const novasLinhas = linhasFiltradas.length > 0 ? linhasFiltradas : [[]];
    setLinhas(novasLinhas);
    setDraggedItem(null);
    setDragOverTarget(null);

    // Salvar no backend
    salvarOrdenacao(novasLinhas);

    
  };

  const handleDropNovaLinha = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;

    const newLinhas = linhas.map(linha => [...linha]);

    // Remover do local original
    const itemId = newLinhas[draggedItem.linhaIndex][draggedItem.itemIndex];
    newLinhas[draggedItem.linhaIndex].splice(draggedItem.itemIndex, 1);

    // Criar nova linha com o item
    newLinhas.push([itemId]);

    // Remover linhas vazias
    const linhasFiltradas = newLinhas.filter(linha => linha.length > 0);

    setLinhas(linhasFiltradas);

    // Salvar no backend
    salvarOrdenacao(linhasFiltradas);
    setDraggedItem(null);
    setDragOverTarget(null);

    toast({
      title: 'Nova linha criada',
      description: 'O item foi movido para uma nova linha.',
    });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // ============================================================
  // RENDER - TELA PRINCIPAL (CARDS DOS INSTRUMENTOS)
  // ============================================================

  const renderTelaInstrumentos = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#2d7a5e] to-[#1d5a4e] flex items-center justify-center shadow-lg">
          <FileText className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Planos/Programas</h1>
          <p className="text-slate-500 text-sm">Cadastro de Planos e Programas</p>
        </div>
      </div>

      {/* Botão Criar */}
      {canCreate && (
        <div>
          <Button
            onClick={handleAbrirModalCriar}
            className="bg-[#5A8A7A] hover:bg-[#4A7A6A] text-white"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar Plano/Programa
          </Button>
        </div>
      )}

      {/* Lista de Instrumentos com Drag and Drop em Linhas */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Carregando instrumentos...</div>
      ) : instrumentos.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Nenhum instrumento cadastrado.
          {canCreate && ' Clique em "Criar Plano/Programa" para começar.'}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Renderizar cada linha */}
          {linhas.map((linha, linhaIndex) => (
            <div
              key={`linha-${linhaIndex}`}
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2 rounded-lg min-h-[90px] transition-all duration-200 ${dragOverTarget?.linhaIndex === linhaIndex && dragOverTarget?.itemIndex === -1
                ? 'bg-[#7dd3c0]/10 border-2 border-dashed border-[#7dd3c0]'
                : 'border-2 border-transparent'
                }`}
              onDragOver={(e) => handleDragOverLinha(e, linhaIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, linhaIndex, linha.length)}
            >
              {linha.map((itemId, itemIndex) => {
                const instrumento = getInstrumentoById(itemId);
                if (!instrumento) return null;

                const isDragging = draggedItem?.linhaIndex === linhaIndex && draggedItem?.itemIndex === itemIndex;
                const isDragOver = dragOverTarget?.linhaIndex === linhaIndex && dragOverTarget?.itemIndex === itemIndex;

                return (
                  <div
                    key={instrumento.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, linhaIndex, itemIndex)}
                    onDragOver={(e) => {
                      e.stopPropagation();
                      handleDragOver(e, linhaIndex, itemIndex);
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDrop(e, linhaIndex, itemIndex);
                    }}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      if (draggedItem === null) {
                        handleSelecionarInstrumento(instrumento);
                      }
                    }}
                    className={`group bg-white hover:bg-slate-50 border rounded-xl p-5 text-left transition-all duration-300 hover:shadow-md cursor-grab active:cursor-grabbing select-none ${isDragging
                      ? 'opacity-50 scale-95 border-[#2d7a5e]/50'
                      : isDragOver
                        ? 'border-[#2d7a5e] bg-emerald-50 scale-105'
                        : 'border-slate-200 hover:border-[#2d7a5e]/40'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#2d7a5e] to-[#1d5a4e] flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">📋</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-slate-900 font-semibold text-base truncate group-hover:text-[#2d7a5e] transition-colors">
                          {instrumento.nome}
                        </h3>
                        <p className="text-slate-500 text-xs mt-1">
                          {instrumento.tipo}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Zona de drop para criar nova linha */}
          {draggedItem !== null && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverTarget({ linhaIndex: linhas.length, itemIndex: 0 });
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropNovaLinha}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 min-h-[90px] flex items-center justify-center ${dragOverTarget?.linhaIndex === linhas.length
                ? 'border-[#2d7a5e] bg-emerald-50 text-[#2d7a5e]'
                : 'border-slate-300 text-slate-500'
                }`}
            >
              <p className="text-sm font-medium">↓ Solte aqui para criar uma nova linha ↓</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================
  // RENDER - TELA DE DETALHES DO INSTRUMENTO
  // ============================================================

  const renderTelaDetalhes = () => {
    if (!instrumentoSelecionado) return null;

    return (
      <div className="space-y-6">
        {/* Header com botão voltar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleVoltar}
              variant="ghost"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2d7a5e] to-[#1d5a4e] flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-slate-900 font-bold text-xl">{instrumentoSelecionado.nome}</h2>
                <p className="text-slate-500 text-sm">
                  {tipoLabels[instrumentoSelecionado.tipo]} • {instrumentoSelecionado.versao}
                </p>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex gap-2">
              <Button
                onClick={() => handleAbrirModalEditar(instrumentoSelecionado)}
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button
                onClick={() => {
                  setItemParaDeletar({ id: instrumentoSelecionado.id, nome: instrumentoSelecionado.nome });
                  setModalConfirmDeleteOpen(true);
                }}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </div>
          )}
        </div>

        {/* Informações do Instrumento */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {instrumentoSelecionado.objetivo && (
              <div className="md:col-span-3">
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1 font-bold">Objetivo</p>
                <p className="text-gray-900 text-base">{instrumentoSelecionado.objetivo}</p>
              </div>
            )}
            {instrumentoSelecionado.ambito_institucional && (
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1 font-bold">Âmbito</p>
                <p className="text-gray-900 text-base">{instrumentoSelecionado.ambito_institucional}</p>
              </div>
            )}
            {instrumentoSelecionado.responsavel_institucional && (
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1 font-bold">Responsável</p>
                <p className="text-gray-900 text-base">{instrumentoSelecionado.responsavel_institucional}</p>
              </div>
            )}
            {(instrumentoSelecionado.periodo_vigencia_inicio || instrumentoSelecionado.periodo_vigencia_fim) && (
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1 font-bold">Vigência</p>
                <p className="text-gray-900 text-base">
                  {instrumentoSelecionado.periodo_vigencia_inicio
                    ? new Date(instrumentoSelecionado.periodo_vigencia_inicio).toLocaleDateString('pt-BR')
                    : '?'
                  }
                  {' → '}
                  {instrumentoSelecionado.periodo_vigencia_fim
                    ? new Date(instrumentoSelecionado.periodo_vigencia_fim).toLocaleDateString('pt-BR')
                    : '?'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Botão Exibir informações completas */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Button
              onClick={() => setModalInfoCompletaOpen(true)}
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Eye className="h-4 w-4 mr-2" />
              Exibir informações completas
            </Button>
          </div>
        </div>

        {/* Projetos Vinculados */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FolderKanban className="h-5 w-5 text-[#2d7a5e]" />
            <h3 className="text-gray-900 font-semibold">
              Projetos Vinculados
              <Badge className="ml-2 bg-gray-100 text-gray-700 border-0">
                {instrumentoSelecionado.projetos?.length || 0}
              </Badge>
            </h3>
          </div>

          {loadingDetalhes ? (
            <div className="text-center py-8 text-gray-500">Carregando projetos...</div>
          ) : !instrumentoSelecionado.projetos || instrumentoSelecionado.projetos.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">Nenhum projeto vinculado a este instrumento.</p>
              {canEdit && (
                <Button
                  onClick={() => handleAbrirModalEditar(instrumentoSelecionado)}
                  variant="outline"
                  size="sm"
                  className="mt-4 border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Vincular Projetos
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {instrumentoSelecionado.projetos.map((proj) => {
                const areasExecucao = proj.projeto_diretorias?.split(', ').filter(Boolean) || [];

                return (
                  <div
                    key={proj.id}
                    onClick={() => window.location.href = `/cadastros/projetos?id=${proj.projeto_id}&from=plano`}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                          <FolderKanban className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-gray-900 font-medium group-hover:text-[#2d7a5e] transition-colors">{proj.projeto_nome}</h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge className={`${statusProjetoColors[proj.projeto_status || 'planejado']} border-0 text-xs`}>
                              {statusProjetoLabels[proj.projeto_status || 'planejado']}
                            </Badge>
                            {areasExecucao.length > 0 && (
                              <Badge variant="outline" className="bg-blue-50 text-xs border-blue-200 text-blue-700">
                                {areasExecucao.join(', ')}
                              </Badge>
                            )}
                          </div>
                          {proj.projeto_gestor_nome && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                              <User className="h-3 w-3" />
                              {proj.projeto_gestor_nome}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Instrumentos Subordinados */}
        {instrumentoSelecionado.instrumentos_subordinados && instrumentoSelecionado.instrumentos_subordinados.length > 0 && (
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <ChevronRight className="h-5 w-5 text-purple-500" />
              <h3 className="text-gray-800 font-semibold">
                Instrumentos Subordinados
                <Badge className="ml-2 bg-purple-100 text-purple-700 border-0">
                  {instrumentoSelecionado.instrumentos_subordinados.length}
                </Badge>
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {instrumentoSelecionado.instrumentos_subordinados.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => handleSelecionarInstrumento(sub)}
                  className="bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-lg p-4 text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-gray-800 font-medium">{sub.nome}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER - MODAL DE FORMULÁRIO
  // ============================================================

  const renderFormModal = () => (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {modalMode === 'create' ? 'Novo Instrumento de Planejamento' : 'Editar Instrumento'}
          </DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo para {modalMode === 'create' ? 'cadastrar' : 'atualizar'} o instrumento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Accordion type="multiple" defaultValue={['identificacao', 'vinculacao', 'formalizacao']} className="w-full">

            {/* SEÇÃO: IDENTIFICAÇÃO */}
            <AccordionItem value="identificacao">
              <AccordionTrigger className="bg-blue-50 px-4 rounded-t">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Identificação do Instrumento
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 border border-t-0 rounded-b space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Nome do Instrumento *</Label>
                    <Input
                      placeholder="Ex: Plano de Gestão da Presidência 2025–2027"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tipo de Instrumento</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plano">Plano</SelectItem>
                        <SelectItem value="programa">Programa</SelectItem>
                        <SelectItem value="estrategia">Estratégia</SelectItem>
                        <SelectItem value="carteira">Carteira</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Versão</Label>
                    <Input
                      placeholder="Ex: v1.0"
                      value={formData.versao}
                      onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Objetivo do Instrumento</Label>
                    <Textarea
                      placeholder="2-3 linhas explicando sua finalidade"
                      value={formData.objetivo}
                      onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Vigência - Início</Label>
                    <Input
                      type="date"
                      value={formData.periodo_vigencia_inicio}
                      onChange={(e) => setFormData({ ...formData, periodo_vigencia_inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Vigência - Fim</Label>
                    <Input
                      type="date"
                      value={formData.periodo_vigencia_fim}
                      onChange={(e) => setFormData({ ...formData, periodo_vigencia_fim: e.target.value })}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SEÇÃO: VINCULAÇÃO */}
            <AccordionItem value="vinculacao">
              <AccordionTrigger className="bg-green-50 px-4 rounded-t">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Vinculação Institucional
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 border border-t-0 rounded-b space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Âmbito Institucional</Label>
                    <Input
                      placeholder="Ex: SGJT, Diretoria, TJGO"
                      value={formData.ambito_institucional}
                      onChange={(e) => setFormData({ ...formData, ambito_institucional: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Responsável Institucional</Label>
                    <Input
                      placeholder="Ex: Presidente, Secretário, Diretor"
                      value={formData.responsavel_institucional}
                      onChange={(e) => setFormData({ ...formData, responsavel_institucional: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Instrumento Superior (Hierarquia)</Label>
                    <Select
                      value={formData.instrumento_superior_id?.toString() || 'none'}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        instrumento_superior_id: v === 'none' ? null : parseInt(v)
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione (se houver)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (instrumento raiz)</SelectItem>
                        {instrumentos
                          .filter(i => i.id !== editingInstrumento?.id)
                          .map(inst => (
                            <SelectItem key={inst.id} value={inst.id.toString()}>
                              [{tipoLabels[inst.tipo]}] {inst.nome}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Diretoria</Label>
                    <div className="flex flex-wrap gap-3 mt-2 p-3 border rounded-lg bg-green-50">
                      {areas.length === 0 ? (
                        <p className="text-gray-500 w-full text-center py-4">Nenhuma diretoria cadastrada</p>
                      ) : (
                        areas.map(area => (
                          <label
                            key={area.id}
                            className={`flex items-center gap-2 text-sm cursor-pointer px-4 py-2 rounded-lg border transition-colors ${formData.areas_vinculadas_ids?.includes(area.id)
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                              }`}
                            title={area.nome}
                          >
                            <Checkbox
                              checked={formData.areas_vinculadas_ids?.includes(area.id) || false}
                              onCheckedChange={() => toggleAreaVinculada(area.id)}
                              className={formData.areas_vinculadas_ids?.includes(area.id) ? 'border-white' : ''}
                            />
                            <span className="font-medium">{extrairSigla(area.nome)}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Selecione a(s) diretoria(s) deste plano/programa</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Projetos Relacionados</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 p-3 border rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
                      {projetos.length === 0 ? (
                        <p className="text-gray-500 col-span-full text-center py-4">Nenhum projeto cadastrado</p>
                      ) : (
                        projetos.map(projeto => (
                          <label key={projeto.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 hover:bg-gray-100 rounded">
                            <Checkbox
                              checked={formData.projetos_ids?.includes(projeto.id) || false}
                              onCheckedChange={() => toggleProjetoVinculado(projeto.id)}
                            />
                            <span className="truncate" title={projeto.nome}>
                              <span className="text-gray-500 font-mono text-xs">{projeto.codigo}</span>
                              {' - '}
                              {projeto.nome}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SEÇÃO: FORMALIZAÇÃO */}
            <AccordionItem value="formalizacao">
              <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Formalização
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 border border-t-0 rounded-b space-y-4">
                <div>
                  <Label>Documento de Formalização</Label>
                  <Input
                    placeholder="Link para PDF, processo, norma, portaria"
                    value={formData.documento_formalizacao}
                    onChange={(e) => setFormData({ ...formData, documento_formalizacao: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Histórico de Alterações</Label>
                  <Textarea
                    placeholder="Registre mudanças ao longo do tempo"
                    value={formData.historico_alteracoes}
                    onChange={(e) => setFormData({ ...formData, historico_alteracoes: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Observações Gerais</Label>
                  <Textarea
                    placeholder="Observações adicionais"
                    value={formData.observacoes_gerais}
                    onChange={(e) => setFormData({ ...formData, observacoes_gerais: e.target.value })}
                    rows={3}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar}>
            {modalMode === 'edit' ? 'Salvar Alterações' : 'Criar Instrumento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ============================================================
  // RENDER - MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
  // ============================================================

  const renderModalConfirmDelete = () => (
    <Dialog open={modalConfirmDeleteOpen} onOpenChange={setModalConfirmDeleteOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Exclusão</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o instrumento "{itemParaDeletar?.nome}"?
            Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setModalConfirmDeleteOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirmarExclusao}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ============================================================
  // RENDER - MODAL DE INFORMAÇÕES COMPLETAS
  // ============================================================

  const renderModalInfoCompleta = () => {
    if (!instrumentoSelecionado) return null;

    return (
      <Dialog open={modalInfoCompletaOpen} onOpenChange={setModalInfoCompletaOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2d7a5e] to-[#1d5a4e] flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="block">{instrumentoSelecionado.nome}</span>
                <span className="text-sm font-normal text-gray-500">
                  {tipoLabels[instrumentoSelecionado.tipo]} • {instrumentoSelecionado.versao}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* SEÇÃO: IDENTIFICAÇÃO */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-blue-900">Identificação do Instrumento</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Nome</p>
                    <p className="text-gray-900 font-medium">{instrumentoSelecionado.nome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tipo</p>
                    <p className="text-gray-900">{tipoLabels[instrumentoSelecionado.tipo]}</p>
                  </div>
                </div>
                {instrumentoSelecionado.objetivo && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Objetivo</p>
                    <p className="text-gray-900">{instrumentoSelecionado.objetivo}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Período de Vigência
                    </p>
                    <p className="text-gray-900">
                      {instrumentoSelecionado.periodo_vigencia_inicio
                        ? new Date(instrumentoSelecionado.periodo_vigencia_inicio).toLocaleDateString('pt-BR')
                        : 'Não definido'
                      }
                      {' → '}
                      {instrumentoSelecionado.periodo_vigencia_fim
                        ? new Date(instrumentoSelecionado.periodo_vigencia_fim).toLocaleDateString('pt-BR')
                        : 'Não definido'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Versão</p>
                    <p className="text-gray-900">{instrumentoSelecionado.versao || 'v1.0'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO: VINCULAÇÃO INSTITUCIONAL */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 px-4 py-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-900">Vinculação Institucional</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Âmbito Institucional</p>
                    <p className="text-gray-900">{instrumentoSelecionado.ambito_institucional || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      <User className="h-3 w-3 inline mr-1" />
                      Responsável Institucional
                    </p>
                    <p className="text-gray-900">{instrumentoSelecionado.responsavel_institucional || 'Não definido'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Instrumento Superior</p>
                  <p className="text-gray-900">{instrumentoSelecionado.instrumento_superior_nome || 'Nenhum (instrumento raiz)'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Projetos Vinculados</p>
                  <p className="text-gray-900">
                    {instrumentoSelecionado.projetos_nomes || 'Nenhum projeto vinculado'}
                  </p>
                </div>
                {instrumentoSelecionado.total_instrumentos_subordinados && instrumentoSelecionado.total_instrumentos_subordinados > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Instrumentos Subordinados</p>
                    <p className="text-gray-900">{instrumentoSelecionado.total_instrumentos_subordinados} instrumento(s)</p>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO: FORMALIZAÇÃO */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-amber-900">Formalização</span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Documento de Formalização</p>
                  {instrumentoSelecionado.documento_formalizacao ? (
                    <a
                      href={instrumentoSelecionado.documento_formalizacao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {instrumentoSelecionado.documento_formalizacao}
                    </a>
                  ) : (
                    <p className="text-gray-900">Não definido</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Histórico de Alterações</p>
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {instrumentoSelecionado.historico_alteracoes || 'Nenhum histórico registrado'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Observações Gerais</p>
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {instrumentoSelecionado.observacoes_gerais || 'Nenhuma observação'}
                  </p>
                </div>
              </div>
            </div>

            {/* SEÇÃO: METADADOS */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <span className="font-semibold text-gray-900">Metadados</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Diretoria</p>
                    <p className="text-gray-900">{instrumentoSelecionado.diretoria}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Criado em</p>
                    <p className="text-gray-900">
                      {new Date(instrumentoSelecionado.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Atualizado em</p>
                    <p className="text-gray-900">
                      {new Date(instrumentoSelecionado.updated_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  setModalInfoCompletaOpen(false);
                  handleAbrirModalEditar(instrumentoSelecionado);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
            <Button onClick={() => setModalInfoCompletaOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================

  return (
    <Layout>
      <div className="space-y-4 lg:space-y-6 page-transition-enter">
        <VoltarCadastros />
        {/* Conteúdo */}
        {instrumentoSelecionado ? renderTelaDetalhes() : renderTelaInstrumentos()}

        {/* Modais */}
        {renderFormModal()}
        {renderModalConfirmDelete()}
        {renderModalInfoCompleta()}
      </div>
    </Layout>
  );
}
