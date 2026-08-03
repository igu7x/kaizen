import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DirectorateSelector } from "@/components/gestao/DirectorateSelector";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpRight, Check, ChevronDown, ChevronUp } from "lucide-react";
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
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const prefersReduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function CountUp({ value, run }: { value: number; run: boolean }) {
  const [n, setN] = useState(prefersReduced ? value : 0);
  useEffect(() => {
    if (prefersReduced || !run) {
      if (prefersReduced) setN(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run]);
  return <span className="tabular-nums">{n}</span>;
}

const HOME_CSS = `
  .kz {
    --ink: #0E2440;
    --navy: #0E3D73;
    --azure: #1478B4;
    --cyan: #1E9BD7;
    --g2: #5A6B84;
    --g3: #8A98AE;
    --line: #E7ECF4;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: var(--ink);
  }
  .kz-word { font-family: "Montserrat", Inter, ui-sans-serif, system-ui, sans-serif; }

  .kz-jack { position: relative; height: 100%; overflow: hidden; background: #fff; }
  .kz-scene { position: absolute; inset: 0; will-change: transform, opacity; transform-origin: center 42%; }
  .kz-dash { overflow-y: auto; overflow-x: hidden; }
  .kz-flow .kz-scene { position: relative; inset: auto; opacity: 1 !important; transform: none !important; min-height: 88vh; overflow: visible; }

  @keyframes kz-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-11px); } }
  @keyframes kz-spin { to { transform: rotate(360deg); } }
  @keyframes kz-spin-rev { to { transform: rotate(-360deg); } }
  @keyframes kz-cue { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
  @keyframes kz-in-sym { from { opacity: 0; transform: scale(0.55) rotate(-50deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
  @keyframes kz-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }
  @keyframes kz-in-fade { from { opacity: 0; } to { opacity: 1; } }

  .kz-symwrap { animation: kz-in-sym 1.15s cubic-bezier(0.16,0.84,0.3,1) both; }
  .kz-symbol { animation: kz-float 8s ease-in-out infinite; }
  .kz-halo { animation: kz-in-fade 1.5s ease both; }
  .kz-ring { transform-origin: center; animation: kz-spin 34s linear infinite; }
  .kz-ring-2 { transform-origin: center; animation: kz-spin-rev 60s linear infinite; }
  .kz-cue svg { animation: kz-cue 1.6s ease-in-out infinite; }
  .kz-in-1 { animation: kz-in-up 0.85s cubic-bezier(0.16,0.84,0.3,1) 0.22s both; }
  .kz-in-2 { animation: kz-in-up 0.85s cubic-bezier(0.16,0.84,0.3,1) 0.34s both; }
  .kz-in-3 { animation: kz-in-up 0.85s cubic-bezier(0.16,0.84,0.3,1) 0.46s both; }
  .kz-in-4 { animation: kz-in-up 0.85s cubic-bezier(0.16,0.84,0.3,1) 0.58s both; }

  .kz-cta { transition: background-color 0.2s ease, transform 0.2s ease; }
  .kz-cta:hover { background: var(--azure); transform: translateY(-1px); }
  .kz-cta:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }

  .kz-mod { transition: color 0.2s ease; }
  .kz-mod:hover .kz-mn { color: var(--azure); }
  .kz-mod:focus-visible { outline: 2px solid var(--azure); outline-offset: 3px; border-radius: 6px; }
  .kz-mn { transition: color 0.2s ease; }
  .kz-ma { opacity: 0; transform: translateX(-6px); transition: opacity 0.25s ease, transform 0.25s ease; }
  .kz-mod:hover .kz-ma { opacity: 1; transform: none; }

  .kz-row { transition: background-color 0.2s ease; }
  .kz-row:hover { background: #F1F6FC; }
  .kz-row .kz-rl { transition: color 0.2s ease; }
  .kz-row:hover .kz-rl { color: var(--azure); }
  .kz-link { transition: color 0.2s ease; }
  .kz-link:hover { color: var(--azure); }

  @media (prefers-reduced-motion: reduce) {
    .kz-symwrap, .kz-symbol, .kz-halo, .kz-ring, .kz-ring-2, .kz-cue svg,
    .kz-in-1, .kz-in-2, .kz-in-3, .kz-in-4 { animation: none !important; opacity: 1; transform: none; }
    .kz-cta, .kz-mod, .kz-mn, .kz-ma, .kz-row, .kz-rl, .kz-link { transition: none; }
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
  { key: "projetos", label: "Escritório de Projetos", desc: "Projetos em execução e suas entregas.", link: "/gestao-estrategica/execucao", permissaoCodigo: "gestao_execucao" },
  { key: "okrs", label: "Monitoramento de OKRs", desc: "Objetivos e resultados-chave da diretoria.", link: "/gestao-estrategica/okrs", permissaoCodigo: "gestao_okrs" },
  { key: "pca", label: "Plano de Contratações", desc: "PCA 2026 e as contratações do ciclo.", link: "/pca", permissaoCodigo: "contratacoes_novas" },
  { key: "competencias", label: "Gestão por Competências", desc: "Matriz, autoavaliação e avaliação.", link: "/pessoas/competencias", permissaoCodigo: "pessoas_competencias" },
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

  const heroRef = useRef<HTMLElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0); // 0 = hero, 1 = dashboard
  const committedRef = useRef(false);
  const settleRef = useRef(0);
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    homeApi
      .getResumo()
      .then(setResumo)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const applyProgress = useCallback((p: number, animated: boolean) => {
    const hero = heroRef.current;
    const dash = dashRef.current;
    if (!hero || !dash) return;
    const tr = animated
      ? "transform 0.72s cubic-bezier(0.7,0,0.2,1), opacity 0.5s ease"
      : "none";
    hero.style.transition = tr;
    dash.style.transition = tr;
    hero.style.transform = `scale(${1 + p * 1.05})`;
    hero.style.opacity = String(clamp01(1 - p * 1.3));
    hero.style.pointerEvents = p > 0.5 ? "none" : "auto";
    dash.style.transform = `scale(${0.92 + p * 0.08})`;
    dash.style.opacity = String(clamp01(p * 1.35));
    dash.style.pointerEvents = p >= 0.5 ? "auto" : "none";
  }, []);

  const setCommittedBoth = useCallback((v: boolean) => {
    committedRef.current = v;
    setCommitted((prev) => (prev === v ? prev : v));
  }, []);

  const settle = useCallback(() => {
    const target = progressRef.current > 0.4 ? 1 : 0;
    progressRef.current = target;
    applyProgress(target, true);
    setCommittedBoth(target >= 1);
    if (target === 0 && dashRef.current) dashRef.current.scrollTop = 0;
  }, [applyProgress, setCommittedBoth]);

  const go = useCallback(
    (to: number) => {
      window.clearTimeout(settleRef.current);
      progressRef.current = to;
      if (!prefersReduced) applyProgress(to, true);
      setCommittedBoth(to >= 1);
      if (to === 0 && dashRef.current) dashRef.current.scrollTop = 0;
    },
    [applyProgress, setCommittedBoth],
  );

  // Estado inicial das cenas (esconde o dashboard sem flash).
  useLayoutEffect(() => {
    if (prefersReduced || loading || !resumo) return;
    applyProgress(0, false);
  }, [applyProgress, loading, resumo]);

  // Scroll CONTROLADO: o zoom acompanha o quanto se rola; solta e faz snap.
  useEffect(() => {
    if (prefersReduced || loading || !resumo) return;

    const scrub = (delta: number) => {
      progressRef.current = clamp01(progressRef.current + delta / 850);
      applyProgress(progressRef.current, false);
      setCommittedBoth(progressRef.current >= 0.999);
      window.clearTimeout(settleRef.current);
      settleRef.current = window.setTimeout(settle, 120);
    };
    const atTop = () => (dashRef.current?.scrollTop ?? 0) <= 0;

    const onWheel = (e: WheelEvent) => {
      if (!committedRef.current) {
        e.preventDefault();
        scrub(e.deltaY);
      } else if (e.deltaY < 0 && atTop()) {
        e.preventDefault();
        scrub(e.deltaY);
      }
    };

    let lastY = 0;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      const dy = lastY - y;
      lastY = y;
      if (!committedRef.current) {
        e.preventDefault();
        scrub(dy * 2.2);
      } else if (dy < 0 && atTop()) {
        e.preventDefault();
        scrub(dy * 2.2);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (!committedRef.current && ["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (committedRef.current && ["ArrowUp", "PageUp"].includes(e.key) && atTop()) {
        e.preventDefault();
        go(0);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(settleRef.current);
    };
  }, [loading, resumo, applyProgress, settle, go, setCommittedBoth]);

  if (loading || !resumo) {
    return (
      <Layout>
        <div className="kz flex h-full items-center justify-center bg-white">
          <style>{HOME_CSS}</style>
          <p className="text-sm text-[var(--g3)]">
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

  return (
    <Layout>
      <div className={`kz relative h-full ${prefersReduced ? "kz-flow overflow-auto bg-white" : "kz-jack"}`}>
        <style>{HOME_CSS}</style>

        {podeSelecionarDiretoria && (
          <div className="absolute right-3 top-3 z-30 lg:right-5 lg:top-5">
            <DirectorateSelector />
          </div>
        )}

        {/* ══════════════ CENA 0 — HERO ══════════════ */}
        <section
          ref={heroRef}
          className="kz-scene flex flex-col items-center justify-center px-6 text-center"
          aria-hidden={committed}
        >
          {/* Emblema com anéis bem visíveis */}
          <div className="kz-symwrap relative mb-7 h-[200px] w-[200px] sm:h-[250px] sm:w-[250px]">
            <div className="kz-halo absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgba(30,155,215,0.18),transparent_62%)] blur-2xl" />
            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <circle cx="200" cy="200" r="196" fill="none" stroke="rgba(30,155,215,0.20)" strokeWidth="1" />
              <circle className="kz-ring" cx="200" cy="200" r="196" fill="none" stroke="rgba(30,155,215,0.85)" strokeWidth="2.5" strokeDasharray="5 11" strokeLinecap="round" />
              <circle className="kz-ring-2" cx="200" cy="200" r="176" fill="none" stroke="rgba(14,61,115,0.35)" strokeWidth="1.5" strokeDasharray="2 12" strokeLinecap="round" />
            </svg>
            <img
              src={SIMBOLO}
              alt="Kaizen — balança da justiça no ciclo de melhoria contínua"
              className="kz-symbol absolute inset-[14%] h-[72%] w-[72%] object-contain"
              draggable={false}
            />
          </div>

          {/* Saudação em destaque */}
          <p className="kz-in-1 kz-word text-[clamp(1.4rem,3.6vw,2.15rem)] font-semibold tracking-tight text-[var(--ink)]">
            {saudacao()},{" "}
            <span className="text-[var(--azure)]">{nome}</span>
          </p>

          {/* Wordmark — mesma fonte do header */}
          <h1 className="kz-in-2 kz-word mt-2 text-[clamp(2.8rem,8vw,6rem)] font-extrabold uppercase leading-[0.9] tracking-[0.01em] text-[var(--navy)]">
            Kaizen
          </h1>

          <p className="kz-in-3 mt-4 max-w-lg text-balance text-base text-[var(--g2)] sm:text-lg">
            Melhoria contínua da governança judiciária e tecnológica.
          </p>

          {/* CTA em destaque + estado */}
          <div className="kz-in-4 mt-9 flex flex-col items-center gap-4">
            <button
              onClick={() => go(1)}
              className="kz-cta inline-flex items-center gap-2.5 rounded-full bg-[var(--navy)] px-7 py-3.5 text-[15px] font-semibold text-white"
            >
              Ir para pendências
              <ChevronDown className="h-4 w-4" />
            </button>
            <span className="flex items-center gap-2 text-[13px] text-[var(--g2)]">
              {emDia ? (
                <>
                  <Check className="h-4 w-4 text-[var(--cyan)]" strokeWidth={2.5} />
                  Tudo resolvido — nada aguardando você.
                </>
              ) : (
                <>
                  <span className="kz-word font-bold text-[var(--cyan)]">
                    {totalPend}
                  </span>
                  {totalPend === 1 ? "item aguarda" : "itens aguardam"} sua ação.
                </>
              )}
            </span>
          </div>

          <div className="kz-cue absolute bottom-8 left-1/2 -translate-x-1/2 text-[var(--g3)]">
            <ChevronDown className="h-5 w-5" />
          </div>
        </section>

        {/* ══════════════ CENA 1 — DASHBOARD (centralizado) ══════════════ */}
        <div ref={dashRef} className="kz-scene kz-dash" aria-hidden={!committed}>
          <div className="mx-auto max-w-2xl px-6 py-16 text-center sm:py-20">
            <button
              onClick={() => go(0)}
              className="kz-link mb-14 inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--g3)]"
            >
              <ChevronUp className="h-4 w-4" />
              Voltar ao início
            </button>

            {/* Sua fila */}
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--azure)]">
              Sua fila
            </p>
            {emDia ? (
              <div className="mb-20 flex flex-col items-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--cyan)] text-[var(--cyan)]">
                  <Check className="h-6 w-6" strokeWidth={2.5} />
                </span>
                <h2 className="kz-word text-[clamp(1.5rem,3.4vw,2rem)] font-semibold tracking-tight text-[var(--ink)]">
                  Tudo resolvido
                </h2>
                <p className="mt-1.5 text-[15px] text-[var(--g2)]">
                  Nenhuma pendência aguardando você agora.
                </p>
              </div>
            ) : (
              <ul className="mx-auto mb-20 max-w-lg border-t border-[var(--line)] text-left">
                {pendencias.map((p, i) => (
                  <li key={i}>
                    <button
                      onClick={() => navigate(p.link)}
                      className="kz-row group flex w-full items-center gap-4 border-b border-[var(--line)] px-3 py-4 text-left"
                    >
                      <span className="kz-word w-9 shrink-0 text-xl font-bold tabular-nums text-[var(--navy)]">
                        {p.count}
                      </span>
                      <span className="kz-rl flex-1 text-[15px] text-[var(--ink)]">
                        {p.label}
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--g3)] group-hover:text-[var(--azure)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Módulos — lista editorial centralizada, sem cards */}
            {visiveis.length > 0 && (
              <div>
                <p className="mb-6 text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--azure)]">
                  Módulos
                </p>
                <div className="mx-auto max-w-lg divide-y divide-[var(--line)] border-y border-[var(--line)] text-left">
                  {visiveis.map((m) => (
                    <Link
                      key={m.key}
                      to={m.link}
                      className="kz-mod group flex items-center justify-between gap-6 py-5"
                    >
                      <div>
                        <h3 className="kz-mn text-[17px] font-semibold text-[var(--ink)]">
                          {m.label}
                        </h3>
                        <p className="mt-0.5 text-[13.5px] text-[var(--g2)]">
                          {m.key === "projetos" && proj.total > 0 ? (
                            <>
                              <span className="kz-word font-semibold text-[var(--navy)]">
                                <CountUp value={proj.total} run={committed} />
                              </span>{" "}
                              em execução
                              {proj.em_atraso > 0 && (
                                <>
                                  {" · "}
                                  <span className="kz-word font-semibold text-[#B4780A]">
                                    {proj.em_atraso}
                                  </span>{" "}
                                  em atraso
                                </>
                              )}
                            </>
                          ) : (
                            m.desc
                          )}
                        </p>
                      </div>
                      <ArrowUpRight className="kz-ma h-5 w-5 shrink-0 text-[var(--azure)]" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
