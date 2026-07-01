import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Settings2,
  Plus,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  Info,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CicloTimeline } from "@/components/contratacoes/ciclo/CicloTimeline";
import { RevisaoItens } from "@/components/contratacoes/ciclo/RevisaoItens";
import {
  NOS_FORMACAO,
  nosRevisao,
  rotuloVersao,
} from "@/components/contratacoes/ciclo/cicloConstants";
import {
  cicloOrcamentarioApi,
  resolverJanelaRevisao,
  type FinalidadeCiclo,
  type Ciclo,
  type EntradaCiclo,
} from "@/services/cicloOrcamentarioApi";

/**
 * Ciclo Orçamentário — a oficina onde se produz ou altera um PCA-TIC (RF-59/60).
 * A entrada bifurca por finalidade (Formação | Revisão). A janela de revisão vigente é resolvida
 * pela data corrente (RF-60). Consulta o backend (/api/ciclo-orcamentario) para o estado persistido
 * dos ciclos; se o backend estiver indisponível, degrada para a resolução client-side.
 */

/** Índice do nó ativo na timeline da Formação (11 nós) a partir do estado do ciclo. */
const IDX_FORMACAO: Record<string, number> = {
  aberto_aguardando_proad: 0,
  em_consulta: 1,
  retorno_areas: 2,
  consolidacao_cca: 2,
  validacao_gejut: 2,
  apreciacao_sgjt: 3,
  em_comites: 4,
  autorizado: 5,
  ajuste_pre_publicacao: 7,
  remessa_dg: 9,
  publicado: 10,
};

/** Índice do nó ativo na timeline da Revisão (4 nós) a partir do estado do ciclo. */
const IDX_REVISAO: Record<string, number> = {
  janela_aberta: 0,
  em_rito_validacao: 1,
  consolidacao_cca: 1,
  em_comites: 2,
  remessa_dg: 3,
  publicado: 3,
};

const ESTADO_LABEL: Record<string, string> = {
  aberto_aguardando_proad: "Aberto · aguardando PROAD",
  em_consulta: "Em consulta",
  retorno_areas: "Retorno das áreas",
  consolidacao_cca: "Consolidação (CCA)",
  validacao_gejut: "Validação (GEJUT)",
  apreciacao_sgjt: "Apreciação (SGJT)",
  em_comites: "Em comitês",
  autorizado: "Autorizado",
  ajuste_pre_publicacao: "Ajuste pré-publicação",
  remessa_dg: "Remessa à DG",
  janela_aberta: "Janela aberta",
  em_rito_validacao: "Em rito de validação",
  publicado: "Publicado",
};

function estadoLabel(e?: string | null): string {
  return e ? ESTADO_LABEL[e] ?? e : "";
}

/** RNF-04/07 — ator responsável em cada estado da esteira (quem age agora). */
const ATOR_ESTADO: Record<string, string> = {
  aberto_aguardando_proad: "CCA",
  em_consulta: "Demandantes",
  retorno_areas: "Demandantes",
  consolidacao_cca: "CCA",
  validacao_gejut: "GEJUT",
  apreciacao_sgjt: "SGJT",
  em_comites: "Comitês",
  autorizado: "CCA",
  ajuste_pre_publicacao: "CCA",
  remessa_dg: "DG",
  janela_aberta: "Demandantes",
  em_rito_validacao: "Validação",
  publicado: "—",
};

/**
 * Controles da esteira (RNF-07): mostra o ator responsável pelo estado atual e permite encaminhar
 * ao próximo ator ou retornar ao anterior. O último passo (→ publicado) grava a versão no PCA-TIC.
 */
function EsteiraControls({
  ciclo,
  onAvancar,
  onRetroceder,
  disabled,
}: {
  ciclo: Ciclo;
  onAvancar: () => void;
  onRetroceder: () => void;
  disabled: boolean;
}) {
  if (ciclo.estado === "publicado") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Ciclo publicado — versão gravada no PCA-TIC.
      </div>
    );
  }
  const proximaPublicacao = ciclo.estado === "remessa_dg";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-xs text-slate-500">
        Aguardando: <b className="text-slate-700">{ATOR_ESTADO[ciclo.estado] ?? "—"}</b>
      </span>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetroceder} disabled={disabled}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Retornar
        </Button>
        <Button
          size="sm"
          onClick={onAvancar}
          disabled={disabled}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <ArrowRight className="h-4 w-4 mr-1.5" />
          {proximaPublicacao ? "Publicar (DG)" : "Encaminhar ao próximo ator"}
        </Button>
      </div>
    </div>
  );
}

export default function CicloOrcamentario() {
  const hoje = useMemo(() => new Date(), []);
  const anoVigente = hoje.getFullYear();
  const anoFormacao = anoVigente + 1;
  const janela = useMemo(
    () => resolverJanelaRevisao(hoje, anoVigente),
    [hoje, anoVigente],
  );

  const [entrada, setEntrada] = useState<EntradaCiclo | null>(null);
  const [finalidade, setFinalidade] = useState<FinalidadeCiclo | null>(null);
  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [acaoEmCurso, setAcaoEmCurso] = useState(false);
  const [proadInput, setProadInput] = useState("");

  // Carrega o estado persistido dos ciclos (RF-59/60). Degrada silenciosamente se o backend
  // ainda não estiver disponível — a resolução por data client-side mantém a tela utilizável.
  useEffect(() => {
    let cancelled = false;
    cicloOrcamentarioApi
      .getEntrada(anoVigente)
      .then((e) => {
        if (!cancelled) setEntrada(e);
      })
      .catch(() => {
        /* backend indisponível — segue no modo client-side */
      });
    return () => {
      cancelled = true;
    };
  }, [anoVigente]);

  const abrirFormacao = async () => {
    setFinalidade("formacao");
    setCiclo(entrada?.formacao ?? null);
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.getOuAbrirFormacao(anoFormacao);
      setCiclo(c);
      setProadInput(c.proad ?? "");
    } catch {
      /* backend off: segue com a timeline estática (ciclo = persistido ou null) */
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const abrirRevisao = async () => {
    setFinalidade("revisao");
    setCiclo(entrada?.revisao ?? null);
    if (!janela.ativa) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.getOuAbrirRevisao(anoVigente);
      setCiclo(c);
    } catch {
      /* backend off ou 409 sem janela: segue com a timeline estática */
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const registrarProad = async () => {
    if (!ciclo || !proadInput.trim()) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.informarProad(
        ciclo.id,
        proadInput.trim(),
      );
      setCiclo(c);
      toast.success("PROAD registrado. Ciclo instruído.");
    } catch {
      toast.error("Não foi possível registrar o PROAD.");
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const avancarEsteira = async () => {
    if (!ciclo) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.avancar(ciclo.id);
      setCiclo(c);
      toast.success(
        c.estado === "publicado" ? "Publicado. Versão gravada no PCA-TIC." : "Encaminhado ao próximo ator.",
      );
    } catch {
      toast.error("Não foi possível encaminhar (verifique o estado atual).");
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const retrocederEsteira = async () => {
    if (!ciclo) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.retroceder(ciclo.id);
      setCiclo(c);
      toast.success("Retornado ao ator anterior.");
    } catch {
      toast.error("Não foi possível retroceder.");
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const formacaoEstado = ciclo?.finalidade === "formacao" ? ciclo.estado : null;
  const aguardandoProad = formacaoEstado === "aberto_aguardando_proad";

  return (
    <Layout>
      <div className="space-y-6 page-transition-enter">
        <Breadcrumbs
          items={[
            { label: "Contratações de TIC", to: "/contratacoes-ti/novas" },
            { label: "Orçamento" },
            { label: "Ciclo Orçamentário" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Settings2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Ciclo Orçamentário
            </h1>
            <p className="text-gray-500 text-sm">
              Oficina de formação e revisão · produção de versões oficiais do
              PCA-TIC
            </p>
          </div>
        </div>

        {/* Entrada: dois botões por finalidade (RF-59) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EntryCard
            selecionado={finalidade === "formacao"}
            onClick={abrirFormacao}
            icon={<Plus className="h-6 w-6" />}
            iconClass="bg-blue-50 text-blue-700"
            titulo={`Formação PCA – ${anoFormacao}`}
            descricao={`Elaboração do plano do próximo exercício. Aberta automaticamente na virada de 1º de janeiro. Gera a Versão 1 de ${anoFormacao}.`}
            metas={[
              {
                texto: entrada?.formacao
                  ? estadoLabel(entrada.formacao.estado)
                  : "Aberto · aguardando PROAD",
                tom: "blue",
              },
              { texto: "rito ordinário · 31/01–31/05", tom: "plain" },
            ]}
            cta="Abrir formação"
          />
          <EntryCard
            selecionado={finalidade === "revisao"}
            onClick={abrirRevisao}
            icon={<RefreshCw className="h-6 w-6" />}
            iconClass="bg-emerald-50 text-emerald-700"
            titulo={`Revisão PCA – ${anoVigente}`}
            descricao="Revisão do plano vigente. Três janelas ordinárias ao ano; cada publicação gera a próxima versão (V2, V3, V4)."
            metas={
              janela.ativa
                ? [
                    {
                      texto: `${janela.calendario.ordem}ª revisão · janela aberta`,
                      tom: "amber",
                    },
                    {
                      texto: `gera ${rotuloVersao(janela.calendario.versao)}`,
                      tom: "plain",
                    },
                  ]
                : [
                    {
                      texto: `próxima janela · ${janela.proximaAberturaEm ?? "—"}`,
                      tom: "gray",
                    },
                  ]
            }
            cta="Abrir revisão"
          />
        </div>

        <NotaInfo>
          A entrada bifurca por finalidade. A tela seguinte é resolvida por
          <b> estado × papel × data</b> — o usuário não escolhe qual das três
          revisões; o sistema resolve pelo calendário (RF-59/RF-60).
        </NotaInfo>

        {/* Formação */}
        {finalidade === "formacao" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Linha do tempo · Formação {anoFormacao}
              </h2>
              {formacaoEstado && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {estadoLabel(formacaoEstado)}
                  {ciclo?.proad ? ` · PROAD ${ciclo.proad}` : ""}
                </span>
              )}
            </div>

            {/* RF-22: registrar o PROAD de instrução */}
            {aguardandoProad && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Instruir o ciclo
                </p>
                <p className="mt-0.5 mb-3 text-xs text-slate-500">
                  Informe o PROAD de instrução para carregar os quatro blocos do
                  DFD-Consulta. Vira chave-container e de monitoramento (RF-22).
                </p>
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Número do PROAD
                    </label>
                    <Input
                      value={proadInput}
                      onChange={(e) => setProadInput(e.target.value)}
                      placeholder="ex.: 202700004821"
                      className="w-56 font-mono"
                    />
                  </div>
                  <Button
                    onClick={registrarProad}
                    disabled={acaoEmCurso || !proadInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {acaoEmCurso ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Registrar PROAD
                  </Button>
                </div>
              </div>
            )}

            <CicloTimeline
              pernas={NOS_FORMACAO}
              activeIndex={
                formacaoEstado != null ? IDX_FORMACAO[formacaoEstado] ?? 0 : 0
              }
              showMarcoLegend
            />
            <p className="text-xs text-slate-400">
              11 fases, de 31/01 a 31/05 (RF-42). A publicação pela DG é o marco
              de virada que grava a Versão 1 no PCA-TIC.
            </p>
            {ciclo?.finalidade === "formacao" && (
              <EsteiraControls
                ciclo={ciclo}
                onAvancar={avancarEsteira}
                onRetroceder={retrocederEsteira}
                disabled={acaoEmCurso}
              />
            )}
          </section>
        )}

        {/* Revisão */}
        {finalidade === "revisao" && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {janela.ativa
                  ? `Rito da ${janela.calendario.ordem}ª revisão · gera ${rotuloVersao(janela.calendario.versao)}`
                  : "Revisão · nenhuma janela aberta"}
              </h2>
              {ciclo?.finalidade === "revisao" && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {estadoLabel(ciclo.estado)}
                </span>
              )}
            </div>
            {janela.ativa ? (
              <>
                <CicloTimeline
                  pernas={nosRevisao(janela.calendario)}
                  activeIndex={
                    ciclo?.finalidade === "revisao"
                      ? IDX_REVISAO[ciclo.estado] ?? 0
                      : 0
                  }
                />
                <p className="text-xs text-slate-400">
                  Rito ágil: dias 07 → 15 → 20 do mês de apuração (RF-70/RF-78).
                </p>
                {ciclo?.finalidade === "revisao" && (
                  <EsteiraControls
                    ciclo={ciclo}
                    onAvancar={avancarEsteira}
                    onRetroceder={retrocederEsteira}
                    disabled={acaoEmCurso}
                  />
                )}
                <RevisaoItens
                  anoVigente={anoVigente}
                  editavel={
                    ciclo?.finalidade === "revisao" &&
                    (ciclo.estado === "janela_aberta" ||
                      ciclo.estado === "em_rito_validacao")
                  }
                />
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-col items-center justify-center text-center px-6 py-12">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <CalendarClock className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">
                    A próxima janela de revisão abre em{" "}
                    {janela.proximaAberturaEm ?? "—"}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-slate-500">
                    Fora das janelas, os itens permanecem como na versão vigente
                    do PCA-TIC. Cronograma das ordinárias: 1ª · pub→31/01 (V2) ·
                    2ª · 01–30/04 (V3) · 3ª · 01–31/07 (V4).
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </Layout>
  );
}

// ============================================================
// Subcomponentes de apresentação
// ============================================================

type MetaTom = "blue" | "amber" | "gray" | "plain";

const META_TOM: Record<MetaTom, string> = {
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  gray: "bg-slate-100 text-slate-500",
  plain: "text-slate-400",
};

function EntryCard({
  selecionado,
  onClick,
  icon,
  iconClass,
  titulo,
  descricao,
  metas,
  cta,
}: {
  selecionado: boolean;
  onClick: () => void;
  icon: ReactNode;
  iconClass: string;
  titulo: string;
  descricao: string;
  metas: { texto: string; tom: MetaTom }[];
  cta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border bg-white p-6 transition-all",
        selecionado
          ? "border-blue-500 shadow-[0_4px_18px_rgba(47,84,235,0.10)]"
          : "border-slate-200 hover:border-blue-400 hover:shadow-sm",
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-xl",
          iconClass,
        )}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        {descricao}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        {metas.map((m, i) => (
          <span
            key={i}
            className={cn("rounded px-2 py-1 font-semibold", META_TOM[m.tom])}
          >
            {m.texto}
          </span>
        ))}
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700">
        {cta} <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function NotaInfo({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-r-lg border border-l-[3px] border-slate-200 border-l-blue-500 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
      <p>{children}</p>
    </div>
  );
}
