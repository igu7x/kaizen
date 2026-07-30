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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ifoApi } from "@/services/dfdApi";

interface DialogEditarValorContratoIfoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ifoId: number;
  contractId: number;
  initialValueCents: number | null;
  onSuccess: () => void;
}

export function DialogEditarValorContratoIfo({
  open,
  onOpenChange,
  ifoId,
  contractId,
  initialValueCents,
  onSuccess,
}: DialogEditarValorContratoIfoProps) {
  const [loading, setLoading] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const [valorCents, setValorCents] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      const numValue = initialValueCents ? initialValueCents / 100 : 0;
      setValorCents(initialValueCents || 0);
      setDisplayValue(new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(numValue));
    }
  }, [open, initialValueCents]);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (!raw) raw = "0";
    const numValue = parseInt(raw, 10);
    
    setValorCents(numValue);
    setDisplayValue(new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue / 100));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await ifoApi.atualizarValorContrato(ifoId, contractId, valorCents || 0);
      toast.success("Valor do contrato atualizado com sucesso.");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível salvar o valor do contrato.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Editar Valor do Contrato
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Altere o valor financeiro deste contrato. O valor total do IFO será recalculado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Valor do Contrato</Label>
            <Input
              placeholder="R$ 0,00"
              value={displayValue}
              onChange={handleCurrencyChange}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
