import { useEffect, useMemo, useState } from "react";
import { Loader2, FileBarChart, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sgsiApi, SgsiRelatorioCatalogo } from "@/services/sgsiApi";

const TODOS = "__todos__";

export default function SgsiRelatorios() {
  const [catalogo, setCatalogo] = useState<SgsiRelatorioCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fTipo, setFTipo] = useState<"todos" | "obrig" | "demanda">("todos");
  const [fPeriodo, setFPeriodo] = useState(TODOS);
  const [fInstr, setFInstr] = useState(TODOS);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    sgsiApi
      .getCatalogoRelatorios()
      .then(setCatalogo)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Segurança da Informação",
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
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">
                Segurança da Informação
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <FileBarChart className="h-6 w-6 text-blue-600" />
                Catálogo de Relatórios
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                {catalogo.length} modelos ({obrig} obrigatórios ·{" "}
                {catalogo.length - obrig} sob demanda) que o SGSI deve produzir.
              </p>
            </div>
          </div>

          {/* Filtros */}
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

          {/* Tabela */}
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
                      <th className="px-4 py-2.5 font-semibold">Periodicidade</th>
                      <th className="px-4 py-2.5 font-semibold">Destinatário</th>
                      <th className="px-4 py-2.5 font-semibold">Base normativa</th>
                      <th className="px-4 py-2.5 font-semibold">Instrumento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrados.map((c) => (
                      <tr key={c.codigo} className="align-top hover:bg-slate-50/60">
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
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {c.instrumento_sigla || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {filtrados.length} de {catalogo.length} modelos
          </p>
        </div>
      </div>
    </Layout>
  );
}
