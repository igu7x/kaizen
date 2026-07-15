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
import { Loader2, FileText, ListChecks } from "lucide-react";
import { toast } from "sonner";
import {
  popsCriadosApi,
  PopCriado,
  PopCriadoInput,
} from "@/services/popsCriadosApi";

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
  revisao: "00",
  servico: "",
  objetivo: "",
  unidade_responsavel: "",
  siglas: "",
  normativa: "",
  descricao_procedimento: "",
  gestor_processo: "",
  sistemas_utilizados: "",
  anexos: "",
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
              <Campo label="Código" hint="Ex.: SGQ-003">
                <Input
                  value={form.codigo ?? ""}
                  onChange={(e) => set("codigo", e.target.value)}
                  placeholder="SGQ-003"
                />
              </Campo>
              <Campo label="Nome do Processo" required>
                <Input
                  value={form.nome_processo ?? ""}
                  onChange={(e) => set("nome_processo", e.target.value)}
                  placeholder="Ex.: Elaboração do Termo de Referência (TR)"
                />
              </Campo>
              <Campo label="Macroprocesso">
                <Input
                  value={form.macroprocesso ?? ""}
                  onChange={(e) => set("macroprocesso", e.target.value)}
                  placeholder="Ex.: Governança"
                />
              </Campo>
              <Campo label="Área (sigla)">
                <Input
                  value={form.area ?? ""}
                  onChange={(e) => set("area", e.target.value)}
                  placeholder="Ex.: DIJUD"
                />
              </Campo>
              <Campo label="Diretoria (cabeçalho)">
                <Input
                  value={form.diretoria_orgao ?? ""}
                  onChange={(e) => set("diretoria_orgao", e.target.value)}
                  placeholder="Ex.: Diretoria Administrativa"
                />
              </Campo>
              <Campo label="Unidade (cabeçalho)">
                <Input
                  value={form.unidade_orgao ?? ""}
                  onChange={(e) => set("unidade_orgao", e.target.value)}
                  placeholder="Ex.: Divisão de Material e Patrimônio"
                />
              </Campo>
              <Campo label="Data da Versão">
                <Input
                  type="date"
                  value={form.data_versao ?? ""}
                  onChange={(e) => set("data_versao", e.target.value)}
                />
              </Campo>
              <Campo label="Revisão">
                <Input
                  value={form.revisao ?? ""}
                  onChange={(e) => set("revisao", e.target.value)}
                  placeholder="00"
                />
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
              <Campo label="9. Anexos" hint="Um por linha">
                <Textarea
                  value={form.anexos ?? ""}
                  onChange={(e) => set("anexos", e.target.value)}
                  rows={2}
                  placeholder={'Fluxo "Gerenciamento de Informação Documentada – SGQ"'}
                />
              </Campo>
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
