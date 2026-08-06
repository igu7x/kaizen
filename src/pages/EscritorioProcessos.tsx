import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  ClipboardList,
  ChevronRight,
  ChevronDown,
  Download,
  Paperclip,
  Info,
  Search,
  Briefcase,
  History,
  RefreshCw,
  FileDown,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  processosNegocioApi,
  ProcessoNegocio,
  DocumentoAnexado,
  TipoDocumentoAnexado,
  temFluxograma,
  temDocumentoPrimario,
  isK1,
  isVigente,
  isRevisaoOuNovo,
  revisaoVencida,
  normalizeResponsavel,
  isComplianceOfficerEmail,
  proximaRevisao,
  dataVigencia,
  TIPO_DOCUMENTO_BADGE,
} from "@/services/processosNegocioApi";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProcessoFormDialog } from "@/components/processos/ProcessoFormDialog";
import { ProcessoDetalhe } from "@/components/processos/ProcessoDetalhe";
import { RichText } from "@/components/ui/RichText";
import { PopsTable } from "@/components/processos/PopsTable";
import { popsCriadosApi, PopCriado } from "@/services/popsCriadosApi";
import { generateProcessoNegocioPDF } from "@/utils/generateProcessoNegocioPDF";
import { areasApi, Area, Unidade } from "@/services/areasApi";
import { toast } from "sonner";
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
  LabelList,
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
  "Até 90 dias": "#fbbf24",
  "91 – 180 dias": "#7c3aed",
  "+ de 180 dias": "#10b981",
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

/**
 * Cor da faixa de status da lateral esquerda:
 *  - vermelho: revisão vencida;
 *  - amarelo: vence em até 90 dias OU ainda não é Modelo K1 (precisa de adequação);
 *  - verde: já é Modelo K1 e vence em mais de 90 dias.
 */
function corFaixaStatus(p: ProcessoNegocio): string {
  const next = proximaRevisao(p);
  const now = Date.now();
  if (next && next.getTime() < now) return "bg-red-500";
  const dias = next
    ? Math.ceil((next.getTime() - now) / (24 * 60 * 60 * 1000))
    : null;
  if ((dias != null && dias <= 90) || !isK1(p)) return "bg-amber-400";
  return "bg-emerald-500";
}

/** Extrai a sigla de um nome "SIGLA - Nome completo" → "SIGLA". Sem separador, retorna o texto. */
function siglaDe(nome: string): string {
  return nome.split(/\s+[-–—]\s+/)[0].trim();
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

/**
 * Rótulo de percentual FORA do anel, com uma linha curta "puxando" da borda da fatia até o
 * texto — mesmo padrão dos donuts do Escritório de Projetos (GraficoRosca). Usa a cor da
 * própria fatia (props.fill). Fatia única de 100% → texto no centro do donut.
 */
function renderDonutLeaderLabel(props: {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  percent: number;
  fill?: string;
}) {
  const { cx, cy, midAngle, outerRadius, percent, fill } = props;
  if (!percent) return null;
  const RAD = Math.PI / 180;
  const color = fill || "#334155";
  const text = `${Math.round(percent * 100)}%`;
  if (percent >= 0.999) {
    return (
      <text
        x={cx}
        y={cy}
        fill={color}
        fontSize={13}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {text}
      </text>
    );
  }
  const LINE_LEN = 13;
  const sx = cx + outerRadius * Math.cos(-midAngle * RAD);
  const sy = cy + outerRadius * Math.sin(-midAngle * RAD);
  const ex = cx + (outerRadius + LINE_LEN) * Math.cos(-midAngle * RAD);
  const ey = cy + (outerRadius + LINE_LEN) * Math.sin(-midAngle * RAD);
  const isRight = ex >= cx;
  return (
    <g>
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={color} strokeWidth={1} />
      <text
        x={ex + (isRight ? 4 : -4)}
        y={ey}
        fill={color}
        fontSize={11}
        fontWeight={700}
        textAnchor={isRight ? "start" : "end"}
        dominantBaseline="central"
      >
        {text}
      </text>
    </g>
  );
}
function DonutChartCard({ title, data, total }: DonutChartCardProps) {
  const chartData = data.filter((d) => d.value > 0);
  const sweepKey = useMemo(
    () => chartData.map((d) => `${d.name}:${d.value}`).join("|"),
    [chartData],
  );
  const sweepRef = useSweepAnimation(sweepKey, 1300);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm h-[300px] flex flex-col">
      <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
      <div className="flex-1 flex items-center gap-6 min-h-0">
        <div
          ref={sweepRef}
          className="w-[200px] h-[180px] flex-shrink-0 relative [&_.recharts-surface]:overflow-visible [&_.recharts-wrapper]:overflow-visible"
          style={{ overflow: "visible" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
              <Pie
                data={
                  chartData.length > 0
                    ? chartData
                    : [{ name: "vazio", value: 1, color: "#e5e7eb" }]
                }
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={58}
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
                labelLine={false}
                label={chartData.length > 0 ? renderDonutLeaderLabel : undefined}
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
        </div>
        <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
          {data.map((d) => (
            <div key={d.name} className="flex items-start gap-2 text-xs">
              <span
                className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-slate-700 flex-1 leading-tight" title={d.desc}>
                {d.name}{" "}
                <span className="text-slate-500 font-medium tabular-nums">
                  ({d.value})
                </span>
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
              <LabelList
                dataKey="value"
                position="right"
                style={{ fontSize: 11, fontWeight: 600, fill: "#334155" }}
              />
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
            margin={{ top: 18, right: 10, left: 0, bottom: 5 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#475569" }}
              tickLine={false}
              axisLine={false}
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
  const navigate = useNavigate();
  const [processos, setProcessos] = useState<ProcessoNegocio[]>([]);
  const [loading, setLoading] = useState(true);

  // Aba ativa (substitui o antigo filtro de Status)
  const [aba, setAba] = useState<"vigentes" | "revisao">("vigentes");

  // Filtros
  const [filtroArea, setFiltroArea] = useState<string>("all");
  const [filtroDiretoria, setFiltroDiretoria] = useState<string>("all");
  // Filtro disparado pelos cards de topo
  const [filtroArtefato, setFiltroArtefato] = useState<
    "all" | "mps" | "pop" | "it"
  >("all");
  // Busca por processo/macroprocesso/área — afeta apenas a tabela
  const [buscaProcesso, setBuscaProcesso] = useState("");

  // Modais
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessoNegocio | null>(null);
  // Modo com que o form abre: "visualizar" (clique no processo → travado) ou "editar".
  const [formModo, setFormModo] = useState<"editar" | "visualizar">("editar");
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<ProcessoNegocio | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  // Processo cuja revisão antecipada está sendo iniciada (trava o item da lista).
  const [revisando, setRevisando] = useState<number | null>(null);
  // Modal "Revisar Processo": tipo de revisão (ordinária x extraordinária) e processo selecionado.
  const [revisarOpen, setRevisarOpen] = useState(false);
  const [tipoRevisao, setTipoRevisao] = useState<
    "ordinaria" | "extraordinaria" | null
  >(null);
  const [processoRevisaoId, setProcessoRevisaoId] = useState<number | null>(
    null,
  );
  // Áreas (sigla → nome) para o rodapé do PDF do Modelo K1.
  const [areas, setAreas] = useState<Area[]>([]);
  // Unidades do cadastro — usadas para resolver o responsável (responsavel_user_id) dinamicamente.
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  const isSuperadmin = (user as { is_superadmin?: boolean } | null)?.is_superadmin === true;
  const isComplianceOfficer = isComplianceOfficerEmail(user?.email);
  // Regra (jul/2026): todos os usuários enxergam todos os processos (de todas as diretorias),
  // então o filtro por diretoria fica habilitado para todos. O Visualizador (VIEWER) segue
  // restrito aos vigentes (aba única) via `soVisualizador`.
  const podeFiltrarDiretoria = true;
  // Visualizador (perfil VIEWER): só enxerga "Processos Vigentes", independente da diretoria.
  // Superadmin (Gestor do Escritório) e Compliance Officer não são restritos.
  const soVisualizador =
    user?.role === "VIEWER" && !isSuperadmin && !isComplianceOfficer;

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
    areasApi
      .getAll()
      .then(setAreas)
      .catch(() => {
        /* sem áreas, o PDF cai para a sigla da diretoria */
      });
    areasApi
      .getAllUnidades()
      .then(setUnidades)
      .catch(() => {
        /* sem unidades, o responsável cai só no snapshot do processo */
      });
  }, []);

  // Deep-link vindo da Home / do e-mail de pendência (?abrir=<id>): abre o processo direto no modal
  // de visualização (onde ficam as ações Validar/Enviar), em vez da tela de detalhe só-leitura.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const abrir = searchParams.get("abrir");
    if (!abrir) return;
    const next = new URLSearchParams(searchParams);
    next.delete("abrir");
    setSearchParams(next, { replace: true });
    const id = Number(abrir);
    if (!Number.isFinite(id)) return;
    processosNegocioApi
      .getById(id)
      .then((full) => {
        setFormModo("visualizar");
        setEditing(full);
        setFormOpen(true);
      })
      .catch(() => {
        /* processo inacessível — ignora */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
      // Exibição da aba "Vigentes": inclui os vigentes de verdade E os que têm documento
      // primário anexado (só visual — o documento primário não altera o andamento/isVigente).
      const naAba =
        aba === "vigentes"
          ? isVigente(p) || temDocumentoPrimario(p)
          : isRevisaoOuNovo(p);
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
      if (filtroArtefato === "it" && !docs.some((d) => d.tipo === "IT"))
        return false;
      return true;
    });
  }, [filteredBase, filtroArtefato]);

  // Resolve se o usuário logado é Responsável do processo. Robusto: usa o responsavel_user_id
  // gravado na entrada (snapshot) E resolve dinamicamente pela unidade do cadastro (por
  // unidade_id ou pelo nome), refletindo o cadastro atual mesmo em processos antigos.
  const ehResponsavelDoProcesso = useMemo(() => {
    return (p: ProcessoNegocio): boolean => {
      const uid = Number(user?.id);
      if (!uid || Number.isNaN(uid)) return false;
      return (p.proprietarios || []).some((raw) => {
        const r = normalizeResponsavel(raw);
        if (Number(r.responsavel_user_id) === uid) return true;
        let u =
          r.unidade_id != null
            ? unidades.find((x) => x.id === r.unidade_id)
            : undefined;
        if (!u && r.area) {
          // A área do responsável pode vir como o nome da unidade, a sigla, ou o rótulo
          // composto "SIGLA - nome" (como aparece no formulário). Casa em qualquer um deles.
          const alvo = r.area.trim().toLowerCase();
          u = unidades.find((x) => {
            const nome = (x.nome || "").trim().toLowerCase();
            const sigla = (x.sigla || "").trim().toLowerCase();
            const composto = sigla && nome ? `${sigla} - ${nome}` : nome;
            return alvo === nome || alvo === sigla || alvo === composto;
          });
        }
        return u?.responsavel_user_id != null && Number(u.responsavel_user_id) === uid;
      });
    };
  }, [unidades, user?.id]);

  // Diretor de uma área = area.gestor_user_id; Sub-diretor = area.subdiretor_user_id.
  // Resolve a área pela sigla == diretoria do processo (mesmo casamento do Revisor/camada 2).
  const ehDiretorDoProcesso = useMemo(() => {
    return (p: ProcessoNegocio): boolean => {
      const uid = Number(user?.id);
      if (!uid || Number.isNaN(uid)) return false;
      const area = areas.find(
        (a) =>
          a.sigla?.trim().toUpperCase() === p.diretoria?.trim().toUpperCase(),
      );
      if (!area) return false;
      return (
        (area.gestor_user_id != null && Number(area.gestor_user_id) === uid) ||
        (area.subdiretor_user_id != null &&
          Number(area.subdiretor_user_id) === uid)
      );
    };
  }, [areas, user?.id]);

  // Usuário é Diretor ou Sub-diretor de ALGUMA área (habilita o botão "Novo Processo").
  const ehDiretorOuSubdiretor = useMemo(() => {
    const uid = Number(user?.id);
    if (!uid || Number.isNaN(uid)) return false;
    return areas.some(
      (a) =>
        (a.gestor_user_id != null && Number(a.gestor_user_id) === uid) ||
        (a.subdiretor_user_id != null && Number(a.subdiretor_user_id) === uid),
    );
  }, [areas, user?.id]);

  // Processos vigentes e no prazo (Modelo K1, revisão não vencida) que o usuário pode revisar
  // antecipadamente. Regra: só aparece para o RESPONSÁVEL do processo (cada um vê apenas os
  // seus) — nem o Gestor do Escritório (superadmin) vê os dos outros aqui. Não apareceriam em
  // "Em Revisão ou Novos".
  const processosParaRevisar = useMemo(() => {
    if (!user?.id) return [];
    return processos
      .filter(
        (p) =>
          isK1(p) &&
          !revisaoVencida(p) &&
          (ehResponsavelDoProcesso(p) || ehDiretorDoProcesso(p)),
      )
      .sort((a, b) => {
        const da = proximaRevisao(a)?.getTime() ?? Infinity;
        const db = proximaRevisao(b)?.getTime() ?? Infinity;
        return da - db;
      });
  }, [processos, user?.id, ehResponsavelDoProcesso, ehDiretorDoProcesso]);

  // Processos vigentes cuja revisão VENCEU (Revisão Ordinária Anual) sob a responsabilidade do
  // usuário. Mesmo público-alvo do de cima, porém com a data de revisão já atingida/ultrapassada.
  const processosRevisaoVencida = useMemo(() => {
    if (!user?.id) return [];
    return processos
      .filter(
        (p) =>
          isK1(p) &&
          revisaoVencida(p) &&
          (ehResponsavelDoProcesso(p) || ehDiretorDoProcesso(p)),
      )
      .sort((a, b) => {
        const da = proximaRevisao(a)?.getTime() ?? Infinity;
        const db = proximaRevisao(b)?.getTime() ?? Infinity;
        return da - db;
      });
  }, [processos, user?.id, ehResponsavelDoProcesso, ehDiretorDoProcesso]);

  // Lista exibida no passo 2 do modal, conforme o tipo escolhido.
  const processosDoTipo =
    tipoRevisao === "ordinaria"
      ? processosRevisaoVencida
      : tipoRevisao === "extraordinaria"
        ? processosParaRevisar
        : [];
  const totalParaRevisar =
    processosParaRevisar.length + processosRevisaoVencida.length;

  // Validação disponível para o usuário no processo em edição (camada atual). Alimenta o botão
  // "Validar" do form: Responsável valida a camada 1 (enviar), Revisor a 2, Compliance a 3.
  // Ausente = usuário não valida (ex.: Editor/Gestor) → o form mostra só "Salvar Alterações".
  // Ação de validação disponível para o usuário no processo, conforme a camada atual. Reusada
  // tanto pelo botão "Validar" do formulário (edição) quanto pelo do preview (leitura), pra que
  // apareçam nas MESMAS condições — antes o modal usava uma lógica de papel própria e divergia.
  const computeValidacao = useCallback(
    (p: ProcessoNegocio | null) => {
      if (!p || !user?.id) return null;
      const uid = Number(user.id);
      const st = p.status;
      const area = areas.find(
        (a) =>
          a.sigla?.trim().toUpperCase() === p.diretoria?.trim().toUpperCase(),
      );
      const ehRevisor =
        area?.gestor_user_id != null && Number(area.gestor_user_id) === uid;
      if (
        (st === "em_elaboracao" || st === "recusado") &&
        ehResponsavelDoProcesso(p)
      ) {
        return { exec: (id: number) => processosNegocioApi.enviar(id) };
      }
      if (st === "validado_autor" && ehRevisor) {
        return { exec: (id: number) => processosNegocioApi.validarDiretoria(id) };
      }
      if (st === "validado_diretoria" && isComplianceOfficer) {
        return { exec: (id: number) => processosNegocioApi.validarFinal(id) };
      }
      return null;
    },
    [user?.id, areas, ehResponsavelDoProcesso, isComplianceOfficer],
  );

  const validacaoDoEditing = useMemo(
    () => computeValidacao(editing),
    [computeValidacao, editing],
  );
  const validacaoDoSelecionado = useMemo(
    () => computeValidacao(selecionado),
    [computeValidacao, selecionado],
  );

  // ============================================================
  // ESTATÍSTICAS / DADOS DOS GRÁFICOS
  // ============================================================
  const stats = useMemo(() => {
    const total = filtered.length;
    let mps = 0,
      pop = 0,
      it = 0;
    filtered.forEach((p) => {
      const docs = p.documentos_anexados || [];
      if (docs.some((d) => d.tipo === "MPS")) mps++;
      if (docs.some((d) => d.tipo === "POP")) pop++;
      if (docs.some((d) => d.tipo === "IT")) it++;
    });
    return { total, mps, pop, it };
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

  // Donut "por área" — a "área" é SEMPRE a Diretoria vinculada do processo (sigla).
  // Mostra TODAS as diretorias (sem bucket "Outras"), coloridas ciclicamente pela paleta.
  const areaChartData = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((p) => {
      // Só a sigla da diretoria (ex.: "DITI - Diretoria..." → "DITI").
      const a = siglaDe(p.diretoria || "Não informada");
      counts.set(a, (counts.get(a) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        color: DIRETORIA_COLORS[i % DIRETORIA_COLORS.length],
      }));
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
  // TABELA DE DOCUMENTOS — quando um card de artefato (IT/POP/MPS) está ativo,
  // a tabela deixa de listar processos e passa a listar cada DOCUMENTO daquele
  // tipo (um por linha), agregado de todos os processos do recorte atual.
  // ============================================================
  const artefatoTipo: TipoDocumentoAnexado | null =
    filtroArtefato === "it"
      ? "IT"
      : filtroArtefato === "pop"
        ? "POP"
        : filtroArtefato === "mps"
          ? "MPS"
          : null;

  const artefatoLabel =
    artefatoTipo === "IT"
      ? "Instruções de Trabalho"
      : artefatoTipo === "POP"
        ? "POPs"
        : artefatoTipo === "MPS"
          ? "MPS"
          : "Processos";

  const tabelaDocumentos = useMemo(() => {
    if (!artefatoTipo) return [];
    const q = buscaProcesso.trim().toLowerCase();
    const rows: Array<{
      key: string;
      processoId: number;
      processoNome: string;
      area: string;
      nomeExibicao: string;
      doc: DocumentoAnexado;
    }> = [];
    filteredBase.forEach((p) => {
      (p.documentos_anexados || []).forEach((d, idx) => {
        if (d.tipo !== artefatoTipo) return;
        const nomeExibicao = d.nome_exibicao || d.nome || "—";
        const area = p.diretoria || "—";
        const processoNome = p.nome_processo || "—";
        if (
          q &&
          !nomeExibicao.toLowerCase().includes(q) &&
          !processoNome.toLowerCase().includes(q) &&
          !area.toLowerCase().includes(q)
        )
          return;
        rows.push({
          key: `${p.id}-${idx}`,
          processoId: p.id,
          processoNome,
          area,
          nomeExibicao,
          doc: d,
        });
      });
    });
    return rows.sort((a, b) => a.nomeExibicao.localeCompare(b.nomeExibicao));
  }, [filteredBase, artefatoTipo, buscaProcesso]);

  // Chave da linha cujo download está em andamento (spinner no botão).
  const [baixandoDocKey, setBaixandoDocKey] = useState<string | null>(null);
  // Linha (processo vigente) expandida na tabela — mostra descrição + documentos.
  const [linhaExpandida, setLinhaExpandida] = useState<number | null>(null);
  // Processo cujo "Baixar todos" está em andamento.
  const [baixandoTodosId, setBaixandoTodosId] = useState<number | null>(null);
  // Dialog de criação de POP (o botão fica no cabeçalho do card da tabela).
  const [criarPopOpen, setCriarPopOpen] = useState(false);
  // POPs criados no Kaizen — carregados aqui (não só na tabela) para o card "POPs"
  // contabilizá-los mesmo quando o filtro POP não está ativo.
  const [popsCriados, setPopsCriados] = useState<PopCriado[]>([]);
  const [loadingPopsCriados, setLoadingPopsCriados] = useState(true);
  const carregarPopsCriados = useCallback(async () => {
    setLoadingPopsCriados(true);
    try {
      setPopsCriados(await popsCriadosApi.list());
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoadingPopsCriados(false);
    }
  }, []);
  useEffect(() => {
    carregarPopsCriados();
  }, [carregarPopsCriados]);

  // Abre o documento de uma linha da tabela de artefatos no visualizador do navegador
  // (nova aba), onde o usuário tem Salvar / Baixar / Imprimir. Como a listagem vem sem o
  // conteúdo (`data` removido no payload enxuto), busca o processo completo via getById e casa
  // o documento. A aba é aberta no gesto do clique para não ser bloqueada como popup.
  const abrirDocumentoArtefato = async (
    rowKey: string,
    processoId: number,
    doc: DocumentoAnexado,
  ) => {
    setBaixandoDocKey(rowKey);
    const win = window.open("", "_blank");
    try {
      const full = await processosNegocioApi.getById(processoId);
      const docs = full.documentos_anexados || [];
      const found =
        docs.find(
          (d) =>
            d.tipo === doc.tipo &&
            d.nome === doc.nome &&
            (d.nome_exibicao || "") === (doc.nome_exibicao || ""),
        ) || docs.find((d) => d.tipo === doc.tipo && d.nome === doc.nome);
      if (!found?.data) {
        toast.error("Documento não disponível.");
        win?.close();
        return;
      }
      const blob = await (await fetch(found.data)).blob();
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      win?.close();
      toast.error("Não foi possível abrir o documento.");
    } finally {
      setBaixandoDocKey(null);
    }
  };

  // Baixa TODOS os documentos anexados de um processo. Faz um getById (a listagem não
  // traz os bytes) e dispara o download de cada documento com conteúdo.
  const baixarTodosDocumentos = async (p: ProcessoNegocio) => {
    setBaixandoTodosId(p.id);
    try {
      const full = await processosNegocioApi.getById(p.id);
      const docs = (full.documentos_anexados || []).filter((d) => d.data);
      if (docs.length === 0) {
        toast.error("Nenhum documento disponível para download.");
        return;
      }
      for (const doc of docs) {
        const blob = await (await fetch(doc.data)).blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.nome || `documento-${doc.tipo}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        // Pequeno intervalo para o navegador não bloquear downloads múltiplos.
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch {
      toast.error("Não foi possível baixar os documentos.");
    } finally {
      setBaixandoTodosId(null);
    }
  };

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleNovoProcesso = () => {
    // Sempre editável: sem resetar o modo, criar logo após ver um preview abriria travado.
    setFormModo("editar");
    setEditing(null);
    setFormOpen(true);
  };

  // Reabre um processo vigente para revisão antecipada: muda o status (backend), recarrega,
  // leva o responsável para a aba "Em Revisão ou Novos" e abre o detalhe para ele revisar.
  const handleIniciarRevisao = async (p: ProcessoNegocio) => {
    setRevisando(p.id);
    try {
      const atualizado = await processosNegocioApi.iniciarRevisao(p.id);
      toast.success(`Revisão iniciada para "${p.nome_processo}".`);
      await carregar();
      trocarAba("revisao");
      handleAbrirDetalhe(atualizado);
    } catch {
      toast.error("Não foi possível iniciar a revisão deste processo.");
    } finally {
      setRevisando(null);
    }
  };
  const abrirRevisar = () => {
    setTipoRevisao(null);
    setProcessoRevisaoId(null);
    setRevisarOpen(true);
  };
  // "Avançar" no modal: inicia a revisão do processo escolhido e o leva para a tela de revisão.
  const avancarRevisao = () => {
    const p = processosDoTipo.find((x) => x.id === processoRevisaoId);
    if (!p) return;
    setRevisarOpen(false);
    handleIniciarRevisao(p);
  };
  const handleEditar = (p: ProcessoNegocio) => {
    setDetalheOpen(false);
    setFormModo("editar");
    setEditing(p);
    setFormOpen(true);
  };
  const handleAbrirDetalhe = async (p: ProcessoNegocio) => {
    // Clicar num processo abre o MESMO form da edição, porém travado (somente leitura) — o botão
    // "Editar" no rodapé destrava. Abre já com o objeto enxuto (instantâneo) e busca o completo em
    // seguida (a listagem não traz os bytes do fluxograma/documentos, necessários para preview/PDF).
    setFormModo("visualizar");
    setEditing(p);
    setFormOpen(true);
    try {
      const full = await processosNegocioApi.getById(p.id);
      setEditing((cur) => (cur && cur.id === full.id ? full : cur));
    } catch {
      /* mantém o objeto enxuto; erro já tratado pelo apiClient */
    }
  };

  // Abre o PDF do documento primário anexado diretamente (sem abrir o detalhe).
  // A listagem não traz os bytes, então busca o processo completo e abre o anexo PRI.
  const handleAbrirDocPrimario = async (
    e: React.MouseEvent,
    p: ProcessoNegocio,
  ) => {
    e.stopPropagation();
    // Abre a janela já no gesto do clique (evita bloqueio de popup); navega quando o PDF chega.
    const win = window.open("", "_blank");
    try {
      const full = await processosNegocioApi.getById(p.id);
      const pri = (full.documentos_anexados || []).find(
        (d) => d.tipo === "PRI",
      );
      if (!pri?.data) {
        win?.close();
        toast.error("Documento primário não encontrado.");
        return;
      }
      const blob = await (await fetch(pri.data)).blob();
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      win?.close();
      toast.error("Não foi possível abrir o documento primário.");
    }
  };

  // Abre o PDF institucional gerado do processo (Modelo K1) diretamente, sem abrir o detalhe.
  // A listagem não traz os bytes (fluxograma/anexos), então busca o processo completo antes.
  const handleAbrirModeloK1 = async (
    e: React.MouseEvent,
    p: ProcessoNegocio,
  ) => {
    e.stopPropagation();
    // Abre a janela já no gesto do clique (evita bloqueio de popup); o PDF navega nela.
    const win = window.open("", "_blank");
    try {
      const full = await processosNegocioApi.getById(p.id);
      const area = areas.find(
        (a) =>
          a.sigla?.trim().toUpperCase() ===
          full.diretoria?.trim().toUpperCase(),
      );
      generateProcessoNegocioPDF(full, area?.nome || full.diretoria || "", win);
    } catch {
      win?.close();
      toast.error("Não foi possível abrir o PDF do processo.");
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

  // Ações do rodapé do preview (form em modo leitura): mantém o form aberto refletindo o novo
  // status/gating (atualiza `editing`) e sincroniza a lista. `null` = deletado → fecha o dialog.
  const handleProcessoChangedNoForm = (next: ProcessoNegocio | null) => {
    if (next === null) {
      setProcessos((prev) => prev.filter((x) => x.id !== editing?.id));
      setEditing(null);
      return;
    }
    setProcessos((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    setEditing((cur) => (cur && cur.id === next.id ? next : cur));
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

          <div className="flex items-center gap-2">
            {aba === "revisao" && (
              <Button
                variant="outline"
                onClick={abrirRevisar}
                disabled={totalParaRevisar === 0 || revisando != null}
                className="h-10 border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  totalParaRevisar === 0
                    ? "Nenhum processo sob sua responsabilidade para revisar"
                    : undefined
                }
              >
                {revisando != null ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Revisar Processo
                {totalParaRevisar > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                    {totalParaRevisar}
                  </span>
                )}
              </Button>
            )}

            {(isSuperadmin || ehDiretorOuSubdiretor) && aba === "revisao" && (
              <Button
                onClick={handleNovoProcesso}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Processo
              </Button>
            )}
          </div>
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
          {!soVisualizador && (
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
          )}
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
            title="Instruções de Trabalho"
            value={stats.it}
            hint={`${stats.total > 0 ? Math.round((stats.it / stats.total) * 100) : 0}% dos processos`}
            icon={<ClipboardList className="h-6 w-6" />}
            iconBg="bg-pink-100"
            iconColor="text-pink-600"
            borderColor="border-pink-200"
            activeRing="ring-pink-400"
            active={filtroArtefato === "it"}
            onClick={() => setFiltroArtefato("it")}
          />
          <StatCard
            title="POPs"
            subtitle="(Procedimento Operacional Padrão)"
            value={stats.pop + popsCriados.length}
            hint={`${stats.pop} anexado${stats.pop === 1 ? "" : "s"} · ${popsCriados.length} criado${popsCriados.length === 1 ? "" : "s"}`}
            icon={<ListChecks className="h-6 w-6" />}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            borderColor="border-amber-200"
            activeRing="ring-amber-400"
            active={filtroArtefato === "pop"}
            onClick={() => setFiltroArtefato("pop")}
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
            onClick={() => setFiltroArtefato("mps")}
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
            <h3 className="text-base font-bold text-slate-900">
              {artefatoLabel}
            </h3>
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                value={buscaProcesso}
                onChange={(e) => setBuscaProcesso(e.target.value)}
                placeholder={
                  artefatoTipo
                    ? "Buscar por nome do documento, processo ou área..."
                    : "Buscar por processo, macroprocesso ou área..."
                }
                className="h-9 pl-9 bg-white"
              />
            </div>
            {filtroArtefato === "pop" && (
              <Button
                onClick={() => setCriarPopOpen(true)}
                size="sm"
                className="ml-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Criar POP
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando processos…
            </div>
          ) : filtroArtefato === "pop" ? (
            /* POPs vivem em uma tabela só: os anexados a processos e os criados no Kaizen. */
            <PopsTable
              linhasAnexadas={tabelaDocumentos}
              criados={popsCriados}
              loading={loadingPopsCriados}
              onReload={carregarPopsCriados}
              busca={buscaProcesso}
              areaPadrao={user?.diretoria || undefined}
              baixandoDocKey={baixandoDocKey}
              onBaixarAnexado={(row) =>
                abrirDocumentoArtefato(row.key, row.processoId, row.doc)
              }
              criarOpen={criarPopOpen}
              onCriarOpenChange={setCriarPopOpen}
            />
          ) : artefatoTipo ? (
            tabelaDocumentos.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileText className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-slate-700 font-semibold">
                  Nenhum documento encontrado
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  Não há {artefatoLabel} no recorte atual.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Documento
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Processo
                        </th>
                        <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Área
                        </th>
                        <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Data da Versão
                        </th>
                        <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tabelaDocumentos.map((row) => (
                        <tr
                          key={row.key}
                          className="transition-colors hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-3 text-left">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-900 font-medium truncate">
                                {row.nomeExibicao}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-left text-slate-700">
                            {row.processoNome}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-700">
                            {row.area}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-700 tabular-nums whitespace-nowrap">
                            {row.doc.data_documento
                              ? row.doc.data_documento
                                  .split("-")
                                  .reverse()
                                  .join("/")
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                abrirDocumentoArtefato(
                                  row.key,
                                  row.processoId,
                                  row.doc,
                                )
                              }
                              disabled={baixandoDocKey === row.key}
                              title="Abrir documento (PDF)"
                              className="inline-flex items-center justify-center h-9 w-9 rounded-md text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {baixandoDocKey === row.key ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <FileText className="h-5 w-5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
                  <span className="text-xs text-slate-600">
                    {tabelaDocumentos.length} documento
                    {tabelaDocumentos.length === 1 ? "" : "s"}
                  </span>
                </div>
              </>
            )
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
                      <th className="w-3 p-0"></th>
                      <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        ID
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Processo
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
                      // "Área" = Diretoria vinculada do processo (sigla).
                      const areaLabel = p.diretoria || "—";
                      const k1 = isK1(p);
                      const docPri = temDocumentoPrimario(p);
                      const docs = p.documentos_anexados || [];
                      const expandido =
                        aba === "vigentes" && linhaExpandida === p.id;
                      // Só quando o MODELO exibido é Doc. Primário (não K1), na aba Vigentes:
                      // não expande nem é clicável. Modelo K1 segue clicável como antes.
                      const bloqueado = aba === "vigentes" && docPri && !k1;
                      return (
                        <Fragment key={p.id}>
                        <tr
                          onClick={() => {
                            if (bloqueado) return;
                            if (aba === "vigentes") {
                              setLinhaExpandida(expandido ? null : p.id);
                            } else {
                              handleAbrirDetalhe(p);
                            }
                          }}
                          className={`transition-colors ${
                            bloqueado
                              ? "cursor-default"
                              : `cursor-pointer ${expandido ? "bg-slate-50" : "hover:bg-blue-50/50"}`
                          }`}
                        >
                          <td className="relative p-0">
                            <span
                              className={`absolute inset-y-1.5 left-1/2 w-1 -translate-x-1/2 rounded-full ${corFaixaStatus(p)}`}
                            />
                          </td>
                          <td className="px-5 py-3 text-center text-slate-600 tabular-nums whitespace-nowrap">
                            {p.codigo || "—"}
                          </td>
                          <td className="px-5 py-3 text-left text-slate-900 font-medium">
                            {p.nome_processo}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-700">
                            {p.macroprocesso || "—"}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-700">
                            {areaLabel}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {k1 ? (
                              <button
                                type="button"
                                onClick={(e) => handleAbrirModeloK1(e, p)}
                                title="Abrir PDF do processo (Modelo K1)"
                                className="inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors"
                              >
                                Modelo K1
                              </button>
                            ) : docPri ? (
                              <button
                                type="button"
                                onClick={(e) => handleAbrirDocPrimario(e, p)}
                                title="Abrir documento primário (PDF)"
                                className="inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer transition-colors"
                              >
                                Doc. Primário
                              </button>
                            ) : (
                              <span className="text-xs italic text-slate-400">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center text-slate-700 tabular-nums">
                            {formatDataVersao(dataVigencia(p) ?? p.periodo)}
                          </td>
                          <td
                            className={`px-5 py-3 text-center tabular-nums font-medium ${overdue ? "text-red-600" : "text-slate-700"}`}
                          >
                            {nextRev ? formatDateShort(nextRev) : "—"}
                          </td>
                          <td className="px-2 py-3 text-slate-400">
                            {bloqueado ? null : aba === "vigentes" ? (
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${expandido ? "rotate-180" : ""}`}
                              />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                        </tr>
                        {expandido && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={9} className="px-6 py-5">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Descrição do Processo */}
                                <div className="rounded-xl border border-slate-200 bg-white p-5">
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2 text-slate-700 min-w-0">
                                      <Info className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-sm font-semibold truncate">
                                        Descrição do Processo
                                      </span>
                                    </div>
                                    {/* "Ver detalhes" só para Modelo K1 (abre a última versão
                                        validada). Documento primário não tem essa visão. */}
                                    {isK1(p) && (
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(
                                            `/gestao-estrategica/processos/${p.id}`,
                                          );
                                        }}
                                        className="h-8 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
                                      >
                                        Ver detalhes
                                        <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                                      </Button>
                                    )}
                                  </div>
                                  {p.descricao?.trim() ? (
                                    <p className="text-sm text-slate-700 whitespace-pre-line [overflow-wrap:anywhere] text-justify">
                                      <RichText text={p.descricao} />
                                    </p>
                                  ) : (
                                    <p className="text-sm text-slate-400">
                                      Sem descrição cadastrada.
                                    </p>
                                  )}
                                </div>

                                {/* Documentos Anexados */}
                                <div className="rounded-xl border border-slate-200 bg-white p-5">
                                  <div className="flex items-center justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2 text-slate-700 min-w-0">
                                      <Paperclip className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-sm font-semibold truncate">
                                        Documentos Anexados ao Processo
                                      </span>
                                    </div>
                                    {docs.length > 0 && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          baixarTodosDocumentos(p);
                                        }}
                                        disabled={baixandoTodosId === p.id}
                                        className="h-8 flex-shrink-0"
                                      >
                                        {baixandoTodosId === p.id ? (
                                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                        ) : (
                                          <Download className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        Baixar todos
                                      </Button>
                                    )}
                                  </div>
                                  {docs.length === 0 ? (
                                    <p className="text-sm text-slate-400">
                                      Nenhum documento anexado.
                                    </p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {docs.map((doc, idx) => {
                                        const rowKey = `${p.id}-${idx}`;
                                        const baixando =
                                          baixandoDocKey === rowKey;
                                        const badgeLabel =
                                          doc.tipo === "PRI"
                                            ? "Doc. Primário"
                                            : doc.tipo === "FLUXOGRAMA"
                                              ? "Fluxograma"
                                              : doc.tipo === "AUX"
                                                ? "Aux"
                                                : doc.tipo;
                                        return (
                                          <li
                                            key={rowKey}
                                            className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                                          >
                                            <span
                                              className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded border flex-shrink-0 ${TIPO_DOCUMENTO_BADGE[doc.tipo] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                                            >
                                              {badgeLabel}
                                            </span>
                                            <span
                                              className="flex-1 min-w-0 truncate text-sm text-slate-700"
                                              title={
                                                doc.nome_exibicao || doc.nome
                                              }
                                            >
                                              {doc.nome_exibicao ||
                                                doc.nome ||
                                                "—"}
                                            </span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                abrirDocumentoArtefato(
                                                  rowKey,
                                                  p.id,
                                                  doc,
                                                );
                                              }}
                                              disabled={baixando}
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex-shrink-0"
                                              title="Abrir documento (PDF)"
                                            >
                                              {baixando ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <FileText className="h-4 w-4" />
                                              )}
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
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

      {/* Modal "Revisar Processo" — escolhe o tipo de revisão (Ordinária/Extraordinária) e o
          processo, e encaminha para a tela de revisão (edição + fluxo de validação). */}
      <Dialog open={revisarOpen} onOpenChange={setRevisarOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden border-0 bg-white p-0 sm:rounded-2xl">
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
            <RefreshCw className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Revisar Processo
              </h2>
              <p className="text-xs text-slate-500">
                Selecione o tipo de revisão e o processo a ser revisado.
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Passo 1 — Tipo de Revisão */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                1. Tipo de Revisão
              </p>
              <div className="grid gap-2">
                {[
                  {
                    tipo: "ordinaria" as const,
                    titulo: "Revisão Ordinária Anual",
                    desc: "Revisão periódica de processos cuja data de revisão já venceu.",
                    count: processosRevisaoVencida.length,
                  },
                  {
                    tipo: "extraordinaria" as const,
                    titulo: "Revisão Extraordinária",
                    desc: "Revisão antecipada, antes da data prevista, por necessidade pontual.",
                    count: processosParaRevisar.length,
                  },
                ].map((op) => {
                  const ativo = tipoRevisao === op.tipo;
                  return (
                    <button
                      key={op.tipo}
                      type="button"
                      onClick={() => {
                        setTipoRevisao(op.tipo);
                        setProcessoRevisaoId(null);
                      }}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        ativo
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                          ativo ? "border-blue-600 bg-blue-600" : "border-slate-300"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {op.titulo}
                          </span>
                          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-600">
                            {op.count}
                          </span>
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {op.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Passo 2 — Selecionar Processo */}
            {tipoRevisao && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  2. Selecionar Processo
                </p>
                {processosDoTipo.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                    Nenhum processo disponível para este tipo de revisão.
                  </p>
                ) : (
                  <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                    {processosDoTipo.map((p) => {
                      const next = proximaRevisao(p);
                      const sel = processoRevisaoId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setProcessoRevisaoId(p.id)}
                          className={`flex w-full items-start gap-3 px-3 py-2.5 text-left ${
                            sel ? "bg-blue-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`mt-1 h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 ${
                              sel ? "border-blue-600 bg-blue-600" : "border-slate-300"
                            }`}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-800 line-clamp-1">
                              {p.nome_processo}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {p.diretoria}
                              {next
                                ? ` · próx. revisão ${next.toLocaleDateString("pt-BR")}`
                                : ""}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {tipoRevisao === "extraordinaria" && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      A revisão extraordinária antecipa o ciclo anual. A próxima
                      revisão passará a contar a partir desta data.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevisarOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={avancarRevisao}
              disabled={processoRevisaoId == null}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Avançar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogos */}
      <ProcessoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        processo={editing}
        diretoriaPadrao={user?.diretoria || undefined}
        modoInicial={formModo}
        onSaved={handleSaved}
        onProcessoChanged={handleProcessoChangedNoForm}
        validacao={validacaoDoEditing}
      />
      <ProcessoDetalhe
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        processo={selecionado}
        onChanged={handleChanged}
        onEdit={handleEditar}
        loadingFull={detalheLoading}
        validacao={validacaoDoSelecionado}
      />
    </Layout>
  );
}
