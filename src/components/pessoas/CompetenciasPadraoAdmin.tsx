import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, RotateCcw, Send, AlertTriangle, History, ChevronDown, ChevronUp } from 'lucide-react';
import { competenciasPadraoApi, CompetenciaPadrao, VersaoSnapshot } from '@/services/competenciasPadraoApi';

const TIPO_LABELS: Record<string, string> = {
  comportamental: 'Comportamentais',
  estrategica: 'Estratégicas',
  gerencial: 'Gerenciais',
};

const TIPO_COLORS: Record<string, string> = {
  comportamental: 'border-violet-300 bg-violet-50',
  estrategica: 'border-sky-300 bg-sky-50',
  gerencial: 'border-rose-300 bg-rose-50',
};

const TIPO_ACCENT: Record<string, string> = {
  comportamental: 'text-violet-700',
  estrategica: 'text-sky-700',
  gerencial: 'text-rose-700',
};

interface EditingState {
  id: number | null; // null = criando novo
  tipo: string;
  nome: string;
  descricao: string;
}

export function CompetenciasPadraoAdmin() {
  const [competencias, setCompetencias] = useState<CompetenciaPadrao[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPending, setHasPending] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versoes, setVersoes] = useState<VersaoSnapshot[]>([]);
  const [loadingVersoes, setLoadingVersoes] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('comportamental');

  const loadData = async () => {
    try {
      const [all, pending] = await Promise.all([
        competenciasPadraoApi.getAllAdmin(),
        competenciasPadraoApi.hasPendingChanges(),
      ]);
      setCompetencias(all);
      setHasPending(pending.hasPendingChanges);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao carregar competências');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = competencias.filter(c => c.tipo === activeTab);
  const ativas = filtered.filter(c => c.ativo);
  const inativas = filtered.filter(c => !c.ativo);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.nome.trim() || !editing.descricao.trim()) {
      return toast.error('Nome e descrição são obrigatórios');
    }
    setSaving(true);
    try {
      if (editing.id) {
        await competenciasPadraoApi.update(editing.id, {
          nome: editing.nome.trim(),
          descricao: editing.descricao.trim(),
        });
        toast.success('Competência atualizada');
      } else {
        await competenciasPadraoApi.create({
          tipo: editing.tipo,
          nome: editing.nome.trim(),
          descricao: editing.descricao.trim(),
        });
        toast.success('Competência criada');
      }
      setEditing(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await competenciasPadraoApi.remove(id);
      toast.success('Competência desativada');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao desativar');
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await competenciasPadraoApi.reactivate(id);
      toast.success('Competência reativada');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao reativar');
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await competenciasPadraoApi.publicar();
      if (result.tiposAfetados.length === 0) {
        toast.info('Nenhuma mudança detectada para publicar.');
      } else {
        toast.success(
          `Versão ${result.versao} publicada! ${result.formulariosAfetados} formulário(s) marcado(s) para atualização.`
        );
      }
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao publicar');
    } finally {
      setPublishing(false);
    }
  };

  const loadHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setLoadingVersoes(true);
    try {
      const v = await competenciasPadraoApi.getVersoes();
      setVersoes(v);
      setShowHistory(true);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao carregar histórico');
    } finally {
      setLoadingVersoes(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header com ações */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">
            Gerencie as competências padrão (comportamentais, estratégicas, gerenciais).
            Alterações só afetam formulários após a publicação.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loadingVersoes}
          >
            {loadingVersoes ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <History className="h-4 w-4 mr-1" />}
            Histórico
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing || !hasPending}
            className={hasPending ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-300 text-gray-500'}
            size="sm"
          >
            {publishing ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Publicando...</>
            ) : (
              <><Send className="h-4 w-4 mr-1" /> Publicar Alterações</>
            )}
          </Button>
        </div>
      </div>

      {/* Banner de mudanças pendentes */}
      {hasPending && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Alterações pendentes de publicação</p>
            <p className="text-sm text-amber-600 mt-1">
              Você fez alterações que ainda não foram publicadas. Clique em "Publicar Alterações" para
              aplicá-las. Formulários já enviados que contenham competências modificadas serão marcados
              para atualização.
            </p>
          </div>
        </div>
      )}

      {/* Histórico de versões */}
      {showHistory && (
        <Card className="border border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Histórico de Versões</CardTitle>
          </CardHeader>
          <CardContent>
            {versoes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma versão publicada ainda.</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  // Agrupar por versão
                  const grouped = new Map<number, VersaoSnapshot[]>();
                  versoes.forEach(v => {
                    if (!grouped.has(v.versao)) grouped.set(v.versao, []);
                    grouped.get(v.versao)!.push(v);
                  });
                  return Array.from(grouped.entries()).map(([versao, items]) => (
                    <div key={versao} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">Versão {versao}</span>
                        <span className="text-xs text-gray-500">
                          {items[0].publicado_por_nome || 'Sistema'} — {new Date(items[0].created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {items.map(item => {
                        const m = item.mudancas;
                        if (!m || ((!m.adicionadas || m.adicionadas.length === 0) && (!m.removidas || m.removidas.length === 0) && (!m.alteradas || m.alteradas.length === 0))) return null;
                        return (
                          <div key={`${versao}-${item.tipo}`} className="text-sm ml-3 mb-1">
                            <span className={`font-medium ${TIPO_ACCENT[item.tipo] || 'text-gray-700'}`}>{TIPO_LABELS[item.tipo] || item.tipo}:</span>
                            {m.adicionadas?.length > 0 && <span className="text-emerald-600 ml-2">+{m.adicionadas.length} adicionada(s)</span>}
                            {m.removidas?.length > 0 && <span className="text-red-600 ml-2">-{m.removidas.length} removida(s)</span>}
                            {m.alteradas?.length > 0 && <span className="text-amber-600 ml-2">~{m.alteradas.length} alterada(s)</span>}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs por tipo */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {(['comportamental', 'estrategica', 'gerencial'] as const).map(tipo => (
          <button
            key={tipo}
            onClick={() => setActiveTab(tipo)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tipo
                ? `${TIPO_ACCENT[tipo]} bg-white border border-b-0 border-gray-200 -mb-[1px]`
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {TIPO_LABELS[tipo]} ({competencias.filter(c => c.tipo === tipo && c.ativo).length})
          </button>
        ))}
      </div>

      {/* Lista de competências ativas */}
      <div className="space-y-3">
        {ativas.sort((a, b) => a.ordem - b.ordem).map((comp, index) => (
          <Card key={comp.id} className={`border ${TIPO_COLORS[comp.tipo]} shadow-sm`}>
            <CardContent className="p-4">
              {editing?.id === comp.id ? (
                <div className="space-y-3">
                  <div>
                    <Label>Nome</Label>
                    <input
                      className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 text-sm"
                      value={editing.nome}
                      onChange={e => setEditing({ ...editing, nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      className="mt-1"
                      rows={3}
                      value={editing.descricao}
                      onChange={e => setEditing({ ...editing, descricao: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      <span className={`${TIPO_ACCENT[comp.tipo]} font-bold mr-2`}>{index + 1}.</span>
                      {comp.nome}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{comp.descricao}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing({ id: comp.id, tipo: comp.tipo, nome: comp.nome, descricao: comp.descricao })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(comp.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Botão adicionar */}
      {editing?.id === null && editing.tipo === activeTab ? (
        <Card className="border border-dashed border-gray-300">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Nome</Label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 text-sm"
                value={editing.nome}
                onChange={e => setEditing({ ...editing, nome: e.target.value })}
                placeholder="Nome da competência"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={editing.descricao}
                onChange={e => setEditing({ ...editing, descricao: e.target.value })}
                placeholder="Descreva a competência"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Criar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setEditing({ id: null, tipo: activeTab, nome: '', descricao: '' })}
        >
          <Plus className="h-4 w-4 mr-2" /> Adicionar Competência {TIPO_LABELS[activeTab]?.slice(0, -1) || ''}
        </Button>
      )}

      {/* Competências inativas */}
      {inativas.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-gray-500 mb-2">Competências desativadas ({inativas.length})</p>
          <div className="space-y-2">
            {inativas.map(comp => (
              <div key={comp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-60">
                <div>
                  <p className="font-medium text-gray-600 line-through">{comp.nome}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{comp.descricao}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReactivate(comp.id)}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Reativar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
