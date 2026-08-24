import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  ShieldCheck,
  ListChecks,
  AlertTriangle,
  FileText,
  Gauge,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { sgsiApi, SgsiPainel as Painel } from "@/services/sgsiApi";

export default function SgsiPainel() {
  const navigate = useNavigate();
  const [p, setP] = useState<Painel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sgsiApi
      .getPainel()
      .then(setP)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }, []);

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
                Painel de Compliance do SGSI
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Visão executiva do SGSI: POSIC/TJGO (norma basilar) e seus 13
                Instrumentos Normativos Complementares.
              </p>
            </div>
          </div>

          {loading || !p ? (
            <div className="flex items-center justify-center py-24 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando painel…
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  titulo="Conformidade global"
                  valor={`${p.tarefas.progresso}%`}
                  sub={`execução média de ${p.tarefas.total} tarefas`}
                  cor="blue"
                  bar={p.tarefas.progresso}
                />
                <Kpi
                  titulo="Tarefas concluídas"
                  valor={p.tarefas.concluidas}
                  sub={`${p.tarefas.em_andamento} em andamento`}
                  icon={<ListChecks className="h-6 w-6" />}
                  cor="green"
                />
                <Kpi
                  titulo="Em atraso / bloqueadas"
                  valor={p.tarefas.atrasadas + p.tarefas.bloqueadas}
                  sub={`${p.tarefas.atrasadas} atrasadas · ${p.tarefas.bloqueadas} bloqueadas`}
                  icon={<AlertTriangle className="h-6 w-6" />}
                  cor={
                    p.tarefas.atrasadas + p.tarefas.bloqueadas > 0
                      ? "red"
                      : "slate"
                  }
                />
                <Kpi
                  titulo="Obrigações documentais"
                  valor={p.documentos.total}
                  sub={`${p.documentos.pendentes} pendentes · ${p.documentos.publicados} assinadas/publicadas`}
                  icon={<FileText className="h-6 w-6" />}
                  cor="slate"
                  onClick={() => navigate("/seguranca-informacao/documentos")}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  titulo="Indicadores monitorados"
                  valor={p.indicadores.total}
                  sub={`${p.indicadores.com_meta} com meta · ${p.indicadores.com_medicao} com medição`}
                  icon={<Gauge className="h-6 w-6" />}
                  cor="slate"
                  onClick={() => navigate("/seguranca-informacao/indicadores")}
                />
                <Kpi
                  titulo="Indicadores fora da meta"
                  valor={p.indicadores.fora_meta}
                  sub={`${p.indicadores.dentro_meta} dentro da meta`}
                  cor={p.indicadores.fora_meta > 0 ? "red" : "green"}
                />
                <Kpi
                  titulo="Instrumentos normativos"
                  valor={p.instrumentos.length}
                  sub="POSIC + 13 complementares"
                  icon={<BookOpen className="h-6 w-6" />}
                  cor="slate"
                  onClick={() => navigate("/seguranca-informacao/instrumentos")}
                />
                <Kpi
                  titulo="Documentos cancelados"
                  valor={p.documentos.cancelados}
                  sub="obrigações canceladas"
                  cor="slate"
                />
              </div>

              {/* Aderência por instrumento */}
              <div className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Aderência por instrumento
                </h2>
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                  {p.instrumentos.map((i) => (
                    <button
                      key={i.codigo}
                      type="button"
                      onClick={() =>
                        navigate(
                          `/seguranca-informacao/instrumentos/${encodeURIComponent(i.codigo)}`,
                        )
                      }
                      className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50/60"
                    >
                      <span
                        className="h-8 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: i.cor_hex || "#1565C0" }}
                      />
                      <div className="w-40 flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {i.sigla_oficial}
                        </p>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          {i.ordem === 0
                            ? "Norma basilar"
                            : `Instrumento ${i.numeral_romano}`}
                        </p>
                      </div>
                      <div className="flex flex-1 items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${i.progresso}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold text-slate-700">
                          {i.progresso}%
                        </span>
                        <span className="w-24 text-right text-xs text-slate-400">
                          {i.tarefas_concluidas}/{i.total_tarefas} tarefas
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Kpi({
  titulo,
  valor,
  sub,
  icon,
  cor,
  bar,
  onClick,
}: {
  titulo: string;
  valor: string | number;
  sub?: string;
  icon?: React.ReactNode;
  cor: "blue" | "green" | "red" | "slate";
  bar?: number;
  onClick?: () => void;
}) {
  const fundo = {
    blue: "from-blue-50 to-white",
    green: "from-emerald-50 to-white",
    red: "from-red-50 to-white",
    slate: "from-slate-50 to-white",
  }[cor];
  const iconeCls = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-emerald-100 text-emerald-600",
    red: "bg-red-100 text-red-600",
    slate: "bg-slate-100 text-slate-500",
  }[cor];
  const valorCls = {
    blue: "text-slate-900",
    green: "text-slate-900",
    red: "text-red-600",
    slate: "text-slate-900",
  }[cor];

  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-xl border border-slate-200 bg-gradient-to-br p-5 text-left transition-all",
        fundo,
        onClick && "hover:border-blue-300 hover:shadow-sm cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {titulo}
          </p>
          <p className={cn("mt-1 text-3xl font-bold", valorCls)}>{valor}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
              iconeCls,
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {bar != null && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </Comp>
  );
}
