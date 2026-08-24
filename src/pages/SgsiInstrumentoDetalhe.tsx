import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, Loader2, ShieldCheck, Lock, ArrowLeft } from "lucide-react";
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
  SgsiInstrumento,
  SgsiTarefa,
  SgsiTarefaStatus,
} from "@/services/sgsiApi";

const STATUS: Record<SgsiTarefaStatus, { label: string; cls: string }> = {
  NAO_INICIADA: { label: "Não iniciada", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  EM_ANDAMENTO: { label: "Em andamento", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  CONCLUIDA: { label: "Concluída", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  ATRASADA: { label: "Atrasada", cls: "bg-red-50 text-red-600 ring-red-200" },
  BLOQUEADA: { label: "Bloqueada", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
};
const STATUS_ORDEM: SgsiTarefaStatus[] = [
  "NAO_INICIADA",
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "ATRASADA",
  "BLOQUEADA",
];

const pct = (v: number) => `${Math.round((v || 0) * 100)}%`;

export default function SgsiInstrumentoDetalhe() {
  const navigate = useNavigate();
  const { codigo = "" } = useParams();
  const [instrumento, setInstrumento] = useState<SgsiInstrumento | null>(null);
  const [tarefas, setTarefas] = useState<SgsiTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      sgsiApi.buscarInstrumento(codigo),
      sgsiApi.listarTarefas(codigo),
    ])
      .then(([inst, ts]) => {
        if (cancelled) return;
        setInstrumento(inst);
        setTarefas(ts);
      })
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [codigo]);

  const stats = useMemo(() => {
    const total = tarefas.length;
    const concl = tarefas.filter((t) => t.status === "CONCLUIDA").length;
    const prog =
      total === 0
        ? 0
        : Math.round(
            (tarefas.reduce((s, t) => s + (t.percentual || 0), 0) / total) * 100,
          );
    return { total, concl, prog };
  }, [tarefas]);

  const onTarefaAtualizada = (t: SgsiTarefa) =>
    setTarefas((prev) => prev.map((x) => (x.id === t.id ? t : x)));

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
              { label: instrumento?.sigla_oficial || codigo },
            ]}
          />

          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/seguranca-informacao/instrumentos")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Instrumentos
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando…
            </div>
          ) : !instrumento ? (
            <div className="py-24 text-center text-slate-500">
              Instrumento não encontrado.
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mt-4 mb-6 flex items-start gap-4">
                <div
                  className="w-1.5 h-14 rounded-full flex-shrink-0"
                  style={{ background: instrumento.cor_hex || "#1565C0" }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {instrumento.ordem === 0
                        ? "Norma basilar"
                        : `Instrumento ${instrumento.numeral_romano}`}
                    </span>
                    {instrumento.restrito && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        <Lock className="h-3 w-3" />
                        Restrito
                      </span>
                    )}
                  </div>
                  <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
                    <ShieldCheck className="h-6 w-6 flex-shrink-0 text-blue-600" />
                    {instrumento.sigla_oficial}
                  </h1>
                  <p className="text-sm text-slate-600">
                    {instrumento.nome_completo}
                  </p>
                  {instrumento.titulo_plano && (
                    <p className="mt-1 text-xs text-slate-400">
                      {instrumento.titulo_plano}
                    </p>
                  )}
                </div>
              </div>

              {/* Resumo do plano */}
              <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm">
                <span className="text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {stats.total}
                  </span>{" "}
                  tarefas
                </span>
                <span className="text-slate-600">
                  <span className="font-semibold text-emerald-600">
                    {stats.concl}
                  </span>{" "}
                  concluídas
                </span>
                <div className="flex flex-1 items-center gap-2 min-w-[160px]">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${stats.prog}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {stats.prog}%
                  </span>
                </div>
              </div>

              {/* Plano de trabalho 5W2H */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_150px_110px_90px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span className="text-center">#</span>
                  <span>Ação (What)</span>
                  <span>Responsável</span>
                  <span className="text-center">Status</span>
                  <span className="text-center">Progresso</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {tarefas.map((t) => (
                    <TarefaLinha
                      key={t.id}
                      tarefa={t}
                      aberta={expandida === t.id}
                      onToggle={() =>
                        setExpandida((cur) => (cur === t.id ? null : t.id))
                      }
                      onAtualizada={onTarefaAtualizada}
                    />
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function TarefaLinha({
  tarefa,
  aberta,
  onToggle,
  onAtualizada,
}: {
  tarefa: SgsiTarefa;
  aberta: boolean;
  onToggle: () => void;
  onAtualizada: (t: SgsiTarefa) => void;
}) {
  const st = STATUS[tarefa.status] ?? STATUS.NAO_INICIADA;
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
        className="grid grid-cols-[40px_1fr_150px_110px_90px] items-center gap-3 px-4 py-3 hover:bg-slate-50/60 cursor-pointer"
      >
        <span className="flex items-center justify-center text-slate-400">
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              aberta && "rotate-90",
            )}
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-800 truncate">{tarefa.oque}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
              {tarefa.fase}
            </span>
            <span>{tarefa.tipo}</span>
            <span>· M+{tarefa.inicio_m}–M+{tarefa.fim_m}</span>
          </p>
        </div>
        <span className="truncate text-sm text-slate-600">
          {tarefa.quem || "—"}
        </span>
        <div className="flex justify-center">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              st.cls,
            )}
          >
            {st.label}
          </span>
        </div>
        <span className="text-center text-sm tabular-nums text-slate-700">
          {pct(tarefa.percentual)}
        </span>
      </div>
      {aberta && <TarefaDetalhe tarefa={tarefa} onAtualizada={onAtualizada} />}
    </li>
  );
}

function TarefaDetalhe({
  tarefa,
  onAtualizada,
}: {
  tarefa: SgsiTarefa;
  onAtualizada: (t: SgsiTarefa) => void;
}) {
  const [status, setStatus] = useState<SgsiTarefaStatus>(tarefa.status);
  const [progresso, setProgresso] = useState<number>(
    Math.round((tarefa.percentual || 0) * 100),
  );
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const campos: [string, string | null][] = [
    ["Por quê (Why)", tarefa.porque],
    ["Onde (Where)", tarefa.onde],
    ["Como (How)", tarefa.como],
    ["Custo (How much)", tarefa.custo],
    ["Dados a levantar", tarefa.dados_levantar],
  ];

  const salvar = async () => {
    const p = Math.max(0, Math.min(100, Number(progresso) || 0));
    setSalvando(true);
    try {
      const upd = await sgsiApi.atualizarTarefa(tarefa.id, {
        status,
        percentual: p / 100,
        observacao,
      });
      onAtualizada(upd);
      setObservacao("");
      toast.success("Tarefa atualizada.");
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
          .map(([titulo, valor]) => (
            <div key={titulo}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                {titulo}
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {valor}
              </p>
            </div>
          ))}
      </div>

      {/* Editor de andamento */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Atualizar andamento
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_140px_1fr_auto] sm:items-end">
          <div>
            <Label className="mb-1.5 block">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SgsiTarefaStatus)}
            >
              <SelectTrigger className="h-9 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDEM.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Progresso (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={progresso}
              onChange={(e) => setProgresso(Number(e.target.value))}
              className="h-9"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Observação (opcional)</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Registro da mudança…"
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
