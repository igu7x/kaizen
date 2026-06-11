import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Loader2, Plus, Pencil, Trash2, Send, AlertTriangle, AlertCircle } from 'lucide-react';
import { competenciasGestorApi } from '@/services/competenciasGestorApi';

interface Unidade {
  unidade_id: number;
  unidade_nome: string;
  formulario_id: number;
  tipo: string;
  status: string;
  tecnicas_versao: number;
  tecnicas_publicado_em: string | null;
  diretoria_sigla: string;
}

interface Item {
  id: number;
  formulario_id: number;
  ordem: number;
  nome: string;
  descricao: string;
  peso: number;
  aplicabilidade: string;
  quantidade_pessoas: number | null;
}

interface EditingState {
  id: number | null;
  nome: string;
  descricao: string;
  peso: number;
  aplicabilidade: string;
  quantidade_pessoas: string;
}

const PESO_LABELS: Record<number, string> = {
  1: 'Útil',
  2: 'Importante',
  3: 'Crítica',
};

const PESO_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-red-100 text-red-700',
};

export function CompetenciasTecnicasAdmin() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [hasPending, setHasPending] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
  }, []);

  const loadForm = async (formularioId: number) => {
    setLoadingForm(true);
    try {
      const form = await competenciasGestorApi.getFormularioAdmin(formularioId);
      setItens(form.itens || []);
      setHasPending(form.hasPendingChanges || false);
    } catch (err: any) {
    } finally {
      setLoadingForm(false);
    }
  };

  useEffect(() => {
    if (selectedFormId) loadForm(selectedFormId);
  }, [selectedFormId]);

  const selectedUnidade = unidades.find(u => u.formulario_id === selectedFormId);

  const handleSave = async () => {
    if (!editing || !selectedFormId) return;
    if (!editing.nome.trim() || !editing.descricao.trim()) {
      return toast.error('Nome e descrição são obrigatórios');
    }
    if (!editing.peso || ![1, 2, 3].includes(editing.peso)) {
      return toast.error('Selecione o peso');
    }
    const isGestor = selectedUnidade?.tipo === 'gestor';
    if (!isGestor && !editing.aplicabilidade) {
      return toast.error('Selecione a aplicabilidade');
    }
    if (!isGestor && editing.aplicabilidade === 'parte' && !editing.quantidade_pessoas) {
      return toast.error('Informe a quantidade de pessoas');
    }

    setSaving(true);
    try {
      const data = {
        nome: editing.nome.trim(),
        descricao: editing.descricao.trim(),
        peso: editing.peso,
        aplicabilidade: isGestor ? 'todos' : editing.aplicabilidade,
        quantidade_pessoas: !isGestor && editing.aplicabilidade === 'parte' ? Number(editing.quantidade_pessoas) : undefined,
      };
      if (editing.id) {
        await competenciasGestorApi.atualizarItemAdmin(editing.id, data);
        
      } else {
        await competenciasGestorApi.criarItemAdmin(selectedFormId, data);
        
      }
      setEditing(null);
      await loadForm(selectedFormId);
    } catch (err: any) {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!selectedFormId) return;
    try {
      await competenciasGestorApi.removerItemAdmin(id);
      
      await loadForm(selectedFormId);
    } catch (err: any) {
    }
  };

  const handlePublish = async () => {
    if (!selectedFormId) return;
    if (!confirm('Publicar alterações? A matriz voltará para o fluxo de validação (enviado → validado autor → validado diretoria → validado final). Os formulários do inventário só serão marcados para atualização após a validação final.')) {
      return;
    }
    setPublishing(true);
    try {
      const result = await competenciasGestorApi.publicarTecnicas(selectedFormId);
      if (!result.tiposMudancas) {
        toast.info('Nenhuma alteração detectada.');
      } else {
        
      }
      await loadForm(selectedFormId);
    } catch (err: any) {
    } finally {
      setPublishing(false);
    }
  };

  if (loadingUnidades) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <p className="text-sm text-gray-500">
        Selecione uma unidade para gerenciar suas competências técnicas.
        Você só vê unidades onde você é responsável e que têm referencial preenchido.
      </p>

      {/* Seletor de unidade */}
      <Card className="border border-gray-200">
        <CardContent className="p-4 space-y-3">
          <Label>Unidade / Referencial</Label>
          {unidades.length === 0 ? (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Nenhuma unidade com referencial preenchido encontrada para seu usuário.
              </p>
            </div>
          ) : (
            <Select value={selectedFormId ? String(selectedFormId) : ''} onValueChange={(v) => setSelectedFormId(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {unidades.map(u => (
                  <SelectItem key={u.formulario_id} value={String(u.formulario_id)}>
                    {u.unidade_nome} — {u.tipo === 'gestor' ? 'Gestor' : 'Equipe'} (v{u.tecnicas_versao || 1})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedFormId && (
        <>
          {/* Header com info + publicar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-gray-600">
                <strong>{selectedUnidade?.unidade_nome}</strong>
                {selectedUnidade?.tipo === 'gestor' ? ' — Competências do Gestor' : ' — Competências da Equipe'}
              </p>
              {selectedUnidade?.tecnicas_publicado_em && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Última publicação: {new Date(selectedUnidade.tecnicas_publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
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

          {/* Banner de pendências */}
          {hasPending && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Alterações pendentes de publicação</p>
                <p className="text-sm text-amber-600 mt-1">
                  Clique em "Publicar Alterações" para aplicá-las. Formulários já enviados
                  desta unidade (autoavaliação, avaliação do gestor, integrada) serão marcados
                  para atualização.
                </p>
              </div>
            </div>
          )}

          {loadingForm ? (
            <div className="flex items-center justify-center py-6 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando competências...
            </div>
          ) : (
            <>
              {/* Lista de itens */}
              <div className="space-y-3">
                {itens.sort((a, b) => a.ordem - b.ordem).map((item, index) => (
                  <Card key={item.id} className="border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      {editing?.id === item.id ? (
                        <ItemForm editing={editing} setEditing={setEditing} onSave={handleSave} saving={saving} isGestor={selectedUnidade?.tipo === 'gestor'} />
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-900">
                                <span className="text-teal-600 font-bold mr-2">{index + 1}.</span>
                                {item.nome}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded ${PESO_COLORS[item.peso] || ''}`}>
                                {PESO_LABELS[item.peso] || `Peso ${item.peso}`}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 [overflow-wrap:anywhere]">{item.descricao}</p>
                            {selectedUnidade?.tipo !== 'gestor' && (
                              <p className="text-xs text-gray-500 mt-2">
                                Aplicabilidade: {item.aplicabilidade === 'todos' ? 'Todos os colaboradores' : `Parte da equipe${item.quantidade_pessoas ? ` (${item.quantidade_pessoas} pessoas)` : ''}`}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing({
                                id: item.id,
                                nome: item.nome,
                                descricao: item.descricao,
                                peso: item.peso,
                                aplicabilidade: item.aplicabilidade,
                                quantidade_pessoas: item.quantidade_pessoas ? String(item.quantidade_pessoas) : '',
                              })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(item.id)}
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
              {editing?.id === null ? (
                <Card className="border border-dashed border-gray-300">
                  <CardContent className="p-4">
                    <ItemForm editing={editing} setEditing={setEditing} onSave={handleSave} saving={saving} isGestor={selectedUnidade?.tipo === 'gestor'} />
                  </CardContent>
                </Card>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => setEditing({
                    id: null,
                    nome: '',
                    descricao: '',
                    peso: 2,
                    aplicabilidade: 'todos',
                    quantidade_pessoas: '',
                  })}
                >
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Competência Técnica
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ItemForm({ editing, setEditing, onSave, saving, isGestor }: {
  editing: EditingState;
  setEditing: (e: EditingState | null) => void;
  onSave: () => void;
  saving: boolean;
  isGestor?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Nome da competência</Label>
        <input
          className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 text-sm"
          value={editing.nome}
          onChange={e => setEditing({ ...editing, nome: e.target.value })}
          placeholder="Ex: Administração de bancos de dados"
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
      <div className={`grid grid-cols-1 ${isGestor ? '' : 'md:grid-cols-2'} gap-3`}>
        <div>
          <Label>Peso</Label>
          <Select value={String(editing.peso)} onValueChange={v => setEditing({ ...editing, peso: Number(v) })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — Útil</SelectItem>
              <SelectItem value="2">2 — Importante</SelectItem>
              <SelectItem value="3">3 — Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isGestor && (
          <div>
            <Label>Aplicabilidade</Label>
            <Select value={editing.aplicabilidade} onValueChange={v => setEditing({ ...editing, aplicabilidade: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os colaboradores</SelectItem>
                <SelectItem value="parte">Parte da equipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {!isGestor && editing.aplicabilidade === 'parte' && (
        <div>
          <Label>Quantidade de pessoas</Label>
          <input
            type="number"
            min="1"
            className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 text-sm"
            value={editing.quantidade_pessoas}
            onChange={e => setEditing({ ...editing, quantidade_pessoas: e.target.value })}
          />
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {editing.id ? 'Salvar' : 'Criar'}
        </Button>
      </div>
    </div>
  );
}
