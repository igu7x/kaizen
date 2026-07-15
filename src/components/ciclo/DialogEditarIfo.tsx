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

  const hasEspecialTags = user?.tags_acesso?.some(tag => tag === "PCA_MODIFICACAO_ESPECIAL" || tag === "PCA_MODIFICACAO_CCA") ?? false;


  useEffect(() => {
    if (open && ifo) {
      areasApi.getAll().then(setDiretoriasList).catch(() => {});
      
      setFormData({
        bloco: ifo.bloco,
        natureza: ifo.natureza,
        objeto: ifo.objeto,
        valorEstimado: ifo.valorEstimado,
        areaDemandante: ifo.areaDemandante,
        unidadeId: ifo.unidadeId,
        areaId: ifo.idCadastrosAreas || null, // Assuming areaId is related to idCadastrosAreas
        interesseRenovacao: ifo.interesseRenovacao,
        description: ifo.description,
        justification: ifo.justification,
        process: ifo.process,
        financialResourceType: ifo.financialResourceType,
        contractType: ifo.contractType,
        formalizedValueCents: ifo.formalizedValueCents,
        idCadastrosAreas: ifo.idCadastrosAreas,
        priority: ifo.priority,
        estimatedDate: ifo.estimatedDate,
      });

      const numValue = ifo.valorEstimado || 0;
      setDisplayValue(new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(numValue));
    }
  }, [open, ifo]);

  useEffect(() => {
    if (formData.areaId) {
      areasApi
        .getUnidades(formData.areaId)
        .then(setUnidadesList)
        .catch(() => setUnidadesList([]));
    } else {
      setUnidadesList([]);
    }
  }, [formData.areaId]);

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

  const handleSave = async () => {
    if (!ifo || !formData.objeto || !formData.areaDemandante) {
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
              Para IFOs do bloco <strong>{ifo.bloco}</strong>, apenas o <strong>Valor Estimado</strong> pode ser modificado.
            </p>
          </div>
        )}

        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Diretoria</Label>
              <Select
                value={formData.areaId ? String(formData.areaId) : undefined}
                disabled={isRestrictedBlock}
                onValueChange={(v) => {
                  const dirId = parseInt(v, 10);
                  const unidade = diretoriasList.find((d) => d.id === dirId);
                  handleChange("areaId", dirId);
                  handleChange("idCadastrosAreas", dirId);
                  handleChange("areaDemandante", unidade?.nome || "");
                  handleChange("unidadeId", undefined);
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
                value={formData.unidadeId ? String(formData.unidadeId) : undefined}
                onValueChange={(v) => handleChange("unidadeId", parseInt(v, 10))}
                disabled={isRestrictedBlock || !formData.areaId || unidadesList.length === 0}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Estimado</Label>
              <Input
                placeholder="R$ 0,00"
                value={displayValue}
                onChange={handleCurrencyChange}
              />
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
          
          <div className="space-y-2">
            <Label>Processo Administrativo (PROAD)</Label>
            <Input
              placeholder="Número do PROAD"
              value={formData.process || ""}
              disabled={isRestrictedBlock}
              onChange={(e) => handleChange("process", e.target.value)}
            />
          </div>
          
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
