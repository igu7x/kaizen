import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  BookOpen,
  Users,
  UserCog,
  FileDown,
} from "lucide-react";
import {
  competenciasPadraoApi,
  CompetenciaPadrao,
} from "@/services/competenciasPadraoApi";
import { generateCompetenciasPadraoPDF } from "@/utils/generateCompetenciasPadraoPDF";

interface CompetenciasPadraoViewProps {
  /** Quando true, mostra alternância entre formulário tipo equipe e tipo gestor */
  podeAlternarTipo: boolean;
  onVoltar: () => void;
}

type TipoFormulario = "equipe" | "gestor";

const SECAO_LABEL: Record<
  string,
  { titulo: string; descricao: string; cor: string }
> = {
  comportamental: {
    titulo: "Competências Comportamentais",
    descricao: "Comuns aos formulários da equipe e do gestor.",
    cor: "text-violet-600",
  },
  estrategica: {
    titulo: "Competências Estratégicas",
    descricao: "Aplicáveis ao formulário do gestor.",
    cor: "text-blue-600",
  },
  gerencial: {
    titulo: "Competências Gerenciais",
    descricao: "Aplicáveis ao formulário do gestor.",
    cor: "text-rose-600",
  },
};

export function CompetenciasPadraoView({
  podeAlternarTipo,
  onVoltar,
}: CompetenciasPadraoViewProps) {
  const [loading, setLoading] = useState(true);
  const [tipoSelecionado, setTipoSelecionado] =
    useState<TipoFormulario>("equipe");
  const [comportamentais, setComportamentais] = useState<CompetenciaPadrao[]>(
    [],
  );
  const [estrategicas, setEstrategicas] = useState<CompetenciaPadrao[]>([]);
  const [gerenciais, setGerenciais] = useState<CompetenciaPadrao[]>([]);
  const [versaoAtual, setVersaoAtual] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    competenciasPadraoApi
      .getAll()
      .then((data) => {
        if (!ativo) return;
        setComportamentais(data.comportamental || []);
        setEstrategicas(data.estrategica || []);
        setGerenciais(data.gerencial || []);
      })
      .catch(() => {
        /* silencioso — exibe vazio */
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    competenciasPadraoApi
      .getVersaoAtual()
      .then((v) => {
        if (ativo) setVersaoAtual(v.versao);
      })
      .catch(() => {
        /* opcional — só usado no rodapé do PDF */
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Quando NÃO pode alternar, força tipo equipe (que mostra apenas comportamentais)
  const tipoExibido: TipoFormulario = podeAlternarTipo
    ? tipoSelecionado
    : "equipe";

  const secoes =
    tipoExibido === "equipe"
      ? [{ chave: "comportamental", items: comportamentais }]
      : [
          { chave: "comportamental", items: comportamentais },
          { chave: "estrategica", items: estrategicas },
          { chave: "gerencial", items: gerenciais },
        ];

  const handleGerarPdf = () => {
    generateCompetenciasPadraoPDF({
      tipoFormulario: tipoExibido,
      comportamentais,
      estrategicas,
      gerenciais,
      versaoAtual,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onVoltar}
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Visualizar Competências Padrão
          </h2>
        </div>
        <Button
          onClick={handleGerarPdf}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <FileDown className="h-4 w-4 mr-2" />
          Gerar PDF
        </Button>
      </div>

      <p className="text-sm text-gray-600 max-w-3xl">
        Catálogo das competências padrão que compõem o formulário do
        referencial. Esta visualização é somente leitura.
      </p>

      {/* Toggle de tipo (apenas para diretores da macroárea) */}
      {podeAlternarTipo && (
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-1 w-fit bg-gray-50">
          <button
            type="button"
            onClick={() => setTipoSelecionado("equipe")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tipoSelecionado === "equipe"
                ? "bg-white text-emerald-700 shadow-sm border border-emerald-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Users className="h-4 w-4" />
            Padrão da Equipe
          </button>
          <button
            type="button"
            onClick={() => setTipoSelecionado("gestor")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tipoSelecionado === "gestor"
                ? "bg-white text-violet-700 shadow-sm border border-violet-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <UserCog className="h-4 w-4" />
            Padrão do Gestor
          </button>
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando competências...
        </div>
      ) : (
        <div className="space-y-8">
          {secoes.map((secao) => {
            const meta = SECAO_LABEL[secao.chave];
            return (
              <section key={secao.chave} className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className={`h-5 w-5 ${meta.cor}`} />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {meta.titulo}{" "}
                      <span className="text-sm font-normal text-gray-500">
                        ({secao.items.length})
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500">{meta.descricao}</p>
                  </div>
                </div>

                {secao.items.length === 0 ? (
                  <p className="text-sm text-gray-500 italic px-2">
                    Nenhuma competência cadastrada.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {secao.items.map((c, idx) => (
                      <Card
                        key={c.id}
                        className="border border-gray-200 shadow-sm"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-start gap-2">
                            <span
                              className={`${meta.cor} font-bold flex-shrink-0`}
                            >
                              {idx + 1}.
                            </span>
                            <span className="flex-1">{c.nome}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap [overflow-wrap:anywhere]">
                            {c.descricao}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
