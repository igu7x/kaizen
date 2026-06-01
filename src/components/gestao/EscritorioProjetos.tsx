import { useState, useEffect, useMemo } from 'react';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { useAuth } from '@/contexts/AuthContext';
import { contratosProjetosApi, type Projeto } from '@/services/contratosProjetosApi';
import {
  planosProgramasApi,
  type InstrumentoPlanejamento,
} from '@/services/planosProgramasApi';
import { GraficoRosca } from './GraficoRosca';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Star,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

const statusLabels: Record<string, string> = {
  planejado: 'Planejado',
  em_execucao: 'Em Execução',
  suspenso: 'Suspenso',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const statusBadgeColors: Record<string, string> = {
  planejado: 'bg-blue-500 text-white hover:bg-blue-500',
  em_execucao: 'bg-yellow-500 text-white hover:bg-yellow-500',
  suspenso: 'bg-red-500 text-white hover:bg-red-500',
  concluido: 'bg-purple-500 text-white hover:bg-purple-500',
  cancelado: 'bg-gray-500 text-white hover:bg-gray-500',
};

const saudeConfig: Record<string, { label: string; dotColor: string; textColor: string }> = {
  verde: { label: 'Saudável', dotColor: 'bg-green-500', textColor: 'text-green-600' },
  amarelo: { label: 'Atenção', dotColor: 'bg-yellow-500', textColor: 'text-yellow-600' },
  vermelho: { label: 'Crítico', dotColor: 'bg-red-500', textColor: 'text-red-600' },
};

const prioridadeConfig: Record<string, { label: string; stars: number }> = {
  baixa: { label: 'Baixa', stars: 1 },
  media: { label: 'Média', stars: 2 },
  alta: { label: 'Alta', stars: 3 },
};

function calcularSituacao(projeto: Projeto): 'no_prazo' | 'em_atraso' | 'finalizado' {
  if (projeto.status === 'concluido') return 'finalizado';
  if (projeto.data_prevista_conclusao) {
    const deadline = new Date(projeto.data_prevista_conclusao);
    if (deadline < new Date()) return 'em_atraso';
  }
  return 'no_prazo';
}

function formatPrazo(date: string | null): string {
  if (!date) return '-';
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ============================================================
// STAR RATING
// ============================================================

function StarRating({ filled, total = 3 }: { filled: number; total?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function EscritorioProjetos() {
  const { selectedDirectorate } = useDirectorate();
  const { user } = useAuth();
  // Sempre enviar a diretoria — o backend filtra por domínio (multi-tenant)
  const dirFiltro = selectedDirectorate || undefined;

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [instrumentos, setInstrumentos] = useState<InstrumentoPlanejamento[]>([]);
  const [unidades, setUnidades] = useState<{ id: number; nome_area: string; diretoria: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstrumento, setSelectedInstrumento] = useState<string>('all');
  const [selectedUnidade, setSelectedUnidade] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [gestorFilter, setGestorFilter] = useState('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [activeTab, setActiveTab] = useState<'todos' | 'meus'>('todos');

  // Projetos em que o usuário logado é gestor (via cadastros_pessoas.user_id)
  const meusProjetos = useMemo(() => {
    const rawId = user?.id;
    if (rawId === undefined || rawId === null || rawId === '') return [];
    const userIdNum = Number(rawId);
    const userIdStr = String(rawId);
    return projetos.filter(p => {
      const guid = (p as any).gestor_user_id;
      if (guid === null || guid === undefined) return false;
      return guid === userIdNum || String(guid) === userIdStr;
    });
  }, [projetos, user?.id]);

  const ehGestorDeProjeto = meusProjetos.length > 0;

  // Se o usuário perde acesso à aba "Meus", volta para "Todos"
  useEffect(() => {
    if (activeTab === 'meus' && !ehGestorDeProjeto) {
      setActiveTab('todos');
    }
  }, [activeTab, ehGestorDeProjeto]);

  // Reset filters when diretoria changes
  useEffect(() => {
    setSelectedInstrumento('all');
    setSelectedUnidade('all');
  }, [selectedDirectorate]);

  // Load instruments
  useEffect(() => {
    const load = async () => {
      try {
        const insts = await planosProgramasApi.getInstrumentos(dirFiltro);
        setInstrumentos(insts);
      } catch (err) {
        console.error('Erro ao carregar instrumentos:', err);
      }
    };
    load();
  }, [selectedDirectorate]);

  // Load unidades for diretoria
  useEffect(() => {
    const load = async () => {
      try {
        const areas = await contratosProjetosApi.getAreas(selectedDirectorate || undefined);
        // Filter out auto:diretoria hidden units
        setUnidades(areas.filter((a: any) => {
          if (selectedDirectorate) {
            return a.diretoria === selectedDirectorate;
          }
          return true;
        }).map((a: any) => ({
          ...a,
          nome_area: a.descricao === 'auto:diretoria' ? `${a.diretoria} (Diretoria)` : a.nome_area,
        })));
      } catch (err) {
        console.error('Erro ao carregar unidades:', err);
      }
    };
    load();
  }, [selectedDirectorate]);

  // Load projects
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let projs: Projeto[];
        const instrId = selectedInstrumento !== 'all' ? parseInt(selectedInstrumento) : null;
        if (instrId !== null) {
          projs = await contratosProjetosApi.getProjetosByInstrumentoId(instrId, dirFiltro);
        } else {
          projs = await contratosProjetosApi.getProjetos(dirFiltro);
        }
        setProjetos(projs.filter(p => p.ativo !== false));
      } catch (err) {
        console.error('Erro ao carregar projetos:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedDirectorate, selectedInstrumento]);

  // Unique gestors
  const gestores = useMemo(() => {
    const map = new Map<number, string>();
    projetos.forEach(p => {
      if (p.gestor_id && p.gestor_nome) map.set(p.gestor_id, p.gestor_nome);
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [projetos]);

  // Filter & Sort
  const filteredProjetos = useMemo(() => {
    // Base conforme aba selecionada
    let result = activeTab === 'meus' ? meusProjetos : projetos;

    // Filter by unidade
    if (selectedUnidade !== 'all') {
      const unidade = unidades.find(u => u.id === parseInt(selectedUnidade));
      if (unidade) {
        result = result.filter(p => {
          const areas = p.areas_execucao_diretorias || '';
          return areas.split(', ').some(a => a.trim() === unidade.nome_area);
        });
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        p => p.nome.toLowerCase().includes(term) || p.codigo?.toLowerCase().includes(term)
      );
    }

    if (gestorFilter !== 'all') {
      result = result.filter(p => p.gestor_id === parseInt(gestorFilter));
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        let valA: number, valB: number;
        switch (sortField) {
          case 'status': {
            const order: Record<string, number> = { planejado: 0, em_execucao: 1, suspenso: 2, concluido: 3, cancelado: 4 };
            valA = order[a.status] ?? 0;
            valB = order[b.status] ?? 0;
            break;
          }
          case 'saude': {
            const order: Record<string, number> = { verde: 0, amarelo: 1, vermelho: 2 };
            valA = order[a.saude] ?? 0;
            valB = order[b.saude] ?? 0;
            break;
          }
          case 'prioridade': {
            const order: Record<string, number> = { baixa: 0, media: 1, alta: 2 };
            valA = order[a.prioridade] ?? 0;
            valB = order[b.prioridade] ?? 0;
            break;
          }
          default:
            return 0;
        }
        return sortDir === 'asc' ? valA - valB : valB - valA;
      });
    }

    return result;
  }, [projetos, meusProjetos, activeTab, searchTerm, gestorFilter, selectedUnidade, unidades, sortField, sortDir]);

  // ============================================================
  // STATS & CHART DATA
  // ============================================================

  const stats = useMemo(() => ({
    total: filteredProjetos.length,
    concluidos: filteredProjetos.filter(p => p.status === 'concluido').length,
    emAndamento: filteredProjetos.filter(p => p.status === 'em_execucao').length,
    naoIniciado: filteredProjetos.filter(p => p.status === 'planejado').length,
  }), [filteredProjetos]);

  const statusChartData = useMemo(() => [
    { name: 'Planejado', value: filteredProjetos.filter(p => p.status === 'planejado').length },
    { name: 'Em Execução', value: filteredProjetos.filter(p => p.status === 'em_execucao').length },
    { name: 'Suspenso', value: filteredProjetos.filter(p => p.status === 'suspenso').length },
    { name: 'Concluído', value: filteredProjetos.filter(p => p.status === 'concluido').length },
  ], [filteredProjetos]);
  const statusChartColors = ['#3b82f6', '#eab308', '#ef4444', '#22c55e'];

  const situacaoChartData = useMemo(() => {
    let noPrazo = 0, emAtraso = 0, finalizado = 0;
    filteredProjetos.forEach(p => {
      const sit = calcularSituacao(p);
      if (sit === 'finalizado') finalizado++;
      else if (sit === 'em_atraso') emAtraso++;
      else noPrazo++;
    });
    return [
      { name: 'No prazo', value: noPrazo },
      { name: 'Em atraso', value: emAtraso },
      { name: 'Finalizado', value: finalizado },
    ];
  }, [filteredProjetos]);
  const situacaoChartColors = ['#3b82f6', '#ef4444', '#f59e0b'];

  const saudeChartData = useMemo(() => [
    { name: 'Saudável', value: filteredProjetos.filter(p => p.saude === 'verde').length, color: '#4ade80' },
    { name: 'Atenção', value: filteredProjetos.filter(p => p.saude === 'amarelo').length, color: '#fbbf24' },
    { name: 'Crítico', value: filteredProjetos.filter(p => p.saude === 'vermelho').length, color: '#f87171' },
  ], [filteredProjetos]);

  const prioridadeChartData = useMemo(() => {
    const baixa = filteredProjetos.filter(p => p.prioridade === 'baixa').length;
    const media = filteredProjetos.filter(p => p.prioridade === 'media').length;
    const alta = filteredProjetos.filter(p => p.prioridade === 'alta').length;
    const maxVal = Math.max(baixa, media, alta, 1);
    return [
      { label: 'Baixa', value: baixa, stars: 1, barColor: 'bg-blue-400', percent: (baixa / maxVal) * 100 },
      { label: 'Média', value: media, stars: 2, barColor: 'bg-blue-500', percent: (media / maxVal) * 100 },
      { label: 'Alta', value: alta, stars: 3, barColor: 'bg-red-500', percent: (alta / maxVal) * 100 },
    ];
  }, [filteredProjetos]);

  // Sort toggle
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Tabs: Todos os projetos | Meus projetos (só se gestor) */}
      {ehGestorDeProjeto && (
        <div className="flex gap-1 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'todos'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Todos os projetos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('meus')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'meus'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Meus projetos
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === 'meus' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {meusProjetos.length}
            </span>
          </button>
        </div>
      )}

      {/* Filter Dropdowns */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plano / Programa</label>
          <Select value={selectedInstrumento} onValueChange={setSelectedInstrumento}>
            <SelectTrigger className="h-10 w-[320px] bg-white">
              <SelectValue placeholder="Todos os Planos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Planos</SelectItem>
              {instrumentos.map(inst => (
                <SelectItem key={inst.id} value={String(inst.id)}>{inst.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Área</label>
          <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
            <SelectTrigger className="h-10 w-[320px] bg-white">
              <SelectValue placeholder="Todas as Áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Áreas</SelectItem>
              {unidades.map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.nome_area}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Section Title */}
      <div className="border-l-4 border-blue-600 bg-white rounded-r-lg py-3 px-5 shadow-sm">
        <h2 className="text-lg font-bold text-blue-600">
          {activeTab === 'meus' ? 'Meus Projetos' : 'Projetos'}
        </h2>
        <p className="text-sm text-gray-400">
          {activeTab === 'meus'
            ? 'Projetos onde você é o gestor'
            : selectedInstrumento !== 'all'
            ? instrumentos.find(i => i.id === parseInt(selectedInstrumento))?.nome || 'Filtrado'
            : 'Portfólio Completo'}
          {activeTab !== 'meus' && selectedUnidade !== 'all' && ` — ${unidades.find(u => u.id === parseInt(selectedUnidade))?.nome_area || ''}`}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-0 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 p-5 border-l-4 border-blue-500">
            <FolderKanban className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Projetos</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 p-5 border-l-4 border-green-500">
            <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Concluídos</p>
              <p className="text-3xl font-bold text-green-500">{stats.concluidos}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 p-5 border-l-4 border-yellow-500">
            <Clock className="h-6 w-6 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Em Andamento</p>
              <p className="text-3xl font-bold text-yellow-500">{stats.emAndamento}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white border-0 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 p-5 border-l-4 border-red-500">
            <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Não Iniciado</p>
              <p className="text-3xl font-bold text-red-500">{stats.naoIniciado}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Donut */}
          <GraficoRosca
            key={`status-${filteredProjetos.length}`}
            title="Status"
            data={statusChartData}
            colors={statusChartColors}
          />

          {/* Situação Donut */}
          <GraficoRosca
            key={`situacao-${filteredProjetos.length}`}
            title="Situação"
            data={situacaoChartData}
            colors={situacaoChartColors}
          />

          {/* Saúde Bar Chart */}
          <Card className="border-0 shadow-md rounded-lg flex flex-col" style={{ height: '400px' }}>
            <CardHeader className="pb-2 py-3 flex-shrink-0">
              <CardTitle className="text-base leading-none">Saúde</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={saudeChartData} margin={{ top: 25, right: 10, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={10}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 'bold' }} />
                    {saudeChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Prioridade Horizontal Bars */}
          <Card className="border-0 shadow-md rounded-lg flex flex-col" style={{ height: '400px' }}>
            <CardHeader className="pb-2 py-3 flex-shrink-0">
              <CardTitle className="text-base leading-none">Prioridade</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-6 flex flex-col justify-center gap-8">
              {prioridadeChartData.map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-12 text-right flex-shrink-0">{item.label}</span>
                  <div className="flex-shrink-0">
                    <StarRating filled={item.stars} />
                  </div>
                  <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
                    <div
                      className={`h-6 rounded ${item.barColor} transition-all duration-700`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-8 text-right flex-shrink-0">
                    {item.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Project List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b flex-wrap">
          <span className="font-semibold text-gray-800 flex-shrink-0">Projetos</span>
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar projeto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 w-[200px]"
            />
          </div>
          <Select value={gestorFilter} onValueChange={setGestorFilter}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Todos os Gestores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Gestores</SelectItem>
              {gestores.map(g => (
                <SelectItem key={g.id} value={String(g.id)}>{g.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* Column Headers (desktop) */}
          <div className="hidden lg:flex items-center text-xs font-medium text-gray-500 uppercase">
            <button
              className="w-32 flex items-center justify-center gap-1 hover:text-gray-700"
              onClick={() => toggleSort('status')}
            >
              Status
              {sortField === 'status'
                ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                : <ChevronDown className="h-3 w-3 opacity-40" />}
            </button>
            <span className="w-24 text-center">Progresso</span>
            <button
              className="w-28 flex items-center justify-center gap-1 hover:text-gray-700"
              onClick={() => toggleSort('saude')}
            >
              Saúde
              {sortField === 'saude'
                ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                : <ChevronDown className="h-3 w-3 opacity-40" />}
            </button>
            <span className="w-24 text-center">Prazo</span>
            <button
              className="w-28 flex items-center justify-center gap-1 hover:text-gray-700"
              onClick={() => toggleSort('prioridade')}
            >
              Prioridade
              {sortField === 'prioridade'
                ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                : <ChevronDown className="h-3 w-3 opacity-40" />}
            </button>
            <span className="w-8" />
          </div>
        </div>

        {/* Project Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : filteredProjetos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            Nenhum projeto encontrado
          </div>
        ) : (
          <div>
            {filteredProjetos.map(projeto => {
              const saude = saudeConfig[projeto.saude] || saudeConfig.verde;
              const prioridade = prioridadeConfig[projeto.prioridade] || prioridadeConfig.media;
              return (
                <div
                  key={projeto.id}
                  className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FolderKanban className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="flex-1 font-medium text-gray-800 truncate min-w-0">
                    {projeto.nome}
                  </span>

                  {/* Desktop columns */}
                  <div className="hidden lg:flex items-center flex-shrink-0">
                    <div className="w-32 flex justify-center">
                      <Badge className={`text-xs whitespace-nowrap ${statusBadgeColors[projeto.status] || 'bg-gray-400 text-white'}`}>
                        {statusLabels[projeto.status] || projeto.status}
                      </Badge>
                    </div>
                    <div className="w-24 text-center text-sm text-gray-600">
                      {projeto.progresso_percentual || 0}%
                    </div>
                    <div className="w-28 flex items-center justify-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${saude.dotColor}`} />
                      <span className={`text-sm ${saude.textColor}`}>{saude.label}</span>
                    </div>
                    <div className="w-24 text-center text-sm text-gray-600">
                      {formatPrazo(projeto.data_prevista_conclusao)}
                    </div>
                    <div className="w-28 flex items-center justify-center gap-1.5">
                      <span className="text-sm text-gray-600">{prioridade.label}</span>
                      <StarRating filled={prioridade.stars} />
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
