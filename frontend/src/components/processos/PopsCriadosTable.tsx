import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Plus,
  Loader2,
  FileDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { popsCriadosApi, PopCriado } from "@/services/popsCriadosApi";
import { generatePopPDF } from "@/utils/generatePopPDF";
import { PopCriadoDialog } from "./PopCriadoDialog";

function formatData(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export function PopsCriadosTable({ areaPadrao }: { areaPadrao?: string }) {
  const [pops, setPops] = useState<PopCriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PopCriado | null>(null);
  const [excluir, setExcluir] = useState<PopCriado | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setPops(await popsCriadosApi.list());
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const abrirEdicao = (p: PopCriado) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const baixarPdf = async (p: PopCriado) => {
    try {
      // Garante os dados completos (a listagem já traz tudo, mas mantém robusto).
      const full = await popsCriadosApi.getById(p.id);
      generatePopPDF(full);
    } catch {
      toast.error("Não foi possível gerar o PDF do POP.");
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    try {
      await popsCriadosApi.remove(excluir.id);
      toast.success("POP excluído.");
      setExcluir(null);
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-base font-bold text-slate-900">
          POPs Criados no Kaizen
        </h3>
        <Button
          onClick={abrirNovo}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Criar POP
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando…
        </div>
      ) : pops.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileText className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold">
            Nenhum POP criado ainda
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Use “Criar POP” para gerar um novo procedimento no padrão SGQ.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Nome do Processo
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Serviço
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Área
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Data da Versão
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Revisão
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pops.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-left">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-900 font-medium truncate">
                          {p.nome_processo || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-left text-slate-700">
                      <span className="line-clamp-1">{p.servico || "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-slate-700">
                      {p.area || "—"}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-700 tabular-nums whitespace-nowrap">
                      {formatData(p.data_versao)}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-700 tabular-nums">
                      {p.revisao || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => baixarPdf(p)}
                          title="Gerar PDF do POP"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => abrirEdicao(p)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setExcluir(p)}
                          title="Excluir"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-600">
              {pops.length} POP{pops.length === 1 ? "" : "s"} criado
              {pops.length === 1 ? "" : "s"}
            </span>
          </div>
        </>
      )}

      <PopCriadoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pop={editing}
        onSaved={carregar}
        areaPadrao={areaPadrao}
      />

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir POP</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <span className="font-semibold">{excluir?.nome_processo}</span>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
