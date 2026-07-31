import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ifoApi, type CriarIfoRequest } from "@/services/dfdApi";
import { areasApi, type Area, type Unidade } from "@/services/areasApi";

interface DialogNovoIfoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ano: number;
  cicloId?: number;
  proad?: string;
  onSuccess: () => void;
}

export function DialogNovoIfo({
  open,
  onOpenChange,
  ano,
  cicloId,
  proad,
  onSuccess,
}: DialogNovoIfoProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<CriarIfoRequest>>({
    ano,
    bloco: "nova_contratacao",
    objeto: "",
    valorEstimado: 0,
    natureza: "",
    process: proad || "",
    contratos: [],
  });
  
  // Combobox lists
  const [diretoriasList, setDiretoriasList] = useState<Area[]>([]);
  const [unidadesList, setUnidadesList] = useState<Unidade[]>([]);
  
  // Format currency state
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (open) {
      areasApi.getAll().then(setDiretoriasList).catch(() => {});
      setFormData((prev) => ({ ...prev, process: proad || "" }));
    }
  }, [open, proad]);

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

  const handleChange = (field: keyof CriarIfoRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (!raw) raw = "0";
    const numValue = parseInt(raw, 10) / 100;
    
    // Format for display
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
    
    setDisplayValue(formatted);
    handleChange("valorEstimado", numValue);
  };

  const handleCurrencyChangeFormalized = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (!raw) raw = "0";
    const numValue = parseInt(raw, 10); // in cents for formalizedValueCents
    
    // Format for display
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue / 100);
    
    // Create a local state for display if needed, but we can just use the value directly for now or add a state.
    handleChange("formalizedValueCents", numValue);
  };
  
  // Format BRL helper
  const formatValueBRL = (cents: number | null | undefined) => {
    if (cents == null) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  const handleSave = async () => {
    if (!formData.objeto || (!formData.cadastrosAreasId && !formData.cadastrosUnidadesId)) {
      toast.error("Preencha os campos obrigatórios (Objeto e Área demandante).");
      return;
    }

    try {
      setLoading(true);
      await ifoApi.criar({
        ...formData,
        ano,
        cicloId,
        bloco: "nova_contratacao",
      } as CriarIfoRequest);
      toast.success("IFO criado com sucesso.");
      onSuccess();
      onOpenChange(false);
      setFormData({
        ano,
        bloco: "nova_contratacao",
        objeto: "",
        valorEstimado: 0,
        natureza: "",
        cadastrosAreasId: undefined,
        cadastrosUnidadesId: undefined,
        process: proad || "",
        contratos: [],
      });
      setDisplayValue("");
    } catch (err) {
      toast.error("Não foi possível salvar o IFO.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Novo IFO (Nova Contratação)
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Adicione um novo item ao planejamento. Os itens preenchidos aqui
            comporão o PCA-TIC do próximo ano.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Diretoria</Label>
              <Select
                value={formData.cadastrosAreasId ? String(formData.cadastrosAreasId) : undefined}
                onValueChange={(v) => {
                  const dirId = parseInt(v, 10);
                  setFormData({
                    ...formData,
                    cadastrosAreasId: dirId,
                    cadastrosUnidadesId: undefined,
                  });
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
              <Label>Área demandante *</Label>
              <Select
                value={formData.cadastrosUnidadesId ? String(formData.cadastrosUnidadesId) : undefined}
                onValueChange={(v) => {
                  const unidId = parseInt(v, 10);
                  setFormData({
                    ...formData,
                    cadastrosUnidadesId: unidId,
                  });
                }}
                disabled={!formData.cadastrosAreasId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {unidadesList.map((u) => {
                    const dir = diretoriasList.find(
                      (d) => d.id === formData.cadastrosAreasId
                    );
                    const sigla = dir?.sigla || dir?.nome;
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nome} {sigla ? `(${sigla})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Objeto *</Label>
            <Input
              placeholder="ex.: Solução de observabilidade"
              value={formData.objeto || ""}
              onChange={(e) => handleChange("objeto", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Demanda da Unidade</Label>
            <Textarea
              placeholder="Descrição da demanda da unidade"
              rows={2}
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Justificativa</Label>
            <Textarea
              placeholder="Justificativa da necessidade"
              rows={2}
              value={formData.justification || ""}
              onChange={(e) => handleChange("justification", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Recurso</Label>
              <Select
                value={formData.financialResourceType || undefined}
                onValueChange={(v) => handleChange("financialResourceType", v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                onValueChange={(v) => handleChange("natureza", v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuada">Continuada</SelectItem>
                  <SelectItem value="pontual">Pontual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Global Estimado (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                <Input
                  className="pl-9"
                  placeholder="0,00"
                  value={displayValue ? displayValue.replace("R$", "").trim() : ""}
                  onChange={handleCurrencyChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor {ano} (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                <Input
                  className="pl-9"
                  placeholder="0,00"
                  value={formData.formalizedValueCents ? formatValueBRL(formData.formalizedValueCents).replace("R$", "").trim() : ""}
                  onChange={handleCurrencyChangeFormalized}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>PROAD</Label>
            <Input
              placeholder="202xxxx"
              value={formData.process || ""}
              onChange={(e) => handleChange("process", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
