import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Workflow,
  Plus,
  Loader2,
  FileText,
  Layers,
  ListChecks,
  GitBranch,
  ChevronRight,
  Search,
  Briefcase,
  History,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  processosNegocioApi,
  ProcessoNegocio,
  temFluxograma,
  temDocumentoPrimario,
  isK1,
  isVigente,
  isRevisaoOuNovo,
  proximaRevisao,
} from "@/services/processosNegocioApi";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProcessoFormDialog } from "@/components/processos/ProcessoFormDialog";
import { ProcessoDetalhe } from "@/components/processos/ProcessoDetalhe";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ============================================================
// MATURIDADE — 3 níveis. "Mapeado" = processo cadastrado (sempre); todo processo é no
// mínimo Mapeado. Estruturado exige fluxograma + POP; Otimizado exige fluxograma + POP + MPS.
// ============================================================
const MATURIDADE_LABEL: Record<1 | 2 | 3, string> = {
  1: "Nível 1 - Mapeado",
  2: "Nível 2 - Estruturado",
  3: "Nível 3 - Otimizado",
};
const MATURIDADE_DESC: Record<1 | 2 | 3, string> = {
  1: "(Cadastrado)",
  2: "(Fluxograma + POP)",
  3: "(Fluxograma + POP + MPS)",
};
const MATURIDADE_COLOR: Record<1 | 2 | 3, string> = {
  1: "#8b5cf6",
  2: "#3b82f6",
  3: "#10b981",
};

// Paleta do donut "por área" (agrupado por diretoria).
const DIRETORIA_COLORS = [
  "#3b82f6",
  "#7c3aed",
  "#f59e0b",
  "#10b981",
  "#1e3a8a",
  "#ec4899",
];

// Baldes do gráfico "Próximas revisões por período" (Vencidos primeiro).
const PERIODO_BUCKETS = [
  "Vencidos",
  "Até 90 dias",
  "91 – 180 dias",
  "+ de 180 dias",
] as const;
type PeriodoBucket = (typeof PERIODO_BUCKETS)[number];
const PERIODO_COLORS: Record<PeriodoBucket, string> = {
  Vencidos: "#ef4444",
  "Até 90 dias": "#10b981",
  "91 – 180 dias": "#7c3aed",
  "+ de 180 dias": "#f59e0b",
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Maturidade a partir dos artefatos. Todo processo é no mínimo "Mapeado".
 *  Otimizado: fluxograma + POP + MPS
 *  Estruturado: fluxograma + POP
 *  Mapeado: o resto
 */
function maturidadeOf(p: ProcessoNegocio): 1 | 2 | 3 {
  const docs = p.documentos_anexados || [];
  const hasPop = docs.some((d) => d.tipo === "POP");
  const hasMps = docs.some((d) => d.tipo === "MPS");
  const hasFlux = temFluxograma(p);
  if (hasFlux && hasPop && hasMps) return 3;
  if (hasFlux && hasPop) return 2;
  return 1;
}

/** Balde da próxima revisão. Sem período → null (não conta); vencidas entram em "Vencidos". */
function periodoRevisaoOf(p: ProcessoNegocio): PeriodoBucket | null {
  const next = proximaRevisao(p);
  if (!next) return null;
  const dias = Math.ceil((next.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (dias < 0) return "Vencidos";
  if (dias <= 90) return "Até 90 dias";
  if (dias <= 180) return "91 – 180 dias";
  return "+ de 180 dias";
}

function formatDateShort(d: string | null | undefined | Date) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("pt-BR");
}

/** Formata a Data da Versão (periodo, "YYYY-MM-DD") como DD/MM/AAAA sem deslocar fuso. */
function formatDataVersao(periodo: string | null | undefined) {
  if (!periodo) return "—";
  const m = periodo.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : periodo;
}

// ============================================================
// HOOK DE ANIMAÇÃO — sweep horário + fade + scale (mesmo padrão usado em GraficoRosca).
// O `key` permite reanimar quando os dados mudam (re-render do filtro).
// ============================================================
function useSweepAnimation(key: unknown, duration = 1200) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.opacity = "0";
    el.style.transform = "scale(0.6)";

    const start = performance.now();
    let frame: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const angle = eased * 360;

      const opacity = Math.min(progress / 0.25, 1);
      el.style.opacity = String(opacity);

      const scaleProgress = Math.min(progress / 0.6, 1);
      const scaleEased = 1 - Math.pow(1 - scaleProgress, 3);
      el.style.transform = `scale(${0.6 + 0.4 * scaleEased})`;

      if (progress < 1) {
        const mask = `conic-gradient(from -90deg at 50% 50%, black ${angle}deg, transparent ${angle}deg)`;
        el.style.maskImage = mask;
        (el.style as CSSStyleDeclaration & { webkitMaskImage: string }).webkitMaskImage = mask;
        frame = requestAnimationFrame(animate);
      } else {
        el.style.maskImage = "none";
        (el.style as CSSStyleDeclaration & { webkitMaskImage: string }).webkitMaskImage = "none";
        el.style.opacity = "1";
        el.style.transform = "none";
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  return ref;
}

// ============================================================
// HOOK DE ANIMAÇÃO HORIZONTAL — wipe da esquerda pra direita, ideal pra barras.
// ============================================================
function useWipeAnimation(key: unknown, duration = 1300) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.opacity = "0";
    el.style.transform = "translateX(-12px)";

    const start = performance.now();
    let frame: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easedOut = 1 - Math.pow(1 - progress, 3);
      const wipePct = easedOut * 100;

      const opacity = Math.min(progress / 0.3, 1);
      el.style.opacity = String(opacity);

      const slideProgress = Math.min(progress / 0.5, 1);
      const slideEased = 1 - Math.pow(1 - slideProgress, 3);
      el.style.transform = `translateX(${-12 + 12 * slideEased}px)`;

      if (progress < 1) {
        const mask = `linear-gradient(to right, black ${wipePct}%, transparent ${wipePct}%)`;
        el.style.maskImage = mask;
        (el.style as CSSStyleDeclaration & { webkitMaskImage: string }).webkitMaskImage = mask;
        frame = requestAnimationFrame(animate);
      } else {
        el.style.maskImage = "none";
        (el.style as CSSStyleDeclaration & { webkitMaskImage: string }).webkitMaskImage = "none";
        el.style.opacity = "1";
        el.style.transform = "none";
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  return ref;
}

// ============================================================
// SUB-COMPONENTES
// ============================================================

interface StatCardProps {
  title: string;
  subtitle?: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  activeRing: string;
  active: boolean;
  onClick: () => void;
}
function StatCard({
  title,
  subtitle,
  value,
  hint,
  icon,
  iconBg,
  iconColor,
  borderColor,
  activeRing,
  active,
  onClick,
}: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border ${borderColor} p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
        active ? `ring-2 ${activeRing} shadow-md` : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-black leading-tight">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
              {subtitle}
            </p>
          )}
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{hint}</p>
        </div>
        <div
          className={`flex-shrink-0 w-12 h-12 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>
    </button>
  );
}

interface DonutChartCardProps {
  title: string;
  data: Array<{ name: string; value: number; color: string; desc?: string }>;
  total: number;
}
function DonutChartCard({ title, data, total }: DonutChartCardProps) {
  const chartData = data.filter((d) => d.value > 0);
  const [hovering, setHovering] = useState(false);
  const sweepKey = useMemo(
    () => chartData.map((d) => `${d.name}:${d.value}`).join("|"),
    [chartData],
  );
  const sweepRef = useSweepAnimation(sweepKey, 1300);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm h-[300px] flex flex-col">
      <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
      <div className="flex-1 flex items-center gap-3 min-h-0">
        <div
          ref={sweepRef}
          className="w-[140px] h-[140px] flex-shrink-0 relative"
          style={{ overflow: "visible" }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={
                  chartData.length > 0
                    ? chartData
                    : [{ name: "vazio", value: 1, color: "#e5e7eb" }]
                }
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
              >
                {(chartData.length > 0
                  ? chartData
                  : [{ color: "#e5e7eb" }]
                ).map((entry: { color: string }, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              {chartData.length > 0 && (
                <RTooltip
                  formatter={(v: number, n: string) => {
                    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                    return [`${v} (${pct}%)`, n];
                  }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
          {chartData.length > 0 && !hovering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-slate-800 leading-none">
                {total}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-none">
                total
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-slate-700 flex-1 truncate" title={d.desc}>
                {d.name}
              </span>
              <span className="text-slate-500 font-medium tabular-nums">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface BarChartCardProps {
  title: string;
  data: Array<{ name: string; value: number; pct: number }>;
}
function BarChartCard({ title, data }: BarChartCardProps) {
  const animKey = useMemo(
    () => data.map((d) => `${d.name}:${d.value}`).join("|"),
    [data],
  );
  const wipeRef = useWipeAnimation(animKey, 1300);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm h-[300px] flex flex-col">
      <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
      <div
        ref={wipeRef}
        className="flex-1 min-h-0"
        style={{ overflow: "visible" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            key={animKey}
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 0, bottom: 5 }}
          >
            <CartesianGrid horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 10, fill: "#475569" }}
              tickLine={false}
              axisLine={false}
            />
            <RTooltip
              formatter={(
                v: number,
                _n: string,
                props: { payload?: { pct?: number } },
              ) => [`${v} (${props.payload?.pct ?? 0}%)`, "Processos"]}
            />
            <Bar
              dataKey="value"
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
              barSize={14}
              isAnimationActive={false}
            >
              {data.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={
                    [
                      "#1e3a8a",
                      "#2563eb",
                      "#3b82f6",
                      "#60a5fa",
                      "#7c3aed",
                      "#94a3b8",
                    ][idx % 6]
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ColumnChartCardProps {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
}
function ColumnChartCard({ title, data }: ColumnChartCardProps) {
  const animKey = useMemo(
    () => data.map((d) => `${d.name}:${d.value}`).join("|"),
    [data],
  );
  const wipeRef = useWipeAnimation(animKey, 1300);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm h-[300px] flex flex-col">
      <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
      <div
        ref={wipeRef}
        className="flex-1 min-h-0"
        style={{ overflow: "visible" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            key={animKey}
            data={data}
            margin={{ top: 18, right: 10, left: -22, bottom: 5 }}
          >
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#475569" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <RTooltip formatter={(v: number) => [`${v}`, "Processos"]} />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              barSize={34}
              isAnimationActive={false}
              label={{ position: "top", fontSize: 11, fill: "#334155" }}
            >
              {data.map((d, idx) => (
                <Cell key={idx} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function EscritorioProcessos() {
  const { user } = useAuth();
  const [processos, setProcessos] = useState<ProcessoNegocio[]>([]);
  const [loading, setLoading] = useState(true);

  // Aba ativa (substitui o antigo filtro de Status)
  const [aba, setAba] = useState<"vigentes" | "revisao">("vigentes");

  // Filtros
  const [filtroArea, setFiltroArea] = useState<string>("all");
  const [filtroDiretoria, setFiltroDiretoria] = useState<string>("all");
  // Filtro disparado pelos cards de topo
  const [filtroArtefato, setFiltroArtefato] = useState<
    "all" | "mps" | "pop" | "flux"
  >("all");
  // Busca por processo/macroprocesso/área — afeta apenas a tabela
  const [buscaProcesso, setBuscaProcesso] = useState("");

  // Modais
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessoNegocio | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<ProcessoNegocio | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);

  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isSuperadmin = (user as { is_superadmin?: boolean } | null)?.is_superadmin === true;
  const podeFiltrarDiretoria = isSuperadmin || user?.diretoria === "SGJT";

  const carregar = async () => {
    setLoading(true);
    try {
      const procs = await processosNegocioApi.getAll();
      setProcessos(procs);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (!podeFiltrarDiretoria && user?.diretoria) {
      setFiltroDiretoria(user.diretoria);
    }
  }, [podeFiltrarDiretoria, user?.diretoria]);

  // ============================================================
  // OPÇÕES DOS FILTROS
  // ============================================================

  const areasOptions = useMemo(() => {
    const set = new Set<string>();
    processos.forEach((p) =>
      (p.areas_responsaveis || []).forEach((a) => set.add(a)),
    );
    return Array.from(set).sort();
  }, [processos]);

  const diretoriasOptions = useMemo(() => {
    const set = new Set<string>();
    processos.forEach((p) => p.diretoria && set.add(p.diretoria));
    return Array.from(set).sort();
  }, [processos]);

  // ============================================================
  // APLICAR FILTROS (aba + diretoria + área)
  // ============================================================
  const filteredBase = useMemo(() => {
    return processos.filter((p) => {
      const naAba = aba === "vigentes" ? isVigente(p) : isRevisaoOuNovo(p);
      if (!naAba) return false;
      if (
        filtroArea !== "all" &&
        !(p.areas_responsaveis || []).includes(filtroArea)
      )
        return false;
      if (filtroDiretoria !== "all" && p.diretoria !== filtroDiretoria)
        return false;
      return true;
    });
  }, [processos, aba, filtroArea, filtroDiretoria]);

  // Inclui o filtro disparado pelos cards. Usado nos gráficos e na tabela.
  const filtered = useMemo(() => {
    return filteredBase.filter((p) => {
      const docs = p.documentos_anexados || [];
      if (filtroArtefato === "mps" && !docs.some((d) => d.tipo === "MPS"))
        return false;
      if (filtroArtefato === "pop" && !docs.some((d) => d.tipo === "POP"))
        return false;
      if (filtroArtefato === "flux" && !temFluxograma(p)) return false;
      return true;
    });
  }, [filteredBase, filtroArtefato]);

  // ============================================================
  // ESTATÍSTICAS / DADOS DOS GRÁFICOS
  // ============================================================
  const stats = useMemo(() => {
    const total = filtered.length;
    let mps = 0,
      pop = 0,
      flux = 0;
    filtered.forEach((p) => {
      const docs = p.documentos_anexados || [];
      if (docs.some((d) => d.tipo === "MPS")) mps++;
      if (docs.some((d) => d.tipo === "POP")) pop++;
      if (temFluxograma(p)) flux++;
    });
    return { total, mps, pop, flux };
  }, [filtered]);

  const tabWord = aba === "vigentes" ? "vigentes" : "em revisão";
  const card1Label =
    aba === "vigentes" ? "Processos Vigentes" : "Em Revisão ou Novos";

  const macroChartData = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((p) => {
      const m = p.macroprocesso || "Não informado";
      counts.set(m, (counts.get(m) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct:
          filtered.length > 0 ? Math.round((value / filtered.length) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  // Donut "por área" — agrupado pela área responsável principal do processo (top 4 + "Outras").
  const areaChartData = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((p) => {
      const a =
        (p.areas_responsaveis || [])[0] || p.diretoria || "Não informada";
      counts.set(a, (counts.get(a) || 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const arr = sorted.slice(0, 4).map(([name, value], i) => ({
      name,
      value,
      color: DIRETORIA_COLORS[i % DIRETORIA_COLORS.length],
    }));
    const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) arr.push({ name: "Outras", value: rest, color: "#94a3b8" });
    return arr;
  }, [filtered]);

  const revisaoPeriodoData = useMemo(() => {
    const counts = Object.fromEntries(
      PERIODO_BUCKETS.map((b) => [b, 0]),
    ) as Record<PeriodoBucket, number>;
    filtered.forEach((p) => {
      const b = periodoRevisaoOf(p);
      if (b) counts[b]++;
    });
    return PERIODO_BUCKETS.map((b) => ({
      name: b,
      value: counts[b],
      color: PERIODO_COLORS[b],
    }));
  }, [filtered]);

  const maturidadeChartData = useMemo(() => {
    const counts: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    filtered.forEach((p) => {
      counts[maturidadeOf(p)]++;
    });
    return ([1, 2, 3] as const).map((n) => ({
      name: MATURIDADE_LABEL[n],
      desc: MATURIDADE_DESC[n],
      value: counts[n],
      color: MATURIDADE_COLOR[n],
    }));
  }, [filtered]);

  // ============================================================
  // TABELA — busca por processo / macroprocesso / área
  // ============================================================
  const tabelaProcessos = useMemo(() => {
    const q = buscaProcesso.trim().toLowerCase();
    const base = q
      ? filtered.filter((p) => {
          const area = (p.areas_responsaveis || []).join(" ");
          return (
            (p.nome_processo || "").toLowerCase().includes(q) ||
            (p.macroprocesso || "").toLowerCase().includes(q) ||
            area.toLowerCase().includes(q)
          );
        })
      : filtered;
    // Ordena por Próxima Revisão crescente (menor → maior); sem data vai pro fim.
    return [...base].sort((a, b) => {
      const da = proximaRevisao(a);
      const db = proximaRevisao(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });
  }, [filtered, buscaProcesso]);

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleNovoProcesso = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const handleEditar = (p: ProcessoNegocio) => {
    setDetalheOpen(false);
    setEditing(p);
    setFormOpen(true);
  };
  const handleAbrirDetalhe = async (p: ProcessoNegocio) => {
    // Abre já com o objeto enxuto (instantâneo) e busca o completo em seguida —
    // a listagem não traz os bytes do fluxograma/documentos, mas o detalhe precisa
    // deles para preview, download e geração de PDF.
    setSelecionado(p);
    setDetalheOpen(true);
    setDetalheLoading(true);
    try {
      const full = await processosNegocioApi.getById(p.id);
      setSelecionado((cur) => (cur && cur.id === full.id ? full : cur));
    } catch {
      /* mantém o objeto enxuto; erro já tratado pelo apiClient */
    } finally {
      setDetalheLoading(false);
    }
  };

  const handleSaved = (p: ProcessoNegocio) => {
    setProcessos((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev];
    });
    setSelecionado(p);
  };

  const handleChanged = (next: ProcessoNegocio | null) => {
    if (next === null) {
      setProcessos((prev) => prev.filter((x) => x.id !== selecionado?.id));
      setSelecionado(null);
      return;
    }
    setProcessos((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    setSelecionado(next);
  };

  const trocarAba = (nova: "vigentes" | "revisao") => {
    setAba(nova);
    setFiltroArtefato("all");
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Layout>
      <div className="space-y-5 page-transition-enter">
        <Breadcrumbs
          items={[
            { label: "Gestão Estratégica", to: "/gestao-estrategica" },
            { label: "Escritório de Processos" },
          ]}
        />

        {/* HEADER */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              className="w-1.5 h-12 rounded-full"
              style={{
                background: "linear-gradient(180deg, #0A2547 0%, #1565C0 100%)",
              }}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Gestão Estratégica
              </p>
              <h1 className="text-2xl font-bold text-slate-800">
                Escritório de Processos
              </h1>
            </div>
          </div>

          {isAdminOrManager && aba === "revisao" && (
            <Button
              onClick={handleNovoProcesso}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Processo
            </Button>
          )}
        </div>

        {/* ABAS */}
        <div className="flex gap-1 border-b border-slate-200">
          <button
            type="button"
            onClick={() => trocarAba("vigentes")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              aba === "vigentes"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Processos Vigentes
          </button>
          <button
            type="button"
            onClick={() => trocarAba("revisao")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              aba === "revisao"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <History className="h-4 w-4" />
            Processos em Revisão ou Novos
          </button>
        </div>

        {/* FILTROS — Diretoria + Área */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Diretoria
            </label>
            <Select
              value={filtroDiretoria}
              onValueChange={setFiltroDiretoria}
              disabled={!podeFiltrarDiretoria}
            >
              <SelectTrigger className="h-10 bg-white">
                <SelectValue placeholder="Todas as diretorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as diretorias</SelectItem>
                {diretoriasOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Área
            </label>
            <Select value={filtroArea} onValueChange={setFiltroArea}>
              <SelectTrigger className="h-10 bg-white">
                <SelectValue placeholder="Todas as áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {areasOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={card1Label}
            value={stats.total}
            hint={`${stats.total === 0 ? 0 : 100}% do total`}
            icon={<FileText className="h-6 w-6" />}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            borderColor="border-blue-200"
            activeRing="ring-blue-400"
            active={filtroArtefato === "all"}
            onClick={() => setFiltroArtefato("all")}
          />
          <StatCard
            title="Fluxogramas"
            value={stats.flux}
            hint={`${stats.total > 0 ? Math.round((stats.flux / stats.total) * 100) : 0}% dos processos`}
            icon={<GitBranch className="h-6 w-6" />}
            iconBg="bg-pink-100"
            iconColor="text-pink-600"
            borderColor="border-pink-200"
            activeRing="ring-pink-400"
            active={filtroArtefato === "flux"}
            onClick={() =>
              setFiltroArtefato(filtroArtefato === "flux" ? "all" : "flux")
            }
          />
          <StatCard
            title="POPs"
            subtitle="(Procedimento Operacional Padrão)"
            value={stats.pop}
            hint={`${stats.total > 0 ? Math.round((stats.pop / stats.total) * 100) : 0}% dos processos`}
            icon={<ListChecks className="h-6 w-6" />}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            borderColor="border-amber-200"
            activeRing="ring-amber-400"
            active={filtroArtefato === "pop"}
            onClick={() =>
              setFiltroArtefato(filtroArtefato === "pop" ? "all" : "pop")
            }
          />
          <StatCard
            title="MPS"
            subtitle="(Modelo Padrão de Serviço)"
            value={stats.mps}
            hint={`${stats.total > 0 ? Math.round((stats.mps / stats.total) * 100) : 0}% dos processos`}
            icon={<Layers className="h-6 w-6" />}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            borderColor="border-emerald-200"
            activeRing="ring-emerald-400"
            active={filtroArtefato === "mps"}
            onClick={() =>
              setFiltroArtefato(filtroArtefato === "mps" ? "all" : "mps")
            }
          />
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BarChartCard
            title={`Processos ${tabWord} por macroprocesso`}
            data={macroChartData}
          />
          <DonutChartCard
            title={`Processos ${tabWord} por área`}
            data={areaChartData}
            total={stats.total}
          />
          <ColumnChartCard
            title="Próximas revisões por período"
            data={revisaoPeriodoData}
          />
          <DonutChartCard
            title="Maturidade dos processos"
            data={maturidadeChartData}
            total={stats.total}
          />
        </div>

        {/* TABELA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-4 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">Processos</h3>
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                value={buscaProcesso}
                onChange={(e) => setBuscaProcesso(e.target.value)}
                placeholder="Buscar por processo, macroprocesso ou área..."
                className="h-9 pl-9 bg-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando processos…
            </div>
          ) : tabelaProcessos.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Workflow className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-slate-700 font-semibold">
                Nenhum processo encontrado
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Ajuste os filtros ou cadastre um novo processo.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Processo
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        ID
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Macroprocesso
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Área
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Modelo Vigente
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Data da Versão
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Próxima Revisão
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tabelaProcessos.map((p) => {
                      const nextRev = proximaRevisao(p);
                      const overdue =
                        nextRev != null && nextRev.getTime() < Date.now();
                      const areaLabel =
                        (p.areas_responsaveis || [])[0] || p.diretoria || "—";
                      const k1 = isK1(p);
                      const docPri = temDocumentoPrimario(p);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleAbrirDetalhe(p)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-3 text-center text-slate-900 font-medium">
                            {p.nome_processo}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-600 tabular-nums whitespace-nowrap">
                            {p.codigo || "—"}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-700">
                            {p.macroprocesso || "—"}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-700">
                            {areaLabel}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {k1 ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                                Modelo K1
                              </span>
                            ) : docPri ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                                Doc. Primário
                              </span>
                            ) : (
                              <span className="text-xs italic text-slate-400">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-700 tabular-nums">
                            {formatDataVersao(p.periodo)}
                          </td>
                          <td
                            className={`px-5 py-3 text-center tabular-nums font-medium ${overdue ? "text-red-600" : "text-slate-700"}`}
                          >
                            {nextRev ? formatDateShort(nextRev) : "—"}
                          </td>
                          <td className="px-2 py-3 text-slate-400">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
                <span className="text-xs text-slate-600">
                  {tabelaProcessos.length} processo
                  {tabelaProcessos.length === 1 ? "" : "s"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Diálogos */}
      <ProcessoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        processo={editing}
        diretoriaPadrao={user?.diretoria || undefined}
        onSaved={handleSaved}
      />
      <ProcessoDetalhe
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        processo={selecionado}
        onChanged={handleChanged}
        onEdit={handleEditar}
        loadingFull={detalheLoading}
      />
    </Layout>
  );
}
