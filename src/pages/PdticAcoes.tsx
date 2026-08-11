import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ClipboardList, Search } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  pdticAcoesApi,
  PdticAcao,
  PdticAcaoInput,
} from "@/services/pdticAcoesApi";
import { areasApi, Area } from "@/services/areasApi";

const VAZIO: PdticAcaoInput = {
  nome: "",
  id_pdtic: "",
  diretoria: "",
  area_responsavel: "",
  conclusao: "",
  necessidade_identificada: "",
  resultado: "",
  reagendada: "",
  classe: "",
  indicador: "",
  objetivos_enticjud: "",
  macrodesafios_tjgo: "",
};

function formatarDataBR(iso?: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default function PdticAcoes() {
  const [acoes, setAcoes] = useState<PdticAcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<PdticAcao | null>(null);
  const [form, setForm] = useState<PdticAcaoInput>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<PdticAcao | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await pdticAcoesApi.list();
      setAcoes(data);
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    areasApi
      .getAll()
      .then(setAreas)
      .catch(() => setAreas([]));
  }, []);

  const siglas = useMemo(
    () =>
      Array.from(
        new Set(areas.map((a) => a.sigla).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [areas],
  );
  const nomesAreas = useMemo(
    () =>
      Array.from(
        new Set(areas.map((a) => a.nome).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [areas],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return acoes;
    return acoes.filter((a) =>
      [a.nome, a.id_pdtic, a.diretoria, a.area_responsavel].some((c) =>
        (c || "").toLowerCase().includes(q),
      ),
    );
  }, [acoes, busca]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(VAZIO);
    setDialogOpen(true);
  };

  const abrirEdicao = (a: PdticAcao) => {
    setEditando(a);
    setForm({
      nome: a.nome ?? "",
      id_pdtic: a.id_pdtic ?? "",
      diretoria: a.diretoria ?? "",
      area_responsavel: a.area_responsavel ?? "",
      conclusao: a.conclusao ?? "",
      necessidade_identificada: a.necessidade_identificada ?? "",
      resultado: a.resultado ?? "",
      reagendada: a.reagendada ?? "",
      classe: a.classe ?? "",
      indicador: a.indicador ?? "",
      objetivos_enticjud: a.objetivos_enticjud ?? "",
      macrodesafios_tjgo: a.macrodesafios_tjgo ?? "",
    });
    setDialogOpen(true);
  };

  const set = (campo: keyof PdticAcaoInput, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const salvar = async () => {
    if (!form.nome?.trim()) {
      toast.error("Informe o nome da ação.");
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await pdticAcoesApi.update(editando.id, form);
        toast.success("Ação atualizada.");
      } else {
        await pdticAcoesApi.create(form);
        toast.success("Ação cadastrada.");
      }
      setDialogOpen(false);
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    try {
      await pdticAcoesApi.remove(excluir.id);
      toast.success("Ação excluída.");
      setExcluir(null);
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    }
  };

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              { label: "Cadastros", to: "/cadastros" },
              { label: "Ações do PDTIC" },
            ]}
          />

          {/* Header */}
          <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
                Administração
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                Ações do PDTIC
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Cadastro das ações do Plano Diretor de TIC que alimentam a tela
                do PDTIC.
              </p>
            </div>
            <Button
              onClick={abrirNovo}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Adicionar
            </Button>
          </div>

          {/* Busca */}
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, ID, diretoria…"
              className="pl-9"
            />
          </div>

          {/* Tabela */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando ações…
              </div>
            ) : filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <ClipboardList className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm">
                  {acoes.length === 0
                    ? "Nenhuma ação cadastrada ainda."
                    : "Nenhuma ação encontrada para a busca."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-24">ID PDTIC</TableHead>
                    <TableHead>Nome da Ação</TableHead>
                    <TableHead className="w-28">Diretoria</TableHead>
                    <TableHead>Área Responsável</TableHead>
                    <TableHead className="w-28 text-center">Conclusão</TableHead>
                    <TableHead className="w-24 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((a) => (
                    <TableRow key={a.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-medium text-slate-700">
                        {a.id_pdtic || "—"}
                      </TableCell>
                      <TableCell className="text-slate-800">{a.nome}</TableCell>
                      <TableCell className="text-slate-700">
                        {a.diretoria || "—"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {a.area_responsavel || "—"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-slate-700 whitespace-nowrap">
                        {formatarDataBR(a.conclusao)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => abrirEdicao(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            onClick={() => setExcluir(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {filtradas.length} açã{filtradas.length === 1 ? "o" : "es"}
          </p>
        </div>
      </div>

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar Ação do PDTIC" : "Nova Ação do PDTIC"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <Label className="mb-1.5 block">
                Nome da ação <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.nome ?? ""}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex.: Aprovar o Plano Diretor de TIC – PDTIC"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">ID do PDTIC</Label>
                <Input
                  value={form.id_pdtic ?? ""}
                  onChange={(e) => set("id_pdtic", e.target.value)}
                  placeholder="Ex.: AC01"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Conclusão</Label>
                <Input
                  value={form.conclusao ?? ""}
                  onChange={(e) => set("conclusao", e.target.value)}
                  placeholder="Ex.: Concluída ou Out/2026"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Diretoria</Label>
                <Input
                  list="pdtic-diretorias"
                  value={form.diretoria ?? ""}
                  onChange={(e) => set("diretoria", e.target.value)}
                  placeholder="Ex.: DITI"
                />
                <datalist id="pdtic-diretorias">
                  {siglas.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label className="mb-1.5 block">Área Responsável</Label>
                <Input
                  list="pdtic-areas"
                  value={form.area_responsavel ?? ""}
                  onChange={(e) => set("area_responsavel", e.target.value)}
                  placeholder="Ex.: Coordenadoria de…"
                />
                <datalist id="pdtic-areas">
                  {nomesAreas.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Detalhes do quadro de ações do PDTIC (todos opcionais) */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Detalhes do quadro de ações (opcional)
              </p>
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Necessidade identificada</Label>
                  <Textarea
                    rows={3}
                    value={form.necessidade_identificada ?? ""}
                    onChange={(e) =>
                      set("necessidade_identificada", e.target.value)
                    }
                    placeholder="Situação que deve ser solucionada com a conclusão da ação."
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Resultado</Label>
                  <Textarea
                    rows={3}
                    value={form.resultado ?? ""}
                    onChange={(e) => set("resultado", e.target.value)}
                    placeholder="Produto ou serviço que será entregue."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">Reagendada</Label>
                    <Input
                      value={form.reagendada ?? ""}
                      onChange={(e) => set("reagendada", e.target.value)}
                      placeholder="Ex.: Não / AG052 2023/25"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Classe</Label>
                    <Input
                      value={form.classe ?? ""}
                      onChange={(e) => set("classe", e.target.value)}
                      placeholder="Ex.: PRIN, SIS, INFRA, SUP"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Indicador</Label>
                    <Input
                      value={form.indicador ?? ""}
                      onChange={(e) => set("indicador", e.target.value)}
                      placeholder="Ex.: KR1, KR2"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Objetivos ENTIC-JUD</Label>
                    <Input
                      value={form.objetivos_enticjud ?? ""}
                      onChange={(e) =>
                        set("objetivos_enticjud", e.target.value)
                      }
                      placeholder="Ex.: ON01, ON05"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block">Macrodesafios TJGO</Label>
                    <Input
                      value={form.macrodesafios_tjgo ?? ""}
                      onChange={(e) =>
                        set("macrodesafios_tjgo", e.target.value)
                      }
                      placeholder="Ex.: MACRO12 e MACRO18"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editando ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <span className="font-semibold">{excluir?.nome}</span>? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
