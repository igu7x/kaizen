import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {

  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ifoApi, type Ifo, type AtualizarIfoRequest } from "@/services/dfdApi";
import { areasApi, type Area, type Unidade } from "@/services/areasApi";

const MESES_ORDENADOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const getIsoDateFromMes = (mes: string, ano: number): string => {
  const index = MESES_ORDENADOS.indexOf(mes);
  if (index === -1) return "";
  const monthStr = String(index + 1).padStart(2, "0");
  return `${ano}-${monthStr}-01`;
};

const getMesFromIsoDate = (isoDate: string | null | undefined): string => {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10);
    return MESES_ORDENADOS[month - 1] || "";
  }
  return "";
};

interface DialogEditarIfoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ifo: Ifo | null;
  onSuccess: () => void;
}

export function DialogEditarIfo({
  open,
  onOpenChange,
  ifo,
  onSuccess,
}: DialogEditarIfoProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<AtualizarIfoRequest>>({});
  
  const [diretoriasList, setDiretoriasList] = useState<Area[]>([]);
  const [unidadesList, setUnidadesList] = useState<Unidade[]>([]);
  const [displayValue, setDisplayValue] = useState("");

  const hasEspecialTags = user?.tags_acesso?.some(tag => tag === "PCA_FOR_MODIFICACAO_ESPECIAL" || tag === "PCA_FOR_MODIFICACAO_CCA") ?? false;


  useEffect(() => {
    if (open && ifo) {
      areasApi.getAll().then(setDiretoriasList).catch(() => {});
      
      setFormData({
        bloco: ifo.bloco,
        natureza: ifo.natureza,
        objeto: ifo.objeto,
        valorEstimado: ifo.valorEstimado,
        cadastrosUnidadesId: ifo.cadastrosUnidadesId,
        cadastrosAreasId: ifo.cadastrosAreasId || null,
        interesseRenovacao: ifo.interesseRenovacao,
        description: ifo.description,
        justification: ifo.justification,
        process: ifo.process,
        financialResourceType: ifo.financialResourceType,
        contractType: ifo.contractType,
        formalizedValueCents: ifo.formalizedValueCents,

        priority: ifo.priority,
        estimatedDate: ifo.estimatedDate,
        strategicObjective: ifo.strategicObjective,
        isSustainable: ifo.isSustainable,
        isSharedAcquisition: ifo.isSharedAcquisition,
        quantity: ifo.quantity,
      });

      const numValue = ifo.valorEstimado || 0;
      setDisplayValue(new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(numValue));
    }
  }, [open, ifo]);

  useEffect(() => {
    if (formData.cadastrosAreasId) {
      areasApi
        .getUnidades(formData.cadastrosAreasId)
        .then(setUnidadesList)
        .catch(() => setUnidadesList([]));
    } else {
      setUnidadesList([]);
    }
  }, [formData.cadastrosAreasId]);

  const handleChange = (field: keyof AtualizarIfoRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (!raw) raw = "0";
    const numValue = parseInt(raw, 10) / 100;
    
    setDisplayValue(new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue));
    
    handleChange("valorEstimado", numValue);
  };

  const formatValueBRL = (cents: number | null | undefined) => {
    if (cents == null) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  const handleCurrencyChangeFormalized = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (!raw) raw = "0";
    const numValue = parseInt(raw, 10);
    handleChange("formalizedValueCents", numValue);
  };

  const handleSave = async () => {
    if (!ifo || !formData.objeto || (!formData.cadastrosAreasId && !formData.cadastrosUnidadesId)) {
      toast.error("Preencha os campos obrigatórios (Objeto e Área demandante).");
      return;
    }

    try {
      setLoading(true);
      await ifoApi.atualizar(ifo.id, formData as AtualizarIfoRequest);
      toast.success("IFO atualizado com sucesso.");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível salvar o IFO.");
    } finally {
      setLoading(false);
    }
  };

  if (!ifo) return null;

  const isRestrictedBlock = ["plurianual", "encerramento", "renovacao"].includes(ifo.bloco) && !hasEspecialTags && !(user as any)?.is_superadmin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Editar IFO {ifo.codigo}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Altere as informações do item. Salvar as edições poderá invalidar aprovações prévias da demanda.
          </DialogDescription>
        </DialogHeader>

        {isRestrictedBlock && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mx-2 flex gap-2 items-start text-amber-800 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>
              Para IFOs do bloco <strong>{ifo.bloco}</strong>, apenas <strong>Valor Estimado, Tipo de Recurso, Grau de Prioridade, Sustentabilidade, Compra Compartilhada e Quantidade</strong> podem ser modificados.
            </p>
          </div>
        )}

        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
          {/* Linha 1 - Tipo e Data Estimada */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Contrato</Label>
              <Select
                value={formData.contractType || undefined}
                disabled={isRestrictedBlock}
                onValueChange={(v) => handleChange("contractType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOVA_CONTRATACAO">Nova Contratação</SelectItem>
                  <SelectItem value="RENOVACAO">Renovação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Estimada</Label>
              <Select
                value={getMesFromIsoDate(formData.estimatedDate) || undefined}
                disabled={isRestrictedBlock}
                onValueChange={(v) => handleChange("estimatedDate", getIsoDateFromMes(v, ifo.ano))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {MESES_ORDENADOS.map((mes) => (
                    <SelectItem key={mes} value={mes}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2 - Diretoria e Área Demandante */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Diretoria</Label>
              <Select
                value={formData.cadastrosAreasId ? String(formData.cadastrosAreasId) : undefined}
                disabled={isRestrictedBlock}
                onValueChange={(v) => {
                  const dirId = parseInt(v, 10);
                  handleChange("cadastrosAreasId", dirId);
                  handleChange("cadastrosUnidadesId", undefined);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {diretoriasList.map((dir) => (
                    <SelectItem key={dir.id} value={String(dir.id)}>
                      {dir.sigla ? `${dir.sigla} - ${dir.nome}` : dir.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade Demandante</Label>
              <Select
                value={formData.cadastrosUnidadesId ? String(formData.cadastrosUnidadesId) : undefined}
                onValueChange={(v) => handleChange("cadastrosUnidadesId", parseInt(v, 10))}
                disabled={isRestrictedBlock || !formData.cadastrosAreasId || unidadesList.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidadesList.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.sigla ? `${u.sigla} - ${u.nome}` : u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3 - Objeto */}
          <div className="space-y-2">
            <Label>Objeto da Contratação <span className="text-red-500">*</span></Label>
            <Textarea
              placeholder="Descreva o objeto..."
              value={formData.objeto || ""}
              onChange={(e) => handleChange("objeto", e.target.value)}
              disabled={isRestrictedBlock}
              className="resize-none h-20"
            />
          </div>

          <div className="space-y-2">
            <Label>Indicação do Objetivo Estratégico TJGO</Label>
            <Textarea
              placeholder="Descreva o objetivo estratégico"
              rows={2}
              value={formData.strategicObjective || ""}
              onChange={(e) => handleChange("strategicObjective", e.target.value)}
              disabled={isRestrictedBlock}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Alinhado às diretrizes de sustentabilidade (PLS)?</Label>
              <Select
                value={formData.isSustainable === true ? "true" : formData.isSustainable === false ? "false" : undefined}
                onValueChange={(v) => handleChange("isSustainable", v === "true")}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Indicada compra compartilhada?</Label>
              <Select
                value={formData.isSharedAcquisition === true ? "true" : formData.isSharedAcquisition === false ? "false" : undefined}
                onValueChange={(v) => handleChange("isSharedAcquisition", v === "true")}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              placeholder="ex.: 10 licenças"
              value={formData.quantity || ""}
              onChange={(e) => handleChange("quantity", e.target.value)}
            />
          </div>

          {/* Linha 4 - Demanda da Unidade */}
          <div className="space-y-2">
            <Label>Demanda da Unidade</Label>
            <Textarea
              placeholder="Descrição da demanda da unidade"
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              disabled={isRestrictedBlock}
              className="resize-none h-20"
            />
          </div>

          {/* Linha 5 - Justificativa */}
          <div className="space-y-2">
            <Label>Justificativa</Label>
            <Textarea
              placeholder="Descreva a justificativa..."
              value={formData.justification || ""}
              disabled={isRestrictedBlock}
              onChange={(e) => handleChange("justification", e.target.value)}
              className="resize-none h-20"
            />
          </div>

          {/* Linha 6 - 3 colunas */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Recurso</Label>
              <Select
                value={formData.financialResourceType || undefined}
                onValueChange={(v) => handleChange("financialResourceType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Investimento">Investimento</SelectItem>
                  <SelectItem value="Custeio">Custeio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grau de Prioridade</Label>
              <Select
                value={formData.priority || undefined}
                onValueChange={(v) => handleChange("priority", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alto">Alto</SelectItem>
                  <SelectItem value="Médio">Médio</SelectItem>
                  <SelectItem value="Baixo">Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Natureza</Label>
              <Select
                value={formData.natureza || undefined}
                disabled={isRestrictedBlock}
                onValueChange={(v) => handleChange("natureza", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuada">Continuada</SelectItem>
                  <SelectItem value="pontual">Pontual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 7 - 2 colunas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Estimado (R$) {ifo.contratos && ifo.contratos.length > 0 && <span className="text-xs text-slate-400 font-normal ml-1">(Derivado dos contratos)</span>}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                <Input
                  className="pl-9"
                  placeholder="0,00"
                  value={displayValue ? displayValue.replace("R$", "").trim() : ""}
                  onChange={handleCurrencyChange}
                  disabled={ifo.contratos && ifo.contratos.length > 0}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor {ifo.ano} (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                <Input
                  className="pl-9"
                  placeholder="0,00"
                  value={formData.formalizedValueCents ? formatValueBRL(formData.formalizedValueCents).replace("R$", "").trim() : ""}
                  onChange={handleCurrencyChangeFormalized}
                  disabled={isRestrictedBlock}
                />
              </div>
            </div>
          </div>
          
          {/* Linha 8 - PROAD */}
          <div className="space-y-2">
            <Label>Processo Administrativo (PROAD)</Label>
            <Input
              placeholder="Número do PROAD"
              value={formData.process || ""}
              disabled={isRestrictedBlock}
              onChange={(e) => handleChange("process", e.target.value)}
            />
          </div>

        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
