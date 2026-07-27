import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rotuloVersao } from "@/components/contratacoes/ciclo/cicloConstants";
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
  aberto: 0,
  em_consulta_1: 1,
  em_consulta_2: 1,
  consolidacao_cca: 2,
  validacao_gejut: 2,
  apreciacao_sgjt: 3,
  em_comites: 4,
  autorizado: 5,
  ajuste_pre_publicacao: 7,
  remessa_dg: 9,
  publicado: 10,
};

const ESTADO_LABEL: Record<string, string> = {
  aberto: "Janela Inicial (DFD-Consulta)",
  em_consulta_1: "Consulta (1ª Validação)",
  em_consulta_2: "Consulta (2ª Validação)",
  consolidacao_cca: "Consolidação DFD-Sistematização",
  validacao_gejut: "Validação (GEJUT)",
  apreciacao_sgjt: "Apreciação (SGJT)",
  em_comites: "Em comitês",
  autorizado: "Autorizado",
  ajuste_pre_publicacao: "Ajuste pré-publicação",
  remessa_dg: "Remessa à DG",
  publicado: "Publicado",
};

function estadoLabel(e?: string | null): string {
  return e ? ESTADO_LABEL[e] ?? e : "";
}

export default function CicloOrcamentario() {
  const navigate = useNavigate();
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

  const abrirFormacao = () => {
    navigate("/ciclo-orcamentario/formacao");
  };

  const abrirRevisao = () => {
    navigate("/ciclo-orcamentario/revisao");
  };

  const formacaoEstado = ciclo?.finalidade === "formacao" ? ciclo.estado : null;
  const aguardandoProad = formacaoEstado === "aguardando_proad";

  return (
    <Layout>
      <div className="space-y-6 page-transition-enter">
        <Breadcrumbs
          items={[
            { label: "Contratações de TIC", to: "/pca" },
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
          <EntryCard
            selecionado={finalidade === "formacao"}
            onClick={abrirFormacao}
            icon={<Plus className="h-6 w-6" />}
            iconClass="bg-blue-50 text-blue-700"
            titulo={
              entrada?.formacao?.estado === "publicado"
                ? `Revisão PCA ${anoFormacao}`
                : `Formação PCA – ${anoFormacao}`
            }
            descricao={`Elaboração do plano do próximo exercício. Aberta automaticamente na virada de 1º de janeiro. Gera a Versão 1 de ${anoFormacao}.`}
            metas={[
              {
                texto: entrada?.formacao
                  ? estadoLabel(entrada.formacao.estado)
                  : "Aberto · aguardando PROAD",
                tom: "blue",
              },
              { texto: "rito ordinário · 31/01–31/03", tom: "plain" },
            ]}
            cta={
              entrada?.formacao?.estado === "publicado"
                ? "Abrir revisão"
                : "Abrir formação"
            }
          />
        </div>
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
