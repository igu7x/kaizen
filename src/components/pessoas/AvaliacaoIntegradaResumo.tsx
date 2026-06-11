import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Clock,
  Lock,
  FileDown,
} from "lucide-react";
import {
  AvaliacaoIntegradaFormulario,
  RespostaIntegradaItem,
  avaliacaoIntegradaApi,
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
  onValidated?: (formulario: AvaliacaoIntegradaFormulario) => void;
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
  descOverride,
}: {
  resposta: RespostaIntegradaItem;
  index: number;
  tipo: "tecnica" | "comportamental" | "estrategica" | "gerencial";
  descOverride?: string;
}) {
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
                Autoavaliação:
              </span>
              <NotaBadge nota={resposta.nota_autoavaliacao} labels={labels} />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-700">Gestor:</span>
              <NotaBadge nota={resposta.nota_gestor} labels={labels} />
            </div>
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-sm font-medium text-gray-700">
                Integrada (consenso):
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
  onValidated,
  onEdit,
  tipoInventario = "equipe",
  currentUserId,
}: AvaliacaoIntegradaResumoProps) {
  const [validando, setValidando] = useState<"gestor" | "colaborador" | null>(
    null,
  );
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

  const labelCamada1 =
    tipoInventario === "gestor"
      ? "Validação da Liderança"
      : "Validação do Gestor";
  const labelCamada2 =
    tipoInventario === "gestor"
      ? "Validação do Gestor"
      : "Validação do Colaborador";
  const labelCamada2Pendente =
    tipoInventario === "gestor"
      ? "Aguardando validação do gestor"
      : "Aguardando validação do colaborador";

  const gestorValidado = !!formulario.validado_gestor_em;
  const colaboradorValidado = !!formulario.validado_colaborador_em;
  const isAtualizacaoRequisitada =
    formulario.status === "atualizacao_requisitada";

  // Camada 1: quem preencheu a avaliação integrada (avaliador) pode validar
  const canValidateCamada1 =
    !currentUserId || formulario.avaliador_user_id === currentUserId;
  // Camada 2: o colaborador/gestor avaliado pode validar
  const canValidateCamada2 =
    !currentUserId || (formulario as any).colaborador_user_id === currentUserId;

  const handleValidarGestor = async () => {
    if (validando) return;
    setValidando("gestor");
    try {
      const updated = await avaliacaoIntegradaApi.validarGestor(formulario.id);

      onValidated?.(updated);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidando(null);
    }
  };

  const handleValidarColaborador = async () => {
    if (validando) return;
    setValidando("colaborador");
    try {
      const updated = await avaliacaoIntegradaApi.validarColaborador(
        formulario.id,
      );

      onValidated?.(updated);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidando(null);
    }
  };
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
              Avaliação Integrada enviada com sucesso
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

      {/* Botão Editar — apenas o avaliador que preencheu, antes de qualquer validação */}
      {onEdit &&
        !gestorValidado &&
        !colaboradorValidado &&
        !!currentUserId &&
        formulario.avaliador_user_id === currentUserId && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => onEdit(formulario)}
              className="border-gray-300"
            >
              Editar
            </Button>
          </div>
        )}

      {/* Status de Validação - 2 camadas */}
      <div className="space-y-3">
        {/* Camada 1: Validação do Gestor */}
        <div
          className={`rounded-xl border p-4 ${gestorValidado ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {gestorValidado ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Clock className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <p
                  className={`font-medium ${gestorValidado ? "text-emerald-800" : "text-amber-800"}`}
                >
                  1. {labelCamada1}
                </p>
                {gestorValidado ? (
                  <p className="text-sm text-emerald-600">
                    Validado por {formulario.validado_gestor_nome} em{" "}
                    {formatDate(formulario.validado_gestor_em!)}
                  </p>
                ) : (
                  <p className="text-sm text-amber-600">
                    Pendente de validação
                  </p>
                )}
              </div>
            </div>
            {!gestorValidado && canValidateCamada1 && (
              <Button
                onClick={handleValidarGestor}
                disabled={!!validando}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {validando === "gestor" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Validar
              </Button>
            )}
          </div>
        </div>

        {/* Camada 2: Validação do Colaborador */}
        <div
          className={`rounded-xl border p-4 ${
            colaboradorValidado
              ? "bg-emerald-50 border-emerald-200"
              : gestorValidado
                ? "bg-amber-50 border-amber-200"
                : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {colaboradorValidado ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : gestorValidado ? (
                <Clock className="h-5 w-5 text-amber-600" />
              ) : (
                <Lock className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p
                  className={`font-medium ${
                    colaboradorValidado
                      ? "text-emerald-800"
                      : gestorValidado
                        ? "text-amber-800"
                        : "text-gray-500"
                  }`}
                >
                  2. {labelCamada2}
                </p>
                {colaboradorValidado ? (
                  <p className="text-sm text-emerald-600">
                    Validado por {formulario.validado_colaborador_nome} em{" "}
                    {formatDate(formulario.validado_colaborador_em!)}
                  </p>
                ) : gestorValidado ? (
                  <p className="text-sm text-amber-600">
                    Pendente de validação
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">
                    {labelCamada2Pendente}
                  </p>
                )}
              </div>
            </div>
            {gestorValidado && !colaboradorValidado && canValidateCamada2 && (
              <Button
                onClick={handleValidarColaborador}
                disabled={!!validando}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {validando === "colaborador" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Validar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Botão Gerar PDF — só aparece após ambas validações */}
      {gestorValidado && colaboradorValidado && (
        <div className="flex justify-end">
          <Button
            onClick={() => generateAvaliacaoIntegradaPDF(formulario)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Gerar PDF
          </Button>
        </div>
      )}

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
              tipo="gerencial"
              descOverride={descAtual.get(resp.competencia_nome)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
