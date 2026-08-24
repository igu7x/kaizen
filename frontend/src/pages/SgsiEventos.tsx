import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert, UserMinus, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  SgsiEventoRh,
  SgsiIncidente,
} from "@/services/sgsiApi";

const TIPOS_RH: SgsiEventoRh["tipo"][] = [
  "DESLIGAMENTO",
  "MOVIMENTACAO",
  "AFASTAMENTO",
  "INGRESSO",
];
const SIT_RH: SgsiEventoRh["situacao"][] = ["PENDENTE", "EXECUTADO", "FALHA"];
const SEVERIDADES: SgsiIncidente["severidade"][] = [
  "BAIXA",
  "MEDIA",
  "ALTA",
  "CRITICA",
];
const SIT_INC: SgsiIncidente["situacao"][] = [
  "TRIAGEM",
  "EM_TRATAMENTO",
  "CONTIDO",
  "ENCERRADO",
];

const SEV_CLS: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-600",
  MEDIA: "bg-amber-50 text-amber-700",
  ALTA: "bg-orange-50 text-orange-700",
  CRITICA: "bg-red-50 text-red-700",
};

function fmtDataHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Rótulo do SLA relativo ao prazo, considerando se o item já foi resolvido. */
function slaLabel(
  prazoIso: string,
  resolvido: boolean,
): { texto: string; cls: string } {
  if (resolvido) return { texto: "No prazo / resolvido", cls: "text-emerald-600" };
  const prazo = new Date(prazoIso).getTime();
  const agora = Date.now();
  const diffMin = Math.round((prazo - agora) / 60000);
  if (diffMin < 0) {
    return { texto: `Vencido há ${humano(-diffMin)}`, cls: "text-red-600" };
  }
  if (diffMin <= 60) {
    return { texto: `Vence em ${humano(diffMin)}`, cls: "text-amber-600" };
  }
  return { texto: `Vence em ${humano(diffMin)}`, cls: "text-slate-500" };
}

function humano(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ""}`;
}

/** Converte o input datetime-local para ISO com timezone do navegador. */
function localToIso(v: string): string {
  return v ? new Date(v).toISOString() : "";
}

export default function SgsiEventos() {
  const [tab, setTab] = useState("rh");
  const [eventos, setEventos] = useState<SgsiEventoRh[]>([]);
  const [incidentes, setIncidentes] = useState<SgsiIncidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoRh, setNovoRh] = useState(false);
  const [novoInc, setNovoInc] = useState(false);

  function carregar() {
    setLoading(true);
    Promise.all([sgsiApi.getEventosRh(), sgsiApi.getIncidentes()])
      .then(([e, i]) => {
        setEventos(e);
        setIncidentes(i);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  const pendRh = useMemo(
    () => eventos.filter((e) => e.situacao === "PENDENTE").length,
    [eventos],
  );
  const abertosInc = useMemo(
    () => incidentes.filter((i) => i.situacao !== "ENCERRADO").length,
    [incidentes],
  );

  async function mudarSituacaoRh(e: SgsiEventoRh, situacao: string) {
    try {
      const upd = await sgsiApi.atualizarSituacaoEventoRh(e.id, situacao);
      setEventos((prev) => prev.map((x) => (x.id === e.id ? upd : x)));
      toast.success("Situação atualizada.");
    } catch {
      /* apiClient */
    }
  }

  async function mudarSituacaoInc(i: SgsiIncidente, situacao: string) {
    try {
      const upd = await sgsiApi.atualizarSituacaoIncidente(i.id, situacao);
      setIncidentes((prev) => prev.map((x) => (x.id === i.id ? upd : x)));
      toast.success("Situação atualizada.");
    } catch {
      /* apiClient */
    }
  }

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
              { label: "Eventos e SLA" },
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
                Sistema de Gestão da Segurança da Informação
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Clock className="h-6 w-6 text-blue-600" />
                Eventos institucionais e SLA
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                O SGSI registra o evento e o prazo de ação derivado da norma; a
                execução pertence aos sistemas operacionais (DITI).
              </p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="rh">
                Eventos de RH ({pendRh} pendente{pendRh === 1 ? "" : "s"})
              </TabsTrigger>
              <TabsTrigger value="inc">
                Incidentes ({abertosInc} aberto{abertosInc === 1 ? "" : "s"})
              </TabsTrigger>
            </TabsList>

            {/* ---- EVENTOS DE RH ---- */}
            <TabsContent value="rh" className="mt-4">
              <div className="mb-3 flex justify-end">
                <Button size="sm" onClick={() => setNovoRh(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Registrar evento
                </Button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {loading ? (
                  <Carregando />
                ) : eventos.length === 0 ? (
                  <Vazio texto="Nenhum evento de RH registrado." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr className="text-left">
                          <th className="px-4 py-2.5 font-semibold">Tipo</th>
                          <th className="px-4 py-2.5 font-semibold">Servidor</th>
                          <th className="px-4 py-2.5 font-semibold">Evento</th>
                          <th className="px-4 py-2.5 font-semibold">Prazo (SLA)</th>
                          <th className="px-4 py-2.5 font-semibold">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {eventos.map((e) => {
                          const sla = slaLabel(
                            e.prazo_acao,
                            e.situacao !== "PENDENTE",
                          );
                          return (
                            <tr key={e.id} className="align-top hover:bg-slate-50/60">
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                    e.tipo === "DESLIGAMENTO"
                                      ? "bg-red-50 text-red-700"
                                      : "bg-slate-100 text-slate-600",
                                  )}
                                >
                                  {e.tipo}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-slate-800">
                                  {e.nome || `mat. ${e.matricula}`}
                                </p>
                                <span className="text-xs text-slate-400">
                                  {e.matricula}
                                  {e.unidade ? ` · ${e.unidade}` : ""}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                {fmtDataHora(e.data_evento)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <p className="text-slate-600">
                                  {fmtDataHora(e.prazo_acao)}
                                </p>
                                <span className={cn("text-xs font-medium", sla.cls)}>
                                  {sla.texto}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <Select
                                  value={e.situacao}
                                  onValueChange={(v) => mudarSituacaoRh(e, v)}
                                >
                                  <SelectTrigger className="h-8 w-36 bg-white text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SIT_RH.map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {s}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ---- INCIDENTES ---- */}
            <TabsContent value="inc" className="mt-4">
              <div className="mb-3 flex justify-end">
                <Button size="sm" onClick={() => setNovoInc(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Registrar incidente
                </Button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {loading ? (
                  <Carregando />
                ) : incidentes.length === 0 ? (
                  <Vazio texto="Nenhum incidente registrado." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr className="text-left">
                          <th className="px-4 py-2.5 font-semibold">Sev.</th>
                          <th className="px-4 py-2.5 font-semibold">Incidente</th>
                          <th className="px-4 py-2.5 font-semibold">Detecção</th>
                          <th className="px-4 py-2.5 font-semibold">
                            Acionamento (SLA)
                          </th>
                          <th className="px-4 py-2.5 font-semibold">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {incidentes.map((i) => {
                          const sla = slaLabel(
                            i.prazo_acionamento,
                            i.situacao === "CONTIDO" ||
                              i.situacao === "ENCERRADO",
                          );
                          return (
                            <tr key={i.id} className="align-top hover:bg-slate-50/60">
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                    SEV_CLS[i.severidade],
                                  )}
                                >
                                  {i.severidade}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-sm">
                                <p className="text-slate-800">{i.titulo}</p>
                                <span className="text-xs text-slate-400">
                                  {i.dados_pessoais ? "Dados pessoais · " : ""}
                                  {i.fornecedor || i.ativos || ""}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                {fmtDataHora(i.detectado_em)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <p className="text-slate-600">
                                  {fmtDataHora(i.prazo_acionamento)}
                                </p>
                                <span className={cn("text-xs font-medium", sla.cls)}>
                                  {sla.texto}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <Select
                                  value={i.situacao}
                                  onValueChange={(v) => mudarSituacaoInc(i, v)}
                                >
                                  <SelectTrigger className="h-8 w-40 bg-white text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SIT_INC.map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {s.replace(/_/g, " ")}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {novoRh && (
        <NovoEventoRhDialog
          onClose={() => setNovoRh(false)}
          onCriado={(e) => {
            setEventos((prev) => [e, ...prev]);
            setNovoRh(false);
          }}
        />
      )}
      {novoInc && (
        <NovoIncidenteDialog
          onClose={() => setNovoInc(false)}
          onCriado={(i) => {
            setIncidentes((prev) => [i, ...prev]);
            setNovoInc(false);
          }}
        />
      )}
    </Layout>
  );
}

function Carregando() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Carregando…
    </div>
  );
}
function Vazio({ texto }: { texto: string }) {
  return <div className="py-16 text-center text-sm text-slate-500">{texto}</div>;
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function NovoEventoRhDialog({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (e: SgsiEventoRh) => void;
}) {
  const [form, setForm] = useState({
    tipo: "DESLIGAMENTO" as SgsiEventoRh["tipo"],
    matricula: "",
    nome: "",
    unidade: "",
    data_evento: "",
    origem: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.matricula.trim() || !form.data_evento) {
      setErro("Matrícula e data do evento são obrigatórias.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const e = await sgsiApi.criarEventoRh({
        tipo: form.tipo,
        matricula: form.matricula.trim(),
        nome: form.nome.trim() || null,
        unidade: form.unidade.trim() || null,
        data_evento: localToIso(form.data_evento),
        origem: form.origem.trim() || null,
      });
      toast.success("Evento registrado.");
      onCriado(e);
    } catch {
      setErro("Não foi possível registrar. Verifique os dados.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-blue-600" />
            Registrar evento de RH
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tipo *">
              <Select
                value={form.tipo}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, tipo: v as SgsiEventoRh["tipo"] }))
                }
              >
                <SelectTrigger className="mt-1 h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_RH.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Matrícula *">
              <Input
                value={form.matricula}
                onChange={(e) =>
                  setForm((f) => ({ ...f, matricula: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
          </div>
          <Campo label="Nome">
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="mt-1 h-10"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Unidade">
              <Input
                value={form.unidade}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unidade: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
            <Campo label="Data/hora do evento *">
              <Input
                type="datetime-local"
                value={form.data_evento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, data_evento: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
          </div>
          <Campo label="Origem">
            <Input
              value={form.origem}
              onChange={(e) =>
                setForm((f) => ({ ...f, origem: e.target.value }))
              }
              placeholder="Ex.: SGRH, ofício…"
              className="mt-1 h-10"
            />
          </Campo>
          <p className="text-[11px] text-slate-400">
            O prazo é derivado da norma: <strong>desligamento +1h</strong>,
            demais tipos +24h.
          </p>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoIncidenteDialog({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (i: SgsiIncidente) => void;
}) {
  const [form, setForm] = useState({
    severidade: "ALTA" as SgsiIncidente["severidade"],
    titulo: "",
    descricao: "",
    ativos: "",
    fornecedor: "",
    dados_pessoais: false,
    detectado_em: "",
    origem: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.titulo.trim() || !form.detectado_em) {
      setErro("Título e data de detecção são obrigatórios.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const i = await sgsiApi.criarIncidente({
        severidade: form.severidade,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        ativos: form.ativos.trim() || null,
        fornecedor: form.fornecedor.trim() || null,
        dados_pessoais: form.dados_pessoais,
        detectado_em: localToIso(form.detectado_em),
        origem: form.origem.trim() || null,
      });
      toast.success("Incidente registrado.");
      onCriado(i);
    } catch {
      setErro("Não foi possível registrar. Verifique os dados.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-blue-600" />
            Registrar incidente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Severidade *">
              <Select
                value={form.severidade}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    severidade: v as SgsiIncidente["severidade"],
                  }))
                }
              >
                <SelectTrigger className="mt-1 h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERIDADES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Data/hora da detecção *">
              <Input
                type="datetime-local"
                value={form.detectado_em}
                onChange={(e) =>
                  setForm((f) => ({ ...f, detectado_em: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
          </div>
          <Campo label="Título *">
            <Input
              value={form.titulo}
              onChange={(e) =>
                setForm((f) => ({ ...f, titulo: e.target.value }))
              }
              className="mt-1 h-10"
            />
          </Campo>
          <Campo label="Descrição">
            <textarea
              value={form.descricao}
              onChange={(e) =>
                setForm((f) => ({ ...f, descricao: e.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Ativos afetados">
              <Input
                value={form.ativos}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ativos: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
            <Campo label="Fornecedor">
              <Input
                value={form.fornecedor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fornecedor: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.dados_pessoais}
              onChange={(e) =>
                setForm((f) => ({ ...f, dados_pessoais: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Envolve dados pessoais (LGPD)
          </label>
          <p className="text-[11px] text-slate-400">
            O prazo de acionamento é derivado da severidade:{" "}
            <strong>ALTA/CRÍTICA +2h</strong>, demais +24h.
          </p>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
