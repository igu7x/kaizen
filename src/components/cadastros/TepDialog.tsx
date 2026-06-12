import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Pencil,
  History,
  FileDown,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  cadastrosProjetosApi,
  Projeto,
  Entrega,
  Tep,
} from "@/services/cadastrosProjetosApi";
import { generateTEPPdf } from "@/utils/generateTEP";

interface TepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto: Projeto;
  entregas?: Entrega[]; // Opcional — TepDialog re-busca para garantir dados atualizados
  onFinalized: (tep: Tep) => void;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function TepDialog({
  open,
  onOpenChange,
  projeto,
  entregas: entregasProp,
  onFinalized,
}: TepDialogProps) {
  const { user } = useAuth();
  const currentUserId = user?.id ? Number(user.id) : null;
  const isSuperadmin =
    (user as any)?.is_superadmin === true ||
    (user as any)?.is_domain_root === true;

  const [tipo, setTipo] = useState<"concluido" | "cancelado">("concluido");
  const [motivo, setMotivo] = useState("");
  const [consideracoesGerente, setConsideracoesGerente] = useState("");
  const [consideracoesPatrocinador, setConsideracoesPatrocinador] =
    useState("");
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [entregas, setEntregas] = useState<Entrega[]>(entregasProp || []);
  const [tepExistente, setTepExistente] = useState<Tep | null>(null);
  const [validandoCamada, setValidandoCamada] = useState<number | null>(null);
  // Edit mode: por padrão TEP existente é read-only mesmo para superadmin.
  // Superadmin clica "Atualizar TEP" para destravar a edição.
  const [editMode, setEditMode] = useState(false);

  // Recusa do TEP
  const [recusaDialogOpen, setRecusaDialogOpen] = useState(false);
  const [recusaCamada, setRecusaCamada] = useState<2 | 3 | null>(null);
  const [recusaComentario, setRecusaComentario] = useState("");
  const [recusandoTEP, setRecusandoTEP] = useState(false);

  // Histórico de versões do TEP
  const [versoesDialogOpen, setVersoesDialogOpen] = useState(false);
  const [versoes, setVersoes] = useState<
    Array<{
      versao: number;
      validado_em: string | null;
      validado_por_nome: string | null;
    }>
  >([]);
  const [loadingVersoes, setLoadingVersoes] = useState(false);
  const [loadingPdfVersao, setLoadingPdfVersao] = useState<number | null>(null);

  const handleAbrirVersoes = async () => {
    setVersoesDialogOpen(true);
    setLoadingVersoes(true);
    try {
      const data = await cadastrosProjetosApi.getTepVersoes(projeto.id);
      setVersoes(data);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingVersoes(false);
    }
  };

  const handlePdfVersaoTep = async (versao: number) => {
    setLoadingPdfVersao(versao);
    try {
      const dados = await cadastrosProjetosApi.getTepVersaoDados(
        projeto.id,
        versao,
      );
      generateTEPPdf(dados.projeto, dados.tep, dados.entregas || []);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingPdfVersao(null);
    }
  };

  // Quando o dialog abre/fecha, resetar edit mode
  useEffect(() => {
    if (!open) setEditMode(false);
  }, [open]);

  // Campos só editáveis quando: (TEP não existe e é superadmin) OU (TEP existe E editMode E superadmin)
  const camposEditaveis = isSuperadmin && (!tepExistente || editMode);

  // Carrega TEP existente (caso o projeto já tenha sido finalizado antes — para edição)
  // E também recarrega as entregas para garantir dados frescos
  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setLoadingExisting(true);
    Promise.all([
      cadastrosProjetosApi.getTep(projeto.id).catch(() => null),
      cadastrosProjetosApi
        .getEntregas(projeto.id)
        .catch(() => entregasProp || []),
    ])
      .then(([tep, entregasFrescas]) => {
        if (cancel) return;
        setTepExistente(tep);
        if (tep) {
          setTipo(tep.tipo_encerramento);
          setMotivo(
            tep.tipo_encerramento === "cancelado"
              ? tep.motivo_cancelamento || ""
              : "",
          );
          setConsideracoesGerente(tep.consideracoes_gerente || "");
          setConsideracoesPatrocinador(tep.consideracoes_patrocinador || "");
        }
        setEntregas(entregasFrescas || []);
      })
      .finally(() => {
        if (!cancel) setLoadingExisting(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, projeto.id]);

  const recarregarTep = async () => {
    try {
      const tep = await cadastrosProjetosApi.getTep(projeto.id);
      setTepExistente(tep);
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleVisualizarPdf = () => {
    if (!tepExistente) {
      toast.error("Salve o TEP antes de visualizar o PDF.");
      return;
    }
    generateTEPPdf(projeto, tepExistente, entregas);
  };

  const handleValidarCamada = async (camada: number) => {
    setValidandoCamada(camada);
    try {
      await cadastrosProjetosApi.validarTEP(projeto.id, camada);
      const labels = ["", "Gestor", "Diretor", "Patrocinador"];

      await recarregarTep();
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidandoCamada(null);
    }
  };

  const abrirDialogRecusa = (camada: 2 | 3) => {
    setRecusaCamada(camada);
    setRecusaComentario("");
    setRecusaDialogOpen(true);
  };

  const handleRecusarTEP = async () => {
    if (!recusaCamada) return;
    setRecusandoTEP(true);
    try {
      await cadastrosProjetosApi.recusarTEP(
        projeto.id,
        recusaCamada,
        recusaComentario.trim() || null,
      );

      await recarregarTep();
      setRecusaDialogOpen(false);
      setRecusaCamada(null);
      setRecusaComentario("");
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setRecusandoTEP(false);
    }
  };

  const entregasComEvidencia = entregas.filter((e) => e.evidencia_filename);

  const handleDownloadEvidencia = async (
    entregaId: number,
    filename: string,
  ) => {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const response = await fetch(
        `/api/cadastros/entregas/${entregaId}/download-evidencia`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Falha ao baixar");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao baixar evidência");
    }
  };

  const handleSubmit = async () => {
    if (tipo === "cancelado" && !motivo.trim()) {
      toast.error("Informe o motivo da descontinuidade.");
      return;
    }
    setSaving(true);
    const eraAtualizacao = !!tepExistente;
    try {
      const tep = await cadastrosProjetosApi.salvarTep(projeto.id, {
        tipo_encerramento: tipo,
        motivo_cancelamento: tipo === "cancelado" ? motivo.trim() : undefined,
        consideracoes_gerente: consideracoesGerente.trim() || undefined,
        consideracoes_patrocinador:
          consideracoesPatrocinador.trim() || undefined,
      });
      const versao = tep.tep_versao || 1;

      setTepExistente(tep);
      setEditMode(false); // Sai do modo edição após salvar
      onFinalized(tep);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            TEP — Termo de Encerramento do Projeto
          </DialogTitle>
        </DialogHeader>

        {/* Banner de TEP recusado — visível enquanto não há nova validação do gestor */}
        {tepExistente?.tep_recusado_em &&
          !tepExistente?.tep_validado_gestor_em && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-red-900">
                  TEP recusado pelo{" "}
                  {tepExistente.tep_recusado_camada === "patrocinador"
                    ? "Patrocinador"
                    : "Diretor"}
                </p>
                <p className="text-red-700 text-xs mt-0.5">
                  {tepExistente.tep_recusado_por_nome
                    ? `Por ${tepExistente.tep_recusado_por_nome} — `
                    : ""}
                  {formatDate(tepExistente.tep_recusado_em)}
                </p>
                {tepExistente.tep_recusado_comentario && (
                  <p className="text-red-800 text-sm mt-2 italic">
                    "{tepExistente.tep_recusado_comentario}"
                  </p>
                )}
                <p className="text-red-600 text-xs mt-2">
                  O gestor deve ajustar o que for necessário e validar novamente
                  para recomeçar o ciclo.
                </p>
              </div>
            </div>
          )}

        {tepExistente?.tep_validado_patrocinador_em && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-emerald-900">TEP Vigente</p>
              <p className="text-emerald-700 text-xs">
                Validado em{" "}
                {formatDate(tepExistente.tep_validado_patrocinador_em)}
                {tepExistente.tep_versao
                  ? ` — versão ${tepExistente.tep_versao}`
                  : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500 text-emerald-700 hover:bg-emerald-100"
              onClick={handleAbrirVersoes}
            >
              <History className="h-4 w-4 mr-1" />
              Versões
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500 text-emerald-700 hover:bg-emerald-100"
              onClick={handleVisualizarPdf}
            >
              <FileText className="h-4 w-4 mr-1" />
              Visualizar PDF
            </Button>
          </div>
        )}

        {loadingExisting ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Painel de Validação (3 camadas) — só aparece quando TEP existe */}
            {tepExistente && (
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-gray-700">
                    Validação do TEP
                  </h4>
                  {/* Botão Visualizar TEP só aparece quando ainda há camada pendente —
                      após validação completa, o banner verde "TEP Vigente" no topo
                      já oferece o botão equivalente. */}
                  {!tepExistente.tep_validado_patrocinador_em && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleVisualizarPdf}
                      className="h-7 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" /> Visualizar TEP
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* CAMADA 1 — GESTOR */}
                  <div
                    className={cn(
                      "flex-1 rounded-lg border p-2 text-center",
                      tepExistente.tep_validado_gestor_em
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-200",
                    )}
                  >
                    <p className="text-[10px] text-gray-500 mb-0.5">
                      Camada 1 — Gestor
                    </p>
                    <p className="text-xs font-medium truncate">
                      {projeto.gestor_nome || "-"}
                    </p>
                    {tepExistente.tep_validado_gestor_em ? (
                      <div className="mt-1">
                        <Badge className="bg-green-600 text-white text-[10px] h-5">
                          Validado
                        </Badge>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {formatDate(tepExistente.tep_validado_gestor_em)}
                        </p>
                      </div>
                    ) : currentUserId &&
                      (projeto as any).gestor_user_id &&
                      Number((projeto as any).gestor_user_id) ===
                        currentUserId ? (
                      <Button
                        size="sm"
                        className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-6 w-full"
                        disabled={validandoCamada !== null}
                        onClick={() => handleValidarCamada(1)}
                      >
                        {validandoCamada === 1 ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                          </>
                        )}
                      </Button>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-gray-400 mt-1 h-5"
                      >
                        Pendente
                      </Badge>
                    )}
                  </div>

                  <span className="text-gray-300 text-base">→</span>

                  {/* CAMADA 2 — DIRETOR */}
                  <div
                    className={cn(
                      "flex-1 rounded-lg border p-2 text-center",
                      tepExistente.tep_validado_diretor_em
                        ? "bg-green-50 border-green-200"
                        : !tepExistente.tep_validado_gestor_em
                          ? "bg-gray-100 border-gray-200 opacity-50"
                          : "bg-gray-50 border-gray-200",
                    )}
                  >
                    <p className="text-[10px] text-gray-500 mb-0.5">
                      Camada 2 — Diretor
                    </p>
                    <p className="text-xs font-medium truncate">
                      {projeto.diretoria || "-"}
                    </p>
                    {tepExistente.tep_validado_diretor_em ? (
                      <div className="mt-1">
                        <Badge className="bg-green-600 text-white text-[10px] h-5">
                          Validado
                        </Badge>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {formatDate(tepExistente.tep_validado_diretor_em)}
                        </p>
                      </div>
                    ) : tepExistente.tep_validado_gestor_em &&
                      currentUserId &&
                      (projeto as any).diretor_user_id &&
                      Number((projeto as any).diretor_user_id) ===
                        currentUserId ? (
                      <div className="mt-1 space-y-1">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-6 w-full"
                          disabled={validandoCamada !== null}
                          onClick={() => handleValidarCamada(2)}
                        >
                          {validandoCamada === 2 ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 w-full border-red-300 text-red-700 hover:bg-red-50"
                          disabled={validandoCamada !== null}
                          onClick={() => abrirDialogRecusa(2)}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-gray-400 mt-1 h-5"
                      >
                        {tepExistente.tep_validado_gestor_em
                          ? "Pendente"
                          : "Bloqueado"}
                      </Badge>
                    )}
                  </div>

                  <span className="text-gray-300 text-base">→</span>

                  {/* CAMADA 3 — PATROCINADOR */}
                  <div
                    className={cn(
                      "flex-1 rounded-lg border p-2 text-center",
                      tepExistente.tep_validado_patrocinador_em
                        ? "bg-green-50 border-green-200"
                        : !tepExistente.tep_validado_diretor_em
                          ? "bg-gray-100 border-gray-200 opacity-50"
                          : "bg-gray-50 border-gray-200",
                    )}
                  >
                    <p className="text-[10px] text-gray-500 mb-0.5">
                      Camada 3 — Patrocinador
                    </p>
                    <p className="text-xs font-medium truncate">
                      {projeto.patrocinador_nome || "-"}
                    </p>
                    {tepExistente.tep_validado_patrocinador_em ? (
                      <div className="mt-1">
                        <Badge
                          className="bg-green-700 text-white text-[10px] h-5 cursor-pointer"
                          onClick={handleVisualizarPdf}
                        >
                          TEP Vigente
                        </Badge>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {formatDate(
                            tepExistente.tep_validado_patrocinador_em,
                          )}
                        </p>
                      </div>
                    ) : tepExistente.tep_validado_diretor_em &&
                      currentUserId &&
                      (projeto as any).patrocinador_user_id &&
                      Number((projeto as any).patrocinador_user_id) ===
                        currentUserId ? (
                      <div className="mt-1 space-y-1">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white text-[10px] h-6 w-full"
                          disabled={validandoCamada !== null}
                          onClick={() => handleValidarCamada(3)}
                        >
                          {validandoCamada === 3 ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 w-full border-red-300 text-red-700 hover:bg-red-50"
                          disabled={validandoCamada !== null}
                          onClick={() => abrirDialogRecusa(3)}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-gray-400 mt-1 h-5"
                      >
                        {tepExistente.tep_validado_diretor_em
                          ? "Pendente"
                          : "Bloqueado"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tipo de Encerramento */}
            <section>
              <Label className="text-sm font-semibold">
                Tipo de Encerramento <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-6 mt-2">
                <label
                  className={cn(
                    "flex items-center gap-2",
                    camposEditaveis
                      ? "cursor-pointer"
                      : "cursor-default opacity-70",
                  )}
                >
                  <input
                    type="radio"
                    checked={tipo === "concluido"}
                    onChange={() => setTipo("concluido")}
                    disabled={!camposEditaveis}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm">Concluído</span>
                </label>
                <label
                  className={cn(
                    "flex items-center gap-2",
                    camposEditaveis
                      ? "cursor-pointer"
                      : "cursor-default opacity-70",
                  )}
                >
                  <input
                    type="radio"
                    checked={tipo === "cancelado"}
                    onChange={() => setTipo("cancelado")}
                    disabled={!camposEditaveis}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm">Descontinuado</span>
                </label>
              </div>
            </section>

            {/* Quando "Descontinuado": exibir só Motivo da Descontinuidade */}
            {tipo === "cancelado" && (
              <section>
                <Label
                  htmlFor="motivo-descontinuidade"
                  className="text-sm font-semibold"
                >
                  Motivo da Descontinuidade{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="motivo-descontinuidade"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Descreva o motivo da descontinuidade..."
                  rows={4}
                  disabled={!camposEditaveis}
                  className="text-sm mt-2"
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 text-right mt-1">
                  {motivo.length}/500
                </p>
              </section>
            )}

            {/* Quando "Concluído": exibir considerações do gestor + patrocinador */}
            {tipo === "concluido" && (
              <>
                <section>
                  <Label
                    htmlFor="consideracoes-gestor"
                    className="text-sm font-semibold"
                  >
                    Considerações Finais do Gestor do Projeto
                  </Label>
                  <Textarea
                    id="consideracoes-gestor"
                    value={consideracoesGerente}
                    onChange={(e) => setConsideracoesGerente(e.target.value)}
                    placeholder="Descreva as considerações finais do gestor do projeto..."
                    rows={4}
                    disabled={!camposEditaveis}
                    className="text-sm mt-2"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">
                    {consideracoesGerente.length}/500
                  </p>
                </section>

                <section>
                  <Label
                    htmlFor="consideracoes-patrocinador"
                    className="text-sm font-semibold"
                  >
                    Considerações Finais do Patrocinador do Projeto
                  </Label>
                  <Textarea
                    id="consideracoes-patrocinador"
                    value={consideracoesPatrocinador}
                    onChange={(e) =>
                      setConsideracoesPatrocinador(e.target.value)
                    }
                    placeholder="Descreva as considerações finais do patrocinador do projeto..."
                    rows={4}
                    disabled={!camposEditaveis}
                    className="text-sm mt-2"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">
                    {consideracoesPatrocinador.length}/500
                  </p>
                </section>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Fechar
          </Button>
          {isSuperadmin && tepExistente && editMode && (
            <Button
              variant="outline"
              onClick={() => setEditMode(false)}
              disabled={saving}
              className="border-gray-300 text-gray-700"
            >
              Cancelar Edição
            </Button>
          )}
          {isSuperadmin && (
            <Button
              onClick={() => {
                if (tepExistente && !editMode) {
                  // Primeiro clique em "Editar TEP" → entra em modo edição
                  setEditMode(true);
                } else {
                  // Em modo edição (ou TEP inexistente) → salva
                  handleSubmit();
                }
              }}
              disabled={saving || loadingExisting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : tepExistente && !editMode ? (
                <Pencil className="h-4 w-4 mr-2" />
              ) : null}
              {!tepExistente
                ? tipo === "concluido"
                  ? "Finalizar como Concluído"
                  : "Finalizar como Descontinuado"
                : editMode
                  ? "Salvar Alterações"
                  : "Editar TEP"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Dialog de versões do TEP */}
      <Dialog
        open={versoesDialogOpen}
        onOpenChange={(o) => {
          if (!o) setVersoesDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Versões do TEP
            </DialogTitle>
          </DialogHeader>
          {loadingVersoes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : versoes.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">
              Nenhuma versão encontrada.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {versoes.map((v) => (
                <div
                  key={v.versao}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <span className="font-semibold text-emerald-700 font-mono">
                      v{v.versao}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {v.validado_em
                        ? `Validado em ${new Date(v.validado_em).toLocaleDateString("pt-BR")}`
                        : "—"}
                      {v.validado_por_nome ? ` por ${v.validado_por_nome}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePdfVersaoTep(v.versao)}
                    disabled={loadingPdfVersao === v.versao}
                    className="gap-1.5"
                  >
                    {loadingPdfVersao === v.versao ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    PDF
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de recusa do TEP */}
      <Dialog
        open={recusaDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
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
              Recusar TEP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              O TEP voltará para o gestor reiniciar o ciclo de validação. Todas
              as validações anteriores serão resetadas. Você pode incluir um
              comentário (opcional) para indicar o que precisa ser ajustado.
            </p>
            <div>
              <Label htmlFor="recusa-tep-comentario">
                Comentário (opcional)
              </Label>
              <Textarea
                id="recusa-tep-comentario"
                value={recusaComentario}
                onChange={(e) => setRecusaComentario(e.target.value)}
                placeholder="Ex: rever considerações, ajustar tipo de encerramento, etc."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRecusaDialogOpen(false)}
              disabled={recusandoTEP}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRecusarTEP}
              disabled={recusandoTEP}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {recusandoTEP ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Recusar TEP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
