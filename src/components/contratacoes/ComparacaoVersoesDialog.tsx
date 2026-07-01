import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, GitCompare, Minus, PencilLine, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  formatCurrency,
  getPcaComparison,
  type PcaComparacao,
  type PcaItemAlterado,
} from "@/services/pcaApi";
import type { PcaItem } from "@/types";
import { cn } from "@/lib/utils";

interface ComparacaoVersoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ano: number;
  /** Versões (snapshots) disponíveis do ano. A "versão viva/atual" é representada por `undefined`. */
  versionsList: number[];
}

/** Valor especial no Select que representa a versão viva (não publicada). */
const ATUAL = "atual";

const CAMPO_LABEL: Record<string, string> = {
  objeto: "Objeto",
  valor_estimado: "Valor estimado",
  status: "Status",
  area_demandante: "Área demandante",
  tipo: "Tipo",
  data_estimada_contratacao: "Data estimada",
};

function rotuloVersao(v: number | undefined, versionsList: number[]): string {
  if (v === undefined) {
    const atual = versionsList.length > 0 ? Math.max(...versionsList) + 1 : 1;
    return `Versão ${atual} (atual)`;
  }
  return `Versão ${v}`;
}

function formatCampo(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (campo === "valor_estimado") return formatCurrency(Number(valor) || 0);
  return String(valor);
}

/**
 * RF-54 — Comparação entre duas versões do PCA-TIC. Escolhe-se a versão "nova" e a "anterior";
 * o backend casa os itens pelo código e devolve incluídos / excluídos / alterados (com de→para).
 */
export function ComparacaoVersoesDialog({
  open,
  onOpenChange,
  ano,
  versionsList,
}: ComparacaoVersoesDialogProps) {
  // Padrão: nova = versão atual (viva); anterior = maior snapshot publicado (se houver).
  const maiorSnapshot = versionsList.length > 0 ? Math.max(...versionsList) : undefined;
  const [versaoNova, setVersaoNova] = useState<number | undefined>(undefined);
  const [versaoAntiga, setVersaoAntiga] = useState<number | undefined>(maiorSnapshot);
  const [data, setData] = useState<PcaComparacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await getPcaComparison(ano, versaoNova, versaoAntiga);
      setData(res);
    } catch {
      setErro("Não foi possível carregar a comparação.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ano, versaoNova, versaoAntiga]);

  useEffect(() => {
    if (open) carregar();
  }, [open, carregar]);

  const opcoes = useMemo(
    () => [ATUAL, ...[...versionsList].sort((a, b) => b - a).map(String)],
    [versionsList],
  );

  const parse = (v: string): number | undefined => (v === ATUAL ? undefined : parseInt(v, 10));
  const mesmaVersao = versaoNova === versaoAntiga;

  const resumo = data
    ? [
        { rotulo: "Incluídos", valor: data.incluidos.length, cor: "text-green-600" },
        { rotulo: "Alterados", valor: data.alterados.length, cor: "text-amber-600" },
        { rotulo: "Excluídos", valor: data.excluidos.length, cor: "text-red-600" },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-800">
            <GitCompare className="h-5 w-5 text-blue-600" />
            Comparar versões do PCA-TIC {ano}
          </DialogTitle>
        </DialogHeader>

        {/* Seletores de versão */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Versão anterior</label>
            <Select
              value={versaoAntiga === undefined ? ATUAL : String(versaoAntiga)}
              onValueChange={(v) => setVersaoAntiga(parse(v))}
            >
              <SelectTrigger className="w-[180px] h-9 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((o) => (
                  <SelectItem key={`a-${o}`} value={o}>
                    {rotuloVersao(parse(o), versionsList)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="h-5 w-5 text-gray-400 mb-2" />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Versão nova</label>
            <Select
              value={versaoNova === undefined ? ATUAL : String(versaoNova)}
              onValueChange={(v) => setVersaoNova(parse(v))}
            >
              <SelectTrigger className="w-[180px] h-9 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((o) => (
                  <SelectItem key={`n-${o}`} value={o}>
                    {rotuloVersao(parse(o), versionsList)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data && !mesmaVersao && (
            <div className="ml-auto flex gap-4 text-sm mb-1">
              {resumo.map((r) => (
                <span key={r.rotulo} className="font-medium text-gray-600">
                  <span className={cn("font-bold", r.cor)}>{r.valor}</span> {r.rotulo}
                </span>
              ))}
            </div>
          )}
        </div>

        {mesmaVersao && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Selecione duas versões diferentes para comparar.
          </p>
        )}

        <ScrollArea className="h-[420px] pr-3 -mr-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : erro ? (
            <p className="text-sm text-red-600 py-8 text-center">{erro}</p>
          ) : data && !mesmaVersao ? (
            <div className="space-y-6">
              <SecaoItens
                titulo="Itens incluídos"
                icone={<Plus className="h-4 w-4" />}
                cor="green"
                itens={data.incluidos}
              />
              <SecaoAlterados alterados={data.alterados} />
              <SecaoItens
                titulo="Itens excluídos"
                icone={<Minus className="h-4 w-4" />}
                cor="red"
                itens={data.excluidos}
              />
              {data.incluidos.length === 0 &&
                data.alterados.length === 0 &&
                data.excluidos.length === 0 && (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    Nenhuma diferença entre as versões selecionadas.
                  </p>
                )}
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const COR_SECAO: Record<string, { header: string; badge: string }> = {
  green: { header: "text-green-700", badge: "bg-green-100 text-green-700 border-green-200" },
  red: { header: "text-red-700", badge: "bg-red-100 text-red-700 border-red-200" },
};

function SecaoItens({
  titulo,
  icone,
  cor,
  itens,
}: {
  titulo: string;
  icone: React.ReactNode;
  cor: "green" | "red";
  itens: PcaItem[];
}) {
  if (itens.length === 0) return null;
  const c = COR_SECAO[cor];
  return (
    <section>
      <h3 className={cn("flex items-center gap-2 text-sm font-semibold mb-2", c.header)}>
        {icone} {titulo} ({itens.length})
      </h3>
      <div className="space-y-1.5">
        {itens.map((item) => (
          <div
            key={item.item_pca}
            className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <Badge variant="outline" className={cn("shrink-0 font-mono text-xs", c.badge)}>
              {item.item_pca}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800 truncate">{item.objeto || "—"}</p>
              <p className="text-xs text-gray-500">
                {item.area_demandante} · {formatCurrency(Number(item.valor_estimado) || 0)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SecaoAlterados({ alterados }: { alterados: PcaItemAlterado[] }) {
  if (alterados.length === 0) return null;
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-2 text-amber-700">
        <PencilLine className="h-4 w-4" /> Itens alterados ({alterados.length})
      </h3>
      <div className="space-y-2">
        {alterados.map((item) => (
          <div
            key={item.item_pca}
            className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Badge
                variant="outline"
                className="shrink-0 font-mono text-xs bg-amber-100 text-amber-700 border-amber-200"
              >
                {item.item_pca}
              </Badge>
              <span className="text-sm text-gray-800 truncate">{item.objeto || "—"}</span>
            </div>
            <ul className="space-y-1 pl-1">
              {item.mudancas.map((m) => (
                <li key={m.campo} className="text-xs text-gray-600 flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-gray-500">
                    {CAMPO_LABEL[m.campo] ?? m.campo}:
                  </span>
                  <span className="line-through text-red-500">{formatCampo(m.campo, m.de)}</span>
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                  <span className="text-green-600 font-medium">{formatCampo(m.campo, m.para)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
