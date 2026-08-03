import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DirectorateSelector } from "@/components/gestao/DirectorateSelector";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpRight } from "lucide-react";
import { homeApi, HomeResumo } from "@/services/homeApi";
import { usePermissoes } from "@/hooks/usePermissoes";

const SIMBOLO = "/logo%20kaizen%20desenho.png";

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
 * Direção de arte: "O Emblema". A identidade da marca é a protagonista — a balança-justiça
 * dentro do ciclo de setas (o símbolo do Kaizen) é o herói visual, sobre fundo claro azulado.
 * Azul-marinho estrutura os títulos e os números; o azul-ciano das setas é o acento. Um anel
 * tracejado gira devagar atrás do símbolo, ecoando o ciclo de melhoria contínua.
 */
const KZ_CSS = `
  .kz {
    --bg: #F3F7FC;
    --navy: #0E3D73;
    --azure: #1E9BD7;
    --ink: #16324F;
    --ink2: #5B7089;
    --ink3: #93A6BD;
    --line: rgba(14, 61, 115, 0.12);
    --card: #FFFFFF;
  }
  .kz-grotesk { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
  .kz-tnum { font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

  @keyframes kz-spin { to { transform: rotate(360deg); } }
  @keyframes kz-spin-rev { to { transform: rotate(-360deg); } }
  @keyframes kz-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes kz-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes kz-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

  .kz-ring { transform-origin: 200px 200px; animation: kz-spin 48s linear infinite; }
  .kz-ring-2 { transform-origin: 200px 200px; animation: kz-spin-rev 90s linear infinite; }
  .kz-symbol { animation: kz-float 7s ease-in-out infinite; }
  .kz-rise { opacity: 0; animation: kz-rise 0.85s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
  .kz-fade { opacity: 0; animation: kz-fade 1.4s ease forwards; }

  .kz-item { transition: color 0.25s ease, transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1); }
  .kz-item:hover { color: var(--azure); }
  @media (hover: hover) { .kz-item:hover { transform: translateX(6px); } }
  .kz-dot { transition: background-color 0.25s ease, transform 0.3s ease; }
  .kz-item:hover .kz-dot { background-color: var(--azure); transform: scale(1.7); }
  .kz-arrow { transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1), color 0.25s ease; }
  .kz-item:hover .kz-arrow { transform: translate(3px, -3px); }

  @media (prefers-reduced-motion: reduce) {
    .kz-ring, .kz-ring-2, .kz-symbol { animation: none; }
    .kz-rise, .kz-fade { animation: none; opacity: 1; transform: none; }
    .kz-item, .kz-dot, .kz-arrow { transition: none; }
    .kz-item:hover { transform: none; }
  }
`;

function Emblema() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[360px] lg:max-w-[420px]">
      {/* halo azul */}
      <div className="absolute inset-[10%] rounded-full bg-[var(--azure)] opacity-[0.12] blur-3xl kz-fade" />
      {/* anéis tracejados girando (ecoam o ciclo de setas do símbolo) */}
      <svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <circle
          className="kz-ring"
          cx="200"
          cy="200"
          r="194"
          fill="none"
          stroke="var(--azure)"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="1.5 13"
        />
        <circle
          className="kz-ring-2"
          cx="200"
          cy="200"
          r="182"
          fill="none"
          stroke="var(--navy)"
          strokeOpacity="0.12"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="1 20"
        />
      </svg>
      {/* símbolo da marca (balança + ciclo) */}
      <img
        src={SIMBOLO}
        alt="Kaizen — balança da justiça no ciclo de melhoria contínua"
        className="kz-symbol absolute inset-[12%] h-[76%] w-[76%] object-contain"
        draggable={false}
      />
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
      <h2 className="kz-grotesk text-xs font-semibold uppercase tracking-[0.24em] text-[var(--navy)]">
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
        <div className="kz min-h-[60vh] bg-[var(--bg)]">
          <style>{KZ_CSS}</style>
          <div className="mx-auto max-w-6xl px-5 pt-24 text-center sm:px-8 lg:px-12">
            <p className="kz-grotesk text-lg text-[var(--ink3)]">Carregando…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!resumo) {
    return (
      <Layout>
        <div className="kz min-h-[60vh] bg-[var(--bg)]">
          <style>{KZ_CSS}</style>
          <div className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 lg:px-12">
            <p className="kz-grotesk text-xl text-[var(--ink2)]">
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
      <div className="kz relative min-h-full overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
        <style>{KZ_CSS}</style>

        {/* textura de grade sutil (identidade do fundo da marca) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(14,61,115,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,61,115,0.04) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(120% 80% at 70% 0%, #000 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(120% 80% at 70% 0%, #000 30%, transparent 75%)",
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-28 sm:px-8 lg:px-12">
          {/* ── TOP BAR ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 pt-7 sm:pt-9">
            <div className="flex items-center gap-2.5">
              <img
                src={SIMBOLO}
                alt=""
                aria-hidden="true"
                className="h-8 w-8 object-contain"
                draggable={false}
              />
              <span className="kz-grotesk text-sm font-semibold uppercase tracking-[0.3em] text-[var(--navy)]">
                Kaizen
              </span>
            </div>
            {podeSelecionarDiretoria && <DirectorateSelector />}
          </div>

          {/* ── HERO: manchete + emblema ────────────────────────────── */}
          <section className="grid grid-cols-12 items-center gap-x-6 gap-y-10 pt-12 pb-6 sm:pt-16 lg:min-h-[62vh]">
            <div className="col-span-12 lg:col-span-7">
              <p className="kz-rise mb-5 text-[11px] uppercase tracking-[0.28em] text-[var(--azure)]">
                Melhoria contínua
              </p>
              <h1
                className="kz-grotesk kz-rise text-[3rem] font-semibold leading-[1.02] tracking-tight text-[var(--navy)] sm:text-[4.25rem] lg:text-[5rem]"
                style={{ animationDelay: "60ms" }}
              >
                {saudacao()},
                <br />
                {nome}.
              </h1>
              <p
                className="kz-rise mt-7 max-w-md text-lg leading-relaxed text-[var(--ink2)] sm:text-xl"
                style={{ animationDelay: "140ms" }}
              >
                {lead}
              </p>

              {/* indicador compacto da fila */}
              <div
                className="kz-rise mt-9 inline-flex items-center gap-4"
                style={{ animationDelay: "220ms" }}
              >
                <span
                  className={`kz-grotesk kz-tnum text-5xl font-semibold leading-none ${
                    emDia ? "text-[var(--ink3)]" : "text-[var(--azure)]"
                  }`}
                >
                  {pad2(totalPendencias)}
                </span>
                <span className="text-sm leading-snug text-[var(--ink2)]">
                  {emDia ? (
                    <>
                      tudo em dia
                      <br />
                      na sua fila
                    </>
                  ) : (
                    <>
                      {totalPendencias === 1 ? "item" : "itens"} na sua fila
                      <br />
                      aguardando ação
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <Emblema />
            </div>
          </section>

          {/* ── PENDÊNCIAS ──────────────────────────────────────────── */}
          <section
            className="kz-rise mt-10 sm:mt-14"
            style={{ animationDelay: "260ms" }}
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
                      className="kz-item group flex w-full items-center gap-5 border-b border-[var(--line)] py-5 text-left"
                    >
                      <span
                        className="kz-dot h-2 w-2 shrink-0 rounded-full bg-[var(--ink3)]"
                        aria-hidden="true"
                      />
                      <span className="kz-grotesk kz-tnum w-10 shrink-0 text-2xl font-semibold text-[var(--navy)] sm:text-3xl">
                        {pad2(p.count)}
                      </span>
                      <span className="flex-1 text-lg leading-snug text-[var(--ink)] sm:text-xl">
                        {p.label}
                      </span>
                      <span className="hidden text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)] transition-colors group-hover:text-[var(--azure)] sm:inline">
                        Resolver
                      </span>
                      <ArrowUpRight className="kz-arrow h-5 w-5 shrink-0 text-[var(--ink3)] group-hover:text-[var(--azure)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── PROJETOS ────────────────────────────────────────────── */}
          {temProjetos && (
            <section
              className="kz-rise mt-14 sm:mt-16"
              style={{ animationDelay: "320ms" }}
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
                  accent={resumo.projetos.em_atraso > 0}
                  onClick={() => navigate("/gestao-estrategica/execucao")}
                />
              </div>
            </section>
          )}

          {/* ── ACESSOS ─────────────────────────────────────────────── */}
          {atalhosVisiveis.length > 0 && (
            <section
              className="kz-rise mt-14 sm:mt-16"
              style={{ animationDelay: "380ms" }}
              aria-labelledby="h-acessos"
            >
              <SectionLabel title="Acessos" meta="Ir direto" />
              <div className="grid grid-cols-1 md:grid-cols-2">
                {atalhosVisiveis.map((a, i) => (
                  <Link
                    key={i}
                    to={a.link}
                    className="kz-item group flex items-start gap-5 border-b border-[var(--line)] py-6 md:odd:border-r md:odd:border-r-[var(--line)] md:odd:pr-8 md:even:pl-8"
                  >
                    <span className="kz-grotesk kz-tnum pt-1 text-sm text-[var(--ink3)] transition-colors group-hover:text-[var(--azure)]">
                      {pad2(i + 1)}
                    </span>
                    <div className="flex-1">
                      <h3 className="kz-grotesk text-xl font-semibold leading-tight text-[var(--navy)] transition-colors group-hover:text-[var(--azure)] sm:text-2xl">
                        {a.label}
                      </h3>
                      <p className="mt-1.5 text-sm text-[var(--ink2)]">
                        {a.desc}
                      </p>
                    </div>
                    <ArrowUpRight className="kz-arrow mt-1.5 h-4 w-4 shrink-0 text-[var(--ink3)] group-hover:text-[var(--azure)]" />
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
  accent = false,
  onClick,
}: {
  n: number;
  label: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="kz-item group border-[var(--line)] py-6 pr-4 text-left [&:not(:first-child)]:border-l [&:not(:first-child)]:pl-5 sm:[&:not(:first-child)]:pl-8"
    >
      <span
        className={`kz-grotesk kz-tnum block text-5xl font-semibold leading-none sm:text-6xl ${
          accent ? "text-[var(--azure)]" : "text-[var(--navy)]"
        }`}
      >
        {n}
      </span>
      <span className="mt-3 block text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)] transition-colors group-hover:text-[var(--navy)]">
        {label}
      </span>
    </button>
  );
}
