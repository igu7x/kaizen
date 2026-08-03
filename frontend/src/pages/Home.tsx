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

function dateline() {
  const d = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/**
 * Direção de arte: "Broadsheet". A home como primeira página de um jornal sério — masthead,
 * fio oxblood, manchete gigante em serifa (Fraunces), listas editoriais com fios capilares e
 * números tabulares. Tipografia é a protagonista; a cor (oxblood) é o único acento, cirúrgico.
 */
const BROADSHEET_CSS = `
  .bs {
    --paper: #FAF8F3;
    --ink: #1A1A1A;
    --ink2: #5C574F;
    --ink3: #A39C8F;
    --line: rgba(26, 22, 18, 0.14);
    --ox: #8C2F27;
  }
  .bs-serif {
    font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
    font-optical-sizing: auto;
  }
  .bs-kicker { font-variant-numeric: tabular-nums; }
  .bs-tnum { font-variant-numeric: tabular-nums; }

  @keyframes bs-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  @keyframes bs-draw { from { transform: scaleX(0); } to { transform: scaleX(1); } }

  .bs-rise { opacity: 0; animation: bs-rise 0.85s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
  .bs-rule { transform: scaleX(0); transform-origin: left; animation: bs-draw 1.15s cubic-bezier(0.2, 0.7, 0.2, 1) 0.15s forwards; }

  .bs-item { transition: color 0.25s ease, padding-left 0.35s cubic-bezier(0.2, 0.7, 0.2, 1); }
  .bs-item:hover { color: var(--ox); }
  @media (hover: hover) {
    .bs-item:hover { padding-left: 0.5rem; }
  }
  .bs-arrow { transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1), color 0.25s ease; }
  .bs-item:hover .bs-arrow { transform: translate(3px, -3px); }

  @media (prefers-reduced-motion: reduce) {
    .bs-rise, .bs-rule { animation: none; opacity: 1; transform: none; }
    .bs-item, .bs-arrow { transition: none; }
    .bs-item:hover { padding-left: 0; }
  }
`;

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
        <div className="bs min-h-[60vh] bg-[var(--paper)]">
          <style>{BROADSHEET_CSS}</style>
          <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 pt-24 text-center">
            <p className="bs-serif italic text-2xl text-[var(--ink3)]">
              Compondo a edição…
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!resumo) {
    return (
      <Layout>
        <div className="bs min-h-[60vh] bg-[var(--paper)]">
          <style>{BROADSHEET_CSS}</style>
          <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 pt-24">
            <p className="bs-serif text-2xl text-[var(--ink2)]">
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

  const lead = emDia
    ? "A fila está limpa. Bom momento para revisar o que vem a seguir."
    : `${totalPendencias} ${totalPendencias === 1 ? "item exige" : "itens exigem"} sua atenção hoje.`;

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
  const temProjetos = resumo.projetos.total > 0;

  return (
    <Layout>
      <div className="bs relative min-h-full bg-[var(--paper)] text-[var(--ink)]">
        <style>{BROADSHEET_CSS}</style>

        <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 pb-28">
          {/* ── MASTHEAD ───────────────────────────────────────────── */}
          <header className="pt-7 sm:pt-9">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="flex items-baseline gap-3">
                <span
                  className="bs-serif text-2xl leading-none"
                  aria-hidden="true"
                >
                  改善
                </span>
                <span className="text-[13px] font-semibold uppercase tracking-[0.34em]">
                  Kaizen
                </span>
              </div>
              <div className="flex items-center gap-5">
                <span className="hidden md:block text-[11px] uppercase tracking-[0.22em] text-[var(--ink3)]">
                  Governança Judiciária e Tecnológica
                </span>
                {podeSelecionarDiretoria && <DirectorateSelector />}
              </div>
            </div>

            <div
              className="mt-3 h-[2px] w-full origin-left bg-[var(--ox)] bs-rule"
              aria-hidden="true"
            />

            <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--ink3)] bs-kicker">
              <span>Poder Judiciário · TJGO</span>
              <span>{dateline()}</span>
            </div>
          </header>

          {/* ── LEAD / MANCHETE ────────────────────────────────────── */}
          <section className="mt-14 sm:mt-20 grid grid-cols-12 gap-x-6 gap-y-10 items-start">
            <div className="col-span-12 lg:col-span-8 bs-rise">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--ox)] mb-5">
                A sua edição de hoje
              </p>
              <h1 className="bs-serif font-medium tracking-tight leading-[0.92] text-[3.15rem] sm:text-[4.75rem] lg:text-[5.5rem]">
                {saudacao()},<br />
                <span className="italic">{nome}.</span>
              </h1>
              <div className="mt-7 flex items-start gap-4 max-w-lg">
                <span
                  className="mt-3 h-px w-14 shrink-0 bg-[var(--ink)]"
                  aria-hidden="true"
                />
                <p className="bs-serif text-lg sm:text-xl text-[var(--ink2)] leading-snug">
                  {lead}
                </p>
              </div>
            </div>

            <aside
              className="col-span-12 lg:col-span-4 lg:pl-8 lg:border-l lg:border-[var(--line)] bs-rise"
              style={{ animationDelay: "120ms" }}
            >
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--ink3)]">
                Na sua fila
              </p>
              <div className="mt-1 flex items-start gap-4">
                <span
                  className={`bs-serif bs-tnum leading-[0.78] text-[6.5rem] sm:text-[7.5rem] ${
                    emDia ? "text-[var(--ink3)]" : "text-[var(--ox)]"
                  }`}
                >
                  {pad2(totalPendencias)}
                </span>
                <span className="mt-4 text-sm leading-snug text-[var(--ink2)]">
                  {emDia ? (
                    <>
                      tudo
                      <br />
                      em dia
                    </>
                  ) : (
                    <>
                      {totalPendencias === 1 ? "item" : "itens"}
                      <br />
                      aguardando
                    </>
                  )}
                </span>
              </div>
            </aside>
          </section>

          {/* ── PENDÊNCIAS ─────────────────────────────────────────── */}
          <section
            className="mt-16 sm:mt-24 bs-rise"
            style={{ animationDelay: "200ms" }}
            aria-labelledby="h-pendencias"
          >
            <div className="flex items-baseline justify-between border-b border-[var(--ink)] pb-2">
              <h2
                id="h-pendencias"
                className="text-xs font-semibold uppercase tracking-[0.24em]"
              >
                Pendências
              </h2>
              <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)]">
                {emDia && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[var(--ox)]"
                    aria-hidden="true"
                  />
                )}
                {emDia ? "Em dia" : "Exigem ação"}
              </span>
            </div>

            {emDia ? (
              <p className="bs-serif italic text-2xl sm:text-3xl text-[var(--ink2)] leading-snug py-10 max-w-2xl">
                Nada aguarda você agora — a melhoria contínua também é saber
                quando o ciclo está em ordem.
              </p>
            ) : (
              <ul>
                {resumo.pendencias.map((p, i) => (
                  <li key={i}>
                    <button
                      onClick={() => navigate(p.link)}
                      className="bs-item group flex w-full items-center gap-5 border-b border-[var(--line)] py-5 text-left sm:gap-8"
                    >
                      <span className="bs-serif bs-tnum w-12 shrink-0 text-3xl sm:text-4xl text-[var(--ink)] transition-colors group-hover:text-[var(--ox)]">
                        {pad2(p.count)}
                      </span>
                      <span className="bs-serif flex-1 text-xl leading-snug sm:text-2xl">
                        {p.label}
                      </span>
                      <span className="hidden text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)] transition-colors group-hover:text-[var(--ox)] sm:inline">
                        Resolver
                      </span>
                      <ArrowUpRight className="bs-arrow h-5 w-5 shrink-0 text-[var(--ink3)] group-hover:text-[var(--ox)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── PROJETOS ───────────────────────────────────────────── */}
          {temProjetos && (
            <section
              className="mt-16 sm:mt-20 bs-rise"
              style={{ animationDelay: "260ms" }}
              aria-labelledby="h-projetos"
            >
              <div className="flex items-baseline justify-between border-b border-[var(--ink)] pb-2">
                <h2
                  id="h-projetos"
                  className="text-xs font-semibold uppercase tracking-[0.24em]"
                >
                  Seus projetos
                </h2>
                <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)]">
                  Em execução
                </span>
              </div>
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

          {/* ── ACESSOS ────────────────────────────────────────────── */}
          {atalhosVisiveis.length > 0 && (
            <section
              className="mt-16 sm:mt-20 bs-rise"
              style={{ animationDelay: "320ms" }}
              aria-labelledby="h-acessos"
            >
              <div className="flex items-baseline justify-between border-b border-[var(--ink)] pb-2">
                <h2
                  id="h-acessos"
                  className="text-xs font-semibold uppercase tracking-[0.24em]"
                >
                  Acessos
                </h2>
                <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)]">
                  Ir direto
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2">
                {atalhosVisiveis.map((a, i) => (
                  <Link
                    key={i}
                    to={a.link}
                    className="bs-item group flex items-start gap-5 border-b border-[var(--line)] py-6 md:odd:border-r md:odd:border-r-[var(--line)] md:odd:pr-8 md:even:pl-8"
                  >
                    <span className="bs-serif bs-tnum pt-1 text-sm text-[var(--ink3)] transition-colors group-hover:text-[var(--ox)]">
                      {pad2(i + 1)}
                    </span>
                    <div className="flex-1">
                      <h3 className="bs-serif text-2xl leading-tight transition-colors group-hover:text-[var(--ox)]">
                        {a.label}
                      </h3>
                      <p className="mt-1.5 text-sm text-[var(--ink2)]">
                        {a.desc}
                      </p>
                    </div>
                    <ArrowUpRight className="bs-arrow mt-1.5 h-4 w-4 shrink-0 text-[var(--ink3)] group-hover:text-[var(--ox)]" />
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
      className="bs-item group border-[var(--line)] py-6 pr-4 text-left [&:not(:first-child)]:border-l [&:not(:first-child)]:pl-5 sm:[&:not(:first-child)]:pl-8"
    >
      <span
        className={`bs-serif bs-tnum block text-5xl leading-none sm:text-6xl ${
          accent ? "text-[var(--ox)]" : "text-[var(--ink)]"
        }`}
      >
        {n}
      </span>
      <span className="mt-3 block text-[11px] uppercase tracking-[0.2em] text-[var(--ink3)] transition-colors group-hover:text-[var(--ink)]">
        {label}
      </span>
    </button>
  );
}
