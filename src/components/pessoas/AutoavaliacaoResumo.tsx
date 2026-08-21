import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, Loader2, Clock } from "lucide-react";
import {
  AutoavaliacaoFormulario,
  autoavaliacaoApi,
} from "@/services/autoavaliacaoApi";
import {
  NOTA_TECNICA_LABELS,
  NOTA_COMPORTAMENTAL_LABELS,
  NOTA_ESTRATEGICA_LABELS,
  NOTA_GERENCIAL_LABELS,
  NOTA_COLORS,
} from "@/constants/competencias";
import { competenciasPadraoApi } from "@/services/competenciasPadraoApi";
import { toast } from "sonner";

interface AutoavaliacaoResumoProps {
  formulario: AutoavaliacaoFormulario;
  onValidated?: (formulario: AutoavaliacaoFormulario) => void;
  onEdit?: (formulario: AutoavaliacaoFormulario) => void;
  currentUserId?: number;
}

const notaColors = NOTA_COLORS;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AutoavaliacaoResumo({
  formulario,
  onValidated,
  onEdit,
  currentUserId,
}: AutoavaliacaoResumoProps) {
  const [validando, setValidando] = useState(false);
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

  const getDesc = (r: any) =>
    descAtual.get(r.competencia_nome) || r.competencia_descricao;

  const isValidado = !!formulario.validado_em;
  const isAtualizacaoRequisitada =
    formulario.status === "atualizacao_requisitada";
  // Quem valida a própria autoavaliação é quem a preencheu — colaborador no inventário da equipe,
  // gestor no inventário do gestor. O rótulo vem do formulário (mesma chave que o AutoavaliacaoForm
  // usa no título), senão a tela "Autoavaliação do Gestor" acabava anunciando "Validação do
  // Colaborador".
  const labelValidacao =
    formulario.tipo_inventario === "gestor"
      ? "Validação do Gestor"
      : "Validação do Colaborador";
  const canValidate = !currentUserId || formulario.user_id === currentUserId;

  const handleValidar = async () => {
    if (validando) return;
    setValidando(true);
    try {
      const updated = await autoavaliacaoApi.validar(formulario.id);

      onValidated?.(updated);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidando(false);
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
      {/* Banner de sucesso + identificação */}
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-gray-900 font-semibold">
              Autoavaliação enviada com sucesso
            </p>
            <p className="text-gray-500 text-sm">
              Enviado em {formatDate(formulario.created_at)}
            </p>
            <p className="text-gray-500 text-sm">
              Enviado por: {formulario.nome_completo}
            </p>
            <p className="text-gray-500 text-sm">{formulario.cargo_funcao}</p>
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
              {onEdit && canValidate && (
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

      {/* Status de Validação */}
      <div
        className={`rounded-xl border p-4 ${isValidado ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isValidado ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <Clock className="h-5 w-5 text-amber-600" />
            )}
            <div>
              <p
                className={`font-medium ${isValidado ? "text-emerald-800" : "text-amber-800"}`}
              >
                {labelValidacao}
              </p>
              {isValidado ? (
                <p className="text-sm text-emerald-600">
                  Validado por {formulario.validado_por_nome} em{" "}
                  {formatDate(formulario.validado_em!)}
                </p>
              ) : (
                <p className="text-sm text-amber-600">Pendente de validação</p>
              )}
            </div>
          </div>
          {!isValidado && canValidate && (
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" onClick={() => onEdit(formulario)}>
                  Editar
                </Button>
              )}
              <Button
                onClick={handleValidar}
                disabled={validando}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {validando ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Validar
              </Button>
            </div>
          )}
        </div>
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

      {/* Respostas Técnicas */}
      {respostasTecnicas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Competências Técnicas ({respostasTecnicas.length})
          </h3>

          {respostasTecnicas.map((resp, index) => (
            <Card key={index} className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <span className="text-teal-600 font-bold mr-2">
                      {index + 1}.
                    </span>
                    {resp.competencia_nome}
                  </CardTitle>
                  <Badge
                    className={
                      notaColors[resp.nota] || "bg-gray-100 text-gray-700"
                    }
                  >
                    {resp.nota} —{" "}
                    {NOTA_TECNICA_LABELS[resp.nota] || `Nota ${resp.nota}`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getDesc(resp) && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Descrição da competência
                      </span>
                      <p className="text-gray-800 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {getDesc(resp)}
                      </p>
                    </div>
                  )}
                  {resp.comentario && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Comentário / Evidências
                      </span>
                      <p className="text-gray-800 mt-0.5 [overflow-wrap:anywhere]">
                        {resp.comentario}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
            <Card
              key={`comp-${index}`}
              className="border border-gray-200 shadow-sm"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <span className="text-violet-600 font-bold mr-2">
                      {index + 1}.
                    </span>
                    {resp.competencia_nome}
                  </CardTitle>
                  <Badge
                    className={
                      notaColors[resp.nota] || "bg-gray-100 text-gray-700"
                    }
                  >
                    {resp.nota} —{" "}
                    {NOTA_COMPORTAMENTAL_LABELS[resp.nota] ||
                      `Nota ${resp.nota}`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getDesc(resp) && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Descrição da competência
                      </span>
                      <p className="text-gray-800 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {getDesc(resp)}
                      </p>
                    </div>
                  )}
                  {resp.comentario && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Comentário / Evidências
                      </span>
                      <p className="text-gray-800 mt-0.5 [overflow-wrap:anywhere]">
                        {resp.comentario}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
            <Card
              key={`estr-${index}`}
              className="border border-gray-200 shadow-sm"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <span className="text-sky-600 font-bold mr-2">
                      {index + 1}.
                    </span>
                    {resp.competencia_nome}
                  </CardTitle>
                  <Badge
                    className={
                      notaColors[resp.nota] || "bg-gray-100 text-gray-700"
                    }
                  >
                    {resp.nota} —{" "}
                    {NOTA_ESTRATEGICA_LABELS[resp.nota] || `Nota ${resp.nota}`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getDesc(resp) && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Descrição da competência
                      </span>
                      <p className="text-gray-800 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {getDesc(resp)}
                      </p>
                    </div>
                  )}
                  {resp.comentario && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Comentário / Evidências
                      </span>
                      <p className="text-gray-800 mt-0.5 [overflow-wrap:anywhere]">
                        {resp.comentario}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
            <Card
              key={`ger-${index}`}
              className="border border-gray-200 shadow-sm"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <span className="text-rose-600 font-bold mr-2">
                      {index + 1}.
                    </span>
                    {resp.competencia_nome}
                  </CardTitle>
                  <Badge
                    className={
                      notaColors[resp.nota] || "bg-gray-100 text-gray-700"
                    }
                  >
                    {resp.nota} —{" "}
                    {NOTA_GERENCIAL_LABELS[resp.nota] || `Nota ${resp.nota}`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getDesc(resp) && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Descrição da competência
                      </span>
                      <p className="text-gray-800 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {getDesc(resp)}
                      </p>
                    </div>
                  )}
                  {resp.comentario && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Comentário / Evidências
                      </span>
                      <p className="text-gray-800 mt-0.5 [overflow-wrap:anywhere]">
                        {resp.comentario}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
      <span className="text-sm text-gray-500">{label}</span>
      <p className="font-medium text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}
