import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  X as XIcon,
  Pencil,
  Trash2,
  CheckCircle2,
  ClipboardCheck,
  XCircle,
  Loader2,
  FileDown,
  History,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getUsers } from "@/services/api";
import type { User } from "@/types";
import {
  processosNegocioApi,
  ProcessoNegocio,
  VersaoHistorico,
  isResponsavel,
  isEditor,
  isComplianceOfficer,
  camposObrigatoriosFaltantes,
  validarComiteParaEnvio,
  temEditores,
  edicaoConcluida,
} from "@/services/processosNegocioApi";
import { areasApi, Area } from "@/services/areasApi";
import { generateProcessoNegocioPDF } from "@/utils/generateProcessoNegocioPDF";

interface ProcessoAcoesFooterProps {
  /** Processo PERSISTIDO (não o estado do form em edição). Em modo leitura são o mesmo. */
  processo: ProcessoNegocio;
  /** Callback após qualquer ação (validar, recusar, deletar, enviar, editores). null = deletado. */
  onChanged: (next: ProcessoNegocio | null) => void;
  /** Botão "Editar" → destrava o form inline (setEditando(true) no pai). */
  onEditar: () => void;
  /** Fecha o dialog do form (usado no handleExcluir). */
  onFechar: () => void;
  loadingFull?: boolean;
}

/**
 * Barra de ações do rodapé do preview de Processo — cópia fiel do rodapé do ProcessoDetalhe
 * (permissões, handlers, JSX e diálogos VERBATIM). Renderizada no ProcessoFormDialog quando
 * o form está travado (modo leitura). Cada botão é gated pela permissão do usuário.
 *
 * NÃO porta a seção de aprovação K1 (fica no corpo do ProcessoDetalhe, fora do rodapé).
 */
export function ProcessoAcoesFooter({
  processo,
  onChanged,
  onEditar,
  onFechar,
}: ProcessoAcoesFooterProps) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [recusaOpen, setRecusaOpen] = useState(false);
  const [recusaCamada, setRecusaCamada] = useState<
    "autor" | "diretoria" | "final"
  >("autor");
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  // Estados do diálogo "Histórico de Versões"
  const [versoesOpen, setVersoesOpen] = useState(false);
  const [versoes, setVersoes] = useState<VersaoHistorico[]>([]);
  const [loadingVersoes, setLoadingVersoes] = useState(false);
  const [loadingPdfVersao, setLoadingPdfVersao] = useState<number | null>(null);
  // Diálogo "Adicionar Editor"
  const [editoresOpen, setEditoresOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [buscaEditor, setBuscaEditor] = useState("");
  const [editorBusy, setEditorBusy] = useState(false);

  // Carrega usuários ao abrir o diálogo de editores.
  useEffect(() => {
    if (!editoresOpen) return;
    let cancelled = false;
    getUsers()
      .then((data) => {
        if (!cancelled) setUsuarios(data);
      })
      .catch(() => {
        /* erro já tratado pelo apiClient */
      });
    return () => {
      cancelled = true;
    };
  }, [editoresOpen]);

  // Carrega áreas uma vez ao montar — usado pra resolver sigla da diretoria → nome
  // completo (rodapé do PDF) e achar o gestor da área (Revisor).
  useEffect(() => {
    let cancelled = false;
    areasApi
      .getAll()
      .then((data) => {
        if (!cancelled) setAreas(data);
      })
      .catch((err) =>
        console.warn("[ProcessoAcoesFooter] erro ao carregar áreas:", err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  // Nome completo da diretoria do processo (resolve sigla → nome). Se não encontrar,
  // usa a sigla mesmo.
  const diretoriaNome = useMemo(() => {
    const match = areas.find(
      (a) =>
        a.sigla?.trim().toUpperCase() ===
        processo.diretoria?.trim().toUpperCase(),
    );
    return match?.nome || processo.diretoria || "";
  }, [areas, processo]);

  // Diretor da área cadastrada no processo = user.id === gestor_user_id da área
  // cuja sigla bate com processo.diretoria.
  const isDiretorDaArea = useMemo(() => {
    if (!user?.id) return false;
    const area = areas.find(
      (a) =>
        a.sigla?.trim().toUpperCase() ===
        processo.diretoria?.trim().toUpperCase(),
    );
    return (
      area?.gestor_user_id != null &&
      Number(area.gestor_user_id) === Number(user.id)
    );
  }, [user, processo, areas]);

  const isSuperadmin =
    (user as { is_superadmin?: boolean } | null)?.is_superadmin === true;

  // Pode atribuir/remover editores: Gestor do Escritório (superadmin), Revisor (gestor da
  // diretoria) ou Responsável do Processo (unidade vinculada no campo Responsável).
  const podeGerenciarEditores =
    isSuperadmin || isDiretorDaArea || isResponsavel(processo, user?.id);

  const editorIds = new Set(
    (processo.editores || []).map((e) => Number(e.user_id)),
  );
  const buscaEditorQ = buscaEditor.toLowerCase().trim();
  const usuariosFiltrados = usuarios
    .filter((u) => !editorIds.has(Number(u.id)))
    .filter(
      (u) =>
        !buscaEditorQ ||
        u.name?.toLowerCase().includes(buscaEditorQ) ||
        u.email?.toLowerCase().includes(buscaEditorQ),
    )
    .slice(0, 50);

  const handleAddEditor = async (u: User) => {
    setEditorBusy(true);
    try {
      const next = await processosNegocioApi.adicionarEditor(
        processo.id,
        Number(u.id),
      );
      onChanged(next);
      setBuscaEditor("");
      toast.success(`${u.name} adicionado como editor.`);
    } catch {
      toast.error("Não foi possível adicionar o editor.");
    } finally {
      setEditorBusy(false);
    }
  };

  const handleRemoveEditor = async (editorUserId: number) => {
    setEditorBusy(true);
    try {
      const next = await processosNegocioApi.removerEditor(
        processo.id,
        editorUserId,
      );
      onChanged(next);
    } catch {
      toast.error("Não foi possível remover o editor.");
    } finally {
      setEditorBusy(false);
    }
  };

  const handleAcao = async (
    label: string,
    fn: () => Promise<ProcessoNegocio>,
  ) => {
    setBusy(label);
    try {
      const next = await fn();
      onChanged(next);
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setBusy(null);
    }
  };

  const handleEnviar = () => {
    const faltam = camposObrigatoriosFaltantes(processo);
    if (faltam.length > 0) {
      toast.error(
        `Para enviar à validação, preencha os campos: ${faltam.join(", ")}.`,
      );
      return;
    }
    const erroComite = validarComiteParaEnvio(processo);
    if (erroComite) {
      toast.error(erroComite);
      return;
    }
    handleAcao("Envio para validação", () =>
      processosNegocioApi.enviar(processo.id),
    );
  };
  const handleConcluirEdicao = () =>
    handleAcao("Conclusão da edição", () =>
      processosNegocioApi.concluirEdicao(processo.id),
    );
  const handleValidarAutor = () =>
    handleAcao("Validação do autor", () =>
      processosNegocioApi.validarAutor(processo.id),
    );
  const handleValidarDiretoria = () =>
    handleAcao("Validação da diretoria", () =>
      processosNegocioApi.validarDiretoria(processo.id),
    );
  const handleValidarFinal = () =>
    handleAcao("Validação final", () =>
      processosNegocioApi.validarFinal(processo.id),
    );

  const handleRecusarConfirm = async () => {
    if (!recusaMotivo.trim()) {
      toast.error("Informe um motivo pra recusa.");
      return;
    }
    setBusy("Recusa");
    try {
      const next = await processosNegocioApi.recusar(
        processo.id,
        recusaCamada,
        recusaMotivo.trim(),
      );
      onChanged(next);

      setRecusaOpen(false);
      setRecusaMotivo("");
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setBusy(null);
    }
  };

  const handleExcluir = async () => {
    if (
      !window.confirm("Excluir este processo? Esta ação não pode ser desfeita.")
    )
      return;
    setBusy("Exclusão");
    try {
      await processosNegocioApi.remove(processo.id);

      onChanged(null);
      onFechar();
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setBusy(null);
    }
  };

  // Gera PDF da versão atual (live) do processo.
  const handleBaixarPDF = () => {
    try {
      generateProcessoNegocioPDF(processo, diretoriaNome);
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Abre o diálogo de histórico e carrega as versões homologadas (snapshots).
  const handleAbrirVersoes = async () => {
    setVersoesOpen(true);
    setLoadingVersoes(true);
    try {
      const data = await processosNegocioApi.listVersoes(processo.id);
      setVersoes(data);
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingVersoes(false);
    }
  };

  // Baixa o PDF de uma versão histórica específica — busca o snapshot e gera o PDF
  // a partir do estado congelado naquele momento.
  const handleBaixarVersao = async (historicoId: number) => {
    setLoadingPdfVersao(historicoId);
    try {
      const snapshot = await processosNegocioApi.getVersaoSnapshot(
        processo.id,
        historicoId,
      );
      generateProcessoNegocioPDF(snapshot, diretoriaNome);
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingPdfVersao(null);
    }
  };

  // Lógica de quais botões mostrar baseado no status atual — VERBATIM do ProcessoDetalhe.
  const isComplianceOfficerUser = isComplianceOfficer(user);
  const isEditorAtribuido = isEditor(processo, user?.id);
  const statusEmPreenchimento =
    processo.status === "em_elaboracao" || processo.status === "recusado";
  const ehResponsavel = isResponsavel(processo, user?.id);
  const podePapelEditor =
    isSuperadmin || isDiretorDaArea || ehResponsavel || isComplianceOfficerUser;
  const podeEditar =
    (podePapelEditor &&
      (statusEmPreenchimento || processo.status === "validado_final")) ||
    (isEditorAtribuido && statusEmPreenchimento) ||
    (isDiretorDaArea && processo.status === "validado_autor") ||
    (isComplianceOfficerUser && processo.status === "validado_diretoria");
  // Edição concluída (sinal do Editor atribuído). Enquanto houver editor e ele não concluir,
  // o Responsável fica bloqueado de validar a camada 1.
  const temEditoresAtribuidos = temEditores(processo);
  const edicaoJaConcluida = edicaoConcluida(processo);
  const editorPendente = temEditoresAtribuidos && !edicaoJaConcluida;
  // O Editor atribuído pode sinalizar "Concluir edição" enquanto o processo está em preenchimento.
  // NÃO depende de edicao_concluida: um save de validador (Responsável/Revisor/Compliance) carimba
  // edicao_concluida de forma "sticky" e escondia o botão do editor — o editor precisa poder
  // (re)confirmar a conclusão da sua parte. A ação é idempotente.
  const podeConcluirEdicao = isEditorAtribuido && statusEmPreenchimento;
  const podeEnviar =
    ehResponsavel &&
    (processo.status === "em_elaboracao" || processo.status === "recusado") &&
    // Só valida quando não há editor pendente (editor concluiu, ou não há editor atribuído).
    !editorPendente;
  const podeValidarAutor = ehResponsavel && processo.status === "enviado";
  const podeValidarDiretoria =
    isDiretorDaArea && processo.status === "validado_autor";
  const podeValidarFinal =
    isComplianceOfficerUser && processo.status === "validado_diretoria";

  const podeRecusar =
    (processo.status === "enviado" && ehResponsavel) ||
    (processo.status === "validado_autor" && isDiretorDaArea) ||
    (processo.status === "validado_diretoria" && isComplianceOfficerUser);

  const podeExcluir = user?.role === "ADMIN";

  const camadaSugerida: "autor" | "diretoria" | "final" =
    processo.status === "enviado"
      ? "autor"
      : processo.status === "validado_autor"
        ? "diretoria"
        : processo.status === "validado_diretoria"
          ? "final"
          : "autor";

  return (
    <>
      {/* Footer fixo — ações (VERBATIM do rodapé do ProcessoDetalhe) */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {podeExcluir && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleExcluir}
              disabled={!!busy}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleBaixarPDF}
            disabled={!!busy}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleAbrirVersoes}
            disabled={!!busy}
          >
            <History className="h-4 w-4 mr-2" />
            Histórico de Versões
          </Button>
          {podeGerenciarEditores && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditoresOpen(true)}
              disabled={!!busy}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Editor
              {(processo.editores?.length ?? 0) > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                  {processo.editores.length}
                </span>
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {podeConcluirEdicao && (
            <Button
              type="button"
              onClick={handleConcluirEdicao}
              disabled={!!busy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {busy === "Conclusão da edição" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4 mr-2" />
              )}
              Concluir edição
            </Button>
          )}
          {podeEditar && (
            <Button
              type="button"
              variant="outline"
              onClick={onEditar}
              disabled={!!busy}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {podeEnviar && (
            <Button
              type="button"
              onClick={handleEnviar}
              disabled={!!busy}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {busy === "Envio para validação" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Validar
            </Button>
          )}
          {podeRecusar && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRecusaCamada(camadaSugerida);
                setRecusaOpen(true);
              }}
              disabled={!!busy}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Recusar
            </Button>
          )}
          {podeValidarAutor && (
            <Button
              type="button"
              onClick={handleValidarAutor}
              disabled={!!busy}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {busy === "Validação do autor" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Validar
            </Button>
          )}
          {podeValidarDiretoria && (
            <Button
              type="button"
              onClick={handleValidarDiretoria}
              disabled={!!busy}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {busy === "Validação da diretoria" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Validar
            </Button>
          )}
          {podeValidarFinal && (
            <Button
              type="button"
              onClick={handleValidarFinal}
              disabled={!!busy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {busy === "Validação final" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Validar
            </Button>
          )}
        </div>
      </div>

      {/* Diálogo de recusa */}
      <Dialog open={recusaOpen} onOpenChange={setRecusaOpen}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Recusar Processo
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                O processo volta para o <strong>Responsável</strong> (1ª camada)
                com o motivo abaixo e a validação recomeça do início.
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Motivo
              </Label>
              <Textarea
                value={recusaMotivo}
                onChange={(e) => setRecusaMotivo(e.target.value)}
                placeholder="Descreva o motivo da recusa..."
                rows={4}
                className="mt-1 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRecusaOpen(false)}
                disabled={busy === "Recusa"}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleRecusarConfirm}
                disabled={busy === "Recusa" || !recusaMotivo.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {busy === "Recusa" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Confirmar Recusa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de histórico de versões homologadas — cada entrada é um snapshot
          completo do processo no momento da validação final. */}
      <Dialog open={versoesOpen} onOpenChange={setVersoesOpen}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Histórico de Versões
              </h3>
            </div>
            <p className="text-sm text-slate-500 -mt-2">
              Cada versão é um snapshot homologado do processo. Baixe o PDF na
              versão exata em que foi aprovada.
            </p>

            {loadingVersoes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : versoes.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-sm">
                Nenhuma versão homologada ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {versoes.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <span className="font-semibold text-emerald-700 font-mono">
                        v{v.versao}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Homologado em{" "}
                        {new Date(v.validado_final_em).toLocaleDateString(
                          "pt-BR",
                        )}
                        {v.validado_final_nome
                          ? ` por ${v.validado_final_nome}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBaixarVersao(v.id)}
                      disabled={loadingPdfVersao === v.id}
                      className="gap-1.5"
                    >
                      {loadingPdfVersao === v.id ? (
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

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVersoesOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Adicionar Editor */}
      <Dialog open={editoresOpen} onOpenChange={setEditoresOpen}>
        <DialogContent className="max-w-lg">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                Editores do processo
              </h3>
              <p className="text-sm text-slate-500">
                Usuários que podem editar e salvar o conteúdo deste processo (sem
                iniciar revisão nem validar).
              </p>
            </div>

            {/* Editores atuais */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                Editores atuais
              </Label>
              {(processo.editores?.length ?? 0) === 0 ? (
                <p className="text-xs italic text-slate-400">
                  Nenhum editor atribuído.
                </p>
              ) : (
                processo.editores.map((e) => (
                  <div
                    key={e.user_id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-slate-700">
                        {e.nome || `Usuário ${e.user_id}`}
                      </span>
                      {e.email && (
                        <span className="text-[11px] text-slate-400">
                          {e.email}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEditor(e.user_id)}
                      disabled={editorBusy}
                      className="text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50"
                      title="Remover editor"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Adicionar usuário */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                Adicionar usuário
              </Label>
              <Input
                value={buscaEditor}
                onChange={(ev) => setBuscaEditor(ev.target.value)}
                placeholder="Buscar por nome ou e-mail..."
              />
              <div className="max-h-52 overflow-y-auto rounded-md border border-slate-200">
                {usuariosFiltrados.length === 0 ? (
                  <div className="px-3 py-2 text-sm italic text-slate-500">
                    {buscaEditorQ
                      ? "Nenhum usuário encontrado."
                      : "Comece a digitar para buscar..."}
                  </div>
                ) : (
                  usuariosFiltrados.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={editorBusy}
                      onClick={() => handleAddEditor(u)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span className="flex flex-col">
                        <span className="text-slate-800">{u.name}</span>
                        {u.email && (
                          <span className="text-[11px] text-slate-400">
                            {u.email}
                          </span>
                        )}
                      </span>
                      <UserPlus className="h-4 w-4 flex-shrink-0 text-blue-500" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
