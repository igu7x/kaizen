import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DirectorateSelector } from "@/components/gestao/DirectorateSelector";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpRight, Check } from "lucide-react";
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

function dataCurta() {
  const d = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return d.replace(".", "").replace(/\bde\b/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Sistema visual da home — extraído das referências (Mercury, Linear-app, Stripe Dashboard,
 * Vercel/Geist, suíço/Vignelli, Muji/Hara): restrição, grid disciplinado, hierarquia por peso
 * e não por cor, ornamento zero, densidade útil. Sem sombra, sem gradiente, sem ícone
 * decorativo. Space Grotesk só em títulos/rótulos; corpo em sans neutra; números em mono
 * tabular. Neutros com viés frio (em direção ao azul da marca). Desenhada para o estado ZERO
 * como caso principal — "Tudo resolvido" é um resultado, não uma ausência.
 */
const HM_CSS = `
  .hm {
    --bg: #F6F8FB;
    --surface: #FFFFFF;
    --ink: #152536;
    --g2: #56637A;
    --g3: #8A93A3;
    --line: #E4E8EF;
    --line-strong: #C7D0DC;
    --navy: #0E3D73;
    --azure: #1478B4;
    --amber: #A96A08;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: var(--ink);
  }
  .hm-display { font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif; }
  .hm-mono {
    font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .hm-label {
    font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 11px;
    font-weight: 600;
    color: var(--g3);
  }

  .hm-tile {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  .hm-tile:hover { border-color: var(--navy); }
  .hm-tile:focus-visible { outline: 2px solid var(--azure); outline-offset: 2px; }
  .hm-tile .hm-tile-title { transition: color 0.15s ease; }
  .hm-tile:hover .hm-tile-title { color: var(--azure); }

  .hm-row { transition: background-color 0.15s ease; }
  .hm-row:hover { background: #EDF2F8; }
  .hm-row .hm-row-label { transition: color 0.15s ease; }
  .hm-row:hover .hm-row-label { color: var(--azure); }
  .hm-row:focus-visible { outline: 2px solid var(--azure); outline-offset: -2px; border-radius: 4px; }
  .hm-arrow { transition: transform 0.2s ease, color 0.15s ease; }
  .hm-row:hover .hm-arrow, .hm-tile:hover .hm-arrow { transform: translate(2px, -2px); color: var(--azure); }

  @keyframes hm-in { from { opacity: 0; } to { opacity: 1; } }
  .hm-in { animation: hm-in 0.4s ease both; }
  @media (prefers-reduced-motion: reduce) {
    .hm-in { animation: none; }
    .hm-arrow, .hm-tile, .hm-row, .hm-tile-title, .hm-row-label { transition: none; }
  }
`;

interface Modulo {
  key: string;
  label: string;
  desc: string;
  link: string;
  permissaoCodigo: string;
}

// Hierarquia FIXA por importância de negócio (nunca muda com o dado): o 1º módulo permitido é o
// primário (tile largo); os demais são pares. Só o conteúdo/sinal interno de cada tile varia.
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

  useEffect(() => {
    homeApi
      .getResumo()
      .then(setResumo)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const shell = (children: React.ReactNode) => (
    <Layout>
      <div className="hm min-h-full bg-[var(--bg)]">
        <style>{HM_CSS}</style>
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">{children}</div>
      </div>
    </Layout>
  );

  if (loading) {
    return shell(
      <div className="py-24 text-center text-sm text-[var(--g3)]">
        Carregando…
      </div>,
    );
  }
  if (!resumo) {
    return shell(
      <div className="py-24 text-[var(--g2)]">
        Não foi possível carregar o resumo.
      </div>,
    );
  }

  const nome = primeiroNome(resumo.user.name);
  const emDia = resumo.pendencias.every((p) => p.count <= 0);
  const pendencias = resumo.pendencias.filter((p) => p.count > 0);

  const visiveis = MODULOS.filter((m) => podeAcessar(m.permissaoCodigo));
  const primario = visiveis[0] ?? null;
  const secundarios = visiveis.slice(1);
  const proj = resumo.projetos;

  return shell(
    <div className="hm-in">
      {/* ── Barra de contexto: saudação + filtro global de Diretoria ─── */}
      <div className="flex h-14 items-center justify-between gap-4 border-b border-[var(--line)]">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="hm-display truncate text-[20px] font-semibold text-[var(--navy)]">
            {saudacao()}, {nome}.
          </h1>
          <span className="hidden text-[13px] text-[var(--g3)] sm:inline">
            · {dataCurta()}
          </span>
        </div>
        {podeSelecionarDiretoria && (
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="hm-label hidden sm:inline">Diretoria</span>
            <DirectorateSelector />
          </div>
        )}
      </div>

      {/* ── Sua fila: ZERO é o caso principal (resultado, não ausência) ── */}
      <div className="border-b border-[var(--line)] py-5">
        {emDia ? (
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[var(--azure)] text-[var(--azure)]">
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div>
              <p className="hm-display text-[15px] font-semibold text-[var(--navy)]">
                Tudo resolvido
              </p>
              <p className="text-[13px] text-[var(--g2)]">
                Nenhuma pendência aguardando você.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="hm-label mb-1">Sua fila</h2>
            <ul className="divide-y divide-[var(--line)]">
              {pendencias.map((p, i) => (
                <li key={i}>
                  <button
                    onClick={() => navigate(p.link)}
                    className="hm-row group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 px-2 py-2.5 text-left"
                  >
                    <span className="hm-mono w-8 shrink-0 text-right text-[15px] text-[var(--navy)]">
                      {p.count}
                    </span>
                    <span className="hm-row-label flex-1 truncate text-[14px] text-[var(--ink)]">
                      {p.label}
                    </span>
                    <ArrowUpRight className="hm-arrow h-4 w-4 shrink-0 text-[var(--g3)]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Módulos: o coração da página, geometria fixa ──────────────── */}
      {primario && (
        <div className="py-6">
          <h2 className="hm-label mb-3">Módulos</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Primário (largo) */}
            <Link
              to={primario.link}
              className="hm-tile group col-span-1 flex flex-col p-5 sm:col-span-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="hm-tile-title hm-display text-[18px] font-semibold text-[var(--navy)]">
                    {primario.label}
                  </h3>
                  <p className="mt-1 text-[13px] text-[var(--g2)]">
                    {primario.desc}
                  </p>
                </div>
                <ArrowUpRight className="hm-arrow h-4 w-4 shrink-0 text-[var(--g3)]" />
              </div>

              {/* Sinal intrínseco — só o módulo de Projetos tem métrica própria. */}
              {primario.key === "projetos" && (
                <div className="mt-5 flex items-baseline gap-6">
                  {proj.total > 0 ? (
                    <>
                      <span className="flex items-baseline gap-1.5">
                        <span className="hm-mono text-[24px] text-[var(--navy)]">
                          {proj.total}
                        </span>
                        <span className="text-[12px] text-[var(--g3)]">
                          em execução
                        </span>
                      </span>
                      {proj.em_atraso > 0 && (
                        <span className="flex items-baseline gap-1.5">
                          <span className="hm-mono text-[24px] text-[var(--amber)]">
                            {proj.em_atraso}
                          </span>
                          <span className="text-[12px] text-[var(--g3)]">
                            em atraso
                          </span>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[13px] text-[var(--g3)]">
                      Nenhum projeto em execução.
                    </span>
                  )}
                </div>
              )}
            </Link>

            {/* Secundários (pares) */}
            {secundarios.map((m) => (
              <Link
                key={m.key}
                to={m.link}
                className="hm-tile group flex flex-col p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="hm-tile-title hm-display text-[15px] font-semibold text-[var(--navy)]">
                    {m.label}
                  </h3>
                  <ArrowUpRight className="hm-arrow h-3.5 w-3.5 shrink-0 text-[var(--g3)]" />
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-[var(--g2)]">
                  {m.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>,
  );
}
