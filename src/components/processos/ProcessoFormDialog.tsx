import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextarea } from "@/components/ui/rich-textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X as XIcon,
  Loader2,
  FileText,
  Users,
  Info,
  Settings,
  Calendar,
  Workflow,
  Paperclip,
  BarChart3,
  Save,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  processosNegocioApi,
  ProcessoNegocio,
  CreateProcessoNegocioDto,
  REVISAO_POLITICA_TEXTO,
  getFluxograma,
  COMITES_APROVACAO,
  exigeComiteAprovacao,
  camposObrigatoriosFaltantes,
  temDocumentoPrimario,
  validarComiteParaEnvio,
} from "@/services/processosNegocioApi";
import { areasApi, Area } from "@/services/areasApi";
import { ListInput } from "./ListInput";
import { ResponsavelInput } from "./ResponsavelInput";
import { UnidadeMultiPicker } from "./UnidadeMultiPicker";
import { DocumentosAnexadosInput } from "./DocumentosAnexadosInput";
import { ProcessoAcoesFooter } from "./ProcessoAcoesFooter";
import { ProcessoAprovacaoK1 } from "./ProcessoAprovacaoK1";

interface ProcessoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando passado, abre em modo edição. Caso contrário, abre em modo criação. */
  processo?: ProcessoNegocio | null;
  /** Diretoria padrão pra novos processos (do usuário logado) */
  diretoriaPadrao?: string;
  /** "visualizar" abre o form travado (somente leitura) com um botão "Editar" que destrava. */
  modoInicial?: "editar" | "visualizar";
  /** Callback após salvar com sucesso */
  onSaved: (processo: ProcessoNegocio) => void;
  /**
   * Callback das ações do rodapé de leitura (validar/enviar/recusar/editores/excluir).
   * `next` = processo atualizado; `null` = deletado. Só é usado em modo visualizar.
   */
  onProcessoChanged?: (next: ProcessoNegocio | null) => void;
  /**
   * Validação disponível para o usuário na camada atual do processo. Quando presente, o form
   * mostra o botão "Validar" (salva e valida a camada do usuário — Responsável/Revisor/Compliance).
   * Ausente = usuário não pode validar (ex.: Editor) → sem botão de validar.
   */
  validacao?: { exec: (id: number) => Promise<ProcessoNegocio> } | null;
}

/** Rótulo amigável da camada que recusou (usado no banner de recusa). */
const CAMADA_LABEL: Record<string, string> = {
  autor: "Responsável",
  diretoria: "Revisor",
  final: "Compliance Officer",
};

const emptyForm: CreateProcessoNegocioDto = {
  macroprocesso: "",
  diretoria: "",
  periodo: "",
  revisao: "000",
  codigo_versao: "",
  nome_processo: "",
  descricao: "",
  detalhamento: "",
  indicadores: "",
  proprietarios: [],
  atores: [],
  areas_responsaveis: [],
  entradas: [],
  saidas: [],
  sistemas_ferramentas: [],
  normativos_referencias: [],
  fluxograma_data: null,
  fluxograma_filename: null,
  fluxograma_mime: null,
  documentos_anexados: [],
  apreciacao: [],
  periodicidade_revisao: "",
  numero_proad: "",
  observacoes_gerais: "",
  versao: "001",
};

/** Numeração de Versão/Revisão em 3 dígitos (000, 001, 002…) — padrão de controle de documentos. */
function pad3(v: string | number | null | undefined): string {
  const n = parseInt(String(v ?? "").split(".")[0], 10);
  return String(Number.isFinite(n) ? n : 0).padStart(3, "0");
}

/**
 * Campos de conteúdo do documento considerados no "Resumo de alterações" de uma revisão.
 * A comparação (form atual x processo persistido) define se a revisão teve alteração de conteúdo
 * — o que, pela política de controle de documentos, também incrementa a Versão.
 */
const CAMPOS_CONTEUDO: Array<{ key: string; label: string }> = [
  { key: "nome_processo", label: "Nome do Processo" },
  { key: "macroprocesso", label: "Macroprocesso" },
  { key: "descricao", label: "Descrição do Processo" },
  { key: "detalhamento", label: "Estrutura / Detalhamento do Processo" },
  { key: "indicadores", label: "Indicadores" },
  { key: "proprietarios", label: "Proprietários" },
  { key: "atores", label: "Atores" },
  { key: "areas_responsaveis", label: "Áreas Responsáveis" },
  { key: "entradas", label: "Entradas" },
  { key: "saidas", label: "Saídas" },
  { key: "sistemas_ferramentas", label: "Sistemas e Ferramentas" },
  { key: "normativos_referencias", label: "Normativos e Referências" },
  { key: "apreciacao", label: "Apreciação" },
  { key: "numero_proad", label: "Número PROAD" },
  { key: "observacoes_gerais", label: "Observações Gerais" },
  // Anexos (documentos_anexados) NÃO entram: alterar anexos não gera nova versão. A única
  // exceção — o Fluxograma — é comparada à parte em camposAlterados (via getFluxograma).
];

/** Normaliza um valor de campo para comparação estável (string trim; arrays/objetos via JSON). */
function normConteudo(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return JSON.stringify(v);
}

/** Lista os rótulos dos campos de conteúdo que diferem entre o form atual e o processo salvo. */
function camposAlterados(
  form: CreateProcessoNegocioDto,
  processo: ProcessoNegocio | null | undefined,
): string[] {
  if (!processo) return [];
  const f = form as unknown as Record<string, unknown>;
  const p = processo as unknown as Record<string, unknown>;
  const mudados = CAMPOS_CONTEUDO.filter(
    (c) => normConteudo(f[c.key]) !== normConteudo(p[c.key]),
  ).map((c) => c.label);
  // Fluxograma é o único anexo versionável — pode estar nos campos legados ou como doc
  // tipo FLUXOGRAMA. Compara o conteúdo resolvido dos dois lados.
  if (getFluxograma(form).data !== getFluxograma(processo).data) {
    mudados.push("Fluxograma");
  }
  return mudados;
}

/**
 * Calcula a próxima revisão a partir do período do processo (Período + 1 ano).
 * Retorna formato brasileiro DD/MM/AAAA. Se o período não estiver definido, retorna '—'.
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

// Bloco de seção com ícone e título — padrão visual do template
function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          {icon}
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          {title}
        </h3>
      </div>
      <div className="pl-1">{children}</div>
    </section>
  );
}

export function ProcessoFormDialog({
  open,
  onOpenChange,
  processo,
  diretoriaPadrao,
  modoInicial = "editar",
  onSaved,
  onProcessoChanged,
  validacao = null,
}: ProcessoFormDialogProps) {
  const isEdit = !!processo;
  const [form, setForm] = useState<CreateProcessoNegocioDto>(emptyForm);
  const [saving, setSaving] = useState(false);
  // "Resumo de alterações" — modal de confirmação exibido ao finalizar uma REVISÃO (processo já
  // homologado, com código K1). Preenchido enquanto o modal está aberto; null quando fechado.
  const [resumo, setResumo] = useState<{
    alterados: string[];
    revDe: string;
    revPara: string;
    verDe: string;
    verPara: string;
  } | null>(null);
  // Modo do form: quando "visualizar", começa travado (somente leitura) até clicar em "Editar".
  const [editando, setEditando] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);
  // Id do processo sendo editado. Em "Salvar Alterações" num processo novo,
  // passamos a editar o mesmo registro (evita recriar a cada clique).
  const [currentId, setCurrentId] = useState<number | null>(
    processo?.id ?? null,
  );

  // Carregar áreas do domínio do usuário ao abrir (pra select de Diretoria)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    areasApi
      .getAll()
      .then((data) => {
        if (!cancelled) setAreas(data);
      })
      .catch((err) =>
        console.warn("[ProcessoFormDialog] erro ao carregar áreas:", err),
      );
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Carregar valores ao abrir (modo edição) ou resetar (criação).
  // Depende de `processo?.id` (NÃO do objeto): ao clicar num processo o pai abre o form já
  // e busca o objeto completo (getById) por baixo, trocando a referência do MESMO processo.
  // Se reinicializássemos aqui a cada troca de referência, o fetch completando no meio da
  // edição APAGAVA o que o usuário digitou (bug: "Responsável nunca salva"). O conteúdo pesado
  // (fluxograma/documentos), que só vem no objeto completo, é sincronizado no efeito seguinte.
  useEffect(() => {
    if (!open) return;
    setEditando(modoInicial !== "visualizar");
    setCurrentId(processo?.id ?? null);
    if (processo) {
      setForm({
        macroprocesso: processo.macroprocesso || "",
        diretoria: processo.diretoria || "",
        periodo: processo.periodo || "",
        revisao: pad3(processo.revisao ?? "0"),
        codigo_versao: processo.codigo_versao || "",
        nome_processo: processo.nome_processo || "",
        descricao: processo.descricao || "",
        detalhamento: processo.detalhamento || "",
        indicadores: processo.indicadores || "",
        proprietarios: processo.proprietarios || [],
        atores: processo.atores || [],
        areas_responsaveis: processo.areas_responsaveis || [],
        entradas: processo.entradas || [],
        saidas: processo.saidas || [],
        sistemas_ferramentas: processo.sistemas_ferramentas || [],
        normativos_referencias: processo.normativos_referencias || [],
        fluxograma_data: processo.fluxograma_data || null,
        fluxograma_filename: processo.fluxograma_filename || null,
        fluxograma_mime: processo.fluxograma_mime || null,
        documentos_anexados: processo.documentos_anexados || [],
        apreciacao: exigeComiteAprovacao(processo.diretoria) ? ["CGTIC"] : [],
        periodicidade_revisao: processo.periodicidade_revisao || "",
        numero_proad: processo.numero_proad || "",
        observacoes_gerais: processo.observacoes_gerais || "",
        versao: pad3(processo.versao ?? "1"),
      });
    } else {
      setForm({
        ...emptyForm,
        diretoria: diretoriaPadrao || "",
        apreciacao: exigeComiteAprovacao(diretoriaPadrao) ? ["CGTIC"] : [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, processo?.id, diretoriaPadrao, modoInicial]);

  // Quando o objeto completo (getById) chega — para o MESMO processo já aberto —, sincroniza
  // só o conteúdo pesado (fluxograma/documentos), que não vem no payload enxuto da listagem.
  // Roda apenas em modo leitura para NUNCA sobrescrever uma edição em curso do usuário.
  useEffect(() => {
    if (!open || editando || !processo) return;
    setForm((prev) => ({
      ...prev,
      fluxograma_data: processo.fluxograma_data ?? null,
      fluxograma_filename: processo.fluxograma_filename ?? null,
      fluxograma_mime: processo.fluxograma_mime ?? null,
      documentos_anexados: processo.documentos_anexados || [],
    }));
  }, [processo, open, editando]);

  const update = <K extends keyof CreateProcessoNegocioDto>(
    field: K,
    value: CreateProcessoNegocioDto[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    if (!form.nome_processo?.trim()) return "O nome do processo é obrigatório.";
    if (!form.macroprocesso?.trim()) return "O macroprocesso é obrigatório.";
    if (!form.diretoria?.trim()) return "A diretoria é obrigatória.";
    if (temDocumentoPrimario(form) && !String(form.versao ?? "").trim())
      return "Com documento primário anexado, informe a versão do processo.";
    return null;
  };

  const handleSave = async (validarApos: boolean, pularResumo = false) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (validarApos) {
      const faltam = camposObrigatoriosFaltantes(form);
      if (faltam.length > 0) {
        toast.error(
          `Para validar, preencha os campos: ${faltam.join(", ")}.`,
        );
        return;
      }
      const erroComite = validarComiteParaEnvio(form);
      if (erroComite) {
        toast.error(erroComite);
        return;
      }
    }
    // Ao FINALIZAR uma revisão (processo já homologado, com código K1), mostra o "Resumo de
    // alterações" com a numeração resultante antes de enviar para validação. A confirmação
    // reentra em handleSave(true, true), pulando este gate.
    const ehRevisao = !!processo?.codigo;
    if (validarApos && ehRevisao && !pularResumo) {
      const alterados = camposAlterados(form, processo);
      const revNum = parseInt(String(processo?.revisao ?? "0").split(".")[0], 10);
      const verNum = parseInt(String(processo?.versao ?? "1").split(".")[0], 10);
      const revBase = Number.isFinite(revNum) ? revNum : 0;
      const verBase = Number.isFinite(verNum) ? verNum : 1;
      setResumo({
        alterados,
        revDe: pad3(revBase),
        revPara: pad3(revBase + 1),
        verDe: pad3(verBase),
        verPara: alterados.length > 0 ? pad3(verBase + 1) : pad3(verBase),
      });
      return;
    }
    setSaving(true);
    try {
      // Versão e Revisão são numéricas e informáveis manualmente; em branco caem no padrão
      // (Versão 1, Revisão 0). O backend ainda incrementa Versão/Revisão no ciclo de homologação.
      const payload: CreateProcessoNegocioDto = {
        ...form,
        versao: pad3(form.versao || "1"),
        revisao: pad3(form.revisao || "0"),
      };
      let saved: ProcessoNegocio;
      if (currentId != null) {
        saved = await processosNegocioApi.update(currentId, payload);
      } else {
        saved = await processosNegocioApi.create(payload);
        setCurrentId(saved.id);
      }
      if (validarApos && validacao) {
        // Salva e valida a camada do usuário (Responsável/Revisor/Compliance) — sem reiniciar
        // as camadas já validadas.
        saved = await validacao.exec(saved.id);
        onSaved(saved);
        onOpenChange(false);
      } else {
        // "Salvar Alterações": persiste e FECHA a tela (o backend reseta as camadas de
        // validação e ajusta a versão ao editar; a lista reflete o novo estado via onSaved).
        toast.success("Alterações salvas.");
        onSaved(saved);
        onOpenChange(false);
      }
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  const resumoComAlteracao = !!resumo && resumo.alterados.length > 0;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden border-0 bg-white p-0 sm:rounded-2xl max-h-[92vh] flex flex-col">
        {/* Header fixo */}
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">
              {!editando
                ? "Visualizar Processo"
                : isEdit
                  ? "Editar Processo"
                  : "Novo Processo"}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Cadastro de processo de negócio — siga o template institucional.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-white/70 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo rolável: o <div> é o container de scroll (fieldset não rola bem em flex). O
            <fieldset disabled> DENTRO apenas trava todos os inputs/selects/botões de uma vez. */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50">
          {/* Motivo da recusa — aparece para a 1ª camada (Responsável) saber o que o superior
              pediu para alterar, antes de corrigir e reenviar. Vale na 1ª criação e nas revisões. */}
          {processo?.status === "recusado" && processo.recusa_motivo && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                Processo recusado
                {processo.recusado_por_nome
                  ? ` por ${processo.recusado_por_nome}`
                  : ""}
                {processo.recusado_camada
                  ? ` — camada ${CAMADA_LABEL[processo.recusado_camada] ?? processo.recusado_camada}`
                  : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-red-900">
                {processo.recusa_motivo}
              </p>
            </div>
          )}
          <fieldset
            disabled={!editando}
            className="m-0 min-w-0 border-0 p-0 space-y-6"
          >
          {/* Identificação */}
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="Identificação"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label
                  htmlFor="nome_processo"
                  className="text-xs font-semibold text-slate-700"
                >
                  Nome do Processo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nome_processo"
                  value={form.nome_processo}
                  onChange={(e) => update("nome_processo", e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <Label
                  htmlFor="macroprocesso"
                  className="text-xs font-semibold text-slate-700"
                >
                  Macroprocesso <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="macroprocesso"
                  value={form.macroprocesso}
                  onChange={(e) => update("macroprocesso", e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <Label
                  htmlFor="diretoria"
                  className="text-xs font-semibold text-slate-700"
                >
                  Área Responsável <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.diretoria || undefined}
                  onValueChange={(v) => {
                    update("diretoria", v);
                    update("apreciacao", exigeComiteAprovacao(v) ? ["CGTIC"] : []);
                  }}
                >
                  <SelectTrigger id="diretoria" className="mt-1 bg-white">
                    <SelectValue placeholder="Selecione a área responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.length === 0 ? (
                      <SelectItem value="_loading" disabled>
                        Carregando…
                      </SelectItem>
                    ) : (
                      areas
                        .filter((a) => a.sigla && a.sigla.trim())
                        .map((a) => (
                          <SelectItem key={a.id} value={a.sigla!}>
                            {a.sigla} — {a.nome}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label
                  htmlFor="revisao"
                  className="text-xs font-semibold text-slate-700"
                >
                  Revisão
                </Label>
                <Input
                  id="revisao"
                  type="text"
                  inputMode="numeric"
                  value={form.revisao ?? ""}
                  onChange={(e) =>
                    update("revisao", e.target.value.replace(/\D/g, ""))
                  }
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    update("revisao", pad3(e.target.value))
                  }
                  placeholder="0"
                  className="mt-1 bg-white"
                />
                <p className="text-xs text-slate-500 mt-1">Em branco = 0.</p>
              </div>
              <div>
                <Label
                  htmlFor="versao"
                  className="text-xs font-semibold text-slate-700"
                >
                  Versão{" "}
                  {temDocumentoPrimario(form) && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  id="versao"
                  type="text"
                  inputMode="numeric"
                  value={form.versao ?? ""}
                  onChange={(e) =>
                    update("versao", e.target.value.replace(/\D/g, ""))
                  }
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    update("versao", pad3(e.target.value))
                  }
                  placeholder="Ex.: 001"
                  className="mt-1 bg-white"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Número da versão. Atualiza sozinho (+1) quando um campo é
                  alterado numa revisão.
                </p>
              </div>
              <div>
                <Label
                  htmlFor="periodo"
                  className="text-xs font-semibold text-slate-700"
                >
                  Data da Versão
                </Label>
                <Input
                  id="periodo"
                  type="date"
                  value={form.periodo || ""}
                  onChange={(e) => update("periodo", e.target.value)}
                  className="mt-1 bg-white"
                />
                <p className="text-xs text-slate-500 mt-1">
                  No PDF será exibido apenas o mês e o ano.
                </p>
              </div>
            </div>
          </Section>

          {/* Descrição */}
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="Descrição do Processo"
          >
            <RichTextarea
              value={form.descricao || ""}
              onChange={(v) => update("descricao", v)}
              placeholder="Descreva brevemente o objetivo deste processo..."
              disabled={!editando}
              minHeight={104}
              className="bg-white"
            />
          </Section>

          {/* Governança e Responsáveis */}
          <Section
            icon={<Users className="h-4 w-4" />}
            title="Governança e Responsáveis"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Responsável
                </Label>
                <div className="mt-1.5">
                  <ResponsavelInput
                    value={form.proprietarios || []}
                    onChange={(next) => update("proprietarios", next)}
                    emptyMessage="Nenhum responsável"
                    somenteLeitura={!editando}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Áreas Envolvidas
                </Label>
                <div className="mt-1.5">
                  <UnidadeMultiPicker
                    value={form.areas_responsaveis || []}
                    onChange={(next) => update("areas_responsaveis", next)}
                    placeholder="Digite para buscar..."
                    emptyMessage="Nenhuma área"
                    somenteLeitura={!editando}
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Informações Utilizadas */}
          <Section
            icon={<Info className="h-4 w-4" />}
            title="Informações Utilizadas"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Entrada
                </Label>
                <div className="mt-1.5">
                  <ListInput
                    value={form.entradas || []}
                    onChange={(next) => update("entradas", next)}
                    placeholder="Adicionar entrada (ex.: Proad 516136/2024)"
                    emptyMessage="Nenhuma entrada"
                    somenteLeitura={!editando}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Saída
                </Label>
                <div className="mt-1.5">
                  <ListInput
                    value={form.saidas || []}
                    onChange={(next) => update("saidas", next)}
                    placeholder="Adicionar saída"
                    emptyMessage="Nenhuma saída"
                    somenteLeitura={!editando}
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Detalhamento */}
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="Estrutura do Processo"
          >
            <RichTextarea
              value={form.detalhamento || ""}
              onChange={(v) => update("detalhamento", v)}
              placeholder="Descreva a estrutura do processo de forma macro, apresentando suas etapas e seu fluxo de execução do início ao fim."
              disabled={!editando}
              minHeight={240}
              className="bg-white"
            />
            <p className="text-xs text-slate-500 mt-1">
              Use quebras de linha pra separar parágrafos e numerar etapas (1.,
              2., 3....).
            </p>
          </Section>

          {/* Recursos Utilizados */}
          <Section
            icon={<Settings className="h-4 w-4" />}
            title="Recursos Utilizados"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Sistemas / Ferramentas
                </Label>
                <div className="mt-1.5">
                  <ListInput
                    value={form.sistemas_ferramentas || []}
                    onChange={(next) => update("sistemas_ferramentas", next)}
                    placeholder="Ex.: Bizagi 3.7.0"
                    emptyMessage="Nenhum item"
                    somenteLeitura={!editando}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Normativo / Referências
                </Label>
                <div className="mt-1.5">
                  <ListInput
                    value={form.normativos_referencias || []}
                    onChange={(next) => update("normativos_referencias", next)}
                    placeholder="Ex.: Resoluções do CNJ"
                    emptyMessage="Nenhum item"
                    somenteLeitura={!editando}
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Indicadores */}
          <Section icon={<BarChart3 className="h-4 w-4" />} title="Indicadores">
            <RichTextarea
              value={form.indicadores || ""}
              onChange={(v) => update("indicadores", v)}
              placeholder="Informe os indicadores utilizados para acompanhar o desempenho e os resultados do processo."
              disabled={!editando}
              minHeight={104}
              className="bg-white"
            />
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold">Exemplos:</span> volume de
              demandas, tempo de execução, produtividade, qualidade ou
              resultados alcançados.
            </p>
          </Section>

          {/* Modelagem / Fluxograma */}
          <Section
            icon={<Workflow className="h-4 w-4" />}
            title="Modelagem / Fluxograma"
          >
            {(() => {
              const flux = getFluxograma(form);
              if (!flux.data) {
                return (
                  <p className="text-xs italic text-slate-400">
                    Anexe o fluxograma na seção "Documentos Anexados" (tipo
                    "Fluxograma") para exibi-lo aqui.
                  </p>
                );
              }
              if (flux.mime?.startsWith("image/")) {
                return (
                  <img
                    src={flux.data}
                    alt={flux.filename || "Fluxograma"}
                    className="w-full max-h-[600px] object-contain rounded-md border border-slate-200 bg-white"
                  />
                );
              }
              if (flux.mime === "application/pdf") {
                return (
                  <iframe
                    src={flux.data}
                    title={flux.filename || "Fluxograma"}
                    className="w-full h-[600px] rounded-md border border-slate-200 bg-white"
                  />
                );
              }
              return (
                <p className="text-xs italic text-slate-400">
                  Pré-visualização indisponível ({flux.filename}).
                </p>
              );
            })()}
          </Section>

          {/* Anexar Documentos */}
          <Section
            icon={<Paperclip className="h-4 w-4" />}
            title="Anexar Documentos"
          >
            <DocumentosAnexadosInput
              value={form.documentos_anexados || []}
              onChange={(next) => update("documentos_anexados", next)}
              somenteLeitura={!editando}
              processoId={currentId ?? processo?.id ?? undefined}
            />
          </Section>

          {/* Revisão — política (Periodicidade) + próxima revisão calculada (Período + 1 ano) */}
          <Section icon={<Calendar className="h-4 w-4" />} title="Revisão">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 md:border-b-0 md:border-r">
                  Periodicidade
                </div>
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 md:border-t-0">
                  Próxima Revisão
                </div>
                <div className="px-4 py-3 text-sm text-slate-700 md:border-r md:border-slate-200">
                  {REVISAO_POLITICA_TEXTO}
                </div>
                <div className="flex items-center gap-2 px-4 py-3 text-sm">
                  <Calendar className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  {form.periodo ? (
                    <span className="font-semibold text-slate-900">
                      {addOneYearToDate(form.periodo)}
                    </span>
                  ) : (
                    <span className="italic text-slate-400">
                      Defina a "Data da Versão" na Identificação
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* Formalização */}
          <Section icon={<FileText className="h-4 w-4" />} title="Formalização">
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="numero_proad"
                  className="text-xs font-semibold text-slate-700"
                >
                  Nº do Proad
                </Label>
                <Input
                  id="numero_proad"
                  value={form.numero_proad || ""}
                  onChange={(e) => update("numero_proad", e.target.value)}
                  placeholder="Número do Proad"
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <Label
                  htmlFor="observacoes_gerais"
                  className="text-xs font-semibold text-slate-700"
                >
                  Observações Gerais
                </Label>
                <RichTextarea
                  id="observacoes_gerais"
                  value={form.observacoes_gerais || ""}
                  onChange={(v) => update("observacoes_gerais", v)}
                  placeholder="Observações adicionais sobre o processo"
                  disabled={!editando}
                  minHeight={80}
                  className="mt-1 bg-white"
                />
              </div>
            </div>
          </Section>

          </fieldset>

          {/* Apreciação + Aprovação (Modelo K1) — FORA do <fieldset disabled> para que o anexo do
              PDF de aprovação (ação de superadmin) funcione também em modo leitura/preview. */}
          <div className="mt-6">
            <Section
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Apreciação em Instâncias Colegiadas"
            >
              {exigeComiteAprovacao(form.diretoria) ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm text-slate-700">
                    Processos da diretoria <strong>{form.diretoria}</strong>{" "}
                    passam obrigatoriamente por apreciação do comitê abaixo (regra
                    automática).
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    CGTIC — {COMITES_APROVACAO.CGTIC}
                    <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-blue-700">
                      obrigatório
                    </span>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  A área responsável
                  {form.diretoria ? ` (${form.diretoria})` : ""} não requer
                  aprovação de comitê.
                </p>
              )}
              {/* Espaço de anexar o PDF de aprovação do comitê (torna Modelo K1) — sobre o
                  processo persistido; superadmin anexa/remove. Só quando o processo já existe. */}
              {processo && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <ProcessoAprovacaoK1
                    processo={processo}
                    onChanged={(next) => onProcessoChanged?.(next)}
                  />
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* Footer fixo */}
        {editando ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
            {validacao && (
              <Button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Validar
              </Button>
            )}
          </div>
        ) : processo ? (
          // Modo leitura: barra de ações completa gated por permissão (mesma do ProcessoDetalhe).
          // Opera sobre o processo PERSISTIDO recebido por prop, não sobre o estado do form.
          <ProcessoAcoesFooter
            processo={processo}
            onChanged={(next) => onProcessoChanged?.(next)}
            onEditar={() => setEditando(true)}
            onFechar={() => onOpenChange(false)}
            validacao={validacao}
          />
        ) : null}
      </DialogContent>
    </Dialog>

    {/* "Resumo de alterações" — confirmação exibida ao finalizar uma revisão, antes de enviar
        para o fluxo de validação. Mostra os campos alterados e a numeração resultante. */}
    <Dialog open={!!resumo} onOpenChange={(o) => !o && setResumo(null)}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-0 bg-white p-0 sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
          {resumoComAlteracao ? (
            <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-500 flex-shrink-0" />
          )}
          <h2 className="text-lg font-bold text-slate-800">
            Resumo de alterações
          </h2>
        </div>

        {resumo && (
          <div className="px-6 py-5 space-y-4">
            {resumoComAlteracao ? (
              <>
                <p className="text-sm text-slate-600">
                  Foram identificadas alterações de conteúdo nesta revisão. Por
                  isso, o número da <strong>revisão</strong> e o da{" "}
                  <strong>versão</strong> serão atualizados automaticamente.
                </p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                    Campos alterados
                  </p>
                  <ul className="space-y-1">
                    {resumo.alterados.map((label) => (
                      <li
                        key={label}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Não foram identificadas alterações de conteúdo nesta revisão.
                Apenas o número da <strong>revisão</strong> será atualizado; a{" "}
                <strong>versão</strong> permanece a mesma.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Revisão
                </p>
                <p className="text-base font-bold tabular-nums text-slate-800">
                  {resumo.revDe} <span className="text-slate-400">→</span>{" "}
                  {resumo.revPara}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Versão
                </p>
                <p className="text-base font-bold tabular-nums text-slate-800">
                  {resumo.verDe} <span className="text-slate-400">→</span>{" "}
                  {resumo.verPara}
                </p>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-700">
              Deseja confirmar e enviar o processo para validação?
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setResumo(null)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              setResumo(null);
              handleSave(true, true);
            }}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Confirmar e enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
