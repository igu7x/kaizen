import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DirectorateSelector } from "@/components/gestao/DirectorateSelector";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2,
  CheckCircle2,
  Clock,
  ClipboardList,
  BookOpen,
  Target,
  FilePlus,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Zap,
  Activity,
} from "lucide-react";
import { homeApi, HomeResumo } from "@/services/homeApi";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(name: string) {
  return (name || "").trim().split(" ")[0] || "";
}

const PENDENCIA_GRADIENT: Record<string, string> = {
  amber:
    "from-amber-500/10 via-orange-500/5 to-transparent border-amber-200/60 hover:border-amber-300",
  orange:
    "from-orange-500/10 via-red-500/5 to-transparent border-orange-200/60 hover:border-orange-300",
  emerald:
    "from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-200/60 hover:border-emerald-300",
  purple:
    "from-purple-500/10 via-pink-500/5 to-transparent border-purple-200/60 hover:border-purple-300",
  blue: "from-blue-500/10 via-indigo-500/5 to-transparent border-blue-200/60 hover:border-blue-300",
};

const PENDENCIA_NUM: Record<string, string> = {
  amber: "from-amber-500 to-orange-600",
  orange: "from-orange-500 to-red-600",
  emerald: "from-emerald-500 to-teal-600",
  purple: "from-purple-500 to-pink-600",
  blue: "from-blue-500 to-indigo-600",
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Seletor de diretoria visível apenas para SGJT (diretoria raiz) e superadmins.
  const podeSelecionarDiretoria =
    (user as { is_superadmin?: boolean } | null)?.is_superadmin === true ||
    user?.diretoria === "SGJT";
  const [resumo, setResumo] = useState<HomeResumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    homeApi
      .getResumo()
      .then(setResumo)
      .catch((err) => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-3" />
          Carregando...
        </div>
      </Layout>
    );
  }

  if (!resumo) {
    return (
      <Layout>
        <div className="p-6 text-gray-500 text-center">
          Não foi possível carregar o resumo.
        </div>
      </Layout>
    );
  }

  const totalPendencias = resumo.pendencias.reduce(
    (sum, p) => sum + p.count,
    0,
  );
  const nome = primeiroNome(resumo.user.name);

  const atalhos = [
    {
      icon: Target,
      label: "Monitoramento OKRs",
      desc: "Acompanhe objetivos e resultados-chave",
      link: "/gestao-estrategica/okrs",
      gradient: "from-blue-600 to-indigo-700",
    },
    {
      icon: ClipboardList,
      label: "Escritório de Projetos",
      desc: "Projetos em execução e entregas",
      link: "/gestao-estrategica/execucao",
      gradient: "from-cyan-600 to-blue-700",
    },
    {
      icon: FilePlus,
      label: "Plano de Contratações",
      desc: "PCA 2026 e suas contratações",
      link: "/contratacoes-ti/novas",
      gradient: "from-emerald-600 to-teal-700",
    },
    {
      icon: BookOpen,
      label: "Gestão por Competências",
      desc: "Matriz, autoavaliação e avaliação",
      link: "/pessoas/competencias",
      gradient: "from-violet-600 to-purple-700",
    },
  ];

  return (
    <Layout>
      <div className="relative">
        {/* Background tech pattern (subtle grid) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <style>{`
          @keyframes home-fade-up {
            from { opacity: 0; transform: translate3d(0, 8px, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          @keyframes home-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .home-anim {
            opacity: 0;
            will-change: transform, opacity;
            animation: home-fade-up 0.9s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
          }
          .home-anim-scale {
            opacity: 0;
            will-change: opacity;
            animation: home-fade-in 1s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
          }
          .home-anim-fade {
            opacity: 0;
            animation: home-fade-in 0.8s ease-out forwards;
          }
        `}</style>

        {/* Seletor de diretoria — fixo no canto superior direito (não empurra o banner).
            Visível apenas para SGJT e superadmins. */}
        {podeSelecionarDiretoria && (
          <div className="absolute -right-2 -top-3 z-20 lg:-right-4 lg:-top-4 xl:-right-6 2xl:-right-8">
            <DirectorateSelector />
          </div>
        )}

        <div className="relative p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
          {/* HERO */}
          <div className="home-anim-scale relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 lg:px-10 py-7 lg:py-8 text-white shadow-2xl shadow-slate-900/20">
            {/* decorações */}
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                backgroundSize: "30px 30px",
              }}
            />

            <div className="relative flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-xs text-white/80 mb-4">
                  <Activity className="h-3 w-3 text-emerald-400" />
                  <span className="font-medium tracking-wide">PAINEL</span>
                </div>

                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
                  {saudacao()},{" "}
                  <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                    {nome}
                  </span>
                </h1>
                <p className="text-white/60 mt-3 text-base lg:text-lg max-w-2xl">
                  Tudo que precisa da sua atenção, em um só lugar.
                </p>
              </div>

              {/* Logo Kaizen desenho — canto direito do banner (sem achatar) */}
              <div className="hidden md:flex items-center justify-center flex-shrink-0 self-center">
                <div className="relative w-36 h-36 lg:w-40 lg:h-40">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/25 to-cyan-500/25 rounded-full blur-2xl" />
                  <img
                    src="/logo%20kaizen%20desenho.png"
                    alt="Kaizen"
                    className="relative w-full h-full object-contain drop-shadow-[0_0_24px_rgba(96,165,250,0.4)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PENDÊNCIAS */}
          <section className="home-anim" style={{ animationDelay: "200ms" }}>
            <SectionHeader
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              title="Pendências"
              subtitle={
                totalPendencias === 0
                  ? "Nada na sua fila agora"
                  : `${totalPendencias} ${totalPendencias === 1 ? "item aguardando" : "itens aguardando"}`
              }
            />

            {totalPendencias === 0 ? (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-8">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-300/20 rounded-full blur-3xl" />
                <div className="relative flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Sparkles className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-900">
                      Você está em dia
                    </p>
                    <p className="text-sm text-emerald-700/80 mt-1">
                      Nenhuma tarefa pendente no momento. Que tal explorar os
                      atalhos abaixo?
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resumo.pendencias.map((p, i) => {
                  const gradient = PENDENCIA_GRADIENT[p.color || "amber"];
                  const numGrad = PENDENCIA_NUM[p.color || "amber"];
                  return (
                    <button
                      key={i}
                      onClick={() => navigate(p.link)}
                      className={`home-anim group relative overflow-hidden text-left rounded-2xl bg-gradient-to-br ${gradient} border bg-white p-5 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5 transition-all duration-200`}
                      style={{ animationDelay: `${300 + i * 90}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${numGrad} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                        >
                          <span className="text-2xl font-bold text-white tabular-nums">
                            {p.count}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 leading-snug">
                            {p.label}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            Clique para resolver{" "}
                            <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* PROJETOS (se tem projetos) */}
          {resumo.projetos.total > 0 && (
            <section className="home-anim" style={{ animationDelay: "400ms" }}>
              <SectionHeader
                icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
                title="Seus projetos"
                subtitle="Status dos projetos em execução"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  label="Total em execução"
                  value={resumo.projetos.total}
                  icon={<Target className="h-5 w-5" />}
                  gradient="from-blue-500 to-indigo-700"
                  onClick={() => navigate("/gestao-estrategica/execucao")}
                />
                <MetricCard
                  label="No prazo"
                  value={resumo.projetos.no_prazo}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  gradient="from-emerald-500 to-teal-700"
                  onClick={() => navigate("/gestao-estrategica/execucao")}
                />
                <MetricCard
                  label="Em atraso"
                  value={resumo.projetos.em_atraso}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  gradient="from-rose-500 to-red-700"
                  onClick={() => navigate("/gestao-estrategica/execucao")}
                />
              </div>
            </section>
          )}

          {/* ATALHOS */}
          <section className="home-anim" style={{ animationDelay: "550ms" }}>
            <SectionHeader
              icon={<Zap className="h-5 w-5 text-violet-600" />}
              title="Acessos rápidos"
              subtitle="Ir direto para os módulos mais usados"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {atalhos.map((a, i) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={i}
                    to={a.link}
                    className="home-anim group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-0.5 transition-all duration-200"
                    style={{ animationDelay: `${650 + i * 90}ms` }}
                  >
                    {/* Glow background on hover */}
                    <div
                      className={`absolute inset-0 opacity-0 group-hover:opacity-5 bg-gradient-to-br ${a.gradient} transition-opacity`}
                    />

                    <div className="relative flex flex-col gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {a.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {a.desc}
                        </p>
                      </div>
                      <div className="mt-1 text-xs text-slate-400 flex items-center gap-1 group-hover:text-slate-700 transition-colors">
                        Abrir{" "}
                        <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function StatBlock({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
        <p className="text-xs text-white/60 uppercase tracking-wider font-medium">
          {label}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  gradient,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white text-left hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 shadow-lg`}
    >
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm text-white/80 font-medium">{label}</p>
          <p className="text-4xl font-bold tabular-nums mt-2">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
          {icon}
        </div>
      </div>
    </button>
  );
}
