import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { VoltarCadastros } from '@/components/ui/VoltarCadastros';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { useToast } from '@/hooks/use-toast';
import { areasApi, Area, Unidade } from '@/services/areasApi';
import { pessoasApi, Pessoa, CreatePessoaDto } from '@/services/pessoasApi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Icons
import {
  Plus,
  Edit,
  Trash2,
  Users,
  ArrowLeft,
  Building2
} from 'lucide-react';

export default function Pessoas() {
  const { user } = useAuth();
  const { devEnvironment } = useDirectorate();
  const { toast } = useToast();

  // Estados principais
  const [areas, setAreas] = useState<Area[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPessoas, setLoadingPessoas] = useState(false);

  // Área selecionada
  const [areaSelecionada, setAreaSelecionada] = useState<Area | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [modalConfirmDeleteOpen, setModalConfirmDeleteOpen] = useState(false);
  const [itemParaDeletar, setItemParaDeletar] = useState<{ id: number; nome: string } | null>(null);

  // Estado para unidades da área
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  // Form data
  const [formData, setFormData] = useState<CreatePessoaDto>({
    area_id: 0,
    unidade_id: null,
    nome: '',
    usuario: '',
    email: '',
    situacao: '',
    cc_fc: '',
    cc_fc_classe: '',
    cargo_efetivo: '',
    cargo_efetivo_classe: ''
  });

  // Drag and drop states (para áreas)
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
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as áreas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast, devEnvironment]);

  const loadPessoas = useCallback(async (areaId: number) => {
    try {
      setLoadingPessoas(true);
      const data = await pessoasApi.getByAreaId(areaId);
      // Ordenar colaboradores alfabeticamente por nome
      const sortedData = [...data].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
      setPessoas(sortedData);
    } catch (error) {
      console.error('Erro ao carregar pessoas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as pessoas',
        variant: 'destructive'
      });
    } finally {
      setLoadingPessoas(false);
    }
  }, [toast]);

  const loadUnidades = useCallback(async (areaId: number) => {
    try {
      setLoadingUnidades(true);
      const data = await areasApi.getUnidades(areaId);
      setUnidades(data);
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
      setUnidades([]);
    } finally {
      setLoadingUnidades(false);
    }
  }, []);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

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

    linhasMap.forEach((areasLinha) => {
      areasLinha.sort((a, b) => (a.ordem_posicao ?? 0) - (b.ordem_posicao ?? 0));
    });

    const linhasArray: Area[][] = [];
    const maxLinha = Math.max(...Array.from(linhasMap.keys()), 0);
    for (let i = 0; i <= maxLinha; i++) {
      linhasArray.push(linhasMap.get(i) || []);
    }

    if (linhasArray.length === 0 || (linhasArray.length === 1 && linhasArray[0].length === 0)) {
      setLinhas([[]]);
    } else {
      setLinhas(linhasArray);
    }
  }, [areas]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleSelecionarArea = (area: Area) => {
    setAreaSelecionada(area);
    loadPessoas(area.id);
  };

  const handleVoltarParaAreas = () => {
    setAreaSelecionada(null);
    setPessoas([]);
  };

  const handleOpenModal = (mode: 'create' | 'edit', pessoa?: Pessoa) => {
    setModalMode(mode);

    // Carregar unidades da área selecionada
    if (areaSelecionada) {
      loadUnidades(areaSelecionada.id);
    }

    if (mode === 'edit' && pessoa) {
      setEditingPessoa(pessoa);
      setFormData({
        area_id: pessoa.area_id,
        unidade_id: pessoa.unidade_id || null,
        nome: pessoa.nome,
        usuario: pessoa.usuario || '',
        email: pessoa.email || '',
        situacao: pessoa.situacao || '',
        cc_fc: pessoa.cc_fc || '',
        cc_fc_classe: pessoa.cc_fc_classe || '',
        cargo_efetivo: pessoa.cargo_efetivo || '',
        cargo_efetivo_classe: pessoa.cargo_efetivo_classe || ''
      });
    } else {
      setEditingPessoa(null);
      setFormData({
        area_id: areaSelecionada?.id || 0,
        unidade_id: null,
        nome: '',
        usuario: '',
        email: '',
        situacao: '',
        cc_fc: '',
        cc_fc_classe: '',
        cargo_efetivo: '',
        cargo_efetivo_classe: ''
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingPessoa(null);
    setUnidades([]);
    setFormData({
      area_id: areaSelecionada?.id || 0,
      unidade_id: null,
      nome: '',
      usuario: '',
      email: '',
      situacao: '',
      cc_fc: '',
      cc_fc_classe: '',
      cargo_efetivo: '',
      cargo_efetivo_classe: ''
    });
  };

  const handleSave = async () => {
    try {
      if (!formData.nome.trim()) {
        toast({
          title: 'Erro',
          description: 'O nome do colaborador é obrigatório',
          variant: 'destructive'
        });
        return;
      }

      if (modalMode === 'create') {
        await pessoasApi.create({
          ...formData,
          area_id: areaSelecionada?.id || 0,
          unidade_id: formData.unidade_id || null
        });
        toast({
          title: 'Sucesso',
          description: 'Pessoa cadastrada com sucesso!'
        });
      } else if (editingPessoa) {
        await pessoasApi.update(editingPessoa.id, {
          ...formData,
          unidade_id: formData.unidade_id || null
        });
        toast({
          title: 'Sucesso',
          description: 'Pessoa atualizada com sucesso!'
        });
      }

      handleCloseModal();
      if (areaSelecionada) {
        await loadPessoas(areaSelecionada.id);
      }
    } catch (error) {
      console.error('Erro ao salvar pessoa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a pessoa',
        variant: 'destructive'
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemParaDeletar) return;

    try {
      await pessoasApi.remove(itemParaDeletar.id);
      toast({
        title: 'Sucesso',
        description: 'Pessoa excluída com sucesso!'
      });
      setModalConfirmDeleteOpen(false);
      setItemParaDeletar(null);
      if (areaSelecionada) {
        await loadPessoas(areaSelecionada.id);
      }
    } catch (error) {
      console.error('Erro ao excluir pessoa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a pessoa',
        variant: 'destructive'
      });
    }
  };

  // ============================================================
  // DRAG AND DROP (para áreas - apenas visual, sem salvar)
  // ============================================================

  const handleDragStart = (e: React.DragEvent, linha: number, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggedItem({ linha, index }), 0);
  };

  const handleDragOver = (e: React.DragEvent, linha: number, index: number) => {
    e.preventDefault();
    setDragOverTarget({ linha, index });
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // Função para extrair sigla e nome da área
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

  // ============================================================
  // RENDER - CARD DE ÁREA
  // ============================================================

  const renderCardArea = (area: Area, linha: number, index: number) => {
    const isDragging = draggedItem?.linha === linha && draggedItem?.index === index;
    const isDragOver = dragOverTarget?.linha === linha && dragOverTarget?.index === index;

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
        draggable={false}
        onClick={() => handleSelecionarArea(area)}
        className={`
          group bg-white hover:bg-slate-50
          border border-slate-200 hover:border-slate-300
          rounded-xl p-4 text-left transition-all duration-300
          hover:shadow-md cursor-pointer
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
  // RENDER - TELA DE PESSOAS (ÁREA SELECIONADA)
  // ============================================================

  const renderTelaPessoas = () => {
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
                <p className="text-slate-500 text-sm">Pessoas vinculadas</p>
              </div>
            </div>
          </div>

          {canCreate && (
            <Button
              onClick={() => handleOpenModal('create')}
              className="bg-[#5A8A7A] hover:bg-[#4A7A6A] text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Pessoa
            </Button>
          )}
        </div>

        {/* Tabela de Pessoas */}
        <div className="rounded-2xl overflow-hidden shadow-2xl">
          {loadingPessoas ? (
            <div className="bg-white text-center py-12 text-gray-500">Carregando pessoas...</div>
          ) : pessoas.length === 0 ? (
            <div className="bg-white text-center py-12 text-gray-400">
              Nenhuma pessoa cadastrada nesta área.
              {canCreate && ' Clique em "Nova Pessoa" para cadastrar.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-700 to-slate-800">
                    <th className="px-5 py-4 text-left text-sm font-bold text-white uppercase tracking-wide">Colaborador(a)</th>
                    <th className="px-5 py-4 text-left text-sm font-bold text-white uppercase tracking-wide">Lotação</th>
                    <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Situação Funcional</th>
                    <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">CC/FC</th>
                    <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Código</th>
                    <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Cargo Efetivo</th>
                    <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">Classe</th>
                    {canEdit && <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide w-28">Ações</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {pessoas.map((pessoa, index) => (
                    <tr key={pessoa.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50 transition-colors`}>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-900">{pessoa.nome}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-gray-600">{pessoa.unidade_nome || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-gray-600">{pessoa.situacao || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-gray-600">{pessoa.cc_fc || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-gray-600">{pessoa.cc_fc_classe || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-gray-600">{pessoa.cargo_efetivo || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-gray-600">{pessoa.cargo_efetivo_classe || '—'}</span>
                      </td>
                      {canEdit && (
                        <td className="px-5 py-4">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleOpenModal('edit', pessoa)}
                              className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setItemParaDeletar({ id: pessoa.id, nome: pessoa.nome });
                                setModalConfirmDeleteOpen(true);
                              }}
                              className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#7a4a9e] to-[#5a2d7e] flex items-center justify-center shadow-lg">
          <Users className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pessoas</h1>
          <p className="text-slate-500 text-sm">Selecione uma área para ver as pessoas</p>
        </div>
      </div>

      {/* Lista de Áreas */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Carregando áreas...</div>
      ) : areas.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Nenhuma área cadastrada.
          Cadastre áreas em Cadastros → Áreas.
        </div>
      ) : (
        <div className="space-y-3">
          {linhas.map((areasLinha, linhaIndex) => (
            <div
              key={linhaIndex}
              className="min-h-[90px] p-2"
            >
              <div className="flex flex-wrap gap-4">
                {areasLinha.map((area, index) => renderCardArea(area, linhaIndex, index))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================================
  // RETURN
  // ============================================================

  return (
    <Layout>
      <div className="page-transition-enter">
        <VoltarCadastros />
        {/* Conteúdo principal - condicional */}
        {areaSelecionada ? renderTelaPessoas() : renderTelaListaAreas()}
      </div>

      {/* Modal Criar/Editar Pessoa */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? 'Nova Pessoa' : 'Editar Pessoa'}
            </DialogTitle>
            <DialogDescription>
              {modalMode === 'create'
                ? `Cadastrar pessoa na área "${areaSelecionada?.nome}"`
                : 'Edite os dados da pessoa'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div>
              <Label htmlFor="nome">Colaborador(a) *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome completo"
                className="mt-1"
              />
            </div>

            {/* Unidade (seleção das unidades da área) */}
            <div>
              <Label htmlFor="unidade_id">Lotação</Label>
              {loadingUnidades ? (
                <div className="mt-1 h-10 flex items-center text-gray-500 text-sm">
                  Carregando unidades...
                </div>
              ) : unidades.length === 0 ? (
                <div className="mt-1 h-10 flex items-center text-gray-400 text-sm">
                  Nenhuma unidade cadastrada nesta área
                </div>
              ) : (
                <Select
                  value={formData.unidade_id?.toString() || ''}
                  onValueChange={(value) => setFormData({ ...formData, unidade_id: value ? parseInt(value, 10) : null })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id.toString()}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Usuário e Email (não aparecem na tabela, apenas são salvos) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="usuario">Usuário</Label>
                <Input
                  id="usuario"
                  value={formData.usuario || ''}
                  onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                  placeholder="Nome de usuário"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Situação Funcional */}
            <div>
              <Label htmlFor="situacao">Situação Funcional</Label>
              <Input
                id="situacao"
                value={formData.situacao}
                onChange={(e) => setFormData({ ...formData, situacao: e.target.value })}
                placeholder="Ex: Ativo, Cedido, Licença..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* CC/FC */}
              <div>
                <Label htmlFor="cc_fc">CC/FC</Label>
                <Input
                  id="cc_fc"
                  value={formData.cc_fc}
                  onChange={(e) => setFormData({ ...formData, cc_fc: e.target.value })}
                  placeholder="Cargo Comissionado / Função"
                  className="mt-1"
                />
              </div>

              {/* Código CC/FC */}
              <div>
                <Label htmlFor="cc_fc_classe">Código (CC/FC)</Label>
                <Input
                  id="cc_fc_classe"
                  value={formData.cc_fc_classe}
                  onChange={(e) => setFormData({ ...formData, cc_fc_classe: e.target.value })}
                  placeholder="Ex: A, B, C..."
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cargo Efetivo */}
              <div>
                <Label htmlFor="cargo_efetivo">Cargo Efetivo</Label>
                <Input
                  id="cargo_efetivo"
                  value={formData.cargo_efetivo}
                  onChange={(e) => setFormData({ ...formData, cargo_efetivo: e.target.value })}
                  placeholder="Cargo efetivo"
                  className="mt-1"
                />
              </div>

              {/* Classe Cargo Efetivo */}
              <div>
                <Label htmlFor="cargo_efetivo_classe">Classe (Cargo Efetivo)</Label>
                <Input
                  id="cargo_efetivo_classe"
                  value={formData.cargo_efetivo_classe}
                  onChange={(e) => setFormData({ ...formData, cargo_efetivo_classe: e.target.value })}
                  placeholder="Ex: I, II, III..."
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-[#5A8A7A] hover:bg-[#4A7A6A]">
              {modalMode === 'create' ? 'Cadastrar' : 'Salvar'}
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
              Deseja realmente excluir <strong>"{itemParaDeletar?.nome}"</strong>?
              <br />
              <span className="text-red-500">Esta ação não pode ser desfeita.</span>
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
    </Layout>
  );
}
