import { useMemo, useState } from "react";
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
import { FileText, Loader2, FileDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { popsCriadosApi, PopCriado } from "@/services/popsCriadosApi";
import { DocumentoAnexado } from "@/services/processosNegocioApi";
import { generatePopPDF } from "@/utils/generatePopPDF";
import { PopCriadoDialog } from "./PopCriadoDialog";

/** Linha de POP anexado a um processo (calculada na página do Escritório de Processos). */
export interface LinhaPopAnexado {
  key: string;
  processoId: number;
  processoNome: string;
  area: string;
  nomeExibicao: string;
  doc: DocumentoAnexado;
}

interface Props {
  linhasAnexadas: LinhaPopAnexado[];
  /** POPs criados no Kaizen (carregados na página, para o card contar mesmo com a aba fechada). */
  criados: PopCriado[];
  loading: boolean;
  onReload: () => void;
  /** Mesmo termo da busca do card, aplicado também aos POPs criados. */
  busca: string;
  areaPadrao?: string;
  baixandoDocKey: string | null;
  onBaixarAnexado: (row: LinhaPopAnexado) => void;
  /** O botão "Criar POP" vive no cabeçalho do card, na página. */
  criarOpen: boolean;
  onCriarOpenChange: (o: boolean) => void;
}

/** Linha da tabela unificada: POPs anexados a processos + POPs criados no Kaizen. */
type LinhaPop =
  | { tipo: "anexado"; key: string; nome: string; contexto: string; area: string; data: string; anexado: LinhaPopAnexado }
  | { tipo: "criado"; key: string; nome: string; contexto: string; area: string; data: string; pop: PopCriado };

function formatData(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/**
 * Tabela única de POPs. Reúne as duas origens que antes viviam em tabelas separadas:
 * documentos do tipo POP anexados a processos e POPs criados dentro do Kaizen. A coluna
 * "Origem" distingue as duas, e as ações disponíveis dependem dela (anexado só baixa;
 * criado gera PDF, edita e exclui).
 */
/** Rótulo e cor do badge de status do fluxo de validação do POP (seção 10). */
function statusPopLabel(status: string): string {
  return status === "aprovado"
    ? "Aprovado"
    : status === "analisado"
      ? "Em aprovação"
      : "Proposto";
}
function statusPopClasse(status: string): string {
  return status === "aprovado"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "analisado"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-slate-100 text-slate-600 ring-slate-200";
}

export function PopsTable({
  linhasAnexadas,
  criados,
  loading,
  onReload,
  busca,
  areaPadrao,
  baixandoDocKey,
  onBaixarAnexado,
  criarOpen,
  onCriarOpenChange,
}: Props) {
  const [editing, setEditing] = useState<PopCriado | null>(null);
  const [excluir, setExcluir] = useState<PopCriado | null>(null);

  const linhas = useMemo<LinhaPop[]>(() => {
    const q = busca.trim().toLowerCase();
    const deAnexados: LinhaPop[] = linhasAnexadas.map((a) => ({
      tipo: "anexado",
      key: `anexado-${a.key}`,
      nome: a.nomeExibicao,
      contexto: a.processoNome,
      area: a.area,
      data: a.doc.data_documento
        ? a.doc.data_documento.split("-").reverse().join("/")
        : "—",
      anexado: a,
    }));
    const deCriados: LinhaPop[] = criados
      .filter((p) => {
        if (!q) return true;
        return [p.nome_processo, p.servico, p.area].some((c) =>
          (c || "").toLowerCase().includes(q),
        );
      })
      .map((p) => ({
        tipo: "criado",
        key: `criado-${p.id}`,
        nome: p.nome_processo || "—",
        contexto: p.servico || "—",
        area: p.area || "—",
        data: formatData(p.data_versao),
        pop: p,
      }));
    return [...deAnexados, ...deCriados].sort((a, b) =>
      a.nome.localeCompare(b.nome),
    );
  }, [linhasAnexadas, criados, busca]);

  const baixarPdf = async (p: PopCriado) => {
    try {
      const full = await popsCriadosApi.getById(p.id);
      await generatePopPDF(full);
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
      onReload();
    } catch {
      /* erro tratado no apiClient */
    }
  };

  const dialogos = (
    <>
      <PopCriadoDialog
        open={criarOpen || !!editing}
        onOpenChange={(o) => {
          if (o) return;
          setEditing(null);
          onCriarOpenChange(false);
        }}
        pop={editing}
        onSaved={onReload}
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
    </>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando POPs…
      </div>
    );
  }

  if (linhas.length === 0) {
    return (
      <>
        <div className="py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileText className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold">Nenhum POP encontrado</p>
          <p className="text-slate-500 text-sm mt-1">
            Anexe um POP a um processo ou use “Criar POP” para gerar um novo no
            padrão SGQ.
          </p>
        </div>
        {dialogos}
      </>
    );
  }

  const th =
    "px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600";

  return (
    <>
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className={`text-left ${th}`}>Documento</th>
              <th className={`text-left ${th}`}>Processo</th>
              <th className={`text-center ${th}`}>Área</th>
              <th className={`text-center ${th}`}>Data da Versão</th>
              <th className={`text-center ${th}`}>Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.key} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-3 text-left">
                  <div className="flex items-start gap-2 min-w-0">
                    <FileText
                      className={`h-4 w-4 mt-0.5 flex-shrink-0 ${l.tipo === "criado" ? "text-blue-500" : "text-slate-400"}`}
                    />
                    <div className="min-w-0">
                      <span className="block text-slate-900 font-medium truncate">
                        {l.nome}
                      </span>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                          l.tipo === "criado"
                            ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                            : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                        }`}
                      >
                        {l.tipo === "criado" ? "Criado no Kaizen" : "Anexado"}
                      </span>
                      {l.tipo === "criado" && l.pop?.status && (
                        <span
                          className={`ml-1 mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${statusPopClasse(l.pop.status)}`}
                        >
                          {statusPopLabel(l.pop.status)}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-left text-slate-700">
                  <span className="line-clamp-1">{l.contexto}</span>
                </td>
                <td className="px-5 py-3 text-center text-slate-700">
                  {l.area}
                </td>
                <td className="px-5 py-3 text-center text-slate-700 tabular-nums whitespace-nowrap">
                  {l.data}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {l.tipo === "anexado" ? (
                      <button
                        type="button"
                        onClick={() => onBaixarAnexado(l.anexado)}
                        disabled={baixandoDocKey === l.anexado.key}
                        title="Abrir documento (PDF)"
                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {baixandoDocKey === l.anexado.key ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => baixarPdf(l.pop)}
                          title="Gerar PDF do POP"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(l.pop)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluir(l.pop)}
                          title="Excluir"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
        <span className="text-xs text-slate-600">
          {linhas.length} POP{linhas.length === 1 ? "" : "s"} ·{" "}
          {linhas.filter((l) => l.tipo === "anexado").length} anexado
          {linhas.filter((l) => l.tipo === "anexado").length === 1 ? "" : "s"} ·{" "}
          {linhas.filter((l) => l.tipo === "criado").length} criado
          {linhas.filter((l) => l.tipo === "criado").length === 1 ? "" : "s"} no
          Kaizen
        </span>
      </div>

      {dialogos}
    </>
  );
}
