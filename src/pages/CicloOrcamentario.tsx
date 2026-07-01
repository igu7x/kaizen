import { useMemo, useState, type ReactNode } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  Settings2,
  Plus,
  RefreshCw,
  ArrowRight,
  CalendarClock,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CicloTimeline } from "@/components/contratacoes/ciclo/CicloTimeline";
import {
  NOS_FORMACAO,
  nosRevisao,
  rotuloVersao,
} from "@/components/contratacoes/ciclo/cicloConstants";
import {
  resolverJanelaRevisao,
  type FinalidadeCiclo,
} from "@/services/cicloOrcamentarioApi";

/**
 * Ciclo Orçamentário — a oficina onde se produz ou altera um PCA-TIC (RF-59/60).
 * A entrada bifurca por finalidade (Formação | Revisão). A janela de revisão vigente é
 * resolvida pela data corrente (RF-60). Enquanto o backend do ciclo não existe, esta tela
 * já entrega a entrada e a linha do tempo; as esteiras detalhadas serão ligadas ao backend.
 */
export default function CicloOrcamentario() {
  const hoje = useMemo(() => new Date(), []);
  const anoVigente = hoje.getFullYear();
  const anoFormacao = anoVigente + 1;
  const janela = useMemo(
    () => resolverJanelaRevisao(hoje, anoVigente),
    [hoje, anoVigente],
  );

  const [finalidade, setFinalidade] = useState<FinalidadeCiclo | null>(null);

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
            onClick={() => setFinalidade("formacao")}
            icon={<Plus className="h-6 w-6" />}
            iconClass="bg-blue-50 text-blue-700"
            titulo={`Formação PCA – ${anoFormacao}`}
            descricao={`Elaboração do plano do próximo exercício. Aberta automaticamente na virada de 1º de janeiro. Gera a Versão 1 de ${anoFormacao}.`}
            metas={[
              { texto: "Aberto · aguardando PROAD", tom: "blue" },
              { texto: "rito ordinário · 31/01–31/05", tom: "plain" },
            ]}
            cta="Abrir formação"
          />
          <EntryCard
            selecionado={finalidade === "revisao"}
            onClick={() => setFinalidade("revisao")}
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

        {/* Linha do tempo da finalidade selecionada */}
        {finalidade === "formacao" && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Linha do tempo · Formação {anoFormacao}
            </h2>
            <CicloTimeline
              pernas={NOS_FORMACAO}
              activeIndex={0}
              showMarcoLegend
            />
            <p className="text-xs text-slate-400">
              11 fases, de 31/01 a 31/05 (RF-42). A publicação pela DG é o marco
              de virada que grava a Versão 1 no PCA-TIC.
            </p>
          </section>
        )}

        {finalidade === "revisao" && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {janela.ativa
                ? `Rito da ${janela.calendario.ordem}ª revisão · gera ${rotuloVersao(janela.calendario.versao)}`
                : "Revisão · nenhuma janela aberta"}
            </h2>
            {janela.ativa ? (
              <>
                <CicloTimeline
                  pernas={nosRevisao(janela.calendario)}
                  activeIndex={0}
                />
                <p className="text-xs text-slate-400">
                  Rito ágil: dias 07 → 15 → 20 do mês de apuração (RF-70/RF-78).
                </p>
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
            className={cn(
              "rounded px-2 py-1 font-semibold",
              META_TOM[m.tom],
            )}
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
