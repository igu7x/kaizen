import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface DialogMotivoNaoRenovacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ifoId: number | null;
  contractId: number | null;
  onConfirm: (ifoId: number, contractId: number, motivo: string) => Promise<void>;
}

export function DialogMotivoNaoRenovacao({
  open,
  onOpenChange,
  ifoId,
  contractId,
  onConfirm,
}: DialogMotivoNaoRenovacaoProps) {
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState("");

  const handleSave = async () => {
    if (!ifoId || !contractId || !motivo.trim()) return;
    
    try {
      setLoading(true);
      await onConfirm(ifoId, contractId, motivo.trim());
      setMotivo(""); // Reset the field after success
      onOpenChange(false);
    } catch (err) {
      // Error handling is managed by onConfirm
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMotivo("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Justificativa para Não Renovação
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Por favor, explique o motivo da equipe não desejar renovar este contrato. Esta informação constará na Proposta do PCA.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              placeholder="Descreva a justificativa..."
              className="min-h-[100px]"
              maxLength={128}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <div className="text-xs text-slate-500 text-right mt-1">
              {128 - (motivo?.length || 0)} caracteres restantes
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !motivo.trim()} 
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Não Renovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
