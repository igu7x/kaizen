import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Send,
  FileText,
  Users,
  Info,
  Settings,
  Calendar,
  Workflow,
  Paperclip,
  BarChart3,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  processosNegocioApi,
  ProcessoNegocio,
  CreateProcessoNegocioDto,
  REVISAO_POLITICA_TEXTO,
} from "@/services/processosNegocioApi";
import { areasApi, Area } from "@/services/areasApi";
import { ListInput } from "./ListInput";
import { ResponsavelInput } from "./ResponsavelInput";
import { UnidadeMultiPicker } from "./UnidadeMultiPicker";
import { FluxogramaUpload } from "./FluxogramaUpload";
import { DocumentosAnexadosInput } from "./DocumentosAnexadosInput";

interface ProcessoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando passado, abre em modo edição. Caso contrário, abre em modo criação. */
  processo?: ProcessoNegocio | null;
  /** Diretoria padrão pra novos processos (do usuário logado) */
  diretoriaPadrao?: string;
  /** Callback após salvar com sucesso */
  onSaved: (processo: ProcessoNegocio) => void;
}

const emptyForm: CreateProcessoNegocioDto = {
  macroprocesso: "",
  diretoria: "",
  periodo: "",
  revisao: "",
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
  periodicidade_revisao: "",
  numero_proad: "",
  observacoes_gerais: "",
};

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
  onSaved,
}: ProcessoFormDialogProps) {
  const isEdit = !!processo;
  const [form, setForm] = useState<CreateProcessoNegocioDto>(emptyForm);
  const [saving, setSaving] = useState(false);
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

  // Carregar valores ao abrir (modo edição) ou resetar (criação)
  useEffect(() => {
    if (!open) return;
    setCurrentId(processo?.id ?? null);
    if (processo) {
      setForm({
        macroprocesso: processo.macroprocesso || "",
        diretoria: processo.diretoria || "",
        periodo: processo.periodo || "",
        revisao: processo.revisao || "",
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
        periodicidade_revisao: processo.periodicidade_revisao || "",
        numero_proad: processo.numero_proad || "",
        observacoes_gerais: processo.observacoes_gerais || "",
      });
    } else {
      setForm({ ...emptyForm, diretoria: diretoriaPadrao || "" });
    }
  }, [open, processo, diretoriaPadrao]);

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
    return null;
  };

  const handleSave = async (enviarApos: boolean) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      let saved: ProcessoNegocio;
      if (currentId != null) {
        saved = await processosNegocioApi.update(currentId, form);
      } else {
        saved = await processosNegocioApi.create(form);
        setCurrentId(saved.id);
      }
      if (enviarApos) {
        saved = await processosNegocioApi.enviar(saved.id);
        onSaved(saved);
        onOpenChange(false);
      } else {
        // "Salvar Alterações": mantém o formulário aberto e editável.
        toast.success("Alterações salvas.");
        onSaved(saved);
      }
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden border-0 bg-white p-0 sm:rounded-2xl max-h-[92vh] flex flex-col">
        {/* Header fixo */}
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isEdit ? "Editar Processo" : "Novo Processo"}
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

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-slate-50">
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
                  placeholder="Ex.: Gerenciamento de Riscos de Segurança da Informação"
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
                  placeholder="Ex.: Segurança da Informação"
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
                  onValueChange={(v) => update("diretoria", v)}
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
                  htmlFor="periodo"
                  className="text-xs font-semibold text-slate-700"
                >
                  Período
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="revisao"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Revisão
                  </Label>
                  <Input
                    id="revisao"
                    value={form.revisao || ""}
                    onChange={(e) => update("revisao", e.target.value)}
                    placeholder="Ex.: 007"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="codigo_versao"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Código/Versão
                  </Label>
                  <Input
                    id="codigo_versao"
                    value={form.codigo_versao || ""}
                    onChange={(e) => update("codigo_versao", e.target.value)}
                    placeholder="Ex.: NSI-005"
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Descrição */}
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="Descrição do Processo"
          >
            <Textarea
              value={form.descricao || ""}
              onChange={(e) => update("descricao", e.target.value)}
              placeholder="Descreva brevemente o objetivo deste processo..."
              rows={4}
              className="bg-white resize-none"
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
            <Textarea
              value={form.detalhamento || ""}
              onChange={(e) => update("detalhamento", e.target.value)}
              placeholder="Descreva a estrutura do processo de forma macro, apresentando suas etapas e seu fluxo de execução do início ao fim."
              rows={10}
              className="bg-white resize-y"
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
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Indicadores */}
          <Section icon={<BarChart3 className="h-4 w-4" />} title="Indicadores">
            <Textarea
              value={form.indicadores || ""}
              onChange={(e) => update("indicadores", e.target.value)}
              placeholder="Informe os indicadores utilizados para acompanhar o desempenho e os resultados do processo."
              rows={4}
              className="bg-white resize-y"
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
            <FluxogramaUpload
              data={form.fluxograma_data || null}
              filename={form.fluxograma_filename || null}
              mime={form.fluxograma_mime || null}
              onChange={({ data, filename, mime }) => {
                setForm((prev) => ({
                  ...prev,
                  fluxograma_data: data,
                  fluxograma_filename: filename,
                  fluxograma_mime: mime,
                }));
              }}
            />
          </Section>

          {/* Anexar Documentos */}
          <Section
            icon={<Paperclip className="h-4 w-4" />}
            title="Anexar Documentos"
          >
            <DocumentosAnexadosInput
              value={form.documentos_anexados || []}
              onChange={(next) => update("documentos_anexados", next)}
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
                      Defina o "Período" na Identificação
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
                <Textarea
                  id="observacoes_gerais"
                  value={form.observacoes_gerais || ""}
                  onChange={(e) => update("observacoes_gerais", e.target.value)}
                  placeholder="Observações adicionais sobre o processo"
                  rows={3}
                  className="mt-1 bg-white resize-y"
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Footer fixo */}
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
          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar para Validação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
