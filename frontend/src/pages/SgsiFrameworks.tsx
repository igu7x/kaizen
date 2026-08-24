import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, LayoutGrid, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  sgsiApi,
  SgsiFramework,
  SgsiFrameworkItem,
  SgsiAvaliacaoStatus,
} from "@/services/sgsiApi";

const AVALIACAO: Record<
  SgsiAvaliacaoStatus,
  { label: string; cls: string }
> = {
  NAO_AVALIADO: { label: "Não avaliado", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
  CONFORME: { label: "Conforme", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  PARCIALMENTE_CONFORME: { label: "Parcial", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  NAO_CONFORME: { label: "Não conforme", cls: "bg-red-50 text-red-600 ring-red-200" },
  NAO_APLICAVEL: { label: "Não aplicável", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};
const AVALIACAO_ORDEM: SgsiAvaliacaoStatus[] = [
  "NAO_AVALIADO",
  "CONFORME",
  "PARCIALMENTE_CONFORME",
  "NAO_CONFORME",
  "NAO_APLICAVEL",
];

export default function SgsiFrameworks() {
  const [frameworks, setFrameworks] = useState<SgsiFramework[]>([]);
  const [sel, setSel] = useState<string>("");
  const [itens, setItens] = useState<SgsiFrameworkItem[]>([]);
  const [loadingFw, setLoadingFw] = useState(true);
  const [loadingItens, setLoadingItens] = useState(false);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    sgsiApi
      .listarFrameworks()
      .then((fw) => {
        setFrameworks(fw);
        if (fw.length) setSel(fw[0].codigo);
      })
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoadingFw(false));
  }, []);

  useEffect(() => {
    if (!sel) return;
    setLoadingItens(true);
    setBusca("");
    setAberta(null);
    sgsiApi
      .listarItensFramework(sel)
      .then(setItens)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoadingItens(false));
  }, [sel]);

  const frameworkAtual = frameworks.find((f) => f.codigo === sel);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((i) =>
      [i.item_id, i.nome, i.instrumentos].some((c) =>
        (c || "").toLowerCase().includes(q),
      ),
    );
  }, [itens, busca]);

  const onAvaliado = (item: SgsiFrameworkItem) =>
    setItens((prev) => prev.map((x) => (x.id === item.id ? item : x)));

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Sistema de Gestão da Segurança da Informação",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Frameworks" },
            ]}
          />

          {/* Header */}
          <div className="mt-4 mb-6 flex items-center gap-4">
            <div
              className="w-1.5 h-12 rounded-full"
              style={{
                background: "linear-gradient(180deg, #0A2547 0%, #1565C0 100%)",
              }}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">
                Sistema de Gestão da Segurança da Informação
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <LayoutGrid className="h-6 w-6 text-blue-600" />
                Frameworks de Governança
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Aderência dos instrumentos normativos aos frameworks CIS, NIST,
                ISO/IEC 27001 e 27002, COBIT e LGPD.
              </p>
            </div>
          </div>

          {/* Seletor de frameworks */}
          {loadingFw ? (
            <div className="flex items-center py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando frameworks…
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap gap-2">
                {frameworks.map((f) => (
                  <button
                    key={f.codigo}
                    type="button"
                    onClick={() => setSel(f.codigo)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-all",
                      sel === f.codigo
                        ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        sel === f.codigo ? "text-blue-700" : "text-slate-800",
                      )}
                    >
                      {f.nome}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {f.total_itens} itens · {f.avaliados} avaliados ·{" "}
                      {f.conformes} conformes
                    </p>
                  </button>
                ))}
              </div>

              {frameworkAtual?.descricao && (
                <p className="mb-4 text-sm text-slate-500">
                  {frameworkAtual.descricao}
                </p>
              )}

              {/* Busca */}
              <div className="relative mb-3 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar item ou instrumento…"
                  className="pl-9"
                />
              </div>

              {/* Itens */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="grid grid-cols-[32px_90px_1fr_150px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span></span>
                  <span>Item</span>
                  <span>Controle</span>
                  <span className="text-center">Avaliação</span>
                </div>

                {loadingItens ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando itens…
                  </div>
                ) : filtrados.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    Nenhum item para a busca.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filtrados.map((it) => (
                      <ItemLinha
                        key={it.id}
                        item={it}
                        aberta={aberta === it.id}
                        onToggle={() =>
                          setAberta((cur) => (cur === it.id ? null : it.id))
                        }
                        onAvaliado={onAvaliado}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ItemLinha({
  item,
  aberta,
  onToggle,
  onAvaliado,
}: {
  item: SgsiFrameworkItem;
  aberta: boolean;
  onToggle: () => void;
  onAvaliado: (i: SgsiFrameworkItem) => void;
}) {
  const av = AVALIACAO[item.avaliacao_status] ?? AVALIACAO.NAO_AVALIADO;
  const instrumentos = (item.instrumentos || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={aberta}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="grid grid-cols-[32px_90px_1fr_150px] items-center gap-3 px-4 py-3 hover:bg-slate-50/60 cursor-pointer"
      >
        <span className="flex items-center justify-center text-slate-400">
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", aberta && "rotate-90")}
          />
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-center text-xs font-semibold text-slate-600">
          {item.item_id}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-800">{item.nome}</p>
          {instrumentos.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {instrumentos.map((s) => (
                <span
                  key={s}
                  className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-center">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              av.cls,
            )}
          >
            {av.label}
          </span>
        </div>
      </div>
      {aberta && <ItemDetalhe item={item} onAvaliado={onAvaliado} />}
    </li>
  );
}

function ItemDetalhe({
  item,
  onAvaliado,
}: {
  item: SgsiFrameworkItem;
  onAvaliado: (i: SgsiFrameworkItem) => void;
}) {
  const [status, setStatus] = useState<SgsiAvaliacaoStatus>(
    item.avaliacao_status,
  );
  const [obs, setObs] = useState(item.avaliacao_observacao ?? "");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      const upd = await sgsiApi.avaliarItemFramework(item.id, {
        status,
        observacao: obs,
      });
      onAvaliado(upd);
      toast.success("Avaliação registrada.");
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 pl-11">
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.nome}</p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Avaliação de conformidade
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr_auto] sm:items-end">
          <div>
            <Label className="mb-1.5 block">Situação</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SgsiAvaliacaoStatus)}
            >
              <SelectTrigger className="h-9 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVALIACAO_ORDEM.map((s) => (
                  <SelectItem key={s} value={s}>
                    {AVALIACAO[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Observação (opcional)</Label>
            <Input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Justificativa, evidência…"
              className="h-9"
            />
          </div>
          <Button
            onClick={salvar}
            disabled={salvando}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
