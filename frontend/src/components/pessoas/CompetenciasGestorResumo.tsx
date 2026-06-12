import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, FileDown, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  FormularioCompetencias,
  CompetenciaItem,
  competenciasGestorApi,
} from "@/services/competenciasGestorApi";
import { ValidacaoStatusBanners } from "./ValidacaoStatusBanners";
import { useAuth } from "@/contexts/AuthContext";
import { generateCompetenciasPDF } from "@/utils/generateCompetenciasPDF";
import {
  COMPETENCIAS_COMPORTAMENTAIS,
  COMPETENCIAS_ESTRATEGICAS,
  COMPETENCIAS_GERENCIAIS,
} from "@/constants/competencias";
import { competenciasPadraoApi } from "@/services/competenciasPadraoApi";
import { areasApi, Area } from "@/services/areasApi";

const VALIDADORES_FINAIS = [
  "gmpdmaciel@tjgo.jus.br",
  "dcamaral@tjgo.jus.br",
  "ifccupertino@tjgo.jus.br",
  "jdnascimento@tjgo.jus.br",
];
const isValidadorFinal = (email: string) =>
  VALIDADORES_FINAIS.some(
    (v) => v.toLowerCase() === email.toLowerCase().trim(),
  );

interface CompetenciasGestorResumoProps {
  formulario: FormularioCompetencias;
  onValidated?: (formulario: FormularioCompetencias) => void;
  onEdit?: (formulario: FormularioCompetencias) => void;
}

const pesoLabels: Record<number, string> = {
  1: "Útil",
  2: "Importante",
  3: "Crítica",
};
const pesoColors: Record<number, string> = {
  1: "bg-blue-100 text-blue-700",
  2: "bg-amber-100 text-amber-700",
  3: "bg-red-100 text-red-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CompetenciasGestorResumo({
  formulario,
  onValidated,
  onEdit,
}: CompetenciasGestorResumoProps) {
  const { user } = useAuth();
  const [validating, setValidating] = useState(false);
  const [recusaDialogOpen, setRecusaDialogOpen] = useState(false);
  const [recusaCamada, setRecusaCamada] = useState<
    "diretoria" | "final" | null
  >(null);
  const [recusaComentario, setRecusaComentario] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [compNomesComportamentais, setCompNomesComportamentais] = useState(
    () => new Set(COMPETENCIAS_COMPORTAMENTAIS.map((c) => c.nome)),
  );
  const [compNomesEstrategicas, setCompNomesEstrategicas] = useState(
    () => new Set(COMPETENCIAS_ESTRATEGICAS.map((c) => c.nome)),
  );
  const [compNomesGerenciais, setCompNomesGerenciais] = useState(
    () => new Set(COMPETENCIAS_GERENCIAIS.map((c) => c.nome)),
  );
  // Mapa de nome → descrição atualizada (para sobrescrever descrições antigas armazenadas no formulário)
  const [compDescricaoAtual, setCompDescricaoAtual] = useState<
    Map<string, string>
  >(new Map());

  useEffect(() => {
    areasApi
      .getAll()
      .then(setAreas)
      .catch(() => {});
    competenciasPadraoApi
      .getAll()
      .then((data) => {
        const descMap = new Map<string, string>();
        if (data.comportamental?.length) {
          setCompNomesComportamentais(
            new Set(data.comportamental.map((c) => c.nome)),
          );
          data.comportamental.forEach((c) => descMap.set(c.nome, c.descricao));
        }
        if (data.estrategica?.length) {
          setCompNomesEstrategicas(
            new Set(data.estrategica.map((c) => c.nome)),
          );
          data.estrategica.forEach((c) => descMap.set(c.nome, c.descricao));
        }
        if (data.gerencial?.length) {
          setCompNomesGerenciais(new Set(data.gerencial.map((c) => c.nome)));
          data.gerencial.forEach((c) => descMap.set(c.nome, c.descricao));
        }
        setCompDescricaoAtual(descMap);
      })
      .catch(() => {});
  }, []);

  const userEmail = (user?.email || "").trim().toLowerCase();
  const userId = user?.id ? Number(user.id) : undefined;
  const formDiretoria = formulario.diretoria || "";
  const isGestor = formulario.tipo === "gestor";

  // Separar competências por tipo usando nomes conhecidos
  const nomesComportamentais = compNomesComportamentais;
  const nomesEstrategicas = compNomesEstrategicas;
  const nomesGerenciais = compNomesGerenciais;

  // Sobrescrever descrições com as versões atuais da API (para competências padrão)
  const withCurrentDesc = (items: typeof allComps) =>
    items.map((c) =>
      compDescricaoAtual.has(c.nome)
        ? { ...c, descricao: compDescricaoAtual.get(c.nome)! }
        : c,
    );

  const allComps = formulario.competencias || [];
  const comportamentais = withCurrentDesc(
    allComps.filter((c) => nomesComportamentais.has(c.nome)),
  );
  const estrategicas = withCurrentDesc(
    allComps.filter((c) => nomesEstrategicas.has(c.nome)),
  );
  const gerenciais = withCurrentDesc(
    allComps.filter((c) => nomesGerenciais.has(c.nome)),
  );
  const tecnicas = allComps.filter(
    (c) =>
      !nomesComportamentais.has(c.nome) &&
      !nomesEstrategicas.has(c.nome) &&
      !nomesGerenciais.has(c.nome),
  );

  // Detectar se foi preenchido pelo sub-diretor (para camada extra de validação)
  const areaForm = areas.find(
    (a) => (a.sigla || "").toUpperCase() === formDiretoria.toUpperCase(),
  );
  const subdiretorId = areaForm
    ? Number((areaForm as any).subdiretor_user_id || 0)
    : 0;
  const autorUserId = Number((formulario as any).user_id || 0);
  const preenchidoPorSubdiretor =
    isGestor && subdiretorId > 0 && autorUserId === subdiretorId;

  // Camada Diretoria: usuário precisa ser o gestor da diretoria (cadastros_areas.gestor_user_id)
  const isGestorDaDiretoria = !!(
    userId &&
    areaForm?.gestor_user_id &&
    Number(areaForm.gestor_user_id) === userId
  );
  // Se foi preenchido pelo sub-diretor (ou se é tipo 'equipe'), o status precisa ser 'validado_autor'
  // Se foi preenchido pelo gestor da macroárea, o status precisa ser 'enviado'
  const statusParaDiretoria =
    isGestor && !preenchidoPorSubdiretor ? "enviado" : "validado_autor";
  const canValidateDiretoria =
    formulario.status === statusParaDiretoria && isGestorDaDiretoria;

  // Camada Final
  const canValidateFinal =
    formulario.status === "validado_diretoria" && isValidadorFinal(userEmail);

  // Camada Autor: apenas o autor pode validar quando status = 'enviado'
  // - Para tipo 'equipe': o autor (email_institucional) valida
  // - Para tipo 'gestor' preenchido pelo sub-diretor: o sub-diretor valida
  const isAutor =
    !!formulario.email_institucional &&
    userEmail === formulario.email_institucional.toLowerCase().trim();
  const isSubdiretorValidando =
    preenchidoPorSubdiretor && userId === subdiretorId;
  const canValidateAutor =
    formulario.status === "enviado" &&
    ((!isGestor && isAutor) || isSubdiretorValidando);

  // Permissão de edição: o botão "Editar" só aparece acompanhado de "Validar".
  // Ou seja, Editar é liberado apenas para quem está habilitado a validar a próxima
  // camada agora — caso contrário some, evitando o cenário de "Editar solto" para
  // quem só veria o formulário em modo leitura.
  const isAutorByUserId = !!(userId && autorUserId === userId);
  const foiRecusado =
    !!formulario.recusado_em && formulario.status === "enviado";
  const podeEditar = (() => {
    if (formulario.status !== "enviado") return false;
    // Se o formulário foi recusado, só o autor (ou subdiretor/autoria-equivalente) edita.
    if (foiRecusado) return canValidateAutor;
    // Editar acompanha o botão de validar correspondente à camada atual.
    return canValidateAutor || canValidateDiretoria;
  })();

  const handleValidarAutor = async () => {
    setValidating(true);
    try {
      const result = await competenciasGestorApi.validarAutor(formulario.id);

      if (onValidated) onValidated(result);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidating(false);
    }
  };

  const handleValidarDiretoria = async () => {
    setValidating(true);
    try {
      const result = await competenciasGestorApi.validarDiretoria(
        formulario.id,
      );

      if (onValidated) onValidated(result);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidating(false);
    }
  };

  const handleValidarFinal = async () => {
    setValidating(true);
    try {
      const result = await competenciasGestorApi.validarFinal(formulario.id);

      if (onValidated) onValidated(result);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidating(false);
    }
  };

  const abrirDialogRecusa = (camada: "diretoria" | "final") => {
    setRecusaCamada(camada);
    setRecusaComentario("");
    setRecusaDialogOpen(true);
  };

  const handleConfirmarRecusa = async () => {
    if (!recusaCamada) return;
    setValidating(true);
    try {
      const result =
        recusaCamada === "final"
          ? await competenciasGestorApi.recusarFinal(
              formulario.id,
              recusaComentario,
            )
          : await competenciasGestorApi.recusarDiretoria(
              formulario.id,
              recusaComentario,
            );

      setRecusaDialogOpen(false);
      setRecusaCamada(null);
      setRecusaComentario("");
      if (onValidated) onValidated(result);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Banners de validação */}
      <ValidacaoStatusBanners
        formulario={formulario}
        preenchidoPorSubdiretor={preenchidoPorSubdiretor}
      />

      {/* Botão Editar — quem tem papel no fluxo pode editar até o formulário ser validado totalmente */}
      {onEdit && podeEditar && (
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

      {/* Botões de validação */}
      {canValidateAutor && (
        <div className="flex justify-end">
          <Button
            onClick={handleValidarAutor}
            disabled={validating}
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" /> Validar como Autor
              </>
            )}
          </Button>
        </div>
      )}
      {canValidateDiretoria && (
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => abrirDialogRecusa("diretoria")}
            disabled={validating}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 px-6 py-3"
          >
            <XCircle className="h-4 w-4 mr-2" /> Recusar
          </Button>
          <Button
            onClick={handleValidarDiretoria}
            disabled={validating}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" /> Validar Diretoria
              </>
            )}
          </Button>
        </div>
      )}
      {canValidateFinal && (
        <div className="flex justify-end gap-2">
          {/* Validação Final é uma camada superior — sempre permite recusar
              (mesmo que o validador final também tenha preenchido/validado camadas anteriores) */}
          <Button
            onClick={() => abrirDialogRecusa("final")}
            disabled={validating}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 px-6 py-3"
          >
            <XCircle className="h-4 w-4 mr-2" /> Recusar
          </Button>
          <Button
            onClick={handleValidarFinal}
            disabled={validating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" /> Validação Final
              </>
            )}
          </Button>
        </div>
      )}

      {/* Dialog de recusa */}
      <Dialog
        open={recusaDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRecusaDialogOpen(false);
            setRecusaCamada(null);
            setRecusaComentario("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Recusar formulário
            </DialogTitle>
            <DialogDescription>
              O formulário voltará para o autor preservando todas as respostas.
              Ele poderá ajustar o que for necessário e validar novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="recusa-comentario">Comentário (opcional)</Label>
            <Textarea
              id="recusa-comentario"
              value={recusaComentario}
              onChange={(e) => setRecusaComentario(e.target.value)}
              placeholder="Explique o motivo da recusa para orientar o autor (opcional)"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRecusaDialogOpen(false);
                setRecusaCamada(null);
                setRecusaComentario("");
              }}
              disabled={validating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarRecusa}
              disabled={validating}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Recusando...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" /> Confirmar recusa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botão Gerar PDF — apenas após validação final */}
      {formulario.status === "validado_final" && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              void generateCompetenciasPDF(formulario);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
          >
            <FileDown className="h-4 w-4 mr-2" /> Gerar PDF
          </Button>
        </div>
      )}

      {/* Diretoria e Unidade */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Diretoria e Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`grid grid-cols-1 ${formulario.tipo === "gestor" ? "md:grid-cols-2" : "md:grid-cols-3"} gap-4`}
          >
            <Field label="Diretoria" value={formulario.diretoria} />
            <Field label="Unidade" value={formulario.unidade_nome || "-"} />
            {formulario.tipo !== "gestor" && (
              <Field
                label="Qtd. de colaboradores"
                value={String(formulario.qtd_colaboradores)}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Competências separadas por tipo */}
      <CompetenciaSection
        title="Competências Técnicas"
        items={tecnicas}
        showPeso
        showAplicabilidade={formulario.tipo !== "gestor"}
        accentColor="blue"
      />

      <CompetenciaSection
        title="Competências Comportamentais"
        items={comportamentais}
        accentColor="violet"
      />

      {isGestor && estrategicas.length > 0 && (
        <CompetenciaSection
          title="Competências Estratégicas"
          items={estrategicas}
          accentColor="sky"
        />
      )}

      {isGestor && gerenciais.length > 0 && (
        <CompetenciaSection
          title="Competências Gerenciais"
          items={gerenciais}
          accentColor="rose"
        />
      )}
    </div>
  );
}

const accentColors: Record<string, string> = {
  blue: "text-blue-600",
  violet: "text-violet-600",
  sky: "text-sky-600",
  rose: "text-rose-600",
};

function CompetenciaSection({
  title,
  items,
  showPeso,
  showAplicabilidade,
  accentColor = "blue",
}: {
  title: string;
  items: CompetenciaItem[];
  showPeso?: boolean;
  showAplicabilidade?: boolean;
  accentColor?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {title} ({items.length})
      </h3>
      {items.map((comp, index) => (
        <Card
          key={index}
          className={`shadow-sm ${
            comp.alterada
              ? "border-2 border-amber-400 bg-amber-50/40"
              : "border border-gray-200"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2 flex-1 min-w-0">
                <span
                  className={`${accentColors[accentColor] || "text-blue-600"} font-bold flex-shrink-0`}
                >
                  {index + 1}.
                </span>
                <span className="flex-1 min-w-0">{comp.nome}</span>
                {comp.alterada && (
                  <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200 flex-shrink-0">
                    Alterada
                  </span>
                )}
              </CardTitle>
              {showPeso && (
                <Badge
                  className={
                    pesoColors[comp.peso] || "bg-gray-100 text-gray-700"
                  }
                >
                  {pesoLabels[comp.peso] || `Peso ${comp.peso}`}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Descrição</span>
                <p className="text-gray-800 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {comp.descricao}
                </p>
              </div>
              {showAplicabilidade && (
                <div className="flex gap-6">
                  <div>
                    <span className="text-sm text-gray-500">
                      Aplicabilidade
                    </span>
                    <p className="text-gray-800 mt-0.5 font-medium">
                      {comp.aplicabilidade === "todos"
                        ? "Todos os colaboradores"
                        : "Parte da equipe"}
                    </p>
                  </div>
                  {comp.aplicabilidade === "parte" &&
                    comp.quantidade_pessoas && (
                      <div>
                        <span className="text-sm text-gray-500">
                          Quantidade
                        </span>
                        <p className="text-gray-800 mt-0.5 font-medium">
                          {comp.quantidade_pessoas} colaboradores
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
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
