import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ifo } from "@/services/dfdApi";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Pencil } from "lucide-react";

import { getAreaLabel } from "@/utils/formatters";

interface DialogImportarPcaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ifos: Ifo[]; // All IFOs that need conversion
  onConfirm: (importacoes: { ifoId: number; codigoPca: string }[], arquivoPca: File) => Promise<void>;
  onEditIfo: (ifo: Ifo) => void;
  anoFormacao: number;
}

export function DialogImportarPca({ open, onOpenChange, ifos, onConfirm, onEditIfo, anoFormacao }: DialogImportarPcaProps) {
  const [codigos, setCodigos] = useState<Record<number, string>>({});
  const [arquivoPca, setArquivoPca] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => {
    if (open) {
       const initial: Record<number, string> = {};
       ifos.forEach(ifo => initial[ifo.id] = "");
       setCodigos(initial);
       setArquivoPca(null);
       setErrorMsg(null);
    }
  }, [open, ifos]);

  const handleConfirmAction = async () => {
    if (!arquivoPca) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const importacoes = Object.entries(codigos).map(([id, code]) => ({
        ifoId: Number(id),
        codigoPca: code.trim()
      }));
      await onConfirm(importacoes, arquivoPca);
      onOpenChange(false);
      setIsAlertOpen(false);
    } catch (err: any) {
      setErrorMsg("Ocorreu um erro ao importar o PCA. Verifique se os dados estão corretos e tente novamente.");
      setIsAlertOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAllFilled = ifos.length > 0 && ifos.every(ifo => !!codigos[ifo.id]?.trim()) && arquivoPca !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar PCA - Formação {anoFormacao}</DialogTitle>
            <DialogDescription>
              Insira os códigos para os PCAs correspondentes a cada demanda estruturada e anexe o arquivo PDF do PCA.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mt-4 border border-red-200">
              {errorMsg}
            </div>
          )}

          <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm mt-4 border border-yellow-200">
            <strong>Dica:</strong> O arquivo selecionado deve ser um PDF e será anexado oficialmente à formação do Ciclo Orçamentário.
          </div>

          <div className="mt-6 mb-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Arquivo PCA (PDF)</label>
            <input 
              type="file" 
              accept=".pdf"
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 cursor-pointer"
              onChange={(e) => setArquivoPca(e.target.files?.[0] || null)}
            />
          </div>

          <div className="space-y-4 my-4">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">IFO (Código)</th>
                  <th className="px-4 py-2 font-medium">Objeto</th>
                  <th className="px-4 py-2 font-medium">Área Demandante</th>
                  <th className="px-4 py-2 font-medium w-48">Código PCA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ifos.map((ifo) => (
                  <tr key={ifo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-600">{ifo.codigo}</td>
                    <td className="px-4 py-3 text-slate-800 line-clamp-2 max-w-[300px]" title={ifo.objeto}>{ifo.objeto || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{getAreaLabel(ifo)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 transition-shadow flex-1">
                          <span className="text-slate-500 font-medium mr-1.5 select-none">PCA</span>
                          <input 
                            type="text" 
                            placeholder="Ex: 230"
                            className="w-full outline-none bg-transparent text-sm placeholder:text-slate-400 font-medium"
                            value={codigos[ifo.id] || ""}
                            onChange={(e) => setCodigos(prev => ({ ...prev, [ifo.id]: e.target.value }))}
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 flex-shrink-0" 
                          onClick={() => onEditIfo(ifo)}
                          title="Editar IFO"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ifos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-500">
                      Nenhuma demanda estruturada encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button 
              onClick={() => setIsAlertOpen(true)} 
              disabled={!isAllFilled}
            >
              Confirmar Importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a importar os dados e transformá-los em itens oficiais do PCA {anoFormacao}. Esta ação publicará o ciclo, oficializando o documento, e é irreversível. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <Button onClick={handleConfirmAction} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
