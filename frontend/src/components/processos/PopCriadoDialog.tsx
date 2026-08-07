import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText, ListChecks, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  popsCriadosApi,
  PopCriado,
  PopCriadoInput,
} from "@/services/popsCriadosApi";
import { areasApi, Area } from "@/services/areasApi";
import {
  processosNegocioApi,
  ProcessoNegocio,
} from "@/services/processosNegocioApi";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pop?: PopCriado | null;
  onSaved: () => void;
  areaPadrao?: string;
}

const VAZIO: PopCriadoInput = {
  codigo: "",
  nome_processo: "",
  macroprocesso: "",
  diretoria_orgao: "",
  unidade_orgao: "",
  area: "",
  data_versao: "",
  revisao: "000",
  servico: "",
  objetivo: "",
  unidade_responsavel: "",
  siglas: "",
  normativa: "",
  descricao_procedimento: "",
  gestor_processo: "",
  sistemas_utilizados: "",
  anexos: "",
  fluxograma_nome: "",
  fluxograma_data: "",
  proposto_por: "",
  analisado_por: "",
  aprovado_por: "",
};

export function PopCriadoDialog({
  open,
  onOpenChange,
  pop,
  onSaved,
  areaPadrao,
}: Props) {
  const editId = pop?.id ?? null;
  const [form, setForm] = useState<PopCriadoInput>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  // Opções puxadas do que já existe no sistema.
  const [areas, setAreas] = useState<Area[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [macroprocessos, setMacroprocessos] = useState<string[]>([]);
  const [processos, setProcessos] = useState<ProcessoNegocio[]>([]);

  useEffect(() => {
    if (!open) return;
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      );
    areasApi
      .getAll()
      .then(setAreas)
      .catch(() => setAreas([]));
    areasApi
      .getAllUnidades()
      .then((us) => setUnidades(uniq(us.map((u) => u.nome))))
      .catch(() => setUnidades([]));
    processosNegocioApi
      .getAll()
      .then((ps) => {
        setProcessos(ps);
        setMacroprocessos(uniq(ps.map((p) => p.macroprocesso)));
      })
      .catch(() => {
        setProcessos([]);
        setMacroprocessos([]);
      });
  }, [open]);

  const siglasAreas = areas.map((a) => a.sigla).filter(Boolean) as string[];
  const nomesAreas = areas.map((a) => a.nome).filter(Boolean) as string[];

  useEffect(() => {
    if (!open) return;
    if (pop) {
      const { id, created_at, updated_at, ...rest } = pop;
      void id;
      void created_at;
      void updated_at;
      setForm({ ...VAZIO, ...rest });
    } else {
      setForm({ ...VAZIO, area: areaPadrao || "" });
    }
  }, [open, pop, areaPadrao]);

  const set = (campo: keyof PopCriadoInput, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  /**
   * Seleção do processo cadastrado: preenche automaticamente macroprocesso, área e diretoria
   * a partir do cadastro do processo. Os campos seguem editáveis — o usuário pode ajustar.
   */
  const selecionarProcesso = (p: ProcessoNegocio) => {
    const areaCad = areas.find((a) => a.sigla === p.diretoria);
    const unidade = p.proprietarios?.find((r) => r.area?.trim())?.area || "";
    setForm((f) => ({
      ...f,
      nome_processo: p.nome_processo,
      macroprocesso: p.macroprocesso || f.macroprocesso,
      area: p.diretoria || f.area,
      diretoria_orgao: areaCad?.nome || p.diretoria || f.diretoria_orgao,
      unidade_orgao: unidade || f.unidade_orgao,
    }));
  };

  /** Lê a imagem do fluxograma como data URL para embutir no PDF (mesma convenção do PAC). */
  const anexarFluxograma = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      toast.error("Envie uma imagem PNG ou JPG.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("A imagem do fluxograma deve ter até 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setForm((f) => ({
        ...f,
        fluxograma_nome: file.name,
        fluxograma_data: String(reader.result),
      }));
    reader.onerror = () => toast.error("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    if (!form.nome_processo?.trim()) {
      toast.error("Informe o nome do processo.");
      return;
    }
    setSalvando(true);
    try {
      if (editId) {
        await popsCriadosApi.update(editId, form);
        toast.success("POP atualizado com sucesso.");
      } else {
        await popsCriadosApi.create(form);
        toast.success("POP criado com sucesso.");
      }
      onOpenChange(false);
      onSaved();
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editId ? "Editar POP" : "Criar POP"} — Procedimento Operacional
            Padrão
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2 min-w-0">
          {/* Identificação / Cabeçalho */}
          <Secao icone={<FileText className="h-4 w-4" />} titulo="Identificação">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Código" hint="não editável — gerado pelo sistema">
                <CampoSomenteLeitura>
                  {form.codigo?.trim() ? (
                    <span className="font-medium text-slate-800">
                      {form.codigo}
                    </span>
                  ) : (
                    <span className="text-xs leading-snug text-slate-500">
                      Gerado pelo sistema ao salvar:{" "}
                      <span className="font-medium text-slate-700">
                        POP_&lt;Sigla da Diretoria&gt;_&lt;nº sequencial&gt;
                      </span>{" "}
                      (ex.: POP_GEJUT_001).
                    </span>
                  )}
                </CampoSomenteLeitura>
              </Campo>
              <Campo label="Nome do Processo" required hint="processo cadastrado">
                <ProcessoPicker
                  value={form.nome_processo ?? ""}
                  onType={(v) => set("nome_processo", v)}
                  onSelect={selecionarProcesso}
                  processos={processos}
                  placeholder="Pesquise o processo cadastrado…"
                />
              </Campo>
              <Campo label="Macroprocesso" hint="preenchido pelo processo">
                <ComboboxLivre
                  value={form.macroprocesso ?? ""}
                  onChange={(v) => set("macroprocesso", v)}
                  options={macroprocessos}
                />
              </Campo>
              <Campo label="Área (sigla)" hint="preenchida pelo processo">
                <ComboboxLivre
                  value={form.area ?? ""}
                  onChange={(v) => {
                    // Ao escolher a sigla, preenche a diretoria (nome) se estiver vazia.
                    const area = areas.find((a) => a.sigla === v);
                    setForm((f) => ({
                      ...f,
                      area: v,
                      diretoria_orgao:
                        area && !f.diretoria_orgao?.trim()
                          ? area.nome
                          : f.diretoria_orgao,
                    }));
                  }}
                  options={siglasAreas}
                  placeholder="Ex.: DIJUD"
                />
              </Campo>
              <Campo label="Diretoria (cabeçalho)" hint="preenchida pelo processo">
                <ComboboxLivre
                  value={form.diretoria_orgao ?? ""}
                  onChange={(v) => set("diretoria_orgao", v)}
                  options={nomesAreas}
                />
              </Campo>
              <Campo label="Unidade (cabeçalho)" hint="das unidades cadastradas">
                <ComboboxLivre
                  value={form.unidade_orgao ?? ""}
                  onChange={(v) => set("unidade_orgao", v)}
                  options={unidades}
                />
              </Campo>
              <Campo
                label="Data da Versão"
                hint="não editável — gerado pelo sistema"
              >
                <CampoSomenteLeitura>
                  {form.data_versao?.trim() ? (
                    <span className="font-medium text-slate-800">
                      {formatarDataBR(form.data_versao)}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      Pendente de aprovação
                    </span>
                  )}
                </CampoSomenteLeitura>
              </Campo>
              <Campo label="Revisão" hint="não editável — gerado pelo sistema">
                <CampoSomenteLeitura>
                  <span className="font-medium text-slate-800">
                    {form.revisao?.trim() || "000"}
                  </span>
                </CampoSomenteLeitura>
              </Campo>
            </div>
          </Secao>

          {/* Conteúdo do POP */}
          <Secao
            icone={<ListChecks className="h-4 w-4" />}
            titulo="Conteúdo do POP"
          >
            <div className="space-y-4">
              <Campo label="1. Serviço">
                <Input
                  value={form.servico ?? ""}
                  onChange={(e) => set("servico", e.target.value)}
                  placeholder="Ex.: GERIR AQUISIÇÕES – Elaboração do Termo de Referência (TR)"
                />
              </Campo>
              <Campo label="2. Objetivo">
                <Textarea
                  value={form.objetivo ?? ""}
                  onChange={(e) => set("objetivo", e.target.value)}
                  rows={2}
                  placeholder="Estabelecer diretrizes e procedimentos para..."
                />
              </Campo>
              <Campo label="3. Unidade Responsável">
                <Textarea
                  value={form.unidade_responsavel ?? ""}
                  onChange={(e) => set("unidade_responsavel", e.target.value)}
                  rows={3}
                  placeholder="Descreva as unidades responsáveis e suas atribuições"
                />
              </Campo>
              <Campo label="4. Siglas" hint="Uma por linha (ex.: ABNT: Associação…)">
                <Textarea
                  value={form.siglas ?? ""}
                  onChange={(e) => set("siglas", e.target.value)}
                  rows={3}
                  placeholder={"ABNT: Associação Brasileira de Normas Técnicas\nPROAD: Processo Administrativo Digital"}
                />
              </Campo>
              <Campo label="5. Normativa" hint="Uma por linha">
                <Textarea
                  value={form.normativa ?? ""}
                  onChange={(e) => set("normativa", e.target.value)}
                  rows={2}
                  placeholder="Decreto Judiciário nº 1.692, de 2 de maio de 2024 - ..."
                />
              </Campo>
              <Campo label="6. Descrição do Procedimento">
                <Textarea
                  value={form.descricao_procedimento ?? ""}
                  onChange={(e) =>
                    set("descricao_procedimento", e.target.value)
                  }
                  rows={4}
                  placeholder="Descreva o passo a passo da atividade desenvolvida."
                />
              </Campo>
              <Campo label="7. Gestor do Processo">
                <Input
                  value={form.gestor_processo ?? ""}
                  onChange={(e) => set("gestor_processo", e.target.value)}
                  placeholder="Nome Completo do Responsável – Unidade Responsável"
                />
              </Campo>
              <Campo label="8. Sistemas Utilizados" hint="Um por linha">
                <Textarea
                  value={form.sistemas_utilizados ?? ""}
                  onChange={(e) => set("sistemas_utilizados", e.target.value)}
                  rows={2}
                  placeholder={"PROAD"}
                />
              </Campo>
              <div className="md:col-span-2">
                <Campo
                  label="9. Anexos"
                  hint="imagem do fluxograma — PNG ou JPG, até 4 MB"
                >
                  {form.fluxograma_data ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 min-w-0">
                      <img
                        src={form.fluxograma_data}
                        alt="Prévia do fluxograma"
                        className="h-14 w-20 rounded border border-slate-200 bg-white object-contain"
                      />
                      <span className="flex-1 min-w-0 truncate text-sm text-slate-700">
                        {form.fluxograma_nome || "fluxograma"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            fluxograma_nome: "",
                            fluxograma_data: "",
                          }))
                        }
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50/50">
                      <ImagePlus className="h-4 w-4 text-slate-400" />
                      Selecionar imagem do fluxograma
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => anexarFluxograma(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </Campo>
              </div>
            </div>
          </Secao>

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={salvando}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {editId ? "Salvar alterações" : "Criar POP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Combobox que lista opções existentes ao digitar/focar, mas aceita valor livre.
 *  Dropdown inline (sem portal) para funcionar dentro do Dialog modal. */
function ComboboxLivre({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const q = value.trim().toLowerCase();
  const filtrados = options
    .filter((o) => !q || o.toLowerCase().includes(q))
    .slice(0, 60);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
      />
      {aberto && filtrados.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filtrados.map((o) => (
            <div
              key={o}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 truncate"
              title={o}
              onMouseDown={() => {
                onChange(o);
                setAberto(false);
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Busca de processo cadastrado. Diferente do ComboboxLivre, cada opção é um processo inteiro:
 * ao selecionar, o formulário auto-preenche macroprocesso/área/diretoria a partir do cadastro.
 * Digitar apenas filtra a lista (a regra do POP exige processo previamente cadastrado).
 */
function ProcessoPicker({
  value,
  onType,
  onSelect,
  processos,
  placeholder,
}: {
  value: string;
  onType: (v: string) => void;
  onSelect: (p: ProcessoNegocio) => void;
  processos: ProcessoNegocio[];
  placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const q = value.trim().toLowerCase();
  const filtrados = processos
    .filter((p) => {
      if (!q) return true;
      return [p.nome_processo, p.macroprocesso, p.diretoria].some((c) =>
        (c || "").toLowerCase().includes(q),
      );
    })
    .slice(0, 60);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onType(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
      />
      {aberto && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filtrados.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Nenhum processo cadastrado encontrado.
            </div>
          ) : (
            filtrados.map((p) => (
              <div
                key={p.id}
                className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                title={p.nome_processo}
                onMouseDown={() => {
                  onSelect(p);
                  setAberto(false);
                }}
              >
                <div className="text-sm text-gray-900 font-medium truncate">
                  {p.nome_processo}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {[p.macroprocesso, p.diretoria].filter(Boolean).join(" · ") ||
                    "—"}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-blue-700">
        {icone}
        <h3 className="text-sm font-semibold">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

/** Caixa somente-leitura, no estilo de um input desabilitado (campos gerados pelo sistema). */
function CampoSomenteLeitura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[2.5rem] items-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm">
      {children}
    </div>
  );
}

/** Converte YYYY-MM-DD (ou ISO) para DD/MM/AAAA sem depender de timezone. */
function formatarDataBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function Campo({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && (
          <span className="ml-1 text-xs font-normal text-gray-400">
            ({hint})
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}
