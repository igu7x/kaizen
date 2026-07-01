import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { pcaApi } from "@/services/pcaApi";
import { cicloOrcamentarioApi } from "@/services/cicloOrcamentarioApi";
import type { PcaItem } from "@/types";
import { MESES_ORDENADOS } from "@/types";

const STATUS_OPCOES = ["Não Iniciada", "Em andamento", "Concluída"];
const TODAS = "todas";

function formatBRL(v: number | null | undefined): string {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface EdicaoState {
  objeto: string;
  valor_estimado: string;
  status: string;
  data_estimada_contratacao: string;
}

/**
 * RF-62..69 — edição dos itens do PCA-TIC durante uma Revisão aberta. Lista os itens do exercício
 * vigente (filtráveis por área) e permite editar os campos revisáveis quando a janela está ativa;
 * fora da janela a lista fica somente leitura. O backend valida o estado da revisão.
 */
export function RevisaoItens({
  anoVigente,
  editavel,
}: {
  anoVigente: number;
  editavel: boolean;
}) {
  const [itens, setItens] = useState<PcaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [area, setArea] = useState<string>(TODAS);
  const [editando, setEditando] = useState<PcaItem | null>(null);
  const [form, setForm] = useState<EdicaoState | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setItens(await pcaApi.getPcaItems(anoVigente));
    } catch {
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [anoVigente]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const areas = useMemo(
    () => Array.from(new Set(itens.map((i) => i.area_demandante).filter(Boolean))).sort(),
    [itens],
  );

  const visiveis = useMemo(
    () => (area === TODAS ? itens : itens.filter((i) => i.area_demandante === area)),
    [itens, area],
  );

  const abrirEdicao = (item: PcaItem) => {
    setEditando(item);
    setForm({
      objeto: item.objeto || "",
      valor_estimado: String(item.valor_estimado ?? ""),
      status: typeof item.status === "string" ? item.status : "Não Iniciada",
      data_estimada_contratacao: item.data_estimada_contratacao || "",
    });
  };

  const salvar = async () => {
    if (!editando || !form) return;
    setSalvando(true);
    try {
      const atualizado = await cicloOrcamentarioApi.editarItemRevisao(editando.id, {
        objeto: form.objeto,
        valor_estimado: Number(form.valor_estimado) || 0,
        status: form.status,
        data_estimada_contratacao: form.data_estimada_contratacao || undefined,
      });
      setItens((prev) => prev.map((i) => (i.id === atualizado.id ? { ...i, ...atualizado } : i)));
      toast.success("Item revisado.");
      setEditando(null);
      setForm(null);
    } catch {
      toast.error("Não foi possível salvar (revisão precisa estar aberta).");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Itens do PCA-TIC {anoVigente}
          {!editavel && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-slate-400">
              <Lock className="h-3 w-3" /> somente leitura (fora da janela)
            </span>
          )}
        </h3>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-[220px] h-9 bg-white">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">Nenhum item para o exercício.</p>
      ) : (
        <div className="space-y-1.5">
          {visiveis.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <Badge variant="outline" className="shrink-0 font-mono text-xs bg-white border-slate-300 text-slate-600">
                {item.item_pca}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 truncate">{item.objeto || "—"}</p>
                <p className="text-xs text-slate-500">
                  {item.area_demandante} · {item.data_estimada_contratacao || "—"} ·{" "}
                  {typeof item.status === "string" ? item.status : "—"}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-800">
                {formatBRL(item.valor_estimado)}
              </span>
              {editavel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => abrirEdicao(item)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Editar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={editando != null} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              Revisar item {editando?.item_pca}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Objeto</label>
                <Input
                  value={form.objeto}
                  onChange={(e) => setForm({ ...form, objeto: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Valor estimado (R$)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_estimado}
                    onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Mês estimado</label>
                  <Select
                    value={form.data_estimada_contratacao || ""}
                    onValueChange={(v) => setForm({ ...form, data_estimada_contratacao: v })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES_ORDENADOS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Status</label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar revisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
