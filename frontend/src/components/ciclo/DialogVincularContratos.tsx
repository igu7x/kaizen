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
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { ifoApi, type Ifo } from "@/services/dfdApi";
import type { Contract } from "@/types";
import { formatCurrency } from "@/services/pcaApi";

interface DialogVincularContratosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ifo: Ifo | null;
  allContracts: Contract[];
  onSuccess: () => void;
}

export function DialogVincularContratos({
  open,
  onOpenChange,
  ifo,
  allContracts,
  onSuccess,
}: DialogVincularContratosProps) {
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open && ifo) {
      setSelectedIds(new Set(ifo.contratos || []));
    }
  }, [open, ifo]);

  const toggleContract = (contractId: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(contractId)) {
      newSet.delete(contractId);
    } else {
      newSet.add(contractId);
    }
    setSelectedIds(newSet);
  };

  const handleSave = async () => {
    if (!ifo) return;

    try {
      setLoading(true);
      await ifoApi.atualizarContratos(ifo.id, Array.from(selectedIds));
      toast.success("Vínculos atualizados com sucesso.");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível atualizar os vínculos.");
    } finally {
      setLoading(false);
    }
  };

  if (!ifo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-white max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Vincular Contratos (IFO {ifo.codigo})
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Selecione os contratos continuados que fazem parte deste item.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
          {allContracts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              Nenhum contrato continuado disponível para vínculo.
            </p>
          ) : (
            allContracts.map((c) => {
              const isSelected = selectedIds.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => toggleContract(c.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded flex items-center justify-center border shrink-0 ${
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-slate-300"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-800 font-mono text-sm">
                        CT {c.noticeNumber || c.id}
                      </span>
                      <span className="font-medium text-slate-700 text-sm">
                        {formatCurrency(c.totalValueCents || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-1">
                      {c.objectName || "Sem objeto descrito"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Unidade: {c.directory || "-"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Vínculos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
