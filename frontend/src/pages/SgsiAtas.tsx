import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ClipboardList,
  Search,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sgsiApi, SgsiAta, SgsiInstrumento } from "@/services/sgsiApi";

const SEM_INSTR = "__none__";
const hoje = () => new Date().toISOString().slice(0, 10);

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

type Form = Record<string, string>;
const VAZIO = (): Form => ({
  data_reuniao: hoje(),
  titulo: "",
  instrumento_codigo: SEM_INSTR,
  participantes: "",
  pauta: "",
  deliberacoes: "",
  encaminhamentos: "",
  numero_emissao: "",
});

export default function SgsiAtas() {
  const [atas, setAtas] = useState<SgsiAta[]>([]);
  const [instrumentos, setInstrumentos] = useState<SgsiInstrumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<SgsiAta | null>(null);
  const [form, setForm] = useState<Form>(VAZIO());
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<SgsiAta | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setAtas(await sgsiApi.listarAtas());
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    sgsiApi.listarInstrumentos().then(setInstrumentos).catch(() => setInstrumentos([]));
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return atas;
    return atas.filter((a) =>
      [a.titulo, a.participantes, a.instrumento_sigla, a.deliberacoes].some((c) =>
        (c || "").toLowerCase().includes(q),
      ),
    );
  }, [atas, busca]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditando(null);
    setForm(VAZIO());
    setDialogOpen(true);
  };

  const abrirEdicao = (a: SgsiAta) => {
    setEditando(a);
    setForm({
      data_reuniao: (a.data_reuniao || hoje()).slice(0, 10),
      titulo: a.titulo,
      instrumento_codigo: a.instrumento_codigo ?? SEM_INSTR,
      participantes: a.participantes ?? "",
      pauta: a.pauta ?? "",
      deliberacoes: a.deliberacoes ?? "",
      encaminhamentos: a.encaminhamentos ?? "",
      numero_emissao: a.numero_emissao ?? "",
    });
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim()) return toast.error("Informe o título.");
    if (!form.data_reuniao) return toast.error("Informe a data da reunião.");
    const input = {
      data_reuniao: form.data_reuniao,
      titulo: form.titulo.trim(),
      instrumento_codigo:
        form.instrumento_codigo === SEM_INSTR ? null : form.instrumento_codigo,
      participantes: form.participantes || null,
      pauta: form.pauta || null,
      deliberacoes: form.deliberacoes || null,
      encaminhamentos: form.encaminhamentos || null,
      numero_emissao: form.numero_emissao || null,
    };
    setSalvando(true);
    try {
      if (editando) {
        await sgsiApi.atualizarAta(editando.id, input);
        toast.success("Ata atualizada.");
      } else {
        await sgsiApi.criarAta(input);
        toast.success("Ata cadastrada.");
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
      await sgsiApi.removerAta(excluir.id);
      toast.success("Ata excluída.");
      setExcluir(null);
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    }
  };

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Sistema de Gestão da Segurança da Informação",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Atas" },
            ]}
          />

          {/* Header */}
          <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-4">
              <div
                className="w-1.5 h-12 rounded-full"
                style={{
                  background: "linear-gradient(180deg, #0A2547 0%, #1565C0 100%)",
                }}
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">
                  Sistema de Gestão da Segurança da Informação
                </p>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                  <ClipboardList className="h-6 w-6 text-blue-600" />
                  Atas de Reunião
                </h1>
                <p className="text-slate-500 mt-1 text-sm">
                  Deliberações e homologações dos comitês (CGSI, CGovTIC…).
                </p>
              </div>
            </div>
            <Button
              onClick={abrirNovo}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nova ata
            </Button>
          </div>

          {/* Busca */}
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, participantes…"
              className="pl-9"
            />
          </div>

          {/* Lista */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando atas…
              </div>
            ) : filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <ClipboardList className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm">
                  {atas.length === 0
                    ? 'Nenhuma ata registrada. Clique em "Nova ata".'
                    : "Nenhuma ata para a busca."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtradas.map((a) => {
                  const ab = aberta === a.id;
                  return (
                    <li key={a.id}>
                      <div
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-expanded={ab}
                        onClick={() =>
                          setAberta((c) => (c === a.id ? null : a.id))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setAberta((c) => (c === a.id ? null : a.id));
                          }
                        }}
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 flex-shrink-0 text-slate-400 transition-transform",
                            ab && "rotate-90",
                          )}
                        />
                        <span className="w-24 flex-shrink-0 text-sm tabular-nums text-slate-600">
                          {fmtData(a.data_reuniao)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-800">
                            {a.titulo}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {a.instrumento_sigla
                              ? `${a.instrumento_sigla} · `
                              : ""}
                            {a.participantes || "sem participantes registrados"}
                          </p>
                        </div>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => abrirEdicao(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            onClick={() => setExcluir(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {ab && (
                        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 pl-11 space-y-3">
                          {(
                            [
                              ["Pauta", a.pauta],
                              ["Deliberações", a.deliberacoes],
                              ["Encaminhamentos", a.encaminhamentos],
                              ["Participantes", a.participantes],
                              ["Nº de emissão", a.numero_emissao],
                            ] as [string, string | null][]
                          )
                            .filter(([, v]) => v && v.trim())
                            .map(([titulo, v]) => (
                              <div key={titulo}>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                                  {titulo}
                                </p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                  {v}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {filtradas.length} ata{filtradas.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Dialog CRUD */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar ata" : "Nova ata"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">
                  Data da reunião <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.data_reuniao}
                  onChange={(e) => set("data_reuniao", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Instrumento</Label>
                <Select
                  value={form.instrumento_codigo}
                  onValueChange={(v) => set("instrumento_codigo", v)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_INSTR}>— Nenhum —</SelectItem>
                    {instrumentos.map((i) => (
                      <SelectItem key={i.codigo} value={i.codigo}>
                        {i.sigla_oficial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                placeholder="Ex.: 1ª reunião ordinária do CGSI de 2026"
              />
            </div>

            <div>
              <Label className="mb-1.5 block">Participantes</Label>
              <Textarea
                rows={2}
                value={form.participantes}
                onChange={(e) => set("participantes", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Pauta</Label>
              <Textarea
                rows={2}
                value={form.pauta}
                onChange={(e) => set("pauta", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Deliberações</Label>
              <Textarea
                rows={3}
                value={form.deliberacoes}
                onChange={(e) => set("deliberacoes", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Encaminhamentos</Label>
              <Textarea
                rows={2}
                value={form.encaminhamentos}
                onChange={(e) => set("encaminhamentos", e.target.value)}
              />
            </div>
            <div className="sm:w-1/2">
              <Label className="mb-1.5 block">Nº de emissão (opcional)</Label>
              <Input
                value={form.numero_emissao}
                onChange={(e) => set("numero_emissao", e.target.value)}
                placeholder="Ex.: ATA-0001/2026"
              />
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

      {/* Excluir */}
      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ata</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <span className="font-semibold">{excluir?.titulo}</span>?
              Esta ação não pode ser desfeita.
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
