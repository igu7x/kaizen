import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DirectorateSelector } from "@/components/gestao/DirectorateSelector";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpRight, ArrowRight, Check, ChevronDown, ChevronUp } from "lucide-react";
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

function CountUp({ value, active }: { value: number; active: boolean }) {
  const [n, setN] = useState(prefersReduced ? value : 0);
  useEffect(() => {
    if (prefersReduced || !active) {
      if (prefersReduced) setN(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active]);
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
    --bg: #FFFFFF;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: var(--ink);
  }
  .kz-display { font-family: "Bricolage Grotesque", Inter, ui-sans-serif, system-ui, sans-serif; }

  /* ── Cenas (zoom entre hero e dashboard) ── */
  .kz-jack { position: relative; height: 100%; overflow: hidden; background: var(--bg); }
  .kz-scene {
    position: absolute; inset: 0;
    transition: transform 0.82s cubic-bezier(0.7, 0, 0.2, 1), opacity 0.66s ease;
    will-change: transform, opacity;
  }
  .kz-scene.on { transform: none; opacity: 1; }
  .kz-hero.off { transform: scale(1.9); opacity: 0; pointer-events: none; }        /* hero mergulha pra frente */
  .kz-dash.off { transform: scale(0.9); opacity: 0; pointer-events: none; }         /* dashboard espera pequeno */
  .kz-dash { overflow-y: auto; overflow-x: hidden; }

  /* Fallback acessível: rolagem normal, sem zoom */
  .kz-flow .kz-scene { position: relative; inset: auto; opacity: 1; transform: none; min-height: 88vh; overflow: visible; }

  /* ── Motion ── */
  @keyframes kz-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
  @keyframes kz-pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } }
  @keyframes kz-spin { to { transform: rotate(360deg); } }
  @keyframes kz-spin-rev { to { transform: rotate(-360deg); } }
  @keyframes kz-cue { 0%,100% { transform: translateY(0); opacity: 0.55; } 50% { transform: translateY(5px); opacity: 1; } }

  /* Intro ao entrar na Home */
  @keyframes kz-in-sym { from { opacity: 0; transform: scale(0.55) rotate(-55deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
  @keyframes kz-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }
  @keyframes kz-in-fade { from { opacity: 0; } to { opacity: 1; } }

  .kz-symwrap { animation: kz-in-sym 1.15s cubic-bezier(0.16, 0.84, 0.3, 1) both; }
  .kz-symbol { animation: kz-float 8s ease-in-out infinite; }
  .kz-halo { animation: kz-in-fade 1.4s ease both, kz-pulse 6s ease-in-out 1.4s infinite; }
  .kz-ring { transform-origin: center; animation: kz-spin 40s linear infinite; }
  .kz-ring-2 { transform-origin: center; animation: kz-spin-rev 75s linear infinite; }
  .kz-cue { animation: kz-cue 1.8s ease-in-out infinite; }
  .kz-in-1 { animation: kz-in-up 0.9s cubic-bezier(0.16,0.84,0.3,1) 0.25s both; }
  .kz-in-2 { animation: kz-in-up 0.9s cubic-bezier(0.16,0.84,0.3,1) 0.36s both; }
  .kz-in-3 { animation: kz-in-up 0.9s cubic-bezier(0.16,0.84,0.3,1) 0.48s both; }
  .kz-in-4 { animation: kz-in-up 0.9s cubic-bezier(0.16,0.84,0.3,1) 0.6s both; }

  /* Interações */
  .kz-tile { background: #fff; border: 1px solid var(--line); border-radius: 14px; transition: border-color 0.25s ease, transform 0.35s cubic-bezier(0.16,0.8,0.24,1); }
  .kz-tile:hover { border-color: var(--cyan); transform: translateY(-4px); }
  .kz-tile:focus-visible { outline: 2px solid var(--azure); outline-offset: 3px; }
  .kz-tile .kz-tt { transition: color 0.2s ease; }
  .kz-tile:hover .kz-tt { color: var(--azure); }
  .kz-underline { transition: width 0.4s cubic-bezier(0.16,0.8,0.24,1); }
  .kz-tile:hover .kz-underline { width: 100%; }
  .kz-arrow { transition: transform 0.3s cubic-bezier(0.16,0.8,0.24,1); }
  .kz-tile:hover .kz-arrow, .kz-row:hover .kz-arrow { transform: translate(4px, -4px); }
  .kz-row { transition: background-color 0.2s ease; }
  .kz-row:hover { background: #F1F6FC; }
  .kz-row .kz-rl { transition: color 0.2s ease; }
  .kz-row:hover .kz-rl { color: var(--azure); }
  .kz-row:focus-visible { outline: 2px solid var(--azure); outline-offset: -2px; border-radius: 8px; }
  .kz-chip { transition: border-color 0.2s ease, background-color 0.2s ease; }
  .kz-chip:hover { border-color: var(--cyan); background: #F1F9FE; }

  @media (prefers-reduced-motion: reduce) {
    .kz-symwrap, .kz-symbol, .kz-halo, .kz-ring, .kz-ring-2, .kz-cue,
    .kz-in-1, .kz-in-2, .kz-in-3, .kz-in-4 { animation: none !important; opacity: 1; transform: none; }
    .kz-scene { transition: none; }
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

  // Cena: 0 = hero, 1 = dashboard (pendências + módulos).
  const [scene, setScene] = useState(0);
  const animatingRef = useRef(false);
  const dashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    homeApi
      .getResumo()
      .then(setResumo)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const go = useCallback(
    (to: number) => {
      if (to === scene) return;
      if (prefersReduced) {
        setScene(to);
        return;
      }
      if (animatingRef.current) return;
      animatingRef.current = true;
      setScene(to);
      window.setTimeout(() => {
        animatingRef.current = false;
      }, 840);
    },
    [scene],
  );

  // Captura de scroll/teclado/toque para trocar de cena com zoom (não rola a página).
  useEffect(() => {
    if (prefersReduced || loading || !resumo) return;
    const dash = dashRef.current;

    const atTop = () => (dashRef.current?.scrollTop ?? 0) <= 2;

    const onWheel = (e: WheelEvent) => {
      if (animatingRef.current) {
        e.preventDefault();
        return;
      }
      if (scene === 0) {
        if (e.deltaY > 4) {
          e.preventDefault();
          go(1);
        }
      } else if (e.deltaY < -4 && atTop()) {
        e.preventDefault();
        go(0);
      }
    };

    let touchStart = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStart = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (animatingRef.current) return;
      const dy = touchStart - e.touches[0].clientY;
      if (scene === 0 && dy > 36) go(1);
      else if (scene === 1 && dy < -36 && atTop()) go(0);
    };

    const onKey = (e: KeyboardEvent) => {
      if (animatingRef.current) return;
      if (scene === 0 && ["ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (scene === 1 && ["ArrowUp", "PageUp"].includes(e.key) && atTop()) {
        e.preventDefault();
        go(0);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, go, loading, resumo, dashRef.current]);

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
  const primario = visiveis[0] ?? null;
  const secundarios = visiveis.slice(1);

  return (
    <Layout>
      <div className={`kz relative h-full ${prefersReduced ? "kz-flow overflow-auto bg-white" : "kz-jack"}`}>
        <style>{HOME_CSS}</style>

        {/* Seletor de Diretoria — só superadmin/SGJT; flutua no canto (posição de sempre). */}
        {podeSelecionarDiretoria && (
          <div className="absolute right-3 top-3 z-30 lg:right-5 lg:top-5">
            <DirectorateSelector />
          </div>
        )}

        {/* ══════════════ CENA 0 — HERO ══════════════ */}
        <section
          className={`kz-scene kz-hero flex flex-col items-center justify-center px-6 text-center ${
            scene === 0 ? "on" : "off"
          }`}
          aria-hidden={scene !== 0}
        >
          {/* Emblema — símbolo da marca (cores originais no branco) */}
          <div className="kz-symwrap relative mb-8 h-[210px] w-[210px] sm:h-[270px] sm:w-[270px]">
            <div className="kz-halo absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(30,155,215,0.22),transparent_60%)] blur-2xl" />
            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <circle className="kz-ring" cx="200" cy="200" r="196" fill="none" stroke="rgba(30,155,215,0.45)" strokeWidth="1.5" strokeDasharray="2 15" strokeLinecap="round" />
              <circle className="kz-ring-2" cx="200" cy="200" r="180" fill="none" stroke="rgba(14,61,115,0.16)" strokeWidth="1" strokeDasharray="1 20" strokeLinecap="round" />
            </svg>
            <img
              src={SIMBOLO}
              alt="Kaizen — balança da justiça no ciclo de melhoria contínua"
              className="kz-symbol absolute inset-[13%] h-[74%] w-[74%] object-contain"
              draggable={false}
            />
          </div>

          <p className="kz-in-1 mb-3 text-[12px] font-medium uppercase tracking-[0.34em] text-[var(--azure)]">
            {saudacao()}, {nome}
          </p>
          <h1 className="kz-in-2 kz-display text-[clamp(3rem,9vw,7rem)] font-extrabold leading-[0.9] tracking-[-0.035em] text-[var(--navy)]">
            Kaizen
          </h1>
          <p className="kz-in-3 mt-4 max-w-xl text-balance text-lg text-[var(--g2)] sm:text-xl">
            Melhoria contínua da governança judiciária e tecnológica.
          </p>

          <div className="kz-in-4 mt-8 flex flex-wrap items-center justify-center gap-3">
            {emDia ? (
              <span className="kz-chip inline-flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm text-[var(--ink)]">
                <Check className="h-4 w-4 text-[var(--cyan)]" strokeWidth={2.5} />
                Tudo resolvido — nenhuma pendência aguardando você.
              </span>
            ) : (
              <button
                onClick={() => go(1)}
                className="kz-chip inline-flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm text-[var(--ink)]"
              >
                <span className="kz-display text-base font-bold text-[var(--cyan)]">
                  {totalPend}
                </span>
                {totalPend === 1 ? "item aguarda" : "itens aguardam"} sua ação
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Cue de scroll → troca de cena */}
          <button
            onClick={() => go(1)}
            aria-label="Ver pendências e módulos"
            className="kz-cue absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 text-[var(--g3)] hover:text-[var(--azure)]"
          >
            <span className="text-[11px] uppercase tracking-[0.2em]">
              Role para continuar
            </span>
            <ChevronDown className="h-5 w-5" />
          </button>
        </section>

        {/* ══════════════ CENA 1 — DASHBOARD ══════════════ */}
        <div
          ref={dashRef}
          className={`kz-scene kz-dash ${scene === 1 ? "on" : "off"}`}
          aria-hidden={scene !== 1}
        >
          <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
            {/* Voltar ao início */}
            <button
              onClick={() => go(0)}
              className="mb-10 inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--g3)] hover:text-[var(--azure)]"
            >
              <ChevronUp className="h-4 w-4" />
              Voltar ao início
            </button>

            {/* Sua fila */}
            <div className="mb-16">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--azure)]">
                Sua fila
              </p>
              {emDia ? (
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--cyan)] text-[var(--cyan)]">
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                  <div>
                    <h2 className="kz-display text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">
                      Tudo resolvido.
                    </h2>
                    <p className="mt-1 text-[15px] text-[var(--g2)]">
                      Nenhuma pendência aguardando você agora.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="kz-display mb-6 text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">
                    O que precisa de você agora.
                  </h2>
                  <ul className="border-t border-[var(--line)]">
                    {pendencias.map((p, i) => (
                      <li key={i}>
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
                </>
              )}
            </div>

            {/* Módulos */}
            {primario && (
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--azure)]">
                  Módulos
                </p>
                <h2 className="kz-display mb-8 text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">
                  Onde o trabalho acontece.
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Link
                    to={primario.link}
                    className="kz-tile group col-span-1 flex flex-col justify-between overflow-hidden p-7 sm:col-span-3 sm:p-9"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <h3 className="kz-tt kz-display text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">
                          {primario.label}
                        </h3>
                        <div className="kz-underline mt-2 h-[2px] w-10 bg-[var(--cyan)]" />
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
                            <CountUp value={proj.total} active={scene === 1} />
                          </span>
                          <span className="text-[13px] text-[var(--g3)]">em execução</span>
                        </span>
                        {proj.em_atraso > 0 && (
                          <span className="flex items-baseline gap-2">
                            <span className="kz-display text-4xl font-bold text-[#B4780A] sm:text-5xl">
                              <CountUp value={proj.em_atraso} active={scene === 1} />
                            </span>
                            <span className="text-[13px] text-[var(--g3)]">em atraso</span>
                          </span>
                        )}
                      </div>
                    )}
                  </Link>

                  {secundarios.map((m) => (
                    <Link
                      key={m.key}
                      to={m.link}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
