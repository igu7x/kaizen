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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  processosNegocioApi,
  ProcessoNegocio,
  VersaoHistorico,
  STATUS_LABEL,
  STATUS_COLOR,
  TIPO_DOCUMENTO_LABEL,
  TIPO_DOCUMENTO_BADGE,
  normalizeResponsavel,
  REVISAO_POLITICA_TEXTO,
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
              Processo de Negócio da Área {processo.diretoria || "—"}
            </p>
          </div>
          <CabecalhoRow
            label="Macroprocesso:"
            value={processo.macroprocesso || "—"}
          />
          <CabecalhoRow
            label="Área Responsável"
            value={processo.diretoria || "—"}
            label2="Período"
            value2={formatDataCompleta(processo.periodo)}
          />
          <CabecalhoRow
            label="Revisão:"
            value={processo.revisao || "—"}
            label2="Código/Versão"
            value2={processo.codigo_versao || "—"}
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

  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isAuthor =
    user?.id != null && Number(user.id) === Number(processo.created_by);
  const isSuperadmin = (user as any)?.is_superadmin === true;

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

  const handleEnviar = () =>
    handleAcao("Envio para validação", () =>
      processosNegocioApi.enviar(processo.id),
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
  const podeEditar =
    isAdminOrManager &&
    (processo.status === "em_elaboracao" ||
      processo.status === "recusado" ||
      processo.status === "validado_final");
  const podeEnviar =
    isAuthor &&
    (processo.status === "em_elaboracao" || processo.status === "recusado");
  // Regras de validação por camada:
  // - Camada 1 (Autor): quem preencheu o formulário valida
  // - Camada 2 (Diretoria): diretor da diretoria cadastrada no processo valida
  // - Camada 3 (Final): superadmin valida
  const podeValidarAutor = isAuthor && processo.status === "enviado";
  const podeValidarDiretoria =
    isDiretorDaArea && processo.status === "validado_autor";
  const podeValidarFinal =
    isSuperadmin && processo.status === "validado_diretoria";

  // Recusar: quem pode validar a camada atual também pode recusar
  const podeRecusar =
    (processo.status === "enviado" && isAuthor) ||
    (processo.status === "validado_autor" && isDiretorDaArea) ||
    (processo.status === "validado_diretoria" && isSuperadmin);

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
                      return n.area ? `${n.cargo} — ${n.area}` : n.cargo;
                    }),
                  },
                  { title: "Atores:", items: processo.atores || [] },
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
              {processo.fluxograma_data ? (
                processo.fluxograma_mime?.startsWith("image/") ? (
                  <img
                    src={processo.fluxograma_data}
                    alt={processo.fluxograma_filename || "Fluxograma"}
                    className="w-full max-h-[700px] object-contain rounded bg-white border border-slate-200"
                  />
                ) : processo.fluxograma_mime === "application/pdf" ? (
                  <iframe
                    src={processo.fluxograma_data}
                    title={processo.fluxograma_filename || "Fluxograma"}
                    className="w-full h-[700px] rounded bg-white border border-slate-200"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <FileImage className="h-4 w-4" />
                    Pré-visualização indisponível (
                    {processo.fluxograma_filename})
                  </div>
                )
              ) : (
                <p className="text-xs italic text-slate-400">
                  Nenhum fluxograma anexado.
                </p>
              )}
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
                            <a
                              href={doc.data}
                              download={doc.nome}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                              title="Baixar"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Baixar
                            </a>
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

            {/* Rodapé institucional — todos os campos são dinâmicos:
                - Elaborado por: nome completo da diretoria do processo (lookup por sigla)
                - Versão: campo `versao` do processo (inicia em 1.0, incrementa 0.1 a cada
                  reenvio pós-recusa)
                - Data da atualização: timestamp de updated_at do processo */}
            <div className="grid grid-cols-3 gap-4 px-4 pt-4 mt-2 text-center text-xs text-slate-600">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  Modelo:
                </div>
                <div className="mt-1 font-bold text-slate-700 leading-tight">
                  {/* ID do documento (modelo) — ainda sem definição */}—
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  Versão:
                </div>
                <div className="mt-1 font-bold text-slate-700">
                  {processo.versao || "1.0"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  Data da proposta:
                </div>
                <div className="mt-1 font-bold text-slate-700">
                  {new Date(processo.updated_at).toLocaleDateString("pt-BR")}
                </div>
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
              {podeEnviar && (
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
                  Validar (Autor)
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
                  Validar (Diretoria)
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
                  Validação Final
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
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      recusaCamada === c
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
    </>
  );
}
