import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { VoltarCadastros } from '@/components/ui/VoltarCadastros';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Target,
  Flag,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useEstrategiaModelo } from '@/contexts/EstrategiaModeloContext';
import { useDirectorate } from '@/contexts/DirectorateContext';
import * as api from '@/services/api';
import { metasApi, type Meta, type CreateMetaDto } from '@/services/metasApi';
import { areasApi, type Area } from '@/services/areasApi';
import type { Objective, KeyResult, OKRStatus } from '@/types';

// ============================================================
// STATUS HELPERS
// ============================================================

const STATUS_LABELS: Record<OKRStatus, string> = {
  NAO_INICIADO: 'Não Iniciado',
  EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDO: 'Concluído',
};

const STATUS_COLORS: Record<OKRStatus, string> = {
  NAO_INICIADO: 'bg-gray-100 text-gray-700',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
};

const SITUATION_LABELS: Record<string, string> = {
  NO_PRAZO: 'No Prazo',
  EM_ATRASO: 'Em Atraso',
  FINALIZADO: 'Finalizado',
};

const SITUATION_COLORS: Record<string, string> = {
  NO_PRAZO: 'bg-green-100 text-green-700',
  EM_ATRASO: 'bg-red-100 text-red-700',
  FINALIZADO: 'bg-blue-100 text-blue-700',
};

export default function OkrsMetas() {
  const { toast } = useToast();
  const { modelo, setModelo } = useEstrategiaModelo();
  const { devEnvironment } = useDirectorate();
  const [loading, setLoading] = useState(false);

  // ============================================================
  // OKR STATE
  // ============================================================
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [expandedObj, setExpandedObj] = useState<string | null>(null);

  // OKR Dialogs
  const [objDialogOpen, setObjDialogOpen] = useState(false);
  const [objEditMode, setObjEditMode] = useState(false);
  const [editingObj, setEditingObj] = useState<Objective | null>(null);
  const [objForm, setObjForm] = useState({ code: '', title: '', description: '', directorate: '' });

  const [krDialogOpen, setKrDialogOpen] = useState(false);
  const [krEditMode, setKrEditMode] = useState(false);
  const [editingKr, setEditingKr] = useState<KeyResult | null>(null);
  const [krForm, setKrForm] = useState({ objectiveId: '', code: '', description: '', status: 'NAO_INICIADO' as OKRStatus, deadline: '', directorate: '' });

  const [confirmDeleteObj, setConfirmDeleteObj] = useState<Objective | null>(null);
  const [confirmDeleteKr, setConfirmDeleteKr] = useState<KeyResult | null>(null);
  const [okrFilterDir, setOkrFilterDir] = useState<string>('all');

  // ============================================================
  // METAS STATE
  // ============================================================
  const [metas, setMetas] = useState<Meta[]>([]);
  const [metaFilterDir, setMetaFilterDir] = useState<string>('all');
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [metaEditMode, setMetaEditMode] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [metaForm, setMetaForm] = useState({ titulo: '', descricao: '', areaId: '', status: 'NAO_INICIADO', situacao: 'NO_PRAZO', prazo: '' });
  const [confirmDeleteMeta, setConfirmDeleteMeta] = useState<Meta | null>(null);

  // ============================================================
  // LOAD DATA
  // ============================================================

  const loadAreas = useCallback(async () => {
    try {
      const data = devEnvironment ? await areasApi.getByDominio(devEnvironment) : await areasApi.getAll();
      setAreas(data);
    } catch { /* silent */ }
  }, [devEnvironment]);

  const loadOkrs = useCallback(async () => {
    setLoading(true);
    try {
      const [objs, krs] = await Promise.all([api.getObjectives(devEnvironment || undefined), api.getKeyResults()]);
      setObjectives(objs);
      setKeyResults(krs);
    } catch {
      toast({ title: 'Erro ao carregar OKRs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, devEnvironment]);

  const loadMetas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await metasApi.getAll(devEnvironment || undefined);
      setMetas(data);
    } catch {
      toast({ title: 'Erro ao carregar Metas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, devEnvironment]);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  useEffect(() => {
    if (modelo === 'okrs') loadOkrs();
    if (modelo === 'metas') loadMetas();
  }, [modelo, loadOkrs, loadMetas]);

  // ============================================================
  // OKR HANDLERS
  // ============================================================

  const openNewObj = () => {
    setObjForm({ code: '', title: '', description: '', directorate: '' });
    setObjEditMode(false);
    setEditingObj(null);
    setObjDialogOpen(true);
  };

  const openEditObj = (obj: Objective) => {
    setObjForm({ code: obj.code, title: obj.title, description: obj.description || '', directorate: obj.directorate });
    setObjEditMode(true);
    setEditingObj(obj);
    setObjDialogOpen(true);
  };

  const handleSaveObj = async () => {
    if (!objForm.code || !objForm.title || !objForm.directorate) {
      toast({ title: 'Preencha código, título e diretoria', variant: 'destructive' });
      return;
    }
    try {
      if (objEditMode && editingObj) {
        await api.updateObjective(editingObj.id, {
          code: objForm.code,
          title: objForm.title,
          description: objForm.description,
          directorate: objForm.directorate,
        });
        toast({ title: 'Objetivo atualizado' });
      } else {
        await api.createObjective({
          code: objForm.code,
          title: objForm.title,
          description: objForm.description,
          directorate: objForm.directorate,
        });
        toast({ title: 'Objetivo criado' });
      }
      setObjDialogOpen(false);
      loadOkrs();
    } catch (err: any) {
      const msg = err?.message?.includes('409') ? 'Código já existe nesta diretoria' : 'Erro ao salvar objetivo';
      toast({ title: msg, variant: 'destructive' });
    }
  };

  const handleDeleteObj = async () => {
    if (!confirmDeleteObj) return;
    try {
      await api.deleteObjective(confirmDeleteObj.id);
      toast({ title: 'Objetivo excluído' });
      setConfirmDeleteObj(null);
      loadOkrs();
    } catch {
      toast({ title: 'Erro ao excluir objetivo', variant: 'destructive' });
    }
  };

  const openNewKr = (objectiveId?: string) => {
    setKrForm({ objectiveId: objectiveId || '', code: '', description: '', status: 'NAO_INICIADO', deadline: '', directorate: '' });
    setKrEditMode(false);
    setEditingKr(null);
    setKrDialogOpen(true);
  };

  const openEditKr = (kr: KeyResult) => {
    setKrForm({
      objectiveId: kr.objectiveId,
      code: kr.code,
      description: kr.description,
      status: kr.status,
      deadline: kr.deadline || '',
      directorate: kr.directorate,
    });
    setKrEditMode(true);
    setEditingKr(kr);
    setKrDialogOpen(true);
  };

  const handleSaveKr = async () => {
    if (!krForm.objectiveId || !krForm.code || !krForm.description || !krForm.directorate) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    try {
      if (krEditMode && editingKr) {
        await api.updateKeyResult(editingKr.id, {
          objectiveId: krForm.objectiveId,
          code: krForm.code,
          description: krForm.description,
          status: krForm.status,
          deadline: krForm.deadline,
          directorate: krForm.directorate,
        });
        toast({ title: 'KR atualizado' });
      } else {
        await api.createKeyResult({
          objectiveId: krForm.objectiveId,
          code: krForm.code,
          description: krForm.description,
          status: krForm.status,
          deadline: krForm.deadline,
          directorate: krForm.directorate,
        });
        toast({ title: 'KR criado' });
      }
      setKrDialogOpen(false);
      loadOkrs();
    } catch (err: any) {
      const msg = err?.message?.includes('409') ? 'Código já existe' : 'Erro ao salvar KR';
      toast({ title: msg, variant: 'destructive' });
    }
  };

  const handleDeleteKr = async () => {
    if (!confirmDeleteKr) return;
    try {
      await api.deleteKeyResult(confirmDeleteKr.id);
      toast({ title: 'KR excluído' });
      setConfirmDeleteKr(null);
      loadOkrs();
    } catch {
      toast({ title: 'Erro ao excluir KR', variant: 'destructive' });
    }
  };

  // ============================================================
  // METAS HANDLERS
  // ============================================================

  const openNewMeta = () => {
    setMetaForm({ titulo: '', descricao: '', areaId: '', status: 'NAO_INICIADO', situacao: 'NO_PRAZO', prazo: '' });
    setMetaEditMode(false);
    setEditingMeta(null);
    setMetaDialogOpen(true);
  };

  const openEditMeta = (meta: Meta) => {
    setMetaForm({ titulo: meta.titulo, descricao: meta.descricao || '', areaId: String(meta.areaId), status: meta.status || 'NAO_INICIADO', situacao: meta.situacao || 'NO_PRAZO', prazo: meta.prazo || '' });
    setMetaEditMode(true);
    setEditingMeta(meta);
    setMetaDialogOpen(true);
  };

  const handleSaveMeta = async () => {
    if (!metaForm.titulo || !metaForm.areaId) {
      toast({ title: 'Preencha título e área responsável', variant: 'destructive' });
      return;
    }
    try {
      const dto: CreateMetaDto = {
        titulo: metaForm.titulo,
        descricao: metaForm.descricao || undefined,
        areaId: parseInt(metaForm.areaId),
        status: metaForm.status,
        situacao: metaForm.situacao,
        prazo: metaForm.prazo || undefined,
      };
      if (metaEditMode && editingMeta) {
        await metasApi.update(editingMeta.id, dto);
        toast({ title: 'Meta atualizada' });
      } else {
        await metasApi.create(dto);
        toast({ title: 'Meta criada' });
      }
      setMetaDialogOpen(false);
      loadMetas();
    } catch {
      toast({ title: 'Erro ao salvar meta', variant: 'destructive' });
    }
  };

  const handleDeleteMeta = async () => {
    if (!confirmDeleteMeta) return;
    try {
      await metasApi.remove(confirmDeleteMeta.id);
      toast({ title: 'Meta excluída' });
      setConfirmDeleteMeta(null);
      loadMetas();
    } catch {
      toast({ title: 'Erro ao excluir meta', variant: 'destructive' });
    }
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const getKrsForObjective = (objId: string) => keyResults.filter(kr => String(kr.objectiveId) === String(objId));

  // Siglas das áreas do domínio do usuário (areasApi.getAll já filtra por domínio)
  const domainSiglas = new Set(areas.map(a => a.sigla).filter(Boolean));

  // Filtrar objetivos pelo domínio do usuário e depois pelo filtro de diretoria
  const domainObjectives = objectives.filter(obj => domainSiglas.has(obj.directorate));
  const filteredObjectives = okrFilterDir === 'all'
    ? domainObjectives
    : domainObjectives.filter(obj => obj.directorate === okrFilterDir);

  // Filtrar metas pelo domínio do usuário e depois pelo filtro de diretoria
  const domainMetas = metas.filter(m => domainSiglas.has(m.areaSigla || '') || domainSiglas.has(m.areaNome || ''));
  const filteredMetas = metaFilterDir === 'all'
    ? domainMetas
    : domainMetas.filter(m => m.areaSigla === metaFilterDir || m.areaNome === metaFilterDir);

  // ============================================================
  // MODEL SELECTOR
  // ============================================================

  const renderModelSelector = () => (
    <div className="mx-auto px-6 pt-6 pb-2">
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 max-w-md shadow-sm">
        <p className="text-sm font-medium text-slate-600 mb-3">Modelo de monitoramento de estratégia:</p>
        <div className="flex gap-3">
          <button
            onClick={() => setModelo('okrs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              modelo === 'okrs'
                ? 'bg-[#1565C0] text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Target className="h-4 w-4" />
            OKRs
          </button>
          <button
            onClick={() => setModelo('metas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              modelo === 'metas'
                ? 'bg-[#2E7D32] text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Flag className="h-4 w-4" />
            Metas
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // OKR VIEW
  // ============================================================

  const renderOkrs = () => (
    <div className="mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Objetivos e Resultados-Chave (OKRs)</h2>
        <div className="flex gap-2 items-center">
          <Select value={okrFilterDir} onValueChange={setOkrFilterDir}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar diretoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Diretorias</SelectItem>
              {areas.map(a => (
                <SelectItem key={a.id} value={a.sigla || a.nome}>{a.sigla || a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openNewObj}>
            <Plus className="h-4 w-4 mr-1" /> Novo Objetivo
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openNewKr()}>
            <Plus className="h-4 w-4 mr-1" /> Novo KR
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredObjectives.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {okrFilterDir === 'all' ? 'Nenhum objetivo cadastrado' : `Nenhum objetivo encontrado para ${okrFilterDir}`}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredObjectives.map(obj => {
            const krs = getKrsForObjective(obj.id);
            const isExpanded = expandedObj === obj.id;
            return (
              <div key={obj.id} className="border rounded-lg overflow-hidden bg-white">
                {/* Objective Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedObj(isExpanded ? null : obj.id)}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                  <Badge variant="outline" className="font-mono text-xs">{obj.code}</Badge>
                  <span className="font-medium text-gray-800 flex-1">{obj.title}</span>
                  <Badge variant="secondary" className="text-xs">{obj.directorate}</Badge>
                  <span className="text-xs text-gray-500">{krs.length} KR(s)</span>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditObj(obj)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" onClick={() => setConfirmDeleteObj(obj)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* KRs */}
                {isExpanded && (
                  <div className="border-t">
                    {krs.length === 0 ? (
                      <div className="px-8 py-4 text-sm text-gray-400">Nenhum KR cadastrado para este objetivo</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-white">
                            <TableHead className="w-20">Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="w-28">Status</TableHead>
                            <TableHead className="w-28">Situação</TableHead>
                            <TableHead className="w-32">Prazo</TableHead>
                            <TableHead className="w-20">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {krs.map(kr => (
                            <TableRow key={kr.id}>
                              <TableCell className="font-mono text-xs">{kr.code}</TableCell>
                              <TableCell className="text-sm">{kr.description}</TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${STATUS_COLORS[kr.status]}`}>
                                  {STATUS_LABELS[kr.status]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${SITUATION_COLORS[kr.situation] || 'bg-gray-100'}`}>
                                  {SITUATION_LABELS[kr.situation] || kr.situation}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">{kr.deadline || '-'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditKr(kr)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" onClick={() => setConfirmDeleteKr(kr)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    <div className="px-4 py-2 border-t bg-gray-50">
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => openNewKr(obj.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar KR
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ============================================================
  // METAS VIEW
  // ============================================================

  const renderMetas = () => (
    <div className="mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Metas</h2>
        <div className="flex gap-2 items-center">
          <Select value={metaFilterDir} onValueChange={setMetaFilterDir}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar diretoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Diretorias</SelectItem>
              {areas.map(a => (
                <SelectItem key={a.id} value={a.sigla || a.nome}>{a.sigla || a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openNewMeta}>
            <Plus className="h-4 w-4 mr-1" /> Nova Meta
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredMetas.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {metaFilterDir === 'all' ? 'Nenhuma meta cadastrada' : `Nenhuma meta encontrada para ${metaFilterDir}`}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título / Descrição</TableHead>
                <TableHead className="w-32 text-center">Status</TableHead>
                <TableHead className="w-32 text-center">Situação</TableHead>
                <TableHead className="w-32 text-center">Prazo</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metas.map(meta => (
                <TableRow key={meta.id}>
                  <TableCell>
                    <div className="font-medium">{meta.titulo}</div>
                    {meta.descricao && <div className="text-xs text-gray-500 mt-0.5">{meta.descricao}</div>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-xs whitespace-nowrap ${meta.status === 'CONCLUIDO' ? 'bg-green-500 text-white' : meta.status === 'EM_ANDAMENTO' ? 'bg-yellow-400 text-gray-900' : 'bg-orange-400 text-white'}`}>
                      {STATUS_LABELS[meta.status as OKRStatus] || 'Não Iniciado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-xs ${meta.situacao === 'FINALIZADO' ? 'bg-green-500 text-white' : meta.situacao === 'EM_ATRASO' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                      {SITUATION_LABELS[meta.situacao] || 'No Prazo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm text-gray-600">{meta.prazo || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditMeta(meta)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" onClick={() => setConfirmDeleteMeta(meta)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  // ============================================================
  // DIALOGS
  // ============================================================

  const renderDialogs = () => (
    <>
      {/* ---- Objective Dialog ---- */}
      <Dialog open={objDialogOpen} onOpenChange={setObjDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{objEditMode ? 'Editar Objetivo' : 'Novo Objetivo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código *</Label>
              <Input placeholder="Ex: OE01" value={objForm.code} onChange={e => setObjForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <Label>Título *</Label>
              <Input placeholder="Título do objetivo" value={objForm.title} onChange={e => setObjForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea placeholder="Descrição (opcional)" value={objForm.description} onChange={e => setObjForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Diretoria *</Label>
              <Select value={objForm.directorate} onValueChange={v => setObjForm(f => ({ ...f, directorate: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {areas.map(a => (
                    <SelectItem key={a.id} value={a.sigla || a.nome}>{a.sigla || a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveObj}>{objEditMode ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- KR Dialog ---- */}
      <Dialog open={krDialogOpen} onOpenChange={setKrDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{krEditMode ? 'Editar KR' : 'Novo Resultado-Chave'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Objetivo *</Label>
              <Select value={krForm.objectiveId} onValueChange={v => setKrForm(f => ({ ...f, objectiveId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o objetivo" /></SelectTrigger>
                <SelectContent>
                  {objectives.map(obj => (
                    <SelectItem key={obj.id} value={String(obj.id)}>{obj.code} - {obj.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Código *</Label>
              <Input placeholder="Ex: KR01" value={krForm.code} onChange={e => setKrForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea placeholder="Descrição do KR" value={krForm.description} onChange={e => setKrForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={krForm.status} onValueChange={v => setKrForm(f => ({ ...f, status: v as OKRStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_INICIADO">Não Iniciado</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input placeholder="Ex: julho - 2026" value={krForm.deadline} onChange={e => setKrForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div>
              <Label>Diretoria *</Label>
              <Select value={krForm.directorate} onValueChange={v => setKrForm(f => ({ ...f, directorate: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {areas.map(a => (
                    <SelectItem key={a.id} value={a.sigla || a.nome}>{a.sigla || a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKrDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveKr}>{krEditMode ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Meta Dialog ---- */}
      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{metaEditMode ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input placeholder="Título da meta" value={metaForm.titulo} onChange={e => setMetaForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea placeholder="Descrição (opcional)" value={metaForm.descricao} onChange={e => setMetaForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div>
              <Label>Área Responsável *</Label>
              <Select value={metaForm.areaId} onValueChange={v => setMetaForm(f => ({ ...f, areaId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                <SelectContent>
                  {areas.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.nome}{a.sigla ? ` (${a.sigla})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={metaForm.status} onValueChange={v => setMetaForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_INICIADO">A iniciar</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                  <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Situação (Calculado Automaticamente)</Label>
              <Select value={metaForm.situacao} disabled>
                <SelectTrigger className="bg-gray-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO_PRAZO">No prazo</SelectItem>
                  <SelectItem value="EM_ATRASO">Em atraso</SelectItem>
                  <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">A situação é atualizada automaticamente com base no status e no prazo.</p>
            </div>
            <div>
              <Label>Prazo *</Label>
              <Input placeholder="Ex: julho - 2026" value={metaForm.prazo} onChange={e => setMetaForm(f => ({ ...f, prazo: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMeta}>{metaEditMode ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm Delete Objective ---- */}
      <Dialog open={!!confirmDeleteObj} onOpenChange={() => setConfirmDeleteObj(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Objetivo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir o objetivo <strong>{confirmDeleteObj?.code}</strong>?
            Os KRs vinculados também serão removidos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteObj(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteObj}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm Delete KR ---- */}
      <Dialog open={!!confirmDeleteKr} onOpenChange={() => setConfirmDeleteKr(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir KR</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir o KR <strong>{confirmDeleteKr?.code}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteKr(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteKr}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm Delete Meta ---- */}
      <Dialog open={!!confirmDeleteMeta} onOpenChange={() => setConfirmDeleteMeta(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Meta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir a meta <strong>{confirmDeleteMeta?.titulo}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteMeta(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteMeta}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <Layout>
      <div className="min-h-screen page-transition-enter">
        <VoltarCadastros />
        {renderModelSelector()}
        {modelo === 'okrs' && renderOkrs()}
        {modelo === 'metas' && renderMetas()}
        {renderDialogs()}
      </div>
    </Layout>
  );
}
