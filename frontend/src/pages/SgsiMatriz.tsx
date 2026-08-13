import { useEffect, useMemo, useState } from "react";
import { Loader2, Network, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sgsiApi, SgsiMatrizItem } from "@/services/sgsiApi";

const TODOS = "__todos__";
const CONCLUIDOS = new Set(["ASSINADO", "PUBLICADO", "CANCELADO"]);

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  EM_ELABORACAO: { label: "Em elaboração", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  EM_REVISAO: { label: "Em revisão", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  EM_ASSINATURA: { label: "Em assinatura", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  ASSINADO: { label: "Assinado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  PUBLICADO: { label: "Publicado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CANCELADO: { label: "Cancelado", cls: "bg-red-50 text-red-600 ring-red-200" },
};
const STATUS_ORDEM = Object.keys(STATUS);

const tipoLabel = (t: string) =>
  t
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

const emAtraso = (r: SgsiMatrizItem) =>
  !!r.prazo_efetivo &&
  new Date(r.prazo_efetivo) < new Date(new Date().toDateString()) &&
  !CONCLUIDOS.has(r.status);

export default function SgsiMatriz() {
  const [rows, setRows] = useState<SgsiMatrizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fInstr, setFInstr] = useState(TODOS);
  const [fStatus, setFStatus] = useState(TODOS);
  const [soAtraso, setSoAtraso] = useState(false);
  const [semEmissao, setSemEmissao] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    sgsiApi
      .getMatriz()
      .then(setRows)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }, []);

  const instrumentos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.instrumento_codigo)
        map.set(r.instrumento_codigo, r.instrumento_sigla || r.instrumento_codigo);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (fInstr !== TODOS && r.instrumento_codigo !== fInstr) return false;
      if (fStatus !== TODOS && r.status !== fStatus) return false;
      if (soAtraso && !emAtraso(r)) return false;
      if (semEmissao && r.numero_emissao) return false;
      if (
        q &&
        ![r.documento, r.atividade, r.normativo_origem, r.responsavel].some(
          (c) => (c || "").toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
  }, [rows, fInstr, fStatus, soAtraso, semEmissao, busca]);

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
              { label: "Matriz de Rastreabilidade" },
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
                <Network className="h-6 w-6 text-blue-600" />
                Matriz de Rastreabilidade
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Atividade → normativo de origem → documento → emissão, de ponta a
                ponta.
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Instrumento
              </label>
              <Select value={fInstr} onValueChange={setFInstr}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os instrumentos</SelectItem>
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
                Status
              </label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os status</SelectItem>
                  {STATUS_ORDEM.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS[s].label}
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
                  placeholder="Atividade, documento, normativo…"
                  className="pl-9 h-10 bg-white"
                />
              </div>
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <Checkbox
                  checked={soAtraso}
                  onCheckedChange={(v) => setSoAtraso(v === true)}
                />
                Em atraso
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <Checkbox
                  checked={semEmissao}
                  onCheckedChange={(v) => setSemEmissao(v === true)}
                />
                Sem emissão
              </label>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando matriz…
              </div>
            ) : filtrados.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Nenhuma linha para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 font-semibold">Instrumento</th>
                      <th className="px-4 py-2.5 font-semibold">
                        Atividade / Documento
                      </th>
                      <th className="px-4 py-2.5 font-semibold">Normativo</th>
                      <th className="px-4 py-2.5 font-semibold">Responsável</th>
                      <th className="px-4 py-2.5 font-semibold">Prazo</th>
                      <th className="px-4 py-2.5 font-semibold text-center">
                        Status
                      </th>
                      <th className="px-4 py-2.5 font-semibold">Emissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrados.map((r) => {
                      const st = STATUS[r.status] ?? STATUS.PENDENTE;
                      const atraso = emAtraso(r);
                      return (
                        <tr key={r.id} className="align-top hover:bg-slate-50/60">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-slate-700">
                              {r.instrumento_sigla || "—"}
                            </span>
                            {(r.tarefa_fase || r.tarefa_numero != null) && (
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {r.tarefa_fase}
                                {r.tarefa_numero != null
                                  ? ` · tarefa ${r.tarefa_numero}`
                                  : ""}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-md">
                            <p className="text-slate-800">{r.documento}</p>
                            {r.atividade && r.atividade !== r.documento && (
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                origem: {r.atividade}
                              </p>
                            )}
                            <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              {tipoLabel(r.tipo)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs">
                            {r.normativo_origem || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {r.responsavel || "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={cn(
                                "tabular-nums",
                                atraso
                                  ? "font-semibold text-red-600"
                                  : "text-slate-600",
                              )}
                            >
                              {fmtData(r.prazo_efetivo)}
                            </span>
                            {atraso && (
                              <span className="ml-1 text-[10px] font-semibold uppercase text-red-500">
                                atraso
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                                st.cls,
                              )}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {r.numero_emissao || (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {filtrados.length} de {rows.length} obrigações rastreadas
          </p>
        </div>
      </div>
    </Layout>
  );
}
