import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Gauge, Search } from "lucide-react";
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
import { sgsiApi, SgsiIndicador, SgsiMedicao } from "@/services/sgsiApi";

const TODOS = "__todos__";

type Semaforo = "verde" | "amarelo" | "vermelho" | "sem_meta" | "sem_medicao";

function semaforo(i: SgsiIndicador): Semaforo {
  if (i.meta == null) return "sem_meta";
  if (i.ultimo_valor == null) return "sem_medicao";
  const v = i.ultimo_valor;
  const meta = i.meta;
  const tol = i.tolerancia ?? meta;
  if (i.direcao === ">=") {
    if (v >= meta) return "verde";
    if (v >= tol) return "amarelo";
    return "vermelho";
  }
  if (v <= meta) return "verde";
  if (v <= tol) return "amarelo";
  return "vermelho";
}

const SEMAFORO_META: Record<Semaforo, { label: string; dot: string; text: string }> = {
  verde: { label: "Na meta", dot: "bg-emerald-500", text: "text-emerald-700" },
  amarelo: { label: "Em tolerância", dot: "bg-amber-500", text: "text-amber-700" },
  vermelho: { label: "Fora da meta", dot: "bg-red-500", text: "text-red-600" },
  sem_meta: { label: "Sem meta", dot: "bg-slate-300", text: "text-slate-500" },
  sem_medicao: { label: "Sem medição", dot: "bg-slate-300", text: "text-slate-500" },
};

const fmtVal = (v: number | null | undefined, unidade?: string) =>
  v == null ? "—" : `${Number.isInteger(v) ? v : v.toFixed(2)}${unidade === "%" ? "%" : unidade ? ` ${unidade}` : ""}`;

export default function SgsiIndicadores() {
  const [inds, setInds] = useState<SgsiIndicador[]>([]);
  const [loading, setLoading] = useState(true);
  const [fInstr, setFInstr] = useState(TODOS);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    sgsiApi
      .listarIndicadores()
      .then(setInds)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }, []);

  const instrumentos = useMemo(() => {
    const map = new Map<string, string>();
    inds.forEach((i) => {
      if (i.instrumento_codigo)
        map.set(i.instrumento_codigo, i.instrumento_sigla || i.instrumento_codigo);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [inds]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return inds.filter((i) => {
      if (fInstr !== TODOS && i.instrumento_codigo !== fInstr) return false;
      if (
        q &&
        ![i.nome, i.referencia, i.responsavel].some((c) =>
          (c || "").toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
  }, [inds, fInstr, busca]);

  const stats = useMemo(() => {
    const comMeta = inds.filter((i) => i.meta != null).length;
    return { total: inds.length, comMeta, semMeta: inds.length - comMeta };
  }, [inds]);

  const patchIndicador = (id: number, patch: Partial<SgsiIndicador>) =>
    setInds((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

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
              { label: "Indicadores" },
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
                <Gauge className="h-6 w-6 text-blue-600" />
                Indicadores
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                {stats.total} indicadores · {stats.comMeta} com meta pactuada ·{" "}
                {stats.semMeta} aguardando deliberação do CGSI.
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Instrumento
              </label>
              <Select value={fInstr} onValueChange={setFInstr}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os instrumentos</SelectItem>
                  {instrumentos.map(([codigo, sigla]) => (
                    <SelectItem key={codigo} value={codigo}>
                      {sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col lg:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, referência, responsável…"
                  className="pl-9 h-10 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[32px_1fr_110px_120px_140px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span></span>
              <span>Indicador</span>
              <span>Instrumento</span>
              <span className="text-center">Meta</span>
              <span>Situação</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando indicadores…
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <Gauge className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm">
                  Nenhum indicador para os filtros selecionados.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtrados.map((i) => (
                  <IndicadorLinha
                    key={i.id}
                    ind={i}
                    aberta={aberta === i.id}
                    onToggle={() =>
                      setAberta((cur) => (cur === i.id ? null : i.id))
                    }
                    onPatch={patchIndicador}
                  />
                ))}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {filtrados.length} de {inds.length} indicadores
          </p>
        </div>
      </div>
    </Layout>
  );
}

function IndicadorLinha({
  ind,
  aberta,
  onToggle,
  onPatch,
}: {
  ind: SgsiIndicador;
  aberta: boolean;
  onToggle: () => void;
  onPatch: (id: number, patch: Partial<SgsiIndicador>) => void;
}) {
  const sem = SEMAFORO_META[semaforo(ind)];
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
        className="grid grid-cols-[32px_1fr_110px_120px_140px] items-center gap-3 px-4 py-3 hover:bg-slate-50/60 cursor-pointer"
      >
        <span className="flex items-center justify-center text-slate-400">
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", aberta && "rotate-90")}
          />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-800">{ind.nome}</p>
          {ind.ultima_competencia && (
            <p className="text-[11px] text-slate-400">
              último: {fmtVal(ind.ultimo_valor, ind.unidade)} ·{" "}
              {ind.ultima_competencia}
            </p>
          )}
        </div>
        <span className="truncate text-sm text-slate-600">
          {ind.instrumento_sigla || ind.instrumento_codigo || "—"}
        </span>
        <span className="text-center text-sm tabular-nums text-slate-700">
          {ind.meta == null
            ? "—"
            : `${ind.direcao} ${fmtVal(ind.meta, ind.unidade)}`}
        </span>
        <span
          className={cn("flex items-center gap-1.5 text-xs font-medium", sem.text)}
        >
          <span className={cn("h-2.5 w-2.5 rounded-full", sem.dot)} />
          {sem.label}
        </span>
      </div>
      {aberta && <IndicadorDetalhe ind={ind} onPatch={onPatch} />}
    </li>
  );
}

function IndicadorDetalhe({
  ind,
  onPatch,
}: {
  ind: SgsiIndicador;
  onPatch: (id: number, patch: Partial<SgsiIndicador>) => void;
}) {
  const [medicoes, setMedicoes] = useState<SgsiMedicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [competencia, setCompetencia] = useState("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancel = false;
    sgsiApi
      .listarMedicoes(ind.id)
      .then((m) => !cancel && setMedicoes(m))
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => !cancel && setCarregando(false));
    return () => {
      cancel = true;
    };
  }, [ind.id]);

  const campos: [string, string | null][] = [
    ["Referência normativa", ind.referencia],
    ["Responsável", ind.responsavel],
    ["Fórmula", ind.formula],
    [
      "Meta",
      ind.meta == null
        ? "Aguardando deliberação do CGSI"
        : `${ind.direcao} ${fmtVal(ind.meta, ind.unidade)}${ind.tolerancia != null ? ` (tolerância ${fmtVal(ind.tolerancia, ind.unidade)})` : ""}`,
    ],
    ["Frequência", ind.frequencia],
    ["Unidade", ind.unidade],
  ];

  const registrar = async () => {
    if (!/^\d{4}-\d{2}$/.test(competencia.trim())) {
      toast.error("Competência no formato AAAA-MM.");
      return;
    }
    if (valor.trim() === "" || Number.isNaN(Number(valor))) {
      toast.error("Informe um valor numérico.");
      return;
    }
    setSalvando(true);
    try {
      const m = await sgsiApi.registrarMedicao(ind.id, {
        competencia: competencia.trim(),
        valor: Number(valor),
        observacao: obs,
      });
      setMedicoes((prev) => {
        const semAtual = prev.filter((x) => x.competencia !== m.competencia);
        return [m, ...semAtual].sort((a, b) =>
          b.competencia.localeCompare(a.competencia),
        );
      });
      // Atualiza o "último" na linha se esta é a competência mais recente.
      if (!ind.ultima_competencia || m.competencia >= ind.ultima_competencia) {
        onPatch(ind.id, {
          ultimo_valor: m.valor,
          ultima_competencia: m.competencia,
          ultima_data: m.data_referencia,
        });
      }
      setCompetencia("");
      setValor("");
      setObs("");
      toast.success("Medição registrada.");
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 pl-11">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {campos
          .filter(([, v]) => v && v.trim())
          .map(([titulo, v]) => (
            <div key={titulo}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                {titulo}
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{v}</p>
            </div>
          ))}
      </div>

      {/* Medições */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Medições
        </p>

        {carregando ? (
          <div className="flex items-center py-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
          </div>
        ) : medicoes.length === 0 ? (
          <p className="text-sm text-slate-400 mb-3">
            Nenhuma medição registrada ainda.
          </p>
        ) : (
          <div className="mb-3 flex flex-wrap gap-2">
            {medicoes.map((m) => (
              <span
                key={m.id}
                title={m.observacao || undefined}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
              >
                <span className="font-medium">{m.competencia}</span>
                <span className="text-slate-400">·</span>
                <span className="tabular-nums">
                  {fmtVal(m.valor, ind.unidade)}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Registrar */}
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[140px_140px_1fr_auto] sm:items-end">
          <div>
            <Label className="mb-1.5 block">Competência</Label>
            <Input
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              placeholder="AAAA-MM"
              className="h-9"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">
              Valor {ind.unidade ? `(${ind.unidade})` : ""}
            </Label>
            <Input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Observação (opcional)</Label>
            <Input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            onClick={registrar}
            disabled={salvando}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Registrar
          </Button>
        </div>
      </div>
    </div>
  );
}
