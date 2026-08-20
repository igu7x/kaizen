import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Lock,
  FileDown,
} from "lucide-react";
import {
  AvaliacaoIntegradaFormulario,
  RespostaIntegradaItem,
} from "@/services/avaliacaoIntegradaApi";
import {
  NOTA_COLORS,
  NOTA_TECNICA_LABELS,
  NOTA_COMPORTAMENTAL_LABELS,
  NOTA_ESTRATEGICA_LABELS,
  NOTA_GERENCIAL_LABELS,
} from "@/constants/competencias";
import { competenciasPadraoApi } from "@/services/competenciasPadraoApi";
import { toast } from "sonner";
import { generateAvaliacaoIntegradaPDF } from "@/utils/generateAvaliacaoIntegradaPDF";

interface AvaliacaoIntegradaResumoProps {
  formulario: AvaliacaoIntegradaFormulario;
  onEdit?: (formulario: AvaliacaoIntegradaFormulario) => void;
  tipoInventario?: "equipe" | "gestor";
  currentUserId?: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
      <span className="text-sm text-gray-500">{label}</span>
      <p className="font-medium text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function NotaBadge({
  nota,
  labels,
}: {
  nota: number;
  labels: Record<number, string>;
}) {
  return (
    <Badge className={NOTA_COLORS[nota] || "bg-gray-100 text-gray-700"}>
      {nota} — {labels[nota] || `Nota ${nota}`}
    </Badge>
  );
}

function RespostaCard({
  resposta,
  index,
  tipo,
  tipoInventario,
  descOverride,
}: {
  resposta: RespostaIntegradaItem;
  index: number;
  tipo: "tecnica" | "comportamental" | "estrategica" | "gerencial";
  tipoInventario: "equipe" | "gestor";
  descOverride?: string;
}) {
  // Quem avalia muda conforme o inventário, mas o peso é o mesmo: 70 pra avaliação de
  // terceiro e 30 pra autoavaliação.
  const rotuloAuto =
    tipoInventario === "gestor"
      ? "Autoavaliação do gestor"
      : "Autoavaliação do colaborador";
  const rotuloAvaliador =
    tipoInventario === "gestor"
      ? "Avaliação da liderança"
      : "Avaliação do gestor";
  const labelsMap: Record<string, Record<number, string>> = {
    tecnica: NOTA_TECNICA_LABELS,
    comportamental: NOTA_COMPORTAMENTAL_LABELS,
    estrategica: NOTA_ESTRATEGICA_LABELS,
    gerencial: NOTA_GERENCIAL_LABELS,
  };
  const colorMap: Record<string, string> = {
    tecnica: "text-teal-600",
    comportamental: "text-violet-600",
    estrategica: "text-sky-600",
    gerencial: "text-rose-600",
  };
  const labels = labelsMap[tipo] || NOTA_TECNICA_LABELS;
  const accentColor = colorMap[tipo] || "text-teal-600";

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <span className={`${accentColor} font-bold mr-2`}>{index + 1}.</span>
          {resposta.competencia_nome}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {(descOverride || resposta.competencia_descricao) && (
            <div>
              <span className="text-sm text-gray-500">
                Descrição da competência
              </span>
              <p className="text-gray-800 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
                {descOverride || resposta.competencia_descricao}
              </p>
            </div>
          )}

          {/* Tres badges lado a lado */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                {rotuloAuto}
              </span>
              <NotaBadge nota={resposta.nota_autoavaliacao} labels={labels} />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                {rotuloAvaliador}
              </span>
              <NotaBadge nota={resposta.nota_gestor} labels={labels} />
            </div>
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-sm font-bold text-gray-800">
                Resultado Final:
              </span>
              <NotaBadge nota={resposta.nota_integrada} labels={labels} />
            </div>
          </div>

          {resposta.comentario && (
            <div>
              <span className="text-sm text-gray-500">Comentário</span>
              <p className="text-gray-800 mt-0.5 [overflow-wrap:anywhere]">
                {resposta.comentario}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AvaliacaoIntegradaResumo({
  formulario,
  onEdit,
  tipoInventario = "equipe",
  currentUserId,
}: AvaliacaoIntegradaResumoProps) {
  const [descAtual, setDescAtual] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    competenciasPadraoApi
      .getAll()
      .then((data) => {
        const m = new Map<string, string>();
        [
          ...(data.comportamental || []),
          ...(data.estrategica || []),
          ...(data.gerencial || []),
        ].forEach((c) => m.set(c.nome, c.descricao));
        setDescAtual(m);
      })
      .catch(() => {});
  }, []);

  // Quem entra com os 70% muda conforme o inventario.
  const rotuloOrigem =
    tipoInventario === "gestor"
      ? "da avaliação da liderança"
      : "da avaliação do gestor";

  // Sem validacao em camadas: o Resultado Final ja nasce pronto. O que resta e o aviso
  // de retrabalho, quando uma das origens mudou e o resultado ainda nao foi recalculado.
  const isAtualizacaoRequisitada =
    formulario.status === "atualizacao_requisitada";

  const respostasTecnicas = useMemo(
    () =>
      (formulario.respostas || []).filter(
        (r) => r.tipo === "tecnica" || (!r.tipo && r.tipo !== "comportamental"),
      ),
    [formulario.respostas],
  );

  const respostasComportamentais = useMemo(
    () =>
      (formulario.respostas || []).filter((r) => r.tipo === "comportamental"),
    [formulario.respostas],
  );

  const respostasEstrategicas = useMemo(
    () => (formulario.respostas || []).filter((r) => r.tipo === "estrategica"),
    [formulario.respostas],
  );

  const respostasGerenciais = useMemo(
    () => (formulario.respostas || []).filter((r) => r.tipo === "gerencial"),
    [formulario.respostas],
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Banner de sucesso + identificacao */}
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-gray-900 font-semibold">
              Resultado Final enviada com sucesso
            </p>
            <p className="text-gray-500 text-sm">
              Enviado em {formatDate(formulario.created_at)}
            </p>
            <p className="text-gray-500 text-sm">
              Avaliador: {formulario.avaliador_nome}
            </p>
            <p className="text-gray-500 text-sm">
              Colaborador: {formulario.pessoa_nome}
            </p>
          </div>
        </div>
      </div>

      {/* Banner de atualização requisitada */}
      {isAtualizacaoRequisitada && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-purple-900 font-semibold">
                Atualização Requisitada
              </p>
              <p className="text-purple-600 text-sm mt-1">
                As competências padrão foram atualizadas. Por favor, revise e
                atualize suas respostas.
              </p>
              {onEdit &&
                !!currentUserId &&
                formulario.avaliador_user_id === currentUserId && (
                  <Button
                    variant="outline"
                    className="mt-3 border-purple-300 text-purple-700 hover:bg-purple-100"
                    onClick={() => onEdit(formulario)}
                  >
                    Atualizar Respostas
                  </Button>
                )}
            </div>
          </div>
        </div>
      )}


      {/* Como a nota saiu — o Resultado Final não é validado por ninguém, é calculado */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-800">
              Resultado calculado automaticamente
            </p>
            <p className="mt-0.5 text-sm text-emerald-700">
              Média ponderada {rotuloOrigem} com a autoavaliação.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => generateAvaliacaoIntegradaPDF(formulario)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
        >
          <FileDown className="h-4 w-4 mr-2" />
          Gerar PDF
        </Button>
      </div>

      {/* Diretoria e Unidade */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Diretoria e Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Diretoria" value={formulario.diretoria} />
            <Field label="Unidade" value={formulario.unidade_nome || "-"} />
          </div>
        </CardContent>
      </Card>

      {/* Respostas Tecnicas */}
      {respostasTecnicas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Competências Técnicas ({respostasTecnicas.length})
          </h3>

          {respostasTecnicas.map((resp, index) => (
            <RespostaCard
              key={index}
              resposta={resp}
              index={index}
              tipoInventario={tipoInventario}
              tipo="tecnica"
            />
          ))}
        </div>
      )}

      {/* Respostas Comportamentais */}
      {respostasComportamentais.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Competências Comportamentais ({respostasComportamentais.length})
          </h3>

          {respostasComportamentais.map((resp, index) => (
            <RespostaCard
              key={`comp-${index}`}
              resposta={resp}
              index={index}
              tipoInventario={tipoInventario}
              tipo="comportamental"
              descOverride={descAtual.get(resp.competencia_nome)}
            />
          ))}
        </div>
      )}

      {/* Respostas Estratégicas */}
      {respostasEstrategicas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Competências Estratégicas ({respostasEstrategicas.length})
          </h3>

          {respostasEstrategicas.map((resp, index) => (
            <RespostaCard
              key={`estr-${index}`}
              resposta={resp}
              index={index}
              tipoInventario={tipoInventario}
              tipo="estrategica"
              descOverride={descAtual.get(resp.competencia_nome)}
            />
          ))}
        </div>
      )}

      {/* Respostas Gerenciais */}
      {respostasGerenciais.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Competências Gerenciais ({respostasGerenciais.length})
          </h3>

          {respostasGerenciais.map((resp, index) => (
            <RespostaCard
              key={`ger-${index}`}
              resposta={resp}
              index={index}
              tipoInventario={tipoInventario}
              tipo="gerencial"
              descOverride={descAtual.get(resp.competencia_nome)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
