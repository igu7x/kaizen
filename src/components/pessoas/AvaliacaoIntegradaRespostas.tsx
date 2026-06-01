import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Eye, Loader2, FileText, Filter, Trash2, History, FileDown } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { avaliacaoIntegradaApi, AvaliacaoIntegradaFormulario, VersaoHistoricoIntegrada } from '@/services/avaliacaoIntegradaApi';
import { generateAvaliacaoIntegradaPDF } from '@/utils/generateAvaliacaoIntegradaPDF';

interface AvaliacaoIntegradaRespostasProps {
  diretoria: string;
  isDomainRoot?: boolean;
  tipoInventario?: "equipe" | "gestor";
  onViewFormulario: (formulario: AvaliacaoIntegradaFormulario) => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function AvaliacaoIntegradaRespostas({ diretoria, isDomainRoot, tipoInventario, onViewFormulario }: AvaliacaoIntegradaRespostasProps) {
  const [formularios, setFormularios] = useState<AvaliacaoIntegradaFormulario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const [filtroDiretoria, setFiltroDiretoria] = useState<string>('__all__');
  const [filtroUnidade, setFiltroUnidade] = useState<string>('__all__');

  // Histórico de versões
  const [versaoDialogFormulario, setVersaoDialogFormulario] = useState<AvaliacaoIntegradaFormulario | null>(null);
  const [versoes, setVersoes] = useState<VersaoHistoricoIntegrada[]>([]);
  const [loadingVersoes, setLoadingVersoes] = useState(false);
  const [loadingPdfVersao, setLoadingPdfVersao] = useState<number | null>(null);

  const handleOpenVersoes = async (f: AvaliacaoIntegradaFormulario) => {
    setVersaoDialogFormulario(f);
    setVersoes([]);
    setLoadingVersoes(true);
    try {
      const data = await avaliacaoIntegradaApi.getVersoes(f.id);
      setVersoes(data);
    } catch (err) {
      console.error('Erro ao carregar versões:', err);
    } finally {
      setLoadingVersoes(false);
    }
  };

  const handlePdfVersao = async (formularioId: number, versao: number) => {
    setLoadingPdfVersao(versao);
    try {
      const snapshot = await avaliacaoIntegradaApi.getVersaoDados(formularioId, versao);
      generateAvaliacaoIntegradaPDF(snapshot);
    } catch (err) {
      console.error('Erro ao gerar PDF da versão:', err);
    } finally {
      setLoadingPdfVersao(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        // Super-diretoria: carrega todos; demais: filtra pela propria diretoria
        const filterDiretoria = isDomainRoot ? undefined : diretoria;
        const data = await avaliacaoIntegradaApi.getAll(filterDiretoria, tipoInventario);
        setFormularios(data);
      } catch (err) {
        console.error('Erro ao carregar respostas:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isDomainRoot, diretoria, tipoInventario]);

  const diretorias = useMemo(() => {
    const set = new Set<string>();
    formularios.forEach(f => { if (f.diretoria) set.add(f.diretoria); });
    return Array.from(set).sort();
  }, [formularios]);

  const unidades = useMemo(() => {
    const set = new Set<string>();
    const filtered = filtroDiretoria !== '__all__'
      ? formularios.filter(f => f.diretoria === filtroDiretoria)
      : formularios;
    filtered.forEach(f => { if (f.unidade_nome) set.add(f.unidade_nome); });
    return Array.from(set).sort();
  }, [formularios, filtroDiretoria]);

  const formulariosFiltrados = useMemo(() => {
    return formularios.filter(f => {
      if (filtroDiretoria !== '__all__' && f.diretoria !== filtroDiretoria) return false;
      if (filtroUnidade !== '__all__' && (f.unidade_nome || '') !== filtroUnidade) return false;
      return true;
    });
  }, [formularios, filtroDiretoria, filtroUnidade]);

  const handleDiretoriaChange = (value: string) => {
    setFiltroDiretoria(value);
    setFiltroUnidade('__all__');
  };

  const handleDelete = async (id: number) => {
    try {
      await avaliacaoIntegradaApi.remove(id);
      setFormularios(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error('Erro ao excluir formulário:', err);
    }
  };

  const handleView = async (id: number) => {
    setLoadingId(id);
    try {
      const full = await avaliacaoIntegradaApi.getById(id);
      onViewFormulario(full);
    } catch (err) {
      console.error('Erro ao carregar formulario:', err);
    } finally {
      setLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (formularios.length === 0) {
    return (
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-12 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nenhuma avaliacao integrada enviada</p>
          <p className="text-gray-400 text-sm mt-2">
            As avaliacoes integradas enviadas pelos gestores aparecerao aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter className="h-4 w-4" />
              Filtros:
            </div>
            {isDomainRoot && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Diretoria:</span>
                <Select value={filtroDiretoria} onValueChange={handleDiretoriaChange}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {diretorias.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Unidade:</span>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger className="w-[220px] h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contador */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {formulariosFiltrados.length} {formulariosFiltrados.length === 1 ? 'resposta' : 'respostas'}
        </Badge>
        {(filtroDiretoria !== '__all__' || filtroUnidade !== '__all__') && (
          <span className="text-xs text-gray-400">
            (de {formularios.length} total)
          </span>
        )}
      </div>

      {/* Tabela */}
      <Card className="border border-gray-200 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Avaliador</TableHead>
              <TableHead>Diretoria</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Competências</TableHead>
              <TableHead>Data de envio</TableHead>
              <TableHead className="text-center">Versão</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formulariosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                  Nenhum resultado para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              formulariosFiltrados.map((f) => {
                const statusLabel = f.status === 'validado' ? 'Validado' : f.status === 'validado_gestor' ? '1/2 Validado' : f.status === 'atualizacao_requisitada' ? 'Atualização Pendente' : 'Enviado';
                const statusColor = f.status === 'validado' ? 'bg-emerald-100 text-emerald-700' : f.status === 'validado_gestor' ? 'bg-blue-100 text-blue-700' : f.status === 'atualizacao_requisitada' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';
                return (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.pessoa_nome}</TableCell>
                  <TableCell>{f.avaliador_nome || '-'}</TableCell>
                  <TableCell>{f.diretoria || '-'}</TableCell>
                  <TableCell>{f.unidade_nome || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{f.total_respostas || '—'}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(f.created_at)}</TableCell>
                  <TableCell className="text-center">
                    {f.versao_formulario && f.versao_formulario > 0 ? (
                      <Badge variant="outline" className={f.status === 'atualizacao_requisitada' ? 'border-amber-400 text-amber-700' : 'border-gray-300 text-gray-600'}>
                        v{f.versao_formulario}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={statusColor}>{statusLabel}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(f.id)}
                        disabled={loadingId === f.id}
                      >
                        {loadingId === f.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      {(f.versao_formulario || 0) > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenVersoes(f)}
                          title="Histórico de versões"
                        >
                          <History className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
                      {isDomainRoot && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" title="Excluir formulário">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir formulário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a avaliação integrada de <strong>{f.pessoa_nome}</strong>? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(f.id)} className="bg-red-600 hover:bg-red-700">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!versaoDialogFormulario} onOpenChange={open => { if (!open) setVersaoDialogFormulario(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Histórico de versões
            </DialogTitle>
          </DialogHeader>
          {versaoDialogFormulario && (
            <p className="text-sm text-gray-500 -mt-2 mb-2">
              {versaoDialogFormulario.pessoa_nome}
              {versaoDialogFormulario.unidade_nome ? ` — ${versaoDialogFormulario.unidade_nome}` : ''}
            </p>
          )}
          {loadingVersoes ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : versoes.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">Nenhuma versão encontrada.</p>
          ) : (
            <div className="space-y-2">
              {versoes.map(v => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <span className="font-semibold text-emerald-700 font-mono">v{v.versao}</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Validado em {new Date(v.validado_em).toLocaleDateString('pt-BR')}
                      {v.validado_nome ? ` por ${v.validado_nome}` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => versaoDialogFormulario && handlePdfVersao(versaoDialogFormulario.id, v.versao)}
                    disabled={loadingPdfVersao === v.versao}
                    title={`Gerar PDF da versão ${v.versao}`}
                    className="gap-1.5"
                  >
                    {loadingPdfVersao === v.versao ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    PDF
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
