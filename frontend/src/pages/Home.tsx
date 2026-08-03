import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DirectorateSelector } from "@/components/gestao/DirectorateSelector";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpRight } from "lucide-react";
import { homeApi, HomeResumo } from "@/services/homeApi";
import { usePermissoes } from "@/hooks/usePermissoes";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(name: string) {
  return (name || "").trim().split(" ")[0] || "";
}

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

/**
 * Direção de arte: "O Ciclo". O loop do kaizen é a espinha da composição — um anel de precisão
 * (dial com ticks) que gira imperceptivelmente e um arco índigo que varre no load. Números
 * tabulares gigantes (Space Grotesk) são os heróis; o índigo é o único acento, cirúrgico.
 */
const CYCLE_CSS = `
  .cy {
    --bg: #F4F6F8;
    --ink: #202632;
    --ink2: #5B6472;
    --ink3: #97A0AD;
    --line: rgba(32, 38, 50, 0.10);
    --indigo: #4F46E5;
  }
  .cy-grotesk { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
  .cy-tnum { font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

  @keyframes cy-spin { to { transform: rotate(360deg); } }
  @keyframes cy-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes cy-fade { from { opacity: 0; } to { opacity: 1; } }

  .cy-ticks { transform-origin: 200px 200px; animation: cy-spin 150s linear infinite; }
  .cy-rise { opacity: 0; animation: cy-rise 0.85s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
  .cy-fade { opacity: 0; animation: cy-fade 1.4s ease forwards; }
  .cy-arc { transition: stroke-dashoffset 1.7s cubic-bezier(0.2, 0.7, 0.2, 1); }

  .cy-item { transition: color 0.25s ease, transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1); }
  .cy-item:hover { color: var(--indigo); }
  @media (hover: hover) { .cy-item:hover { transform: translateX(6px); } }
  .cy-dot { transition: background-color 0.25s ease, transform 0.3s ease; }
  .cy-item:hover .cy-dot { background-color: var(--indigo); transform: scale(1.6); }
  .cy-arrow { transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1), color 0.25s ease; }
  .cy-item:hover .cy-arrow { transform: translate(3px, -3px); }

  @media (prefers-reduced-motion: reduce) {
    .cy-ticks { animation: none; }
    .cy-rise, .cy-fade { animation: none; opacity: 1; transform: none; }
    .cy-arc { transition: none; }
    .cy-item, .cy-dot, .cy-arrow { transition: none; }
    .cy-item:hover { transform: none; }
  }
`;

function CycleRing({
  count,
  frac,
  label,
  emphasize,
}: {
  count: number;
  frac: number;
  label: string;
  emphasize: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const R = 180;
  const C = 2 * Math.PI * R;
  const clamped = Math.min(1, Math.max(0.04, frac));
  const offset = mounted ? C * (1 - clamped) : C;
  const ticks = Array.from({ length: 72 });

  return (
    <div className="relative aspect-square w-full">
      <div className="absolute inset-[14%] rounded-full bg-[var(--indigo)] opacity-[0.06] blur-3xl cy-fade" />
      <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden="true">
        <circle
          cx="200"
          cy="200"
          r={R}
          fill="none"
          stroke="var(--ink)"
          strokeOpacity="0.12"
          strokeWidth="1.25"
        />
        <g className="cy-ticks">
          {ticks.map((_, i) => {
            const major = i % 6 === 0;
            const a = (i / ticks.length) * 2 * Math.PI;
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const rin = major ? 166 : 175;
            const rout = 184;
            return (
              <line
                key={i}
                x1={200 + cos * rin}
                y1={200 + sin * rin}
                x2={200 + cos * rout}
                y2={200 + sin * rout}
                stroke="var(--ink)"
                strokeOpacity={major ? 0.3 : 0.14}
                strokeWidth={major ? 1.5 : 1}
              />
            );
          })}
        </g>
        <circle
          cx="200"
          cy="200"
          r={R}
          fill="none"
          stroke="var(--indigo)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 200 200)"
          className="cy-arc"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`cy-grotesk cy-tnum font-medium leading-none text-[5rem] sm:text-[6.5rem] ${
            emphasize ? "text-[var(--indigo)]" : "text-[var(--ink3)]"
          }`}
        >
          {pad2(count)}
        </span>
        <span className="mt-2 text-[11px] uppercase tracking-[0.28em] text-[var(--ink3)]">
          {label}
        </span>
      </div>
    </div>
  );
}

function SectionLabel({
  title,
  meta,
}: {
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between border-t border-[var(--line)] pt-3">
      <h2 className="cy-grotesk text-xs font-semibold uppercase tracking-[0.24em] text-[var(--ink)]">
        {title}
      </h2>
      {meta && (
        <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)]">
          {meta}
        </span>
      )}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const podeSelecionarDiretoria =
    (user as { is_superadmin?: boolean } | null)?.is_superadmin === true ||
    user?.diretoria === "SGJT";
  const [resumo, setResumo] = useState<HomeResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const { podeAcessar } = usePermissoes();

  useEffect(() => {
    homeApi
      .getResumo()
      .then(setResumo)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="cy min-h-[60vh] bg-[var(--bg)]">
          <style>{CYCLE_CSS}</style>
          <div className="mx-auto max-w-6xl px-5 pt-24 text-center sm:px-8 lg:px-12">
            <p className="cy-grotesk text-lg text-[var(--ink3)]">
              Girando o ciclo…
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!resumo) {
    return (
      <Layout>
        <div className="cy min-h-[60vh] bg-[var(--bg)]">
          <style>{CYCLE_CSS}</style>
          <div className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 lg:px-12">
            <p className="cy-grotesk text-xl text-[var(--ink2)]">
              Não foi possível carregar o resumo.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const totalPendencias = resumo.pendencias.reduce((s, p) => s + p.count, 0);
  const nome = primeiroNome(resumo.user.name);
  const emDia = totalPendencias === 0;
  const temProjetos = resumo.projetos.total > 0;

  // Arco índigo do anel: proporção de projetos no prazo (sinal glanceável) ou um arco ambiente.
  const arcFrac = temProjetos
    ? resumo.projetos.no_prazo / resumo.projetos.total
    : 0.66;

  const lead = emDia
    ? "A fila está limpa. O ciclo segue — bom momento para olhar o que vem a seguir."
    : `${totalPendencias} ${totalPendencias === 1 ? "item aguarda" : "itens aguardam"} sua ação para o ciclo avançar.`;

  const atalhos = [
    {
      label: "Monitoramento de OKRs",
      desc: "Objetivos e resultados-chave em acompanhamento.",
      link: "/gestao-estrategica/okrs",
      permissaoCodigo: "gestao_okrs",
    },
    {
      label: "Escritório de Projetos",
      desc: "Projetos em execução e suas entregas.",
      link: "/gestao-estrategica/execucao",
      permissaoCodigo: "gestao_execucao",
    },
    {
      label: "Plano de Contratações",
      desc: "PCA 2026 e as contratações do ciclo.",
      link: "/pca",
      permissaoCodigo: "contratacoes_novas",
    },
    {
      label: "Gestão por Competências",
      desc: "Matriz, autoavaliação e avaliação.",
      link: "/pessoas/competencias",
      permissaoCodigo: "pessoas_competencias",
    },
  ];
  const atalhosVisiveis = atalhos.filter((a) => podeAcessar(a.permissaoCodigo));

  return (
    <Layout>
      <div className="cy relative min-h-full bg-[var(--bg)] text-[var(--ink)]">
        <style>{CYCLE_CSS}</style>

        <div className="mx-auto max-w-6xl px-5 pb-28 sm:px-8 lg:px-12">
          {/* ── TOP BAR ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 pt-7 sm:pt-9">
            <div className="flex items-center gap-2.5">
              <span
                className="cy-grotesk text-lg leading-none text-[var(--ink)]"
                aria-hidden="true"
              >
                改善
              </span>
              <span className="cy-grotesk text-sm font-semibold uppercase tracking-[0.3em] text-[var(--ink)]">
                Kaizen
              </span>
            </div>
            {podeSelecionarDiretoria && <DirectorateSelector />}
          </div>

          {/* ── HERO: manchete + anel ───────────────────────────────── */}
          <section className="relative overflow-hidden">
            {/* Anel: fora de quadro à direita no desktop; centralizado no mobile. */}
            <div className="pointer-events-none mx-auto mt-10 w-[76vw] max-w-[340px] cy-fade sm:max-w-[400px] lg:absolute lg:right-0 lg:top-1/2 lg:mt-0 lg:w-[560px] lg:max-w-none lg:-translate-y-1/2 lg:translate-x-[16%]">
              <CycleRing
                count={totalPendencias}
                frac={arcFrac}
                label={emDia ? "em dia" : "na fila"}
                emphasize={!emDia}
              />
            </div>

            <div className="relative z-10 py-16 sm:py-24 lg:max-w-[54%] lg:py-32">
              <p className="cy-rise mb-5 text-[11px] uppercase tracking-[0.28em] text-[var(--indigo)]">
                Melhoria contínua
              </p>
              <h1
                className="cy-grotesk cy-rise text-[3rem] font-medium leading-[1.02] tracking-tight text-[var(--ink)] sm:text-[4.25rem] lg:text-[5rem]"
                style={{ animationDelay: "60ms" }}
              >
                {saudacao()},
                <br />
                {nome}.
              </h1>
              <p
                className="cy-rise mt-7 max-w-md text-lg leading-relaxed text-[var(--ink2)] sm:text-xl"
                style={{ animationDelay: "140ms" }}
              >
                {lead}
              </p>
            </div>
          </section>

          {/* ── PENDÊNCIAS ──────────────────────────────────────────── */}
          <section
            className="cy-rise mt-8 sm:mt-12"
            style={{ animationDelay: "220ms" }}
            aria-labelledby="h-pendencias"
          >
            <SectionLabel
              title="Pendências"
              meta={emDia ? "Em dia" : `${totalPendencias} aguardando`}
            />
            {emDia ? (
              <p className="max-w-2xl py-8 text-xl leading-relaxed text-[var(--ink2)] sm:text-2xl">
                Nada aguarda você agora — o ciclo está em ordem.
              </p>
            ) : (
              <ul>
                {resumo.pendencias.map((p, i) => (
                  <li key={i}>
                    <button
                      onClick={() => navigate(p.link)}
                      className="cy-item group flex w-full items-center gap-5 border-b border-[var(--line)] py-5 text-left"
                    >
                      <span
                        className="cy-dot h-2 w-2 shrink-0 rounded-full bg-[var(--ink3)]"
                        aria-hidden="true"
                      />
                      <span className="cy-grotesk cy-tnum w-10 shrink-0 text-2xl text-[var(--ink)] sm:text-3xl">
                        {pad2(p.count)}
                      </span>
                      <span className="flex-1 text-lg leading-snug text-[var(--ink)] sm:text-xl">
                        {p.label}
                      </span>
                      <span className="hidden text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)] transition-colors group-hover:text-[var(--indigo)] sm:inline">
                        Resolver
                      </span>
                      <ArrowUpRight className="cy-arrow h-5 w-5 shrink-0 text-[var(--ink3)] group-hover:text-[var(--indigo)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── PROJETOS ────────────────────────────────────────────── */}
          {temProjetos && (
            <section
              className="cy-rise mt-14 sm:mt-16"
              style={{ animationDelay: "280ms" }}
              aria-labelledby="h-projetos"
            >
              <SectionLabel title="Seus projetos" meta="Em execução" />
              <div className="grid grid-cols-3">
                <Figure
                  n={resumo.projetos.total}
                  label="Em execução"
                  onClick={() => navigate("/gestao-estrategica/execucao")}
                />
                <Figure
                  n={resumo.projetos.no_prazo}
                  label="No prazo"
                  onClick={() => navigate("/gestao-estrategica/execucao")}
                />
                <Figure
                  n={resumo.projetos.em_atraso}
                  label="Em atraso"
                  onClick={() => navigate("/gestao-estrategica/execucao")}
                />
              </div>
            </section>
          )}

          {/* ── ACESSOS ─────────────────────────────────────────────── */}
          {atalhosVisiveis.length > 0 && (
            <section
              className="cy-rise mt-14 sm:mt-16"
              style={{ animationDelay: "340ms" }}
              aria-labelledby="h-acessos"
            >
              <SectionLabel title="Acessos" meta="Ir direto" />
              <div className="grid grid-cols-1 md:grid-cols-2">
                {atalhosVisiveis.map((a, i) => (
                  <Link
                    key={i}
                    to={a.link}
                    className="cy-item group flex items-start gap-5 border-b border-[var(--line)] py-6 md:odd:border-r md:odd:border-r-[var(--line)] md:odd:pr-8 md:even:pl-8"
                  >
                    <span className="cy-grotesk cy-tnum pt-1 text-sm text-[var(--ink3)] transition-colors group-hover:text-[var(--indigo)]">
                      {pad2(i + 1)}
                    </span>
                    <div className="flex-1">
                      <h3 className="cy-grotesk text-xl font-medium leading-tight text-[var(--ink)] transition-colors group-hover:text-[var(--indigo)] sm:text-2xl">
                        {a.label}
                      </h3>
                      <p className="mt-1.5 text-sm text-[var(--ink2)]">
                        {a.desc}
                      </p>
                    </div>
                    <ArrowUpRight className="cy-arrow mt-1.5 h-4 w-4 shrink-0 text-[var(--ink3)] group-hover:text-[var(--indigo)]" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Figure({
  n,
  label,
  onClick,
}: {
  n: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="cy-item group border-[var(--line)] py-6 pr-4 text-left [&:not(:first-child)]:border-l [&:not(:first-child)]:pl-5 sm:[&:not(:first-child)]:pl-8"
    >
      <span className="cy-grotesk cy-tnum block text-5xl font-medium leading-none text-[var(--ink)] sm:text-6xl">
        {n}
      </span>
      <span className="mt-3 block text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)] transition-colors group-hover:text-[var(--ink)]">
        {label}
      </span>
    </button>
  );
}
