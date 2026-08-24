import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Stamp,
  Search,
  Upload,
  Eye,
  Ban,
  ShieldCheck,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  sgsiApi,
  SgsiEmissao,
  SgsiSerie,
  SgsiInstrumento,
} from "@/services/sgsiApi";

const SEM_INSTR = "__none__";

const CLASSIF: Record<string, { label: string; cls: string }> = {
  PUBLICA: { label: "Pública", cls: "bg-emerald-50 text-emerald-700" },
  INTERNA: { label: "Interna", cls: "bg-slate-100 text-slate-600" },
  RESTRITA: { label: "Restrita", cls: "bg-amber-50 text-amber-700" },
  SIGILOSA_CLASSIFICADA: { label: "Sigilosa", cls: "bg-red-50 text-red-700" },
};
const CLASSIF_ORDEM = ["PUBLICA", "INTERNA", "RESTRITA", "SIGILOSA_CLASSIFICADA"];

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

type Form = Record<string, string>;
const hoje = () => new Date().toISOString().slice(0, 10);
const VAZIO = (): Form => ({
  serie_codigo: "",
  titulo: "",
  tipo: "",
  instrumento_codigo: SEM_INSTR,
  referencia: "",
  autoridade: "",
  proad: "",
  classificacao: "INTERNA",
  data_emissao: hoje(),
  observacoes: "",
});

export default function SgsiEmissoes() {
  const [emissoes, setEmissoes] = useState<SgsiEmissao[]>([]);
  const [series, setSeries] = useState<SgsiSerie[]>([]);
  const [instrumentos, setInstrumentos] = useState<SgsiInstrumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO());
  const [emitindo, setEmitindo] = useState(false);

  const [cancelando, setCancelando] = useState<SgsiEmissao | null>(null);
  const [motivo, setMotivo] = useState("");

  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadId = useRef<number | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setEmissoes(await sgsiApi.listarEmissoes());
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    sgsiApi.listarSeries().then(setSeries).catch(() => setSeries([]));
    sgsiApi.listarInstrumentos().then(setInstrumentos).catch(() => setInstrumentos([]));
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return emissoes;
    return emissoes.filter((e) =>
      [e.numero, e.titulo, e.autoridade, e.serie_nome].some((c) =>
        (c || "").toLowerCase().includes(q),
      ),
    );
  }, [emissoes, busca]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const emitir = async () => {
    if (!form.serie_codigo) return toast.error("Selecione a série.");
    if (!form.titulo.trim()) return toast.error("Informe o título.");
    if (!form.autoridade.trim()) return toast.error("Informe a autoridade.");
    setEmitindo(true);
    try {
      const nova = await sgsiApi.emitir({
        serie_codigo: form.serie_codigo,
        titulo: form.titulo.trim(),
        tipo: form.tipo || null,
        instrumento_codigo:
          form.instrumento_codigo === SEM_INSTR ? null : form.instrumento_codigo,
        referencia: form.referencia || null,
        autoridade: form.autoridade.trim(),
        proad: form.proad || null,
        classificacao: form.classificacao,
        data_emissao: form.data_emissao || null,
        observacoes: form.observacoes || null,
      });
      setDialogOpen(false);
      toast.success(`Emitido: ${nova.numero}`);
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setEmitindo(false);
    }
  };

  const escolherArquivo = (id: number) => {
    uploadId.current = id;
    uploadRef.current?.click();
  };

  const onArquivo = (file?: File) => {
    const id = uploadId.current;
    if (!file || id == null) return;
    if (file.type !== "application/pdf") return toast.error("A digitalização deve ser PDF.");
    if (file.size > 8 * 1024 * 1024) return toast.error("O arquivo deve ter até 8 MB.");
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(id);
      try {
        const upd = await sgsiApi.anexarDigitalizacao(id, {
          nome: file.name,
          mime: file.type,
          conteudo: String(reader.result),
        });
        setEmissoes((prev) => prev.map((e) => (e.id === id ? upd : e)));
        toast.success("Digitalização anexada.");
      } catch {
        /* erro tratado no apiClient */
      } finally {
        setBusy(null);
      }
    };
    reader.onerror = () => toast.error("Não foi possível ler o arquivo.");
    reader.readAsDataURL(file);
  };

  const verPdf = async (id: number) => {
    setBusy(id);
    try {
      const a = await sgsiApi.getDigitalizacao(id);
      const resp = await fetch(a.conteudo_base64);
      const blob = await resp.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      toast.error("Não foi possível abrir o PDF.");
    } finally {
      setBusy(null);
    }
  };

  const confirmarCancelamento = async () => {
    if (!cancelando) return;
    if (!motivo.trim()) return toast.error("Informe o motivo.");
    try {
      const upd = await sgsiApi.cancelarEmissao(cancelando.id, motivo.trim());
      setEmissoes((prev) => prev.map((e) => (e.id === upd.id ? upd : e)));
      setCancelando(null);
      setMotivo("");
      toast.success("Emissão cancelada.");
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
              {
                label: "Sistema de Gestão da Segurança da Informação",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Emissões" },
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
                  <Stamp className="h-6 w-6 text-blue-600" />
                  Livro de Emissões
                </h1>
                <p className="text-slate-500 mt-1 text-sm">
                  Numeração oficial por série ({series.length} séries) com
                  digitalização e hash de custódia. O número não retorna à
                  sequência.
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                setForm(VAZIO());
                setDialogOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Emitir documento
            </Button>
          </div>

          {/* Busca */}
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número, título, autoridade…"
              className="pl-9"
            />
          </div>

          {/* Lista */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[140px_1fr_120px_100px_90px_150px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Número</span>
              <span>Título</span>
              <span>Classificação</span>
              <span className="text-center">Data</span>
              <span className="text-center">Status</span>
              <span className="text-center">Digitalização</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando emissões…
              </div>
            ) : filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <Stamp className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm">
                  {emissoes.length === 0
                    ? 'Nenhuma emissão. Clique em "Emitir documento".'
                    : "Nenhuma emissão para a busca."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtradas.map((e) => {
                  const cl = CLASSIF[e.classificacao] ?? CLASSIF.INTERNA;
                  const carregando = busy === e.id;
                  const cancelado = e.status === "CANCELADO";
                  return (
                    <li
                      key={e.id}
                      className="grid grid-cols-[140px_1fr_120px_100px_90px_150px] items-center gap-3 px-4 py-3 hover:bg-slate-50/60"
                    >
                      <span
                        className={cn(
                          "font-mono text-xs font-semibold",
                          cancelado ? "text-slate-400 line-through" : "text-slate-700",
                        )}
                      >
                        {e.numero}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-800">
                          {e.titulo}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {e.serie_nome} · {e.autoridade}
                          {e.instrumento_sigla ? ` · ${e.instrumento_sigla}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          cl.cls,
                        )}
                      >
                        {cl.label}
                      </span>
                      <span className="text-center text-sm tabular-nums text-slate-600">
                        {fmtData(e.data_emissao)}
                      </span>
                      <div className="flex justify-center">
                        {cancelado ? (
                          <span
                            title={e.cancel_motivo || undefined}
                            className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-200"
                          >
                            Cancelado
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            Emitido
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        {carregando ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : (
                          <>
                            {e.digitalizado ? (
                              <button
                                type="button"
                                title="Ver digitalização"
                                onClick={() => verPdf(e.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-300">
                                sem PDF
                              </span>
                            )}
                            {!cancelado && (
                              <button
                                type="button"
                                title={e.digitalizado ? "Substituir PDF" : "Anexar PDF"}
                                onClick={() => escolherArquivo(e.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                              >
                                <Upload className="h-4 w-4" />
                              </button>
                            )}
                            {!cancelado && (
                              <button
                                type="button"
                                title="Cancelar emissão"
                                onClick={() => setCancelando(e)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {filtradas.length} emiss{filtradas.length === 1 ? "ão" : "ões"}
          </p>
        </div>
      </div>

      {/* Input de upload oculto */}
      <input
        ref={uploadRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(ev) => {
          onArquivo(ev.target.files?.[0]);
          ev.target.value = "";
        }}
      />

      {/* Dialog Emitir */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Emitir documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">
                  Série <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.serie_codigo}
                  onValueChange={(v) => set("serie_codigo", v)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {series
                      .filter((s) => s.ativa)
                      .map((s) => (
                        <SelectItem key={s.codigo} value={s.codigo}>
                          {s.nome} ({s.prefixo})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Classificação</Label>
                <Select
                  value={form.classificacao}
                  onValueChange={(v) => set("classificacao", v)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIF_ORDEM.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CLASSIF[c].label}
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
                placeholder="Ex.: Decreto que institui a POSIC/TJGO"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">
                  Autoridade emissora <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.autoridade}
                  onChange={(e) => set("autoridade", e.target.value)}
                  placeholder="Ex.: Presidência do TJGO"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Data de emissão</Label>
                <Input
                  type="date"
                  value={form.data_emissao}
                  onChange={(e) => set("data_emissao", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Instrumento relacionado</Label>
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
              <div>
                <Label className="mb-1.5 block">PROAD</Label>
                <Input
                  value={form.proad}
                  onChange={(e) => set("proad", e.target.value)}
                  placeholder="Nº do processo administrativo"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Tipo</Label>
                <Input
                  value={form.tipo}
                  onChange={(e) => set("tipo", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Referência</Label>
                <Input
                  value={form.referencia}
                  onChange={(e) => set("referencia", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
              />
            </div>

            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              O número é gerado automaticamente pela série e um hash de custódia é
              registrado.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={emitindo}
            >
              Cancelar
            </Button>
            <Button
              onClick={emitir}
              disabled={emitindo}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {emitindo && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cancelar */}
      <Dialog
        open={!!cancelando}
        onOpenChange={(o) => {
          if (!o) {
            setCancelando(null);
            setMotivo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar emissão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Cancelar{" "}
            <span className="font-mono font-semibold">{cancelando?.numero}</span>?
            O número <b>não</b> retorna à sequência. Informe o motivo:
          </p>
          <Textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo do cancelamento (obrigatório)"
            className="mt-2"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelando(null);
                setMotivo("");
              }}
            >
              Voltar
            </Button>
            <Button
              onClick={confirmarCancelamento}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Cancelar emissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
