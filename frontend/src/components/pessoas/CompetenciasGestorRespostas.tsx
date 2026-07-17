import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Pencil,
  Lock,
  Loader2,
  FileText,
  Filter,
  Trash2,
  Search,
  History,
  FileDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  competenciasGestorApi,
  FormularioCompetencias,
  VersaoHistorico,
} from "@/services/competenciasGestorApi";
import { areasApi, Area } from "@/services/areasApi";
import { generateCompetenciasPDF } from "@/utils/generateCompetenciasPDF";

// Validadores finais (Camada 3) — apenas estes 2 são finais
const VALIDADORES_FINAIS = [
  "gmpdmaciel@tjgo.jus.br",
  "dcamaral@tjgo.jus.br",
  "ifccupertino@tjgo.jus.br",
  "jdnascimento@tjgo.jus.br",
];
const isValidadorFinal = (email: string) =>
  VALIDADORES_FINAIS.some(
    (v) => v.toLowerCase() === email.toLowerCase().trim(),
  );

// Verifica se o usuário é gestor da diretoria do formulário (via cadastros_areas.gestor_user_id)
function isGestorDaDiretoria(
  f: FormularioCompetencias,
  userId: number | undefined,
  areas: Area[],
): boolean {
  if (!userId) return false;
  const area = areas.find(
    (a) => (a.sigla || "").toUpperCase() === (f.diretoria || "").toUpperCase(),
  );
  return area?.gestor_user_id === Number(userId);
}

function canUserEdit(
  f: FormularioCompetencias,
  userEmail: string,
  userId: number | undefined,
  areas: Area[],
): boolean {
  const email = userEmail.toLowerCase().trim();
  const isGestor = f.tipo === "gestor";
  const isDiretor = isGestorDaDiretoria(f, userId, areas);
  if (f.status === "validado_final") return false;
  if (f.status === "validado_diretoria") {
    return isValidadorFinal(email);
  }
  if (isGestor) {
    // Gestor: 2 camadas — status 'enviado': diretor + validador final
    if (isDiretor) return true;
    if (isValidadorFinal(email)) return true;
    return false;
  }
  // Equipe: 3 camadas
  if (f.status === "validado_autor") {
    if (isDiretor) return true;
    if (isValidadorFinal(email)) return true;
    return false;
  }
  // status 'enviado': o autor pode editar + diretor + validador final
  if (
    f.email_institucional &&
    email === f.email_institucional.toLowerCase().trim()
  )
    return true;
  if (isDiretor) return true;
  if (isValidadorFinal(email)) return true;
  return false;
}

interface CompetenciasGestorRespostasProps {
  diretoria: string;
  tipo?: "equipe" | "gestor";
  isDomainRoot?: boolean;
  onViewFormulario: (formulario: FormularioCompetencias) => void;
  onEditFormulario?: (formulario: FormularioCompetencias) => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Equipe: 3 camadas (autor → diretoria → final)
// Gestor: 2 camadas (diretoria → final) — não tem validado_autor
const statusLabelsEquipe: Record<string, { label: string; color: string }> = {
  enviado: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
  validado_autor: {
    label: "1/3 Validado",
    color: "bg-amber-100 text-amber-700",
  },
  validado_diretoria: {
    label: "2/3 Validado",
    color: "bg-orange-100 text-orange-700",
  },
  validado_final: {
    label: "Validado",
    color: "bg-emerald-100 text-emerald-700",
  },
  atualizacao_requisitada: {
    label: "Atualização Requisitada",
    color: "bg-purple-100 text-purple-700",
  },
};
const statusLabelsGestor: Record<string, { label: string; color: string }> = {
  enviado: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
  validado_autor: {
    label: "1/3 Validado",
    color: "bg-amber-100 text-amber-700",
  },
  validado_diretoria: {
    label: "2/3 Validado",
    color: "bg-orange-100 text-orange-700",
  },
  validado_final: {
    label: "Validado",
    color: "bg-emerald-100 text-emerald-700",
  },
  atualizacao_requisitada: {
    label: "Atualização Requisitada",
    color: "bg-purple-100 text-purple-700",
  },
};

export function CompetenciasGestorRespostas({
  diretoria,
  tipo,
  isDomainRoot,
  onViewFormulario,
  onEditFormulario,
}: CompetenciasGestorRespostasProps) {
  const { user } = useAuth();
  const [formularios, setFormularios] = useState<FormularioCompetencias[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // Histórico de versões
  const [versaoDialogFormulario, setVersaoDialogFormulario] =
    useState<FormularioCompetencias | null>(null);
  const [versoes, setVersoes] = useState<VersaoHistorico[]>([]);
  const [loadingVersoes, setLoadingVersoes] = useState(false);
  const [loadingPdfVersao, setLoadingPdfVersao] = useState<number | null>(null);

  // Filtros
  const [filtroDiretoria, setFiltroDiretoria] = useState<string>("__all__");
  const [filtroUnidade, setFiltroUnidade] = useState<string>("__all__");
  const [filtroNome, setFiltroNome] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        // Super-diretoria: carrega todos; demais: filtra pela própria diretoria
        const filterDiretoria = isDomainRoot ? undefined : diretoria;
        const [data, areasData] = await Promise.all([
          competenciasGestorApi.getAll(filterDiretoria, tipo),
          areasApi.getAll().catch(() => [] as Area[]),
        ]);
        setFormularios(data);
        setAreas(areasData);
      } catch (err) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tipo, isDomainRoot, diretoria]);

  // Extrair opções únicas para os filtros
  const diretorias = useMemo(() => {
    const set = new Set<string>();
    formularios.forEach((f) => {
      if (f.diretoria) set.add(f.diretoria);
    });
    return Array.from(set).sort();
  }, [formularios]);

  const unidades = useMemo(() => {
    const set = new Set<string>();
    const filtered =
      filtroDiretoria !== "__all__"
        ? formularios.filter((f) => f.diretoria === filtroDiretoria)
        : formularios;
    filtered.forEach((f) => {
      if (f.unidade_nome) set.add(f.unidade_nome);
    });
    return Array.from(set).sort();
  }, [formularios, filtroDiretoria]);

  // Aplicar filtros
  const formulariosFiltrados = useMemo(() => {
    const nomeLower = filtroNome.trim().toLowerCase();
    return formularios.filter((f) => {
      if (filtroDiretoria !== "__all__" && f.diretoria !== filtroDiretoria)
        return false;
      if (
        filtroUnidade !== "__all__" &&
        (f.unidade_nome || "") !== filtroUnidade
      )
        return false;
      if (nomeLower) {
        const nome = (f.user_name || f.nome_completo || "").toLowerCase();
        if (!nome.includes(nomeLower)) return false;
      }
      return true;
    });
  }, [formularios, filtroDiretoria, filtroUnidade, filtroNome]);

  const handleDiretoriaChange = (value: string) => {
    setFiltroDiretoria(value);
    setFiltroUnidade("__all__");
  };

  const handleView = async (id: number) => {
    setLoadingId(id);
    try {
      const full = await competenciasGestorApi.getById(id);
      onViewFormulario(full);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await competenciasGestorApi.remove(id);
      setFormularios((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleEdit = async (id: number) => {
    if (!onEditFormulario) return;
    setLoadingId(id);
    try {
      const full = await competenciasGestorApi.getById(id);
      onEditFormulario(full);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingId(null);
    }
  };

  const handleOpenVersoes = async (f: FormularioCompetencias) => {
    setVersaoDialogFormulario(f);
    setVersoes([]);
    setLoadingVersoes(true);
    try {
      const data = await competenciasGestorApi.getVersoes(f.id);
      setVersoes(data);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingVersoes(false);
    }
  };

  const handlePdfVersao = async (formularioId: number, versao: number) => {
    setLoadingPdfVersao(versao);
    try {
      const snapshot = await competenciasGestorApi.getVersaoDados(
        formularioId,
        versao,
      );
      await generateCompetenciasPDF(snapshot);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingPdfVersao(null);
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
          <p className="text-gray-500 text-lg">Nenhum formulário enviado</p>
          <p className="text-gray-400 text-sm mt-2">
            Os formulários de competências enviados pelos gestores aparecerão
            aqui.
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
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome..."
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="w-[200px] h-9"
              />
            </div>
            {isDomainRoot && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Diretoria:</span>
                <Select
                  value={filtroDiretoria}
                  onValueChange={handleDiretoriaChange}
                >
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {diretorias.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
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
                  {unidades.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border border-gray-200 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Diretoria</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Competências</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Versão</TableHead>
              <TableHead>Data de envio</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formulariosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-gray-400 py-8"
                >
                  Nenhum resultado para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              formulariosFiltrados.map((f) => {
                const labels =
                  f.tipo === "gestor" ? statusLabelsGestor : statusLabelsEquipe;
                // Formulário recusado por validador → status especial (mesmo voltando para 'enviado')
                const foiRecusado = f.status === "enviado" && !!f.recusado_em;
                const st = foiRecusado
                  ? {
                      label: "Recusado — preencher novamente",
                      color: "bg-red-100 text-red-700",
                    }
                  : labels[f.status] || {
                      label: f.status,
                      color: "bg-gray-100 text-gray-700",
                    };
                const versaoNum =
                  f.versao_formulario && f.versao_formulario > 0
                    ? f.versao_formulario
                    : 0;
                // When re-editing after a validated cycle, versaoNum shows the last completed version
                // and the next validation will increment it. Show "v1 (editando)" while in progress.
                const isReEditando =
                  versaoNum > 0 && f.status !== "validado_final";
                const versaoLabel =
                  versaoNum > 0
                    ? isReEditando
                      ? `v${versaoNum} →`
                      : `v${versaoNum}`
                    : "-";
                return (
                  <TableRow key={f.id}>
                    <TableCell>{f.diretoria || "-"}</TableCell>
                    <TableCell>{f.unidade_nome || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {f.total_competencias || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={st.color}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`text-sm font-mono ${versaoNum > 0 ? (isReEditando ? "text-amber-600 font-semibold" : "text-emerald-700 font-semibold") : "text-gray-400"}`}
                        title={
                          isReEditando
                            ? `Última versão validada: v${versaoNum}. Aguardando nova validação completa.`
                            : undefined
                        }
                      >
                        {versaoLabel}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(f.created_at)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onEditFormulario &&
                        canUserEdit(
                          f,
                          user?.email || "",
                          user?.id ? Number(user.id) : undefined,
                          areas,
                        ) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(f.id)}
                            disabled={loadingId === f.id}
                            title="Editar formulário"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : onEditFormulario &&
                          (f.status === "validado_diretoria" ||
                            f.status === "validado_final") ? (
                          <Lock
                            className="h-4 w-4 text-gray-300"
                            title={
                              f.status === "validado_final"
                                ? "Validado"
                                : "Em validação final"
                            }
                          />
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(f.id)}
                          disabled={loadingId === f.id}
                          title="Visualizar formulário"
                        >
                          {loadingId === f.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {versaoNum > 0 && (
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
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Excluir formulário"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Excluir formulário
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o formulário de{" "}
                                  <strong>
                                    {f.user_name || f.nome_completo}
                                  </strong>
                                  ? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(f.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
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
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-lg">
          <span className="text-sm font-medium text-gray-600">
            {formulariosFiltrados.length}{" "}
            {formulariosFiltrados.length === 1 ? "matriz" : "matrizes"}
            {(filtroDiretoria !== "__all__" ||
              filtroUnidade !== "__all__" ||
              filtroNome.trim()) && (
              <span className="ml-1 text-xs text-gray-400">
                (de {formularios.length} total)
              </span>
            )}
          </span>
        </div>
      </Card>

      {/* Dialog: Histórico de versões */}
      <Dialog
        open={!!versaoDialogFormulario}
        onOpenChange={(open) => {
          if (!open) setVersaoDialogFormulario(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Histórico de versões
            </DialogTitle>
          </DialogHeader>
          {versaoDialogFormulario && (
            <p className="text-sm text-gray-500 -mt-2 mb-2">
              {versaoDialogFormulario.user_name ||
                versaoDialogFormulario.nome_completo}
              {versaoDialogFormulario.unidade_nome
                ? ` — ${versaoDialogFormulario.unidade_nome}`
                : ""}
            </p>
          )}
          {loadingVersoes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : versoes.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">
              Nenhuma versão encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {versoes.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <span className="font-semibold text-emerald-700 font-mono">
                      v{v.versao}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Validado em{" "}
                      {new Date(v.validado_final_em).toLocaleDateString(
                        "pt-BR",
                      )}
                      {v.validado_final_nome
                        ? ` por ${v.validado_final_nome}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      versaoDialogFormulario &&
                      handlePdfVersao(versaoDialogFormulario.id, v.versao)
                    }
                    disabled={loadingPdfVersao === v.versao}
                    title={`Gerar PDF da versão ${v.versao}`}
                    className="gap-1.5"
                  >
                    {loadingPdfVersao === v.versao ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
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
