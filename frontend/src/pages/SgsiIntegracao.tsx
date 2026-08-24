import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plug,
  KeyRound,
  Webhook,
  Plus,
  Trash2,
  Copy,
  ShieldCheck,
} from "lucide-react";
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
  SgsiApiEscopo,
  SgsiApiChave,
  SgsiWebhook,
} from "@/services/sgsiApi";

/** Eventos que um webhook pode assinar (derivados da trilha de auditoria). */
const EVENTOS = [
  "DOC_EMITIDO",
  "DOC_ASSINADO",
  "DOC_TRAMITADO",
  "EMISSAO_CANCELADA",
  "INCIDENTE_REGISTRADO",
  "EVENTO_RH_REGISTRADO",
  "ALERTA_REGISTRADO",
  "MEDICAO_REGISTRADA",
  "RELATORIO_EMITIDO",
  "LEITURA_CONFIRMADA",
];

const STATUS_CLS: Record<string, string> = {
  ATIVA: "bg-emerald-50 text-emerald-700",
  SUSPENSA: "bg-amber-50 text-amber-700",
  REVOGADA: "bg-red-50 text-red-600",
};

function fmtData(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { dateStyle: "short" });
}

function csv(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function SgsiIntegracao() {
  const [escopos, setEscopos] = useState<SgsiApiEscopo[]>([]);
  const [chaves, setChaves] = useState<SgsiApiChave[]>([]);
  const [webhooks, setWebhooks] = useState<SgsiWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaChave, setNovaChave] = useState(false);
  const [novoWebhook, setNovoWebhook] = useState(false);
  const [segredo, setSegredo] = useState<{ label: string; valor: string } | null>(
    null,
  );

  function carregar() {
    setLoading(true);
    Promise.all([
      sgsiApi.getEscopos(),
      sgsiApi.getChaves(),
      sgsiApi.getWebhooks(),
    ])
      .then(([e, k, w]) => {
        setEscopos(e);
        setChaves(k);
        setWebhooks(w);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  async function mudarStatusChave(k: SgsiApiChave, status: string) {
    try {
      const upd = await sgsiApi.alterarStatusChave(k.id, status);
      setChaves((prev) => prev.map((x) => (x.id === k.id ? { ...x, ...upd } : x)));
      toast.success("Status atualizado.");
    } catch {
      /* apiClient */
    }
  }

  async function toggleWebhook(w: SgsiWebhook) {
    try {
      const upd = await sgsiApi.alternarWebhook(w.id, !w.ativo);
      setWebhooks((prev) => prev.map((x) => (x.id === w.id ? { ...x, ...upd } : x)));
    } catch {
      /* apiClient */
    }
  }

  async function removerWebhook(w: SgsiWebhook) {
    try {
      await sgsiApi.removerWebhook(w.id);
      setWebhooks((prev) => prev.filter((x) => x.id !== w.id));
      toast.success("Webhook removido.");
    } catch {
      /* apiClient */
    }
  }

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
              { label: "Integração" },
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
                <Plug className="h-6 w-6 text-blue-600" />
                Integração — API e Webhooks
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Credenciais de máquina com escopos e webhooks de saída. O segredo é
                exibido uma única vez na criação.
              </p>
            </div>
          </div>

          <Tabs defaultValue="chaves">
            <TabsList>
              <TabsTrigger value="chaves">
                Chaves de API ({chaves.length})
              </TabsTrigger>
              <TabsTrigger value="webhooks">
                Webhooks ({webhooks.length})
              </TabsTrigger>
            </TabsList>

            {/* CHAVES */}
            <TabsContent value="chaves" className="mt-4">
              <div className="mb-3 flex justify-end">
                <Button size="sm" onClick={() => setNovaChave(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nova chave
                </Button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {loading ? (
                  <Carregando />
                ) : chaves.length === 0 ? (
                  <Vazio texto="Nenhuma chave de API." />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {chaves.map((k) => (
                      <li key={k.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">
                              {k.nome}
                              {k.exige_mtls && (
                                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                  mTLS
                                </span>
                              )}
                            </p>
                            <p className="font-mono text-xs text-slate-400">
                              {k.id}
                              {k.unidade ? ` · ${k.unidade}` : ""} ·{" "}
                              {k.limite_por_min ?? "—"}/min
                              {k.expiracao ? ` · exp. ${fmtData(k.expiracao)}` : ""}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {csv(k.escopos).map((e) => (
                                <span
                                  key={e}
                                  className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-700"
                                >
                                  {e}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                STATUS_CLS[k.status],
                              )}
                            >
                              {k.status}
                            </span>
                            {k.status !== "REVOGADA" && (
                              <Select
                                value=""
                                onValueChange={(v) => mudarStatusChave(k, v)}
                              >
                                <SelectTrigger className="h-7 w-28 bg-white text-xs">
                                  <SelectValue placeholder="Ação" />
                                </SelectTrigger>
                                <SelectContent>
                                  {k.status !== "ATIVA" && (
                                    <SelectItem value="ATIVA">Reativar</SelectItem>
                                  )}
                                  {k.status !== "SUSPENSA" && (
                                    <SelectItem value="SUSPENSA">Suspender</SelectItem>
                                  )}
                                  <SelectItem value="REVOGADA">Revogar</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            {/* WEBHOOKS */}
            <TabsContent value="webhooks" className="mt-4">
              <div className="mb-3 flex justify-end">
                <Button size="sm" onClick={() => setNovoWebhook(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Novo webhook
                </Button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {loading ? (
                  <Carregando />
                ) : webhooks.length === 0 ? (
                  <Vazio texto="Nenhum webhook." />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {webhooks.map((w) => (
                      <li
                        key={w.id}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {w.nome}
                          </p>
                          <p className="truncate font-mono text-xs text-slate-400">
                            {w.url}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {csv(w.eventos).map((e) => (
                              <span
                                key={e}
                                className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] text-violet-700"
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => toggleWebhook(w)}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              w.ativo
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {w.ativo ? "ativo" : "inativo"}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => removerWebhook(w)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {novaChave && (
        <NovaChaveDialog
          escopos={escopos}
          onClose={() => setNovaChave(false)}
          onCriada={(k) => {
            setChaves((prev) => [k, ...prev]);
            setNovaChave(false);
            setSegredo({ label: `Chave ${k.id}`, valor: k.segredo });
          }}
        />
      )}
      {novoWebhook && (
        <NovoWebhookDialog
          onClose={() => setNovoWebhook(false)}
          onCriado={(w) => {
            setWebhooks((prev) => [w, ...prev]);
            setNovoWebhook(false);
            setSegredo({ label: `Webhook ${w.nome}`, valor: w.segredo });
          }}
        />
      )}
      {segredo && (
        <SegredoDialog dados={segredo} onClose={() => setSegredo(null)} />
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

function SegredoDialog({
  dados,
  onClose,
}: {
  dados: { label: string; valor: string };
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Segredo gerado — copie agora
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {dados.label}. Este segredo <strong>não será exibido novamente</strong>
            . Guarde-o em local seguro.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-slate-800">
              {dados.valor}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                navigator.clipboard?.writeText(dados.valor);
                toast.success("Copiado.");
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Entendi, guardei o segredo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaChaveDialog({
  escopos,
  onClose,
  onCriada,
}: {
  escopos: SgsiApiEscopo[];
  onClose: () => void;
  onCriada: (k: import("@/services/sgsiApi").SgsiApiChaveCriada) => void;
}) {
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("");
  const [limite, setLimite] = useState("120");
  const [expiracao, setExpiracao] = useState("");
  const [mtls, setMtls] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function toggle(c: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome.");
      return;
    }
    if (sel.size === 0) {
      setErro("Selecione ao menos um escopo.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const k = await sgsiApi.criarChave({
        nome: nome.trim(),
        unidade: unidade.trim() || null,
        limite_por_min: Number(limite) || 120,
        expiracao: expiracao || null,
        exige_mtls: mtls,
        escopos: Array.from(sel),
      });
      onCriada(k);
    } catch {
      setErro("Não foi possível criar a chave.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600" />
            Nova chave de API
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Nome *</label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Unidade
              </label>
              <Input
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="mt-1 h-10"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Limite/min
              </label>
              <Input
                type="number"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
                className="mt-1 h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Expiração
              </label>
              <Input
                type="date"
                value={expiracao}
                onChange={(e) => setExpiracao(e.target.value)}
                className="mt-1 h-10"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={mtls}
              onChange={(e) => setMtls(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Exige mTLS (obrigatório para escopos restritos)
          </label>
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Escopos ({sel.size})
            </label>
            <div className="mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {escopos.map((e) => (
                <label
                  key={e.codigo}
                  className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={sel.has(e.codigo)}
                    onChange={() => toggle(e.codigo)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {e.codigo}
                    </span>
                    <p className="text-xs text-slate-500">{e.descricao}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Criar chave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoWebhookDialog({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (w: import("@/services/sgsiApi").SgsiWebhookCriado) => void;
}) {
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("https://");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function toggle(c: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  }

  async function salvar() {
    if (!nome.trim() || !url.startsWith("https://") || url.length < 10) {
      setErro("Informe o nome e uma URL https válida.");
      return;
    }
    if (sel.size === 0) {
      setErro("Selecione ao menos um evento.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const w = await sgsiApi.criarWebhook({
        nome: nome.trim(),
        url: url.trim(),
        eventos: Array.from(sel),
      });
      onCriado(w);
    } catch {
      setErro("Não foi possível criar o webhook.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-blue-600" />
            Novo webhook
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Nome *</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">
              URL (https) *
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 h-10 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Eventos ({sel.size})
            </label>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {EVENTOS.map((e) => (
                <label
                  key={e}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={sel.has(e)}
                    onChange={() => toggle(e)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="font-mono text-slate-600">{e}</span>
                </label>
              ))}
            </div>
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Criar webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
