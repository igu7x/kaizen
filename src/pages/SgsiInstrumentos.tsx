import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, Lock, Search } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { sgsiApi, SgsiInstrumento } from "@/services/sgsiApi";

export default function SgsiInstrumentos() {
  const navigate = useNavigate();
  const [instrumentos, setInstrumentos] = useState<SgsiInstrumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    sgsiApi
      .listarInstrumentos()
      .then(setInstrumentos)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return instrumentos;
    return instrumentos.filter((i) =>
      [i.sigla_oficial, i.nome_curto, i.nome_completo, i.numeral_romano].some(
        (c) => (c || "").toLowerCase().includes(q),
      ),
    );
  }, [instrumentos, busca]);

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: "Sistema de Gestão da Segurança da Informação" }]} />

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
                Sistema de Gestão da Segurança da Informação
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                Instrumentos Normativos
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                POSIC/TJGO — norma basilar — e os 13 Instrumentos Normativos
                Complementares, com seus planos de trabalho 5W2H.
              </p>
            </div>
          </div>

          {/* Busca */}
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar instrumento…"
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando instrumentos…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtrados.map((i) => (
                <button
                  key={i.codigo}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/seguranca-informacao/instrumentos/${encodeURIComponent(i.codigo)}`,
                    )
                  }
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-blue-300 hover:shadow-sm"
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: i.cor_hex || "#1565C0" }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {i.ordem === 0
                        ? "Norma basilar"
                        : `Instrumento ${i.numeral_romano}`}
                    </span>
                    {i.restrito && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                        title="Instrumento restrito"
                      >
                        <Lock className="h-3 w-3" />
                        Restrito
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {i.sigla_oficial}
                  </p>
                  <p className="text-sm text-slate-700">{i.nome_curto}</p>

                  {/* Progresso */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>
                        {i.tarefas_concluidas ?? 0}/{i.total_tarefas ?? 0}{" "}
                        tarefas
                      </span>
                      <span className="font-semibold text-slate-700">
                        {i.progresso ?? 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${i.progresso ?? 0}%` }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && filtrados.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <ShieldCheck className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm">Nenhum instrumento encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
