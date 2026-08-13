import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ShieldAlert, Search } from "lucide-react";
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
import {
  sgsiApi,
  SgsiRisco,
  SgsiRiscoStatus,
  SgsiInstrumento,
} from "@/services/sgsiApi";

const SEM_INSTR = "__none__";

const STATUS: Record<SgsiRiscoStatus, { label: string; cls: string }> = {
  IDENTIFICADO: { label: "Identificado", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  EM_ANALISE: { label: "Em análise", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  EM_TRATAMENTO: { label: "Em tratamento", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  MITIGADO: { label: "Mitigado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  ACEITO: { label: "Aceito", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
};
const STATUS_ORDEM: SgsiRiscoStatus[] = [
  "IDENTIFICADO",
  "EM_ANALISE",
  "EM_TRATAMENTO",
  "MITIGADO",
  "ACEITO",
];

function nivel(irs: number): { label: string; dot: string; badge: string } {
  if (irs >= 81)
    return { label: "Crítico", dot: "bg-red-500", badge: "bg-red-100 text-red-700" };
  if (irs >= 45)
    return { label: "Alto", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700" };
  if (irs >= 21)
    return { label: "Moderado", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" };
  return { label: "Baixo", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" };
}

const ESCALA = [1, 2, 3, 4, 5];

type Form = Record<string, string>;
const VAZIO: Form = {
  titulo: "",
  instrumento_codigo: SEM_INSTR,
  status: "IDENTIFICADO",
  ativo_informacao: "",
  ameaca: "",
  vulnerabilidade: "",
  dono: "",
  probabilidade: "3",
  severidade: "3",
  relevancia: "3",
  probabilidade_residual: "",
  severidade_residual: "",
  controles: "",
  plano_descricao: "",
  plano_responsavel: "",
  plano_prazo: "",
  plano_status: "NAO_INICIADO",
};

export default function SgsiRiscos() {
  const [riscos, setRiscos] = useState<SgsiRisco[]>([]);
  const [instrumentos, setInstrumentos] = useState<SgsiInstrumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<SgsiRisco | null>(null);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<SgsiRisco | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setRiscos(await sgsiApi.listarRiscos());
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    sgsiApi
      .listarInstrumentos()
      .then(setInstrumentos)
      .catch(() => setInstrumentos([]));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return riscos;
    return riscos.filter((r) =>
      [r.titulo, r.dono, r.ameaca, r.instrumento_sigla].some((c) =>
        (c || "").toLowerCase().includes(q),
      ),
    );
  }, [riscos, busca]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditando(null);
    setForm(VAZIO);
    setDialogOpen(true);
  };

  const abrirEdicao = (r: SgsiRisco) => {
    setEditando(r);
    setForm({
      titulo: r.titulo,
      instrumento_codigo: r.instrumento_codigo ?? SEM_INSTR,
      status: r.status,
      ativo_informacao: r.ativo_informacao ?? "",
      ameaca: r.ameaca ?? "",
      vulnerabilidade: r.vulnerabilidade ?? "",
      dono: r.dono ?? "",
      probabilidade: String(r.probabilidade),
      severidade: String(r.severidade),
      relevancia: String(r.relevancia),
      probabilidade_residual: r.probabilidade_residual != null ? String(r.probabilidade_residual) : "",
      severidade_residual: r.severidade_residual != null ? String(r.severidade_residual) : "",
      controles: r.controles ?? "",
      plano_descricao: r.plano_descricao ?? "",
      plano_responsavel: r.plano_responsavel ?? "",
      plano_prazo: r.plano_prazo ?? "",
      plano_status: r.plano_status ?? "NAO_INICIADO",
    });
    setDialogOpen(true);
  };

  // Preview do IRS enquanto edita.
  const preview = useMemo(() => {
    const p = Number(form.probabilidade) || 0;
    const s = Number(form.severidade) || 0;
    const r = Number(form.relevancia) || 0;
    const pr = form.probabilidade_residual ? Number(form.probabilidade_residual) : p;
    const sr = form.severidade_residual ? Number(form.severidade_residual) : s;
    return { inerente: p * s * r, residual: pr * sr * r };
  }, [form]);

  const salvar = async () => {
    if (!form.titulo.trim()) {
      toast.error("Informe o título do risco.");
      return;
    }
    const input = {
      titulo: form.titulo.trim(),
      instrumento_codigo:
        form.instrumento_codigo === SEM_INSTR ? null : form.instrumento_codigo,
      status: form.status as SgsiRiscoStatus,
      ativo_informacao: form.ativo_informacao,
      ameaca: form.ameaca,
      vulnerabilidade: form.vulnerabilidade,
      dono: form.dono,
      probabilidade: Number(form.probabilidade),
      severidade: Number(form.severidade),
      relevancia: Number(form.relevancia),
      probabilidade_residual: form.probabilidade_residual
        ? Number(form.probabilidade_residual)
        : null,
      severidade_residual: form.severidade_residual
        ? Number(form.severidade_residual)
        : null,
      controles: form.controles,
      plano_descricao: form.plano_descricao,
      plano_responsavel: form.plano_responsavel,
      plano_prazo: form.plano_prazo || null,
      plano_status: form.plano_status as never,
    };
    setSalvando(true);
    try {
      if (editando) {
        await sgsiApi.atualizarRisco(editando.id, input);
        toast.success("Risco atualizado.");
      } else {
        await sgsiApi.criarRisco(input);
        toast.success("Risco cadastrado.");
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
      await sgsiApi.removerRisco(excluir.id);
      toast.success("Risco excluído.");
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
              {
                label: "Gestão de Riscos e Compliance",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Riscos" },
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
                  Gestão de Riscos e Compliance
                </p>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                  <ShieldAlert className="h-6 w-6 text-blue-600" />
                  Registro de Riscos
                </h1>
                <p className="text-slate-500 mt-1 text-sm">
                  IRS = probabilidade × severidade × relevância (1–125). O nível
                  usa os valores residuais quando informados.
                </p>
              </div>
            </div>
            <Button
              onClick={abrirNovo}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo risco
            </Button>
          </div>

          {/* Busca */}
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, dono, ameaça…"
              className="pl-9"
            />
          </div>

          {/* Lista */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_110px_110px_120px_130px_80px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Risco</span>
              <span>Instrumento</span>
              <span className="text-center">IRS</span>
              <span className="text-center">Nível</span>
              <span className="text-center">Status</span>
              <span className="text-center">Ações</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando riscos…
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <ShieldAlert className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm">
                  {riscos.length === 0
                    ? 'Nenhum risco registrado. Clique em "Novo risco".'
                    : "Nenhum risco para a busca."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtrados.map((r) => {
                  const n = nivel(r.irs_residual);
                  const st = STATUS[r.status] ?? STATUS.IDENTIFICADO;
                  return (
                    <li
                      key={r.id}
                      className="grid grid-cols-[1fr_110px_110px_120px_130px_80px] items-center gap-3 px-4 py-3 hover:bg-slate-50/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-800">
                          {r.titulo}
                        </p>
                        {r.dono && (
                          <p className="text-[11px] text-slate-400">
                            dono: {r.dono}
                          </p>
                        )}
                      </div>
                      <span className="truncate text-sm text-slate-600">
                        {r.instrumento_sigla || "—"}
                      </span>
                      <span className="text-center text-sm tabular-nums text-slate-700">
                        {r.irs_residual}
                        {r.irs_residual !== r.irs_inerente && (
                          <span className="text-slate-400"> / {r.irs_inerente}</span>
                        )}
                      </span>
                      <div className="flex justify-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            n.badge,
                          )}
                        >
                          <span className={cn("h-2 w-2 rounded-full", n.dot)} />
                          {n.label}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                            st.cls,
                          )}
                        >
                          {st.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => abrirEdicao(r)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => setExcluir(r)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {filtrados.length} risco{filtrados.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Dialog CRUD */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar risco" : "Novo risco"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <Label className="mb-1.5 block">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                placeholder="Ex.: Vazamento de dados por acesso indevido"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div>
                <Label className="mb-1.5 block">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => set("status", v)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDEM.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Ativo de informação</Label>
                <Input
                  value={form.ativo_informacao}
                  onChange={(e) => set("ativo_informacao", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Dono do risco</Label>
                <Input
                  value={form.dono}
                  onChange={(e) => set("dono", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Ameaça</Label>
                <Input
                  value={form.ameaca}
                  onChange={(e) => set("ameaca", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Vulnerabilidade</Label>
                <Input
                  value={form.vulnerabilidade}
                  onChange={(e) => set("vulnerabilidade", e.target.value)}
                />
              </div>
            </div>

            {/* Escalas + IRS */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Avaliação (1 a 5) e IRS
              </p>
              <div className="grid grid-cols-3 gap-3">
                <EscalaSelect label="Probabilidade" value={form.probabilidade} onChange={(v) => set("probabilidade", v)} />
                <EscalaSelect label="Severidade" value={form.severidade} onChange={(v) => set("severidade", v)} />
                <EscalaSelect label="Relevância" value={form.relevancia} onChange={(v) => set("relevancia", v)} />
                <EscalaSelect label="Prob. residual" value={form.probabilidade_residual} onChange={(v) => set("probabilidade_residual", v)} opcional />
                <EscalaSelect label="Sev. residual" value={form.severidade_residual} onChange={(v) => set("severidade_residual", v)} opcional />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="text-slate-600">
                  IRS inerente:{" "}
                  <b className="tabular-nums">{preview.inerente}</b>
                </span>
                <span className="text-slate-600">
                  IRS residual:{" "}
                  <b className="tabular-nums">{preview.residual}</b>
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    nivel(preview.residual).badge,
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      nivel(preview.residual).dot,
                    )}
                  />
                  {nivel(preview.residual).label}
                </span>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">Controles</Label>
              <Textarea
                rows={2}
                value={form.controles}
                onChange={(e) => set("controles", e.target.value)}
                placeholder="Controles existentes / mitigadores."
              />
            </div>

            {/* Plano de ação */}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Plano de ação (opcional)
              </p>
              <div className="space-y-3">
                <Textarea
                  rows={2}
                  value={form.plano_descricao}
                  onChange={(e) => set("plano_descricao", e.target.value)}
                  placeholder="Descrição do tratamento planejado."
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="mb-1.5 block">Responsável</Label>
                    <Input
                      value={form.plano_responsavel}
                      onChange={(e) => set("plano_responsavel", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Prazo</Label>
                    <Input
                      type="date"
                      value={form.plano_prazo}
                      onChange={(e) => set("plano_prazo", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Situação</Label>
                    <Select
                      value={form.plano_status}
                      onValueChange={(v) => set("plano_status", v)}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NAO_INICIADO">Não iniciado</SelectItem>
                        <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                        <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
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

      {/* Excluir */}
      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir risco</AlertDialogTitle>
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

function EscalaSelect({
  label,
  value,
  onChange,
  opcional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcional?: boolean;
}) {
  const NENHUM = "__";
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Select
        value={value === "" ? NENHUM : value}
        onValueChange={(v) => onChange(v === NENHUM ? "" : v)}
      >
        <SelectTrigger className="h-9 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcional && <SelectItem value={NENHUM}>—</SelectItem>}
          {ESCALA.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
