import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAreaLabel } from "@/utils/formatters";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { ifoApi, type Ifo } from "@/services/dfdApi";
import type { Contract } from "@/types";
import { formatCurrency } from "@/services/pcaApi";

interface DialogCriarIfoViaContratoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bloco: "plurianual" | "renovacao" | "encerramento";
  ano: number;
  cicloId: number;
  allContracts: Contract[];
  onSuccess: () => void;
}

export function DialogCriarIfoViaContrato({
  open,
  onOpenChange,
  bloco,
  ano,
  cicloId,
  allContracts,
  onSuccess,
}: DialogCriarIfoViaContratoProps) {
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const blocoLabels = {
    plurianual: "Plurianual",
    renovacao: "Renovação",
    encerramento: "Encerramento",
  };

  const filteredContracts = useMemo(() => {
    return allContracts.filter((c) => {
      // Regra de inserção automática: contratos precisam ter limitDate e ela deve alcançar o ano do ciclo
      if (!c.limitDate) return false;
      const limitAno = new Date(c.limitDate).getFullYear();
      if (limitAno < ano) return false;

      let blocoContrato = "plurianual"; // Default se não tiver endDate

      if (c.endDate) {
        const fimAno = new Date(c.endDate).getFullYear();
        if (fimAno > ano) {
          blocoContrato = "plurianual";
        } else if (new Date(c.limitDate) > new Date(c.endDate)) {
          blocoContrato = "renovacao";
        } else {
          blocoContrato = "encerramento";
        }
      }

      return blocoContrato === bloco;
    });
  }, [allContracts, bloco, ano]);

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
    }
  }, [open]);

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
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um contrato.");
      return;
    }

    try {
      setLoading(true);
      const firstId = Array.from(selectedIds)[0];
      const firstContract = allContracts.find((c) => c.id === firstId);

      await ifoApi.criar({
        ano,
        cicloId,
        bloco: bloco as any,
        natureza: "continuada",
        objeto: firstContract?.objectName || "Novo IFO",
        contratos: Array.from(selectedIds),
      });

      toast.success("Novo IFO criado com sucesso.");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível criar o IFO.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-white max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Novo IFO ({blocoLabels[bloco] || bloco})
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Selecione o(s) contrato(s) para compor o novo IFO.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
          {filteredContracts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              Nenhum contrato continuado disponível para vínculo neste bloco.
            </p>
          ) : (
            filteredContracts.map((c) => {
              const isSelected = selectedIds.has(c.id);
              const isLinkedToAnother = !!c.linkedIfoCodigo && !isSelected;

              return (
                <div
                  key={c.id}
                  onClick={() => toggleContract(c.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isSelected
                      ? "border-blue-500 bg-blue-50 cursor-pointer"
                      : "border-slate-200 hover:bg-slate-50 cursor-pointer"
                    }`}
                >
                  <div className="flex-shrink-0">
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "border-slate-300"
                        }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-slate-900 break-words line-clamp-2">
                          {c.objectName || "Sem Objeto"}
                        </span>
                        {isLinkedToAnother && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                            Vinculado ao {c.linkedIfoCodigo}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-slate-700 text-sm">
                        {formatCurrency((c.totalValueCents || 0) / 100)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-1">
                      {c.objectName || "Sem objeto descrito"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Unidade: {getAreaLabel(c)}
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
          <Button onClick={handleSave} disabled={loading || selectedIds.size === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar IFO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
