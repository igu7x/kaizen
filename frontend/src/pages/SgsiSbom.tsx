import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Boxes,
  Plus,
  Trash2,
  AlertTriangle,
  PackagePlus,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  sgsiApi,
  SgsiSbomSistema,
  SgsiSbomDetalhe,
} from "@/services/sgsiApi";

const CRIT_CLS: Record<string, string> = {
  ALTA: "bg-red-50 text-red-700",
  MEDIA: "bg-amber-50 text-amber-700",
  BAIXA: "bg-slate-100 text-slate-600",
};

function fmtData(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { dateStyle: "short" });
}

function eolVencido(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(`${iso}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

export default function SgsiSbom() {
  const [sistemas, setSistemas] = useState<SgsiSbomSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() {
    setLoading(true);
    sgsiApi
      .getSbomSistemas()
      .then(setSistemas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  async function remover(s: SgsiSbomSistema) {
    if (!window.confirm(`Remover o SBOM de "${s.sistema}"?`)) return;
    try {
      await sgsiApi.removerSbomSistema(s.id);
      setSistemas((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("SBOM removido.");
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
                label: "Gestão de Riscos e Compliance",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "SBOM" },
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
                Gestão de Riscos e Compliance
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Boxes className="h-6 w-6 text-blue-600" />
                SBOM — Cadeia de Suprimentos
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Inventário de componentes de software por sistema: licença,
                procedência e fim de vida (EOL).
              </p>
            </div>
            <Button size="sm" onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo sistema
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando…
              </div>
            ) : sistemas.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Nenhum sistema inventariado. Cadastre o primeiro em “Novo sistema”.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sistemas.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60"
                  >
                    <button
                      onClick={() => setSel(s.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                        {s.sistema}
                        {s.versao && (
                          <span className="font-mono text-xs text-slate-400">
                            {s.versao}
                          </span>
                        )}
                        {s.origem === "DEMONSTRACAO" && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                            DEMO
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {s.fornecedor || "—"}
                        {s.instrumento_sigla ? ` · ${s.instrumento_sigla}` : ""}
                      </p>
                    </button>
                    {s.criticidade && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          CRIT_CLS[s.criticidade],
                        )}
                      >
                        {s.criticidade}
                      </span>
                    )}
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {s.componentes} comp.
                    </span>
                    {s.eol_vencidos > 0 && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        {s.eol_vencidos} EOL
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-red-500 hover:text-red-600"
                      onClick={() => remover(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {sel && (
        <SbomDetalheDialog
          id={sel}
          onClose={() => setSel(null)}
          onMudou={carregar}
        />
      )}
      {novo && (
        <NovoSistemaDialog
          onClose={() => setNovo(false)}
          onCriado={() => {
            setNovo(false);
            carregar();
          }}
        />
      )}
    </Layout>
  );
}

function SbomDetalheDialog({
  id,
  onClose,
  onMudou,
}: {
  id: string;
  onClose: () => void;
  onMudou: () => void;
}) {
  const [det, setDet] = useState<SgsiSbomDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  async function recarregar() {
    setCarregando(true);
    try {
      setDet(await sgsiApi.getSbomSistema(id));
    } catch {
      /* apiClient */
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function removerComp(compId: number) {
    try {
      await sgsiApi.removerComponenteSbom(compId);
      await recarregar();
      onMudou();
    } catch {
      /* apiClient */
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex min-w-0 items-center gap-2 pr-8">
            <Boxes className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="min-w-0 truncate">
              {det?.sistema || "Sistema"}
              {det?.versao ? ` ${det.versao}` : ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        {carregando || !det ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <Info rot="Fornecedor" val={det.fornecedor} />
              <Info rot="Tipo" val={det.tipo} />
              <Info rot="Criticidade" val={det.criticidade} />
              <Info rot="Formato" val={det.formato} />
              <Info rot="Instrumento" val={det.instrumento_sigla} />
              <Info rot="Referência" val={fmtData(det.data_referencia)} />
            </div>
            {det.observacoes && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {det.observacoes}
              </p>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Componentes ({det.componentes.length})
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setAddOpen(true)}
                >
                  <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
                  Adicionar
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">Componente</th>
                      <th className="px-3 py-2 font-semibold">Licença</th>
                      <th className="px-3 py-2 font-semibold">Procedência</th>
                      <th className="px-3 py-2 font-semibold">EOL</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {det.componentes.map((c) => (
                      <tr key={c.id} className="align-top">
                        <td className="px-3 py-2">
                          <p className="text-slate-700">
                            {c.nome}
                            {c.versao ? (
                              <span className="ml-1 font-mono text-xs text-slate-400">
                                {c.versao}
                              </span>
                            ) : null}
                          </p>
                          {c.purl && (
                            <span className="font-mono text-[10px] text-slate-400">
                              {c.purl}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {c.licenca || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {c.procedencia || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {c.eol_data ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                eolVencido(c.eol_data)
                                  ? "bg-red-50 text-red-600"
                                  : "bg-slate-100 text-slate-500",
                              )}
                            >
                              {fmtData(c.eol_data)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => removerComp(c.id)}
                            className="text-slate-400 hover:text-red-600"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {det.componentes.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-slate-400"
                        >
                          Nenhum componente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {addOpen && det && (
          <NovoComponenteDialog
            sistemaId={det.id}
            onClose={() => setAddOpen(false)}
            onAdicionado={(d) => {
              setDet(d);
              setAddOpen(false);
              onMudou();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ rot, val }: { rot: string; val: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {rot}
      </p>
      <p className="text-slate-700">{val || "—"}</p>
    </div>
  );
}

function NovoSistemaDialog({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: () => void;
}) {
  const [form, setForm] = useState({
    sistema: "",
    versao: "",
    fornecedor: "",
    tipo: "",
    criticidade: "MEDIA",
    data_referencia: "",
    observacoes: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.sistema.trim()) {
      setErro("Informe o nome do sistema.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await sgsiApi.criarSbomSistema({
        sistema: form.sistema.trim(),
        versao: form.versao.trim() || null,
        fornecedor: form.fornecedor.trim() || null,
        tipo: form.tipo.trim() || null,
        criticidade: form.criticidade,
        data_referencia: form.data_referencia || null,
        observacoes: form.observacoes.trim() || null,
      });
      toast.success("Sistema cadastrado.");
      onCriado();
    } catch {
      setErro("Não foi possível cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle>Novo sistema (SBOM)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Campo label="Sistema *">
            <Input
              value={form.sistema}
              onChange={(e) => setForm((f) => ({ ...f, sistema: e.target.value }))}
              className="mt-1 h-10"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Versão">
              <Input
                value={form.versao}
                onChange={(e) => setForm((f) => ({ ...f, versao: e.target.value }))}
                className="mt-1 h-10"
              />
            </Campo>
            <Campo label="Criticidade">
              <Select
                value={form.criticidade}
                onValueChange={(v) => setForm((f) => ({ ...f, criticidade: v }))}
              >
                <SelectTrigger className="mt-1 h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALTA">ALTA</SelectItem>
                  <SelectItem value="MEDIA">MEDIA</SelectItem>
                  <SelectItem value="BAIXA">BAIXA</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Fornecedor">
              <Input
                value={form.fornecedor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fornecedor: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
            <Campo label="Tipo">
              <Input
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                placeholder="Aplicação web, Serviço REST…"
                className="mt-1 h-10"
              />
            </Campo>
          </div>
          <Campo label="Data de referência">
            <Input
              type="date"
              value={form.data_referencia}
              onChange={(e) =>
                setForm((f) => ({ ...f, data_referencia: e.target.value }))
              }
              className="mt-1 h-10"
            />
          </Campo>
          <Campo label="Observações">
            <textarea
              value={form.observacoes}
              onChange={(e) =>
                setForm((f) => ({ ...f, observacoes: e.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Campo>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoComponenteDialog({
  sistemaId,
  onClose,
  onAdicionado,
}: {
  sistemaId: string;
  onClose: () => void;
  onAdicionado: (d: SgsiSbomDetalhe) => void;
}) {
  const [form, setForm] = useState({
    nome: "",
    versao: "",
    fornecedor: "",
    licenca: "",
    tipo: "",
    procedencia: "código aberto",
    purl: "",
    eol_data: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do componente.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const d = await sgsiApi.adicionarComponenteSbom(sistemaId, {
        nome: form.nome.trim(),
        versao: form.versao.trim() || null,
        fornecedor: form.fornecedor.trim() || null,
        licenca: form.licenca.trim() || null,
        tipo: form.tipo.trim() || null,
        procedencia: form.procedencia,
        purl: form.purl.trim() || null,
        eol_data: form.eol_data || null,
      });
      onAdicionado(d);
    } catch {
      setErro("Não foi possível adicionar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle>Adicionar componente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome *">
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="mt-1 h-10"
              />
            </Campo>
            <Campo label="Versão">
              <Input
                value={form.versao}
                onChange={(e) => setForm((f) => ({ ...f, versao: e.target.value }))}
                className="mt-1 h-10"
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Licença">
              <Input
                value={form.licenca}
                onChange={(e) =>
                  setForm((f) => ({ ...f, licenca: e.target.value }))
                }
                placeholder="MIT, BSD-2-Clause…"
                className="mt-1 h-10"
              />
            </Campo>
            <Campo label="Procedência">
              <Select
                value={form.procedencia}
                onValueChange={(v) => setForm((f) => ({ ...f, procedencia: v }))}
              >
                <SelectTrigger className="mt-1 h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno">interno</SelectItem>
                  <SelectItem value="terceiro">terceiro</SelectItem>
                  <SelectItem value="código aberto">código aberto</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Fornecedor">
              <Input
                value={form.fornecedor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fornecedor: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
            <Campo label="Fim de vida (EOL)">
              <Input
                type="date"
                value={form.eol_data}
                onChange={(e) =>
                  setForm((f) => ({ ...f, eol_data: e.target.value }))
                }
                className="mt-1 h-10"
              />
            </Campo>
          </div>
          <Campo label="purl">
            <Input
              value={form.purl}
              onChange={(e) => setForm((f) => ({ ...f, purl: e.target.value }))}
              placeholder="pkg:npm/express@4.21.2"
              className="mt-1 h-10 font-mono text-sm"
            />
          </Campo>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
