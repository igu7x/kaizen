import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Bell,
  BellOff,
  Plus,
  Trash2,
  Check,
  FileText,
  ListChecks,
  AlarmClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  sgsiApi,
  SgsiAlertaDerivado,
  SgsiAlertaRegistrado,
} from "@/services/sgsiApi";

function fmtData(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { dateStyle: "short" });
}

function prazoTexto(dias: number): string {
  if (dias < 0) return `Venceu há ${-dias} dia(s)`;
  if (dias === 0) return "Vence hoje";
  return `Vence em ${dias} dia(s)`;
}

export default function SgsiAlertas() {
  const [derivados, setDerivados] = useState<SgsiAlertaDerivado[]>([]);
  const [registrados, setRegistrados] = useState<SgsiAlertaRegistrado[]>([]);
  const [contador, setContador] = useState(0);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);

  function carregar() {
    setLoading(true);
    sgsiApi
      .getAlertas()
      .then((p) => {
        setDerivados(p.derivados);
        setRegistrados(p.registrados);
        setContador(p.contador);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  async function dispensar(a: SgsiAlertaDerivado) {
    try {
      await sgsiApi.dispensarAlerta(a.chave);
      setDerivados((prev) => prev.filter((x) => x.chave !== a.chave));
      setContador((c) => Math.max(0, c - 1));
      toast.success("Alerta dispensado (reaparece se o prazo mudar).");
    } catch {
      /* apiClient */
    }
  }

  async function toggleLido(a: SgsiAlertaRegistrado) {
    try {
      const upd = await sgsiApi.marcarLidoAlerta(a.id, !a.lido);
      setRegistrados((prev) => prev.map((x) => (x.id === a.id ? upd : x)));
      setContador((c) => c + (a.lido ? 1 : -1));
    } catch {
      /* apiClient */
    }
  }

  async function remover(a: SgsiAlertaRegistrado) {
    try {
      await sgsiApi.removerAlerta(a.id);
      setRegistrados((prev) => prev.filter((x) => x.id !== a.id));
      if (!a.lido) setContador((c) => Math.max(0, c - 1));
      toast.success("Alerta removido.");
    } catch {
      /* apiClient */
    }
  }

  const vencidos = derivados.filter((a) => a.gravidade === "VENCIDO").length;

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Segurança da Informação",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Alertas" },
            ]}
          />

          <div className="mt-4 mb-6 flex items-center gap-4">
            <div
              className="w-1.5 h-12 rounded-full"
              style={{
                background: "linear-gradient(180deg, #0A2547 0%, #1565C0 100%)",
              }}
            />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">
                Segurança da Informação
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Bell className="h-6 w-6 text-blue-600" />
                Alertas
                {contador > 0 && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                    {contador}
                  </span>
                )}
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Derivados dos prazos (não persistidos) + registrados. Dispensar um
                derivado o silencia só até o prazo mudar.
              </p>
            </div>
            <Button size="sm" onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo alerta
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando…
            </div>
          ) : (
            <div className="space-y-6">
              {/* DERIVADOS */}
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <AlarmClock className="h-4 w-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-700">
                    Derivados de prazos ({derivados.length})
                  </h2>
                  {vencidos > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                      {vencidos} vencido(s)
                    </span>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {derivados.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">
                      Nenhum prazo dentro da janela de alerta.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 max-h-[26rem] overflow-auto">
                      {derivados.map((a) => (
                        <li
                          key={a.chave}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60"
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                              a.tipo === "DOCUMENTO"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-violet-50 text-violet-600",
                            )}
                          >
                            {a.tipo === "DOCUMENTO" ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <ListChecks className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-800">
                              {a.titulo}
                            </p>
                            <p className="text-xs text-slate-400">
                              {a.instrumento ? `${a.instrumento} · ` : ""}
                              limite {fmtData(a.data_limite)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              a.gravidade === "VENCIDO"
                                ? "bg-red-50 text-red-600"
                                : "bg-amber-50 text-amber-700",
                            )}
                          >
                            {prazoTexto(a.dias)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => dispensar(a)}
                            title="Dispensar"
                          >
                            <BellOff className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* REGISTRADOS */}
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-700">
                    Registrados ({registrados.length})
                  </h2>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {registrados.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">
                      Nenhum alerta registrado.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {registrados.map((a) => (
                        <li
                          key={a.id}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3",
                            a.lido ? "bg-slate-50/40" : "hover:bg-slate-50/60",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "truncate text-sm",
                                a.lido
                                  ? "text-slate-400"
                                  : "font-medium text-slate-800",
                              )}
                            >
                              {a.titulo}
                            </p>
                            <p className="text-xs text-slate-400">
                              {a.instrumento_sigla ? `${a.instrumento_sigla} · ` : ""}
                              {a.data_referencia
                                ? `ref. ${fmtData(a.data_referencia)} · `
                                : ""}
                              {a.origem === "API" ? "via API" : "manual"}
                            </p>
                            {a.descricao && (
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {a.descricao}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => toggleLido(a)}
                            title={a.lido ? "Marcar não lido" : "Marcar lido"}
                          >
                            <Check
                              className={cn(
                                "h-3.5 w-3.5",
                                a.lido ? "text-emerald-600" : "text-slate-400",
                              )}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-red-500 hover:text-red-600"
                            onClick={() => remover(a)}
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {novo && (
        <NovoAlertaDialog
          onClose={() => setNovo(false)}
          onCriado={(a) => {
            setRegistrados((prev) => [a, ...prev]);
            setContador((c) => c + 1);
            setNovo(false);
          }}
        />
      )}
    </Layout>
  );
}

function NovoAlertaDialog({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (a: SgsiAlertaRegistrado) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataRef, setDataRef] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!titulo.trim()) {
      setErro("Informe o título.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const a = await sgsiApi.criarAlerta({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_referencia: dataRef || null,
      });
      toast.success("Alerta criado.");
      onCriado(a);
    } catch {
      setErro("Não foi possível criar o alerta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Novo alerta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Título *</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Data de referência
            </label>
            <Input
              type="date"
              value={dataRef}
              onChange={(e) => setDataRef(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
