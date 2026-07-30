import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  X as XIcon,
  Pencil,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Users,
  Info,
  Settings,
  Calendar,
  Workflow,
  ClipboardCheck,
  FileImage,
  Cog,
  Paperclip,
  Download,
  File as FileIcon,
  FileDown,
  History,
  BarChart3,
  ShieldCheck,
  Upload,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { getUsers } from "@/services/api";
import type { User } from "@/types";
import {
  processosNegocioApi,
  ProcessoNegocio,
  VersaoHistorico,
  STATUS_LABEL,
  STATUS_COLOR,
  TIPO_DOCUMENTO_LABEL,
  TIPO_DOCUMENTO_BADGE,
  normalizeResponsavel,
  isResponsavel,
  isEditor,
  isComplianceOfficerEmail,
  REVISAO_POLITICA_TEXTO,
  getFluxograma,
  isK1,
  temDocumentoPrimario,
  aprovacaoDoComite,
  camposObrigatoriosFaltantes,
  validarComiteParaEnvio,
  COMITES_APROVACAO,
} from "@/services/processosNegocioApi";
import { areasApi, Area } from "@/services/areasApi";
import { generateProcessoNegocioPDF } from "@/utils/generateProcessoNegocioPDF";

interface ProcessoDetalheProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: ProcessoNegocio | null;
  /** Callback após qualquer ação (validar, recusar, deletar, enviar) */
  onChanged: (next: ProcessoNegocio | null) => void;
  /** Callback ao clicar em editar — abre o ProcessoFormDialog */
  onEdit: (processo: ProcessoNegocio) => void;
  /**
   * True enquanto o objeto completo (com os bytes de fluxograma/anexos) está sendo
   * buscado por id. A listagem entrega um payload enxuto (sem base64), então o detalhe
   * abre na hora com os metadados e preenche o conteúdo pesado quando o fetch retorna.
   */
  loadingFull?: boolean;
  /**
   * Ação de validação disponível para o usuário na camada atual (calculada na página, mesma
   * regra do botão "Validar" da edição). Quando presente, o preview mostra "Validar" direto —
   * sem precisar entrar no modo de edição.
   */
  validacao?: { exec: (id: number) => Promise<ProcessoNegocio> } | null;
}

// ============================================================
// HELPERS DE LAYOUT
// ============================================================

/**
 * Calcula a próxima revisão a partir do período (Período + 1 ano).
 * Retorna formato brasileiro DD/MM/AAAA, ou '—' se o período não estiver definido.
 */
function addOneYearToDate(periodo: string | null | undefined): string {
  if (!periodo || !periodo.trim()) return "—";
  const m = periodo.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  d.setFullYear(d.getFullYear() + 1);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Formata uma data ISO (YYYY-MM-DD) para a data completa dd/mm/aaaa.
 * Mantém compatibilidade com valores antigos em texto livre.
 */
function formatDataCompleta(data: string | null | undefined): string {
  if (!data || !data.trim()) return "—";
  const m = data.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return data;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Cabeçalho institucional (mimetiza a tabela superior do PDF) */
function CabecalhoInstitucional({ processo }: { processo: ProcessoNegocio }) {
  return (
    <div className="border border-slate-300 rounded-md overflow-hidden bg-white">
      <div className="grid grid-cols-[180px_1fr] divide-x divide-slate-300">
        {/* Brasão + label */}
        <div className="flex flex-col items-center justify-center py-4 px-3 bg-white text-center">
          <img
            src="/brasao-goias.png"
            alt="Brasão"
            className="h-14 w-14 object-contain mb-1"
          />
          <p className="text-[10px] font-bold tracking-wide text-slate-800">
            PODER JUDICIÁRIO
          </p>
          <p className="text-[9px] text-slate-600">
            Tribunal de Justiça do Estado de Goiás
          </p>
        </div>

        {/* Tabela de identificação */}
        <div className="divide-y divide-slate-300">
          <div className="px-4 py-3 text-center bg-white">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Processo de Negócio
            </p>
          </div>
          <CabecalhoRow
            label="Revisão:"
            value={String(parseInt(String(processo.revisao ?? "0"), 10) || 0).padStart(3, "0")}
            label2="Código/Versão"
            value2={processo.codigo_versao || "—"}
          />
          <CabecalhoRow
            label="Macroprocesso:"
            value={processo.macroprocesso || "—"}
          />
          <CabecalhoRow
            label="Data:"
            value={formatDataCompleta(processo.periodo)}
          />
        </div>
      </div>

      {/* Linha "Nome do Processo" — full width abaixo */}
      <div className="grid grid-cols-[180px_1fr] divide-x divide-slate-300 border-t border-slate-300">
        <div className="px-3 py-3 bg-white text-center text-xs font-bold tracking-wide text-slate-800">
          NOME DO PROCESSO
        </div>
        <div className="px-4 py-3 bg-white">
          <p className="text-sm font-bold italic text-blue-700">
            {processo.nome_processo}
          </p>
        </div>
      </div>
    </div>
  );
}

function CabecalhoRow({
  label,
  value,
  label2,
  value2,
}: {
  label: string;
  value: string;
  label2?: string;
  value2?: string;
}) {
  if (label2) {
    return (
      <div className="grid grid-cols-[140px_1fr_120px_1fr] divide-x divide-slate-300">
        <div className="px-3 py-2 text-xs font-bold text-blue-700 bg-amber-50">
          {label}
        </div>
        <div className="px-3 py-2 text-xs text-slate-700">{value}</div>
        <div className="px-3 py-2 text-xs font-bold text-blue-700 bg-amber-50">
          {label2}
        </div>
        <div className="px-3 py-2 text-xs text-slate-700">{value2}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[140px_1fr] divide-x divide-slate-300">
      <div className="px-3 py-2 text-xs font-bold text-blue-700 bg-amber-50">
        {label}
      </div>
      <div className="px-3 py-2 text-xs text-slate-700">{value}</div>
    </div>
  );
}

/** Bloco "Seção" — header amber + corpo branco com borda */
function SectionBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-300 rounded-md overflow-hidden bg-white">
      <div className="flex items-center gap-2 bg-amber-50 border-b border-slate-300 px-4 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded text-slate-700">
          {icon}
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
          {title}
        </h3>
      </div>
      <div className="px-4 py-3 text-sm text-slate-700">{children}</div>
    </section>
  );
}

/** Tabela com colunas (Proprietário | Atores | Áreas) */
function TableColunas({
  cols,
}: {
  cols: Array<{ title: string; items: string[] }>;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {cols.map((c) => (
            <th
              key={c.title}
              className="border border-slate-300 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-slate-700"
            >
              {c.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="align-top">
          {cols.map((c) => (
            <td
              key={c.title}
              className="border border-slate-300 px-3 py-3 bg-white text-sm"
            >
              {c.items.length === 0 ? (
                <span className="text-xs italic text-slate-400">
                  Não informado
                </span>
              ) : (
                <ul className="space-y-1">
                  {c.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-slate-700" />
                      <span className="flex-1 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** Texto multi-parágrafo com bullets se começar com "-" ou "•" */
function MultiParagraph({ text }: { text: string | null }) {
  if (!text || !text.trim()) {
    return <p className="text-xs italic text-slate-400">Não informado</p>;
  }
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        const bulleted = /^\s*[-•*]\s+/.test(line);
        const numbered = /^\s*\d+[\.\)]\s+/.test(line);
        if (bulleted || numbered) {
          return (
            <div key={idx} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-slate-700" />
              <span className="flex-1 break-words">
                {line.replace(/^\s*[-•*\d\.\)]+\s*/, "")}
              </span>
            </div>
          );
        }
        return (
          <p key={idx} className="leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

/** Histórico de validação — tabela final do PDF */
function HistoricoValidacao({ processo }: { processo: ProcessoNegocio }) {
  const fmt = (d: string | null, nome: string | null) =>
    d && nome
      ? `${nome} — ${new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
      : "Pendente";
  const rows: Array<{ label: string; value: string; isPending: boolean }> = [
    {
      label: "Validação do Responsável",
      value: fmt(processo.validado_autor_em, processo.validado_autor_nome),
      isPending: !processo.validado_autor_em,
    },
    {
      label: "Validação Setorial",
      value: fmt(
        processo.validado_diretoria_em,
        processo.validado_diretoria_nome,
      ),
      isPending: !processo.validado_diretoria_em,
    },
    {
      label: "Validação Estratégica",
      value: fmt(processo.validado_final_em, processo.validado_final_nome),
      isPending: !processo.validado_final_em,
    },
  ];
  return (
    <SectionBlock
      icon={<ClipboardCheck className="h-4 w-4" />}
      title="Histórico de Validação"
    >
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50/50 w-[220px]">
                {row.label}
              </td>
              <td className="border border-slate-300 px-3 py-2 text-sm text-slate-700">
                {row.isPending ? (
                  <span className="text-slate-500">Pendente</span>
                ) : (
                  row.value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mostra recusa se houver */}
      {processo.status === "recusado" && processo.recusa_motivo && (
        <div className="mt-3 border border-red-200 bg-red-50 rounded-md px-4 py-3">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">
            Recusado por {processo.recusado_por_nome} — camada{" "}
            {processo.recusado_camada}
          </p>
          <p className="text-sm text-red-900 leading-relaxed">
            {processo.recusa_motivo}
          </p>
        </div>
      )}
    </SectionBlock>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function ProcessoDetalhe({
  open,
  onOpenChange,
  processo,
  onChanged,
  onEdit,
  loadingFull = false,
  validacao = null,
}: ProcessoDetalheProps) {
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
  // Comitê cuja aprovação está sendo anexada/removida no momento (sigla) ou null.
  const [aprovacaoBusyComite, setAprovacaoBusyComite] = useState<string | null>(
    null,
  );
  // Data de aprovação informada por comitê (sigla -> YYYY-MM-DD), antes de anexar.
  const [aprovacaoEmInputs, setAprovacaoEmInputs] = useState<
    Record<string, string>
  >({});
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

  // Carrega áreas uma vez ao abrir o detalhe — usado pra resolver
  // sigla da diretoria → nome completo no rodapé institucional.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    areasApi
      .getAll()
      .then((data) => {
        if (!cancelled) setAreas(data);
      })
      .catch((err) =>
        console.warn("[ProcessoDetalhe] erro ao carregar áreas:", err),
      );
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Nome completo da diretoria do processo (resolve sigla → nome). Se não encontrar,
  // usa a sigla mesmo.
  const diretoriaNome = useMemo(() => {
    if (!processo) return "";
    const match = areas.find(
      (a) =>
        a.sigla?.trim().toUpperCase() ===
        processo.diretoria?.trim().toUpperCase(),
    );
    return match?.nome || processo.diretoria || "";
  }, [areas, processo]);

  // Diretor da área cadastrada no processo = user.id === gestor_user_id da área
  // cuja sigla bate com processo.diretoria. Hook precisa ficar ANTES do early-return
  // pra não violar a regra de ordem dos hooks.
  const isDiretorDaArea = useMemo(() => {
    if (!user?.id || !processo) return false;
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

  if (!processo) return null;

  const isSuperadmin = (user as any)?.is_superadmin === true;

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
    } catch (err: any) {
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

  // Validação direta no preview (mesma ação do botão "Validar" da edição). Na 1ª camada
  // (em_elaboracao/recusado, que envia à validação) valida os campos obrigatórios + comitê antes.
  const handleValidarPreview = () => {
    if (!validacao) return;
    if (
      processo.status === "em_elaboracao" ||
      processo.status === "recusado"
    ) {
      const faltam = camposObrigatoriosFaltantes(processo);
      if (faltam.length > 0) {
        toast.error(`Para validar, preencha os campos: ${faltam.join(", ")}.`);
        return;
      }
      const erroComite = validarComiteParaEnvio(processo);
      if (erroComite) {
        toast.error(erroComite);
        return;
      }
    }
    handleAcao("Validação", () => validacao.exec(processo.id));
  };

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
    } catch (err: any) {
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
      onOpenChange(false);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setBusy(null);
    }
  };

  // Gera PDF da versão atual (live) do processo.
  const handleBaixarPDF = () => {
    try {
      generateProcessoNegocioPDF(processo, diretoriaNome);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Anexa o PDF de aprovação de UM comitê (Modelo K1) — restrito a superadmin.
  const handleUploadAprovacao = async (comite: string, file: File) => {
    const dataAprovacao = aprovacaoEmInputs[comite];
    if (!dataAprovacao) {
      toast.error("Informe a data de aprovação antes de anexar o PDF.");
      return;
    }
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("PDF muito grande. Tamanho máximo: 6MB.");
      return;
    }
    setAprovacaoBusyComite(comite);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const updated = await processosNegocioApi.setAprovacao(processo.id, {
        aprovacao_data: dataUrl,
        aprovacao_filename: file.name,
        aprovacao_mime: file.type || "application/pdf",
        aprovacao_em: dataAprovacao,
        aprovacao_comite: comite,
      });
      onChanged(updated);
      setAprovacaoEmInputs((prev) => ({ ...prev, [comite]: "" }));
      toast.success("Aprovação anexada.");
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setAprovacaoBusyComite(null);
    }
  };

  const handleRemoverAprovacao = async (comite: string) => {
    if (
      !window.confirm(
        `Remover a aprovação do ${comite}? O processo pode deixar de ser Modelo K1.`,
      )
    )
      return;
    setAprovacaoBusyComite(comite);
    try {
      const updated = await processosNegocioApi.removeAprovacao(
        processo.id,
        comite,
      );
      onChanged(updated);
      toast.success("Aprovação removida.");
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setAprovacaoBusyComite(null);
    }
  };

  // Abre o diálogo de histórico e carrega as versões homologadas (snapshots).
  const handleAbrirVersoes = async () => {
    setVersoesOpen(true);
    setLoadingVersoes(true);
    try {
      const data = await processosNegocioApi.listVersoes(processo.id);
      setVersoes(data);
    } catch (err: any) {
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
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingPdfVersao(null);
    }
  };

  // Lógica de quais botões mostrar baseado no status atual.
  // - 'validado_final': só "Editar" aparece (sem "Enviar"). Quando o autor edita
  //   e salva, o backend reseta o status pra 'em_elaboracao' (homologação fica
  //   invalidada), e aí o "Enviar para Validação" passa a aparecer.
  // - 'em_elaboracao' / 'recusado': tanto "Editar" quanto "Enviar" aparecem.
  const isComplianceOfficer = isComplianceOfficerEmail(user?.email);
  const isEditorAtribuido = isEditor(processo, user?.id);
  // Status em que o conteúdo está "em preenchimento".
  const statusEmPreenchimento =
    processo.status === "em_elaboracao" || processo.status === "recusado";
  // Papéis que editam o conteúdo (e podem reabrir um processo vigente ao editar):
  // Gestor do Escritório (superadmin), Revisor (gestor da diretoria), Responsável e
  // Compliance Officer. Editor atribuído é tratado à parte (não reabre vigente).
  const ehResponsavel = isResponsavel(processo, user?.id);
  const podePapelEditor =
    isSuperadmin || isDiretorDaArea || ehResponsavel || isComplianceOfficer;
  const podeEditar =
    (podePapelEditor &&
      (statusEmPreenchimento || processo.status === "validado_final")) ||
    // Editor atribuído: apenas preenche/salva em elaboração ou recusado (não reabre vigente).
    (isEditorAtribuido && statusEmPreenchimento) ||
    // Revisor edita no aguardo da camada 2; Compliance no aguardo da camada 3 — para corrigir
    // e validar a própria camada sem devolver ao Responsável.
    (isDiretorDaArea && processo.status === "validado_autor") ||
    (isComplianceOfficer && processo.status === "validado_diretoria");
  const podeEnviar =
    ehResponsavel &&
    (processo.status === "em_elaboracao" || processo.status === "recusado");
  // Regras de validação por camada:
  // - Camada 1 (Responsável): o Responsável do Processo valida o que preencheu
  // - Camada 2 (Revisor): o gestor da diretoria cadastrada valida
  // - Camada 3 (Compliance Officer): validadores finais (ver COMPLIANCE_OFFICER_EMAILS)
  const podeValidarAutor = ehResponsavel && processo.status === "enviado";
  const podeValidarDiretoria =
    isDiretorDaArea && processo.status === "validado_autor";
  const podeValidarFinal =
    isComplianceOfficer && processo.status === "validado_diretoria";

  // Recusar: quem pode validar a camada atual também pode recusar
  const podeRecusar =
    (processo.status === "enviado" && ehResponsavel) ||
    (processo.status === "validado_autor" && isDiretorDaArea) ||
    (processo.status === "validado_diretoria" && isComplianceOfficer);

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl gap-0 overflow-hidden border-0 bg-white p-0 sm:rounded-2xl max-h-[92vh] flex flex-col">
          {/* Header fixo */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">
                {processo.nome_processo}
              </h2>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[processo.status]}`}
              >
                {STATUS_LABEL[processo.status]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-white/70 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Corpo: layout template-styled */}
          <div className="flex-1 overflow-y-auto bg-slate-100 px-6 py-6 space-y-4">
            <CabecalhoInstitucional processo={processo} />

            <SectionBlock
              icon={<FileText className="h-4 w-4" />}
              title="Descrição do Processo"
            >
              <MultiParagraph text={processo.descricao} />
            </SectionBlock>

            <SectionBlock
              icon={<Users className="h-4 w-4" />}
              title="Governança e Responsáveis"
            >
              <TableColunas
                cols={[
                  {
                    title: "Responsável:",
                    items: (processo.proprietarios || []).map((r) => {
                      const n = normalizeResponsavel(r);
                      return n.area ? `${n.cargo} (${n.area})` : n.cargo;
                    }),
                  },
                  {
                    title: "Áreas Envolvidas",
                    items: processo.areas_responsaveis || [],
                  },
                ]}
              />
            </SectionBlock>

            <SectionBlock
              icon={<Info className="h-4 w-4" />}
              title="Informações Utilizadas"
            >
              <TableColunas
                cols={[
                  { title: "Entrada", items: processo.entradas || [] },
                  { title: "Saída", items: processo.saidas || [] },
                ]}
              />
            </SectionBlock>

            <SectionBlock
              icon={<Cog className="h-4 w-4" />}
              title="Estrutura do Processo"
            >
              <MultiParagraph text={processo.detalhamento} />
            </SectionBlock>

            <SectionBlock
              icon={<Settings className="h-4 w-4" />}
              title="Recursos Utilizados"
            >
              <TableColunas
                cols={[
                  {
                    title: "Sistemas / Ferramentas",
                    items: processo.sistemas_ferramentas || [],
                  },
                  {
                    title: "Normativo / Referências",
                    items: processo.normativos_referencias || [],
                  },
                ]}
              />
            </SectionBlock>

            <SectionBlock
              icon={<BarChart3 className="h-4 w-4" />}
              title="Indicadores"
            >
              <MultiParagraph text={processo.indicadores} />
            </SectionBlock>

            <SectionBlock
              icon={<Workflow className="h-4 w-4" />}
              title="Modelagem / Fluxograma"
            >
              {(() => {
                const flux = getFluxograma(processo);
                if (!flux.data) {
                  // Só mostra "Carregando" se o payload enxuto indicar que há fluxograma
                  // (tem_fluxograma). Processos sem fluxograma mostram "Nenhum" de imediato.
                  if (loadingFull && processo.tem_fluxograma !== false) {
                    return (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando fluxograma…
                      </div>
                    );
                  }
                  return (
                    <p className="text-xs italic text-slate-400">
                      Nenhum fluxograma anexado.
                    </p>
                  );
                }
                if (flux.mime?.startsWith("image/")) {
                  return (
                    <img
                      src={flux.data}
                      alt={flux.filename || "Fluxograma"}
                      className="w-full max-h-[700px] object-contain rounded bg-white border border-slate-200"
                    />
                  );
                }
                if (flux.mime === "application/pdf") {
                  return (
                    <iframe
                      src={flux.data}
                      title={flux.filename || "Fluxograma"}
                      className="w-full h-[700px] rounded bg-white border border-slate-200"
                    />
                  );
                }
                return (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <FileImage className="h-4 w-4" />
                    Pré-visualização indisponível ({flux.filename})
                  </div>
                );
              })()}
            </SectionBlock>

            <SectionBlock
              icon={<Paperclip className="h-4 w-4" />}
              title="Documentos Anexados"
            >
              {(processo.documentos_anexados || []).length === 0 ? (
                <p className="text-xs italic text-slate-400">
                  Nenhum documento anexado.
                </p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-slate-300 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-slate-700 w-[180px]">
                        Tipo
                      </th>
                      <th className="border border-slate-300 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-slate-700">
                        Documento
                      </th>
                      <th className="border border-slate-300 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-slate-700 w-[100px]">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processo.documentos_anexados.map((doc, idx) => {
                      const isImage = doc.mime.startsWith("image/");
                      const isPdf = doc.mime === "application/pdf";
                      return (
                        <tr key={`${idx}-${doc.nome}`} className="align-middle">
                          <td className="border border-slate-300 px-3 py-2 bg-white text-center">
                            <span
                              className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${TIPO_DOCUMENTO_BADGE[doc.tipo]}`}
                              title={TIPO_DOCUMENTO_LABEL[doc.tipo]}
                            >
                              {doc.tipo}
                            </span>
                          </td>
                          <td className="border border-slate-300 px-3 py-2 bg-white">
                            <div className="flex items-center gap-2">
                              {isImage ? (
                                <FileImage className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              ) : isPdf ? (
                                <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                              ) : (
                                <FileIcon className="h-4 w-4 text-slate-500 flex-shrink-0" />
                              )}
                              <span className="text-sm text-slate-700 break-words">
                                {doc.nome}
                              </span>
                            </div>
                          </td>
                          <td className="border border-slate-300 px-3 py-2 bg-white text-center">
                            {doc.data ? (
                              <a
                                href={doc.data}
                                download={doc.nome}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                title="Baixar"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Baixar
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Carregando…
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </SectionBlock>

            <SectionBlock
              icon={<Calendar className="h-4 w-4" />}
              title="Revisão"
            >
              <div className="overflow-hidden rounded-md border border-slate-300">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="border-b border-slate-300 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-slate-700 md:border-b-0 md:border-r">
                    Periodicidade
                  </div>
                  <div className="border-t border-slate-300 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-slate-700 md:border-t-0">
                    Próxima Revisão
                  </div>
                  <div className="px-3 py-3 text-sm text-slate-700 md:border-r md:border-slate-300">
                    {REVISAO_POLITICA_TEXTO}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-3 text-sm">
                    <Calendar className="h-4 w-4 flex-shrink-0 text-blue-500" />
                    {processo.periodo ? (
                      <span className="font-semibold text-slate-900">
                        {addOneYearToDate(processo.periodo)}
                      </span>
                    ) : (
                      <span className="italic text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock
              icon={<FileText className="h-4 w-4" />}
              title="Formalização"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                    Nº do Proad
                  </p>
                  {processo.numero_proad ? (
                    <p className="text-sm text-slate-700">
                      {processo.numero_proad}
                    </p>
                  ) : (
                    <p className="text-xs italic text-slate-400">
                      Não informado
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                    Observações Gerais
                  </p>
                  <MultiParagraph text={processo.observacoes_gerais} />
                </div>
              </div>
            </SectionBlock>

            <HistoricoValidacao processo={processo} />

            <SectionBlock
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Aprovação (Modelo K1)"
            >
              {(() => {
                const k1 = isK1(processo);
                const exigidos = processo.apreciacao || [];
                const faltam = camposObrigatoriosFaltantes(processo);
                return (
                  <div className="space-y-3">
                    {k1 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Modelo K1
                        </span>
                      </div>
                    )}

                    {faltam.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Para atualizar o processo para o modelo atual, preencha
                        os campos:{" "}
                        <span className="font-semibold">
                          {faltam.join(", ")}
                        </span>
                        .
                      </div>
                    )}

                    {exigidos.length === 0 ? (
                      <p className="text-xs italic text-slate-400">
                        Este processo não passa por aprovação de comitê
                        (apreciação vazia).
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {exigidos.map((comite) => {
                          const aprov = aprovacaoDoComite(processo, comite);
                          const nome = COMITES_APROVACAO[comite] || comite;
                          const busy = aprovacaoBusyComite === comite;
                          const carregando = loadingFull && !!aprov && !aprov.data;
                          return (
                            <div
                              key={comite}
                              className="rounded-md border border-slate-200 p-3"
                            >
                              <p className="text-sm font-semibold text-slate-800">
                                {comite}{" "}
                                <span className="font-normal text-slate-500">
                                  — {nome}
                                </span>
                              </p>
                              {aprov ? (
                                <div className="mt-2 space-y-1.5">
                                  <p className="text-sm text-slate-700">
                                    <span className="font-semibold">
                                      Aprovado em:
                                    </span>{" "}
                                    {formatDataCompleta(aprov.em)}
                                  </p>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                      <FileText className="h-4 w-4 flex-shrink-0 text-red-500" />
                                      <span className="break-words">
                                        {aprov.filename || "aprovacao.pdf"}
                                      </span>
                                    </div>
                                    {carregando ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Carregando…
                                      </span>
                                    ) : (
                                      aprov.data && (
                                        <a
                                          href={aprov.data}
                                          download={
                                            aprov.filename || "aprovacao.pdf"
                                          }
                                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                          Baixar
                                        </a>
                                      )
                                    )}
                                    {isSuperadmin && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleRemoverAprovacao(comite)
                                        }
                                        disabled={busy}
                                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        {busy ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                        <span className="ml-1">Remover</span>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ) : isSuperadmin ? (
                                <div className="mt-2 flex flex-wrap items-end gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                      Data de aprovação
                                    </label>
                                    <input
                                      type="date"
                                      value={aprovacaoEmInputs[comite] || ""}
                                      onChange={(e) =>
                                        setAprovacaoEmInputs((prev) => ({
                                          ...prev,
                                          [comite]: e.target.value,
                                        }))
                                      }
                                      className="h-9 w-[180px] rounded-md border border-slate-300 bg-white px-3 text-sm"
                                    />
                                  </div>
                                  <label
                                    className={`inline-flex items-center gap-2 text-sm font-medium ${
                                      aprovacaoEmInputs[comite]
                                        ? "cursor-pointer text-blue-600 hover:text-blue-700"
                                        : "cursor-not-allowed text-slate-400"
                                    }`}
                                  >
                                    {busy ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Upload className="h-4 w-4" />
                                    )}
                                    Anexar aprovação (PDF)
                                    <input
                                      type="file"
                                      accept="application/pdf,.pdf"
                                      className="hidden"
                                      disabled={busy || !aprovacaoEmInputs[comite]}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleUploadAprovacao(comite, f);
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <p className="mt-1 text-xs italic text-slate-400">
                                  Aprovação pendente.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </SectionBlock>

            {/* Rodapé institucional — todos os campos são dinâmicos:
                - Elaborado por: nome completo da diretoria do processo (lookup por sigla)
                - Versão: campo `versao` do processo (inicia em 1.0, incrementa 0.1 a cada
                  reenvio pós-recusa)
                - Data da atualização: timestamp de updated_at do processo */}
            <div className="grid grid-cols-4 gap-4 px-4 pt-4 mt-2 text-center text-xs text-slate-600">
              <div className="whitespace-nowrap">
                <span className="uppercase tracking-wide text-slate-500">
                  Modelo:{" "}
                </span>
                <span className="font-bold text-slate-700">
                  {isK1(processo)
                    ? "K1"
                    : temDocumentoPrimario(processo)
                      ? "Doc. Primário"
                      : "—"}
                </span>
              </div>
              <div className="whitespace-nowrap">
                <span className="uppercase tracking-wide text-slate-500">
                  ID:{" "}
                </span>
                <span className="font-bold text-slate-700 tabular-nums">
                  {processo.codigo || "—"}
                </span>
              </div>
              <div className="whitespace-nowrap">
                <span className="uppercase tracking-wide text-slate-500">
                  Versão:{" "}
                </span>
                <span className="font-bold text-slate-700">
                  {processo.versao || "1"}
                </span>
              </div>
              <div className="whitespace-nowrap">
                <span className="uppercase tracking-wide text-slate-500">
                  Data da proposta:{" "}
                </span>
                <span className="font-bold text-slate-700">
                  {new Date(processo.updated_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>
          </div>

          {/* Footer fixo — ações */}
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
              {podeEditar && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onEdit(processo)}
                  disabled={!!busy}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              {/* Validação direta no preview — mesma condição do botão "Validar" da edição. */}
              {validacao && (
                <Button
                  type="button"
                  onClick={handleValidarPreview}
                  disabled={!!busy}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {busy === "Validação" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Validar
                </Button>
              )}
              {podeEnviar && !validacao && (
                <Button
                  type="button"
                  onClick={handleEnviar}
                  disabled={!!busy}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {busy === "Envio para validação" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar para Validação
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
              {podeValidarAutor && !validacao && (
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
              {podeValidarDiretoria && !validacao && (
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
              {podeValidarFinal && !validacao && (
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
        </DialogContent>
      </Dialog>

      {/* Diálogo de recusa */}
      <Dialog open={recusaOpen} onOpenChange={setRecusaOpen}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Recusar Processo
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Informe o motivo da recusa. O autor poderá editar e re-enviar.
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Camada
              </Label>
              <div className="mt-1 flex gap-2">
                {(["autor", "diretoria", "final"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRecusaCamada(c)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${recusaCamada === c
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                  >
                    {c === "autor"
                      ? "Autor"
                      : c === "diretoria"
                        ? "Diretoria"
                        : "Final"}
                  </button>
                ))}
              </div>
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
