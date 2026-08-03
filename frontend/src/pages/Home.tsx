import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DirectorateSelector } from "@/components/gestao/DirectorateSelector";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpRight, ArrowRight, Check } from "lucide-react";
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

const prefersReduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* Revela elementos [data-rv] quando entram na viewport; parallax leve ligado ao scroll do <main>.
   Só ativa quando o conteúdo está montado (`ready`); o estado escondido é escopado por
   [data-choreo="on"] — se o JS não rodar, nada fica invisível (fail-safe). */
function useScrollChoreography(
  rootRef: React.RefObject<HTMLElement>,
  ready: boolean,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return;

    const revealables = Array.from(
      root.querySelectorAll<HTMLElement>("[data-rv]"),
    );
    root.setAttribute("data-choreo", "on");
    const clear = () => root.removeAttribute("data-choreo");

    if (prefersReduced) {
      revealables.forEach((el) => el.classList.add("rv-in"));
      return clear;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("rv-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    revealables.forEach((el) => io.observe(el));
    // Rede de segurança: se o observer não disparar por algum motivo, revela tudo.
    const fallback = window.setTimeout(() => {
      revealables.forEach((el) => el.classList.add("rv-in"));
    }, 1600);

    const scroller = (root.closest("main") as HTMLElement | null) ?? null;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = scroller ? scroller.scrollTop : window.scrollY;
        root.style.setProperty("--sy", String(y));
        raf = 0;
      });
    };
    onScroll();
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
      target.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      clear();
    };
  }, [rootRef, ready]);
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(prefersReduced ? value : 0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (prefersReduced) {
      setN(value);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          started = true;
          const dur = 900;
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setN(Math.round(value * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return (
    <span ref={ref} className="tabular-nums">
      {n}
    </span>
  );
}

const HOME_CSS = `
  .kz {
    --ink: #0E2440;
    --navy: #0E3D73;
    --azure: #1478B4;
    --azure-hi: #1E9BD7;
    --g2: #5A6B84;
    --g3: #8A98AE;
    --line: #E4EAF3;
    --light: #F5F9FE;
    --d1: #06162E;
    --d2: #0B2A55;
    --d3: #123C76;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .kz-display { font-family: "Bricolage Grotesque", Inter, ui-sans-serif, system-ui, sans-serif; }

  /* Reveal — só esconde quando a coreografia está ativa (JS rodando). */
  .kz[data-choreo="on"] [data-rv] { opacity: 0; transform: translateY(26px); transition: opacity 0.9s cubic-bezier(0.16,0.8,0.24,1), transform 0.9s cubic-bezier(0.16,0.8,0.24,1); }
  .kz[data-choreo="on"] [data-rv].rv-in { opacity: 1; transform: none; }

  /* Hero */
  .kz-hero { background:
      radial-gradient(90% 70% at 72% 18%, rgba(30,155,215,0.28), transparent 60%),
      radial-gradient(70% 60% at 12% 92%, rgba(18,60,118,0.55), transparent 62%),
      linear-gradient(160deg, var(--d1), var(--d2) 55%, var(--d3)); }
  .kz-grid { background-image:
      linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 46px 46px;
    mask-image: radial-gradient(120% 90% at 60% 20%, #000 30%, transparent 78%);
    -webkit-mask-image: radial-gradient(120% 90% at 60% 20%, #000 30%, transparent 78%); }

  @keyframes kz-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
  @keyframes kz-pulse { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.06); } }
  @keyframes kz-spin { to { transform: rotate(360deg); } }
  @keyframes kz-spin-rev { to { transform: rotate(-360deg); } }
  @keyframes kz-cue { 0%,100% { transform: translateY(0); opacity: 0.5; } 50% { transform: translateY(6px); opacity: 1; } }

  .kz-symbol { animation: kz-float 8s ease-in-out infinite; filter: drop-shadow(0 20px 60px rgba(30,155,215,0.45)); }
  .kz-halo { animation: kz-pulse 6s ease-in-out infinite; }
  .kz-ring { transform-origin: center; animation: kz-spin 42s linear infinite; }
  .kz-ring-2 { transform-origin: center; animation: kz-spin-rev 80s linear infinite; }
  .kz-cue { animation: kz-cue 1.8s ease-in-out infinite; }

  .kz-chip { transition: border-color 0.2s ease, background-color 0.2s ease; }
  .kz-chip:hover { border-color: rgba(105,208,247,0.7); background: rgba(105,208,247,0.10); }

  /* Módulos */
  .kz-tile { background: #fff; border: 1px solid var(--line); border-radius: 14px; transition: border-color 0.25s ease, transform 0.35s cubic-bezier(0.16,0.8,0.24,1); }
  .kz-tile:hover { border-color: var(--azure-hi); transform: translateY(-4px); }
  .kz-tile:focus-visible { outline: 2px solid var(--azure); outline-offset: 3px; }
  .kz-tile .kz-tt { transition: color 0.2s ease; }
  .kz-tile:hover .kz-tt { color: var(--azure); }
  .kz-underline { transition: width 0.4s cubic-bezier(0.16,0.8,0.24,1); }
  .kz-tile:hover .kz-underline { width: 100%; }
  .kz-arrow { transition: transform 0.3s cubic-bezier(0.16,0.8,0.24,1); }
  .kz-tile:hover .kz-arrow, .kz-row:hover .kz-arrow { transform: translate(4px, -4px); }

  .kz-row { transition: background-color 0.2s ease; }
  .kz-row:hover { background: #EEF4FB; }
  .kz-row .kz-rl { transition: color 0.2s ease; }
  .kz-row:hover .kz-rl { color: var(--azure); }
  .kz-row:focus-visible { outline: 2px solid var(--azure); outline-offset: -2px; border-radius: 8px; }

  @media (prefers-reduced-motion: reduce) {
    .kz-symbol, .kz-halo, .kz-ring, .kz-ring-2, .kz-cue { animation: none; }
    .kz [data-rv] { opacity: 1; transform: none; transition: none; }
    .kz-tile, .kz-arrow, .kz-underline, .kz-row, .kz-tt, .kz-rl, .kz-chip { transition: none; }
    .kz-tile:hover { transform: none; }
  }
`;

interface Modulo {
  key: string;
  label: string;
  desc: string;
  link: string;
  permissaoCodigo: string;
}
const MODULOS: Modulo[] = [
  {
    key: "projetos",
    label: "Escritório de Projetos",
    desc: "Projetos em execução e suas entregas.",
    link: "/gestao-estrategica/execucao",
    permissaoCodigo: "gestao_execucao",
  },
  {
    key: "okrs",
    label: "Monitoramento de OKRs",
    desc: "Objetivos e resultados-chave da diretoria.",
    link: "/gestao-estrategica/okrs",
    permissaoCodigo: "gestao_okrs",
  },
  {
    key: "pca",
    label: "Plano de Contratações",
    desc: "PCA 2026 e as contratações do ciclo.",
    link: "/pca",
    permissaoCodigo: "contratacoes_novas",
  },
  {
    key: "competencias",
    label: "Gestão por Competências",
    desc: "Matriz, autoavaliação e avaliação.",
    link: "/pessoas/competencias",
    permissaoCodigo: "pessoas_competencias",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const podeSelecionarDiretoria =
    (user as { is_superadmin?: boolean } | null)?.is_superadmin === true ||
    user?.diretoria === "SGJT";
  const [resumo, setResumo] = useState<HomeResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const { podeAcessar } = usePermissoes();
  const rootRef = useRef<HTMLDivElement>(null);

  useScrollChoreography(rootRef, !loading && !!resumo);

  useEffect(() => {
    homeApi
      .getResumo()
      .then(setResumo)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const scrollToModulos = useCallback(() => {
    rootRef.current
      ?.querySelector("#modulos")
      ?.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
  }, []);

  if (loading || !resumo) {
    return (
      <Layout>
        <div className="kz kz-hero flex min-h-screen items-center justify-center">
          <style>{HOME_CSS}</style>
          <p className="text-sm text-white/60">
            {loading ? "Carregando…" : "Não foi possível carregar o resumo."}
          </p>
        </div>
      </Layout>
    );
  }

  const nome = primeiroNome(resumo.user.name);
  const pendencias = resumo.pendencias.filter((p) => p.count > 0);
  const emDia = pendencias.length === 0;
  const totalPend = pendencias.reduce((s, p) => s + p.count, 0);
  const proj = resumo.projetos;

  const visiveis = MODULOS.filter((m) => podeAcessar(m.permissaoCodigo));
  const primario = visiveis[0] ?? null;
  const secundarios = visiveis.slice(1);

  return (
    <Layout>
      <div ref={rootRef} className="kz bg-[var(--light)]">
        <style>{HOME_CSS}</style>

        {/* ══════════════ HERO ══════════════ */}
        <section className="kz-hero relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
          <div className="kz-grid pointer-events-none absolute inset-0" />

          {/* Emblema — o símbolo da marca como herói */}
          <div
            className="relative mb-9 h-[220px] w-[220px] sm:h-[280px] sm:w-[280px]"
            style={{
              transform: "translateY(calc(var(--sy,0) * -0.06px))",
            }}
            data-rv
          >
            <div className="kz-halo absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(105,208,247,0.55),transparent_62%)] blur-2xl" />
            <svg
              viewBox="0 0 400 400"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <circle
                className="kz-ring"
                cx="200"
                cy="200"
                r="196"
                fill="none"
                stroke="rgba(105,208,247,0.5)"
                strokeWidth="1.5"
                strokeDasharray="2 16"
                strokeLinecap="round"
              />
              <circle
                className="kz-ring-2"
                cx="200"
                cy="200"
                r="180"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
                strokeDasharray="1 22"
                strokeLinecap="round"
              />
            </svg>
            <img
              src={SIMBOLO}
              alt="Kaizen — balança da justiça no ciclo de melhoria contínua"
              className="kz-symbol absolute inset-[13%] h-[74%] w-[74%] object-contain brightness-0 invert"
              draggable={false}
            />
          </div>

          <p
            className="mb-4 text-[12px] font-medium uppercase tracking-[0.34em] text-[color:rgba(105,208,247,0.9)]"
            data-rv
            style={{ transitionDelay: "80ms" }}
          >
            {saudacao()}, {nome}
          </p>
          <h1
            className="kz-display text-[clamp(3rem,9vw,7rem)] font-extrabold leading-[0.92] tracking-[-0.03em] text-white"
            data-rv
            style={{ transitionDelay: "140ms" }}
          >
            Kaizen
          </h1>
          <p
            className="mt-5 max-w-xl text-balance text-lg text-white/70 sm:text-xl"
            data-rv
            style={{ transitionDelay: "220ms" }}
          >
            Melhoria contínua da governança judiciária e tecnológica.
          </p>

          {/* Estado — resultado confiante, dentro do hero */}
          <div
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
            data-rv
            style={{ transitionDelay: "300ms" }}
          >
            {emDia ? (
              <span className="kz-chip inline-flex items-center gap-2.5 rounded-full border border-[rgba(105,208,247,0.4)] bg-white/[0.06] px-5 py-2.5 text-sm text-white/90 backdrop-blur-sm">
                <Check
                  className="h-4 w-4 text-[color:rgba(105,208,247,1)]"
                  strokeWidth={2.5}
                />
                Tudo resolvido — nenhuma pendência aguardando você.
              </span>
            ) : (
              <button
                onClick={scrollToModulos}
                className="kz-chip inline-flex items-center gap-2.5 rounded-full border border-[rgba(105,208,247,0.4)] bg-white/[0.06] px-5 py-2.5 text-sm text-white/90 backdrop-blur-sm"
              >
                <span className="kz-display text-base font-bold text-[color:rgba(105,208,247,1)]">
                  {totalPend}
                </span>
                {totalPend === 1 ? "item aguarda" : "itens aguardam"} sua ação
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {podeSelecionarDiretoria && (
              <div className="[&_*]:!text-white/90">
                <DirectorateSelector />
              </div>
            )}
          </div>

          {/* Scroll cue */}
          <button
            onClick={scrollToModulos}
            aria-label="Ver módulos"
            className="kz-cue absolute bottom-7 left-1/2 -translate-x-1/2 text-white/60 hover:text-white"
          >
            <svg width="26" height="40" viewBox="0 0 26 40" fill="none">
              <rect
                x="1"
                y="1"
                width="24"
                height="38"
                rx="12"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="13" cy="11" r="3" fill="currentColor" />
            </svg>
          </button>
        </section>

        {/* ══════════════ SUA FILA (só quando há itens) ══════════════ */}
        {!emDia && (
          <section
            id="fila"
            className="mx-auto max-w-5xl px-6 py-20 sm:py-28"
          >
            <p
              className="mb-2 text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--azure)]"
              data-rv
            >
              Sua fila
            </p>
            <h2
              className="kz-display mb-8 text-[clamp(1.9rem,4vw,3rem)] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]"
              data-rv
              style={{ transitionDelay: "60ms" }}
            >
              O que precisa de você agora.
            </h2>
            <ul className="border-t border-[var(--line)]">
              {pendencias.map((p, i) => (
                <li key={i} data-rv style={{ transitionDelay: `${i * 70}ms` }}>
                  <button
                    onClick={() => navigate(p.link)}
                    className="kz-row group flex w-full items-center gap-5 border-b border-[var(--line)] px-3 py-5 text-left"
                  >
                    <span className="kz-display w-12 shrink-0 text-2xl font-bold tabular-nums text-[var(--navy)] sm:text-3xl">
                      {p.count}
                    </span>
                    <span className="kz-rl flex-1 text-lg text-[var(--ink)] sm:text-xl">
                      {p.label}
                    </span>
                    <ArrowUpRight className="kz-arrow h-5 w-5 shrink-0 text-[var(--g3)] group-hover:text-[var(--azure)]" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ══════════════ MÓDULOS ══════════════ */}
        {primario && (
          <section
            id="modulos"
            className="mx-auto max-w-6xl px-6 py-20 sm:py-28"
          >
            <div className="mb-10 flex items-end justify-between gap-4" data-rv>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--azure)]">
                  Módulos
                </p>
                <h2 className="kz-display text-[clamp(1.9rem,4vw,3rem)] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">
                  Onde o trabalho acontece.
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Primário — largo */}
              <Link
                to={primario.link}
                data-rv
                className="kz-tile group col-span-1 flex flex-col justify-between overflow-hidden p-7 sm:col-span-3 sm:p-9"
              >
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h3 className="kz-tt kz-display text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">
                      {primario.label}
                    </h3>
                    <div className="kz-underline mt-2 h-[2px] w-10 bg-[var(--azure-hi)]" />
                    <p className="mt-4 max-w-md text-[15px] text-[var(--g2)]">
                      {primario.desc}
                    </p>
                  </div>
                  <ArrowUpRight className="kz-arrow h-6 w-6 shrink-0 text-[var(--g3)] group-hover:text-[var(--azure)]" />
                </div>

                {primario.key === "projetos" && (
                  <div className="mt-8 flex flex-wrap items-baseline gap-x-10 gap-y-3">
                    <span className="flex items-baseline gap-2">
                      <span className="kz-display text-4xl font-bold text-[var(--navy)] sm:text-5xl">
                        <CountUp value={proj.total} />
                      </span>
                      <span className="text-[13px] text-[var(--g3)]">
                        em execução
                      </span>
                    </span>
                    {proj.em_atraso > 0 && (
                      <span className="flex items-baseline gap-2">
                        <span className="kz-display text-4xl font-bold text-[#B4780A] sm:text-5xl">
                          <CountUp value={proj.em_atraso} />
                        </span>
                        <span className="text-[13px] text-[var(--g3)]">
                          em atraso
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </Link>

              {/* Secundários */}
              {secundarios.map((m, i) => (
                <Link
                  key={m.key}
                  to={m.link}
                  data-rv
                  style={{ transitionDelay: `${(i + 1) * 80}ms` }}
                  className="kz-tile group flex flex-col justify-between p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="kz-tt kz-display text-xl font-bold leading-tight tracking-[-0.01em] text-[var(--ink)]">
                      {m.label}
                    </h3>
                    <ArrowUpRight className="kz-arrow h-4 w-4 shrink-0 text-[var(--g3)] group-hover:text-[var(--azure)]" />
                  </div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--g2)]">
                    {m.desc}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
