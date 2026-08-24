import { useEffect, useState } from "react";
import { Loader2, Workflow, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  sgsiApi,
  SgsiProcesso,
  SgsiProcessoDetalhe,
  SgsiProcessoNode,
  SgsiProcessoFlow,
} from "@/services/sgsiApi";

export default function SgsiProcessos() {
  const [processos, setProcessos] = useState<SgsiProcesso[]>([]);
  const [sel, setSel] = useState<string>("");
  const [detalhe, setDetalhe] = useState<SgsiProcessoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDet, setLoadingDet] = useState(false);

  useEffect(() => {
    sgsiApi
      .listarProcessos()
      .then((ps) => {
        setProcessos(ps);
        if (ps.length) setSel(ps[0].id);
      })
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!sel) return;
    setLoadingDet(true);
    sgsiApi
      .buscarProcesso(sel)
      .then(setDetalhe)
      .catch(() => setDetalhe(null))
      .finally(() => setLoadingDet(false));
  }, [sel]);

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Sistema de Gestão da Segurança da Informação",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Processos" },
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
                <Workflow className="h-6 w-6 text-blue-600" />
                Processos (BPMN)
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Fluxos de negócio instituídos pelos instrumentos normativos, em
                notação de raias.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando processos…
            </div>
          ) : (
            <>
              {/* Seletor de processos */}
              <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {processos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSel(p.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-all",
                      sel === p.id
                        ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-slate-500">
                        {p.id}
                      </span>
                      {p.restrito && <Lock className="h-3 w-3 text-amber-600" />}
                    </div>
                    <p
                      className={cn(
                        "text-sm leading-tight",
                        sel === p.id
                          ? "font-semibold text-blue-700"
                          : "text-slate-800",
                      )}
                    >
                      {p.nome}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {p.instrumento_sigla || "—"}
                    </p>
                  </button>
                ))}
              </div>

              {/* Diagrama */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                {loadingDet || !detalhe ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando diagrama…
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <h2 className="text-base font-semibold text-slate-800">
                        {detalhe.nome}
                      </h2>
                      {detalhe.referencia && (
                        <p className="text-xs text-slate-500">
                          {detalhe.referencia}
                        </p>
                      )}
                    </div>
                    <Legenda />
                    <div className="mt-3 overflow-x-auto">
                      <ProcessoDiagrama
                        lanes={detalhe.lanes}
                        nodes={detalhe.nodes}
                        flows={detalhe.flows}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Legenda() {
  const itens: [string, string][] = [
    ["Início", "#dcfce7"],
    ["Tarefa", "#dbeafe"],
    ["Decisão", "#fef3c7"],
    ["Fim", "#fee2e2"],
  ];
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
      {itens.map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm border border-slate-300"
            style={{ background: c }}
          />
          {l}
        </span>
      ))}
    </div>
  );
}

const ESTILO: Record<
  SgsiProcessoNode["t"],
  { fill: string; stroke: string; text: string; rx: number }
> = {
  start: { fill: "#dcfce7", stroke: "#4ade80", text: "#166534", rx: 26 },
  task: { fill: "#dbeafe", stroke: "#93c5fd", text: "#1e3a8a", rx: 10 },
  gw: { fill: "#fef3c7", stroke: "#fcd34d", text: "#92400e", rx: 10 },
  end: { fill: "#fee2e2", stroke: "#fca5a5", text: "#991b1b", rx: 26 },
};

function ProcessoDiagrama({
  lanes,
  nodes,
  flows,
}: {
  lanes: string[];
  nodes: SgsiProcessoNode[];
  flows: SgsiProcessoFlow[];
}) {
  const labelW = 140;
  const colW = 200;
  const laneH = 108;
  const nodeW = 158;
  const nodeH = 58;
  const top = 8;

  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const width = labelW + Math.max(nodes.length, 1) * colW + 12;
  const height = top + Math.max(lanes.length, 1) * laneH + 12;

  const cx = (i: number) => labelW + i * colW + colW / 2;
  const cy = (l: number) => top + l * laneH + laneH / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="max-w-none"
    >
      <defs>
        <marker
          id="sgsi-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
      </defs>

      {/* Raias */}
      {lanes.map((lane, l) => (
        <g key={l}>
          <rect
            x={0}
            y={top + l * laneH}
            width={width}
            height={laneH}
            fill={l % 2 ? "#f8fafc" : "#ffffff"}
            stroke="#e2e8f0"
          />
          <rect
            x={0}
            y={top + l * laneH}
            width={labelW}
            height={laneH}
            fill="#f1f5f9"
            stroke="#e2e8f0"
          />
          <foreignObject x={6} y={top + l * laneH} width={labelW - 12} height={laneH}>
            <div className="flex h-full items-center text-xs font-semibold leading-tight text-slate-600">
              {lane}
            </div>
          </foreignObject>
        </g>
      ))}

      {/* Fluxos */}
      {flows.map((f, i) => {
        const si = idx.get(f[0]);
        const ti = idx.get(f[1]);
        if (si == null || ti == null) return null;
        const label = f[2];
        const sNode = nodes[si];
        const tNode = nodes[ti];
        let d: string;
        let lx: number;
        let ly: number;
        if (ti > si) {
          const sx = cx(si) + nodeW / 2;
          const sy = cy(sNode.l);
          const tx = cx(ti) - nodeW / 2;
          const ty = cy(tNode.l);
          const mx = (sx + tx) / 2;
          d = `M ${sx} ${sy} H ${mx} V ${ty} H ${tx}`;
          lx = sx + 8;
          ly = sy - 6;
        } else {
          // aresta de retorno: desce, volta pela parte de baixo da raia e sobe
          const sBottom = cy(sNode.l) + nodeH / 2;
          const tBottom = cy(tNode.l) + nodeH / 2;
          const yBase = Math.max(cy(sNode.l), cy(tNode.l)) + nodeH / 2 + 22;
          d = `M ${cx(si)} ${sBottom} V ${yBase} H ${cx(ti)} V ${tBottom}`;
          lx = (cx(si) + cx(ti)) / 2;
          ly = yBase - 6;
        }
        return (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.5}
              markerEnd="url(#sgsi-arrow)"
            />
            {label && (
              <text
                x={lx}
                y={ly}
                fontSize={10}
                fontWeight={600}
                fill="#64748b"
                className="select-none"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nós */}
      {nodes.map((n, i) => {
        const st = ESTILO[n.t] ?? ESTILO.task;
        const x = cx(i) - nodeW / 2;
        const y = cy(n.l) - nodeH / 2;
        return (
          <g key={n.id}>
            <rect
              x={x}
              y={y}
              width={nodeW}
              height={nodeH}
              rx={st.rx}
              fill={st.fill}
              stroke={st.stroke}
              strokeWidth={1.5}
            />
            <foreignObject x={x + 6} y={y + 4} width={nodeW - 12} height={nodeH - 8}>
              <div
                className="flex h-full items-center justify-center text-center text-[11px] font-medium leading-tight"
                style={{ color: st.text }}
              >
                {n.n}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
