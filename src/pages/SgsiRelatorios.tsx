import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  FileBarChart,
  Search,
  AlertTriangle,
  FilePlus,
  Eye,
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
  SgsiRelatorioCatalogo,
  SgsiRelatorio,
  SgsiRelatorioDetalhe,
  SgsiRelatorioPendencia,
} from "@/services/sgsiApi";

const TODOS = "__todos__";

const CLASSIFICACOES = [
  "PUBLICA",
  "INTERNA",
  "RESTRITA",
  "SIGILOSA_CLASSIFICADA",
] as const;

function fmtData(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { dateStyle: "short" });
}

export default function SgsiRelatorios() {
  const [catalogo, setCatalogo] = useState<SgsiRelatorioCatalogo[]>([]);
  const [emitidos, setEmitidos] = useState<SgsiRelatorio[]>([]);
  const [pendencias, setPendencias] = useState<SgsiRelatorioPendencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("emitidos");

  // Filtros do catálogo
  const [fTipo, setFTipo] = useState<"todos" | "obrig" | "demanda">("todos");
  const [fPeriodo, setFPeriodo] = useState(TODOS);
  const [fInstr, setFInstr] = useState(TODOS);
  const [busca, setBusca] = useState("");

  // Diálogo de emissão
  const [emitindoAberto, setEmitindoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroEmissao, setErroEmissao] = useState<string | null>(null);
  const [form, setForm] = useState({
    catalogo_codigo: "",
    autoridade: "",
    periodo: "",
    destinatario: "",
    classificacao: "INTERNA" as (typeof CLASSIFICACOES)[number],
    observacoes: "",
  });

  // Visualização do retrato
  const [detalhe, setDetalhe] = useState<SgsiRelatorioDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  function carregar() {
    setLoading(true);
    Promise.all([
      sgsiApi.getCatalogoRelatorios(),
      sgsiApi.getRelatoriosEmitidos(),
      sgsiApi.getRelatorioPendencias(),
    ])
      .then(([cat, emi, pen]) => {
        setCatalogo(cat);
        setEmitidos(emi);
        setPendencias(pen);
      })
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  const periodicidades = useMemo(
    () =>
      Array.from(new Set(catalogo.map((c) => c.periodicidade))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [catalogo],
  );
  const instrumentos = useMemo(() => {
    const map = new Map<string, string>();
    catalogo.forEach((c) => {
      if (c.instrumento_codigo)
        map.set(c.instrumento_codigo, c.instrumento_sigla || c.instrumento_codigo);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [catalogo]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return catalogo.filter((c) => {
      if (fTipo === "obrig" && !c.obrigatorio) return false;
      if (fTipo === "demanda" && c.obrigatorio) return false;
      if (fPeriodo !== TODOS && c.periodicidade !== fPeriodo) return false;
      if (fInstr !== TODOS && c.instrumento_codigo !== fInstr) return false;
      if (
        q &&
        ![c.codigo, c.nome, c.destinatario, c.base_normativa].some((x) =>
          (x || "").toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
  }, [catalogo, fTipo, fPeriodo, fInstr, busca]);

  const obrig = catalogo.filter((c) => c.obrigatorio).length;
  const modeloSelecionado = catalogo.find(
    (c) => c.codigo === form.catalogo_codigo,
  );

  function abrirEmissao(codigoPreset?: string) {
    const preset = codigoPreset
      ? catalogo.find((c) => c.codigo === codigoPreset)
      : undefined;
    setForm({
      catalogo_codigo: preset?.codigo ?? "",
      autoridade: "",
      periodo: "",
      destinatario: preset?.destinatario ?? "",
      classificacao: "INTERNA",
      observacoes: "",
    });
    setErroEmissao(null);
    setEmitindoAberto(true);
  }

  async function emitir() {
    if (!form.catalogo_codigo) {
      setErroEmissao("Selecione o modelo de relatório.");
      return;
    }
    if (!form.autoridade.trim()) {
      setErroEmissao("Informe a autoridade emissora.");
      return;
    }
    setSalvando(true);
    setErroEmissao(null);
    try {
      const novo = await sgsiApi.emitirRelatorio({
        catalogo_codigo: form.catalogo_codigo,
        autoridade: form.autoridade.trim(),
        periodo: form.periodo.trim() || null,
        destinatario: form.destinatario.trim() || null,
        classificacao: form.classificacao,
        observacoes: form.observacoes.trim() || null,
      });
      setEmitindoAberto(false);
      setTab("emitidos");
      carregar();
      setDetalhe(novo);
    } catch {
      setErroEmissao(
        "Não foi possível emitir o relatório. Verifique os dados e tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function verDetalhe(id: number) {
    setCarregandoDetalhe(true);
    try {
      const d = await sgsiApi.getRelatorio(id);
      setDetalhe(d);
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Sistema de Gestão da Segurança da Informação",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Relatórios" },
            ]}
          />

          {/* Header */}
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
                <FileBarChart className="h-6 w-6 text-blue-600" />
                Relatórios
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                {emitidos.length} emitido(s) · {catalogo.length} modelos no
                catálogo ({obrig} obrigatórios).
              </p>
            </div>
            <Button onClick={() => abrirEmissao()} disabled={loading}>
              <FilePlus className="h-4 w-4 mr-1.5" />
              Emitir relatório
            </Button>
          </div>

          {/* Pendências (RN-36) */}
          {!loading && pendencias.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-800">
                    {pendencias.length} relatório(s) obrigatório(s) ainda não
                    emitido(s) neste ano
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pendencias.map((p) => (
                      <button
                        key={p.codigo}
                        onClick={() => abrirEmissao(p.codigo)}
                        title={p.nome}
                        className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        {p.codigo} · {p.nome}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="emitidos">
                Emitidos ({emitidos.length})
              </TabsTrigger>
              <TabsTrigger value="catalogo">
                Catálogo ({catalogo.length})
              </TabsTrigger>
            </TabsList>

            {/* ---- EMITIDOS ---- */}
            <TabsContent value="emitidos" className="mt-4">
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando…
                  </div>
                ) : emitidos.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    Nenhum relatório emitido ainda. Use “Emitir relatório”.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr className="text-left">
                          <th className="px-4 py-2.5 font-semibold">Número</th>
                          <th className="px-4 py-2.5 font-semibold">Relatório</th>
                          <th className="px-4 py-2.5 font-semibold">Período</th>
                          <th className="px-4 py-2.5 font-semibold">Emissão</th>
                          <th className="px-4 py-2.5 font-semibold">Situação</th>
                          <th className="px-4 py-2.5 font-semibold text-right">
                            Retrato
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {emitidos.map((r) => (
                          <tr key={r.id} className="align-top hover:bg-slate-50/60">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                                {r.numero}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-sm">
                              <p className="text-slate-800">{r.titulo}</p>
                              <span className="text-xs text-slate-400 font-mono">
                                {r.catalogo_codigo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {r.periodo || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {fmtData(r.data_emissao)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  r.emissao_status === "CANCELADO"
                                    ? "bg-red-50 text-red-600"
                                    : "bg-emerald-50 text-emerald-700",
                                )}
                              >
                                {r.emissao_status === "CANCELADO"
                                  ? "Cancelado"
                                  : "Emitido"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => verDetalhe(r.id)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                Ver
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ---- CATÁLOGO ---- */}
            <TabsContent value="catalogo" className="mt-4">
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Tipo
                  </label>
                  <Select value={fTipo} onValueChange={(v) => setFTipo(v as never)}>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="obrig">Obrigatórios</SelectItem>
                      <SelectItem value="demanda">Sob demanda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Periodicidade
                  </label>
                  <Select value={fPeriodo} onValueChange={setFPeriodo}>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todas</SelectItem>
                      {periodicidades.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Instrumento
                  </label>
                  <Select value={fInstr} onValueChange={setFInstr}>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todos</SelectItem>
                      {instrumentos.map(([codigo, sigla]) => (
                        <SelectItem key={codigo} value={codigo}>
                          {sigla}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Buscar
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Nome, destinatário, base…"
                      className="pl-9 h-10 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando catálogo…
                  </div>
                ) : filtrados.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    Nenhum modelo para os filtros selecionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[880px] text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr className="text-left">
                          <th className="px-4 py-2.5 font-semibold w-16">Cód.</th>
                          <th className="px-4 py-2.5 font-semibold">Relatório</th>
                          <th className="px-4 py-2.5 font-semibold">
                            Periodicidade
                          </th>
                          <th className="px-4 py-2.5 font-semibold">
                            Destinatário
                          </th>
                          <th className="px-4 py-2.5 font-semibold">
                            Base normativa
                          </th>
                          <th className="px-4 py-2.5 font-semibold text-right">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtrados.map((c) => (
                          <tr
                            key={c.codigo}
                            className="align-top hover:bg-slate-50/60"
                          >
                            <td className="px-4 py-3">
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
                                {c.codigo}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-md">
                              <p className="text-slate-800">{c.nome}</p>
                              <span
                                className={cn(
                                  "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  c.obrigatorio
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-slate-100 text-slate-500",
                                )}
                              >
                                {c.obrigatorio ? "Obrigatório" : "Sob demanda"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {c.periodicidade}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs">
                              {c.destinatario}
                            </td>
                            <td className="px-4 py-3 text-slate-500 max-w-xs text-xs">
                              {c.base_normativa}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirEmissao(c.codigo)}
                              >
                                <FilePlus className="h-3.5 w-3.5 mr-1.5" />
                                Emitir
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Diálogo de emissão */}
      <Dialog open={emitindoAberto} onOpenChange={setEmitindoAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Emitir relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Modelo do catálogo *
              </label>
              <Select
                value={form.catalogo_codigo}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    catalogo_codigo: v,
                    destinatario:
                      catalogo.find((c) => c.codigo === v)?.destinatario ??
                      f.destinatario,
                  }))
                }
              >
                <SelectTrigger className="mt-1 h-10 bg-white">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>
                      {c.codigo} · {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modeloSelecionado && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {modeloSelecionado.periodicidade} ·{" "}
                  {modeloSelecionado.base_normativa}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Autoridade emissora *
                </label>
                <Input
                  value={form.autoridade}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, autoridade: e.target.value }))
                  }
                  placeholder="Ex.: NSI"
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Período de referência
                </label>
                <Input
                  value={form.periodo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, periodo: e.target.value }))
                  }
                  placeholder="Ex.: 1º trimestre/2026"
                  className="mt-1 h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Destinatário
                </label>
                <Input
                  value={form.destinatario}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, destinatario: e.target.value }))
                  }
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Classificação
                </label>
                <Select
                  value={form.classificacao}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, classificacao: v as never }))
                  }
                >
                  <SelectTrigger className="mt-1 h-10 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICACOES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Observações
              </label>
              <textarea
                value={form.observacoes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, observacoes: e.target.value }))
                }
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              A emissão consome um número da série <strong>REL</strong> e
              congela o retrato atual dos indicadores — imutável (RN-37).
            </p>
            {erroEmissao && (
              <p className="text-xs text-red-600">{erroEmissao}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEmitindoAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={emitir} disabled={salvando}>
              {salvando ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <FilePlus className="h-4 w-4 mr-1.5" />
              )}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualização do retrato */}
      <Dialog
        open={detalhe !== null}
        onOpenChange={(o) => !o && setDetalhe(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5 text-blue-600" />
              {detalhe?.numero} — {detalhe?.titulo}
            </DialogTitle>
          </DialogHeader>
          {carregandoDetalhe || !detalhe ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Info rotulo="Modelo" valor={`${detalhe.catalogo_codigo}`} />
                <Info rotulo="Período" valor={detalhe.periodo || "—"} />
                <Info rotulo="Destinatário" valor={detalhe.destinatario || "—"} />
                <Info rotulo="Emissão" valor={fmtData(detalhe.data_emissao)} />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-mono break-all">
                  SHA-256: {detalhe.hash_sha256}
                </span>
              </div>
              {detalhe.observacoes && (
                <p className="text-sm text-slate-600">{detalhe.observacoes}</p>
              )}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Retrato dos indicadores
                  {detalhe.conteudo?.gerado_em
                    ? ` · congelado em ${fmtData(detalhe.conteudo.gerado_em)}`
                    : ""}
                </p>
                <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-semibold">Indicador</th>
                        <th className="px-3 py-2 font-semibold">Instr.</th>
                        <th className="px-3 py-2 font-semibold text-right">
                          Valor
                        </th>
                        <th className="px-3 py-2 font-semibold text-right">
                          Meta
                        </th>
                        <th className="px-3 py-2 font-semibold">Compet.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detalhe.conteudo?.indicadores ?? []).map((ind) => (
                        <tr key={ind.id}>
                          <td className="px-3 py-2 text-slate-700">{ind.nome}</td>
                          <td className="px-3 py-2 text-slate-500">
                            {ind.instrumento_sigla || "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {ind.valor === null
                              ? "—"
                              : `${ind.valor}${ind.unidade || ""}`}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">
                            {ind.meta === null
                              ? "—"
                              : `${ind.direcao ?? ""}${ind.meta}${ind.unidade || ""}`}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {ind.competencia || "—"}
                          </td>
                        </tr>
                      ))}
                      {(detalhe.conteudo?.indicadores ?? []).length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-6 text-center text-slate-400"
                          >
                            Sem indicadores no retrato.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {rotulo}
      </p>
      <p className="text-slate-700">{valor}</p>
    </div>
  );
}
