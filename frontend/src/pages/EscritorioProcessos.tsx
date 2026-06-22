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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  processosNegocioApi,
  ProcessoNegocio,
  temFluxograma,
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
// MAPEAMENTOS DE STATUS — converte o estado de validação interno (6 valores)
// nos 4 buckets que o hub apresenta visualmente.
// ============================================================
const HUB_STATUS = [
  "Ativo",
  "Em Revisão",
  "Aguardando Revisão",
  "Revisão Pendente",
] as const;
type HubStatus = (typeof HUB_STATUS)[number];

const HUB_STATUS_BADGE: Record<HubStatus, string> = {
  Ativo: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Em Revisão": "bg-blue-100 text-blue-700 border-blue-200",
  "Aguardando Revisão": "bg-amber-100 text-amber-700 border-amber-200",
  "Revisão Pendente": "bg-red-100 text-red-700 border-red-200",
};

const HUB_STATUS_DOT: Record<HubStatus, string> = {
  Ativo: "#10b981",
  "Em Revisão": "#3b82f6",
  "Aguardando Revisão": "#f59e0b",
  "Revisão Pendente": "#ef4444",
};

const REV_SITUACAO = [
  "No prazo",
  "Aguardando revisão",
  "Revisão vencida",
  "Em revisão",
] as const;
type RevSituacao = (typeof REV_SITUACAO)[number];
const REV_SITUACAO_COLOR: Record<RevSituacao, string> = {
  "No prazo": "#10b981",
  "Aguardando revisão": "#f59e0b",
  "Revisão vencida": "#ef4444",
  "Em revisão": "#3b82f6",
};

const MATURIDADE_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "Nível 1 - Mapeado",
  2: "Nível 2 - Básico",
  3: "Nível 3 - Parcial",
  4: "Nível 4 - Completo",
};
const MATURIDADE_DESC: Record<1 | 2 | 3 | 4, string> = {
  1: "(Formulário cadastrado)",
  2: "(Formulário + 1 doc.)",
  3: "(Formulário + 2 docs.)",
  4: "(Formulário + MPS + POP + Fluxograma)",
};
const MATURIDADE_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: "#8b5cf6",
  2: "#3b82f6",
  3: "#f59e0b",
  4: "#10b981",
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Mapeia o status interno (em_elaboracao, enviado, etc.) → bucket do hub.
 * Regra:
 *  - Homologado (validado_final) + dentro do prazo → "Ativo"
 *  - Homologado mas próxima revisão vencida → "Revisão Pendente"
 *  - Em fluxo de validação → "Aguardando Revisão"
 *  - Em edição → "Em Revisão"
 *  - Recusado → "Revisão Pendente"
 */
function hubStatusOf(p: ProcessoNegocio): HubStatus {
  if (p.status === "em_elaboracao") return "Em Revisão";
  if (
    p.status === "enviado" ||
    p.status === "validado_autor" ||
    p.status === "validado_diretoria"
  ) {
    return "Aguardando Revisão";
  }
  if (p.status === "recusado") return "Revisão Pendente";
  // validado_final → verifica se a próxima revisão venceu
  const next = nextRevisionDate(p);
  if (next && next.getTime() < Date.now()) return "Revisão Pendente";
  return "Ativo";
}

/**
 * Próxima revisão = Período cadastrado + 1 ano (regra fixa do módulo).
 * Retorna Date ou null se o período não estiver definido / for inválido.
 */
function nextRevisionDate(p: ProcessoNegocio): Date | null {
  if (!p.periodo) return null;
  const m = p.periodo.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Situação da revisão pro gráfico "Situação das Revisões". */
function revSituacaoOf(p: ProcessoNegocio): RevSituacao {
  if (p.status === "em_elaboracao") return "Em revisão";
  if (
    p.status === "enviado" ||
    p.status === "validado_autor" ||
    p.status === "validado_diretoria"
  ) {
    return "Aguardando revisão";
  }
  const next = nextRevisionDate(p);
  if (!next) return "No prazo";
  const diff = next.getTime() - Date.now();
  if (diff < 0) return "Revisão vencida";
  if (diff < 60 * 24 * 60 * 60 * 1000) return "Aguardando revisão";
  return "No prazo";
}

/**
 * Maturidade calculada a partir dos artefatos disponíveis.
 *  N1: só formulário cadastrado
 *  N2: 1 artefato (fluxograma OU 1 doc anexado)
 *  N3: 2 artefatos
 *  N4: completo — tem MPS + POP + Fluxograma
 */
function maturidadeOf(p: ProcessoNegocio): 1 | 2 | 3 | 4 {
  const docs = p.documentos_anexados || [];
  const hasMps = docs.some((d) => d.tipo === "MPS");
  const hasPop = docs.some((d) => d.tipo === "POP");
  const hasAux = docs.some((d) => d.tipo === "AUX");
  const hasFlux = temFluxograma(p);
  if (hasMps && hasPop && hasFlux) return 4;
  const total = [hasMps, hasPop, hasAux, hasFlux].filter(Boolean).length;
  if (total >= 2) return 3;
  if (total >= 1) return 2;
  return 1;
}

function formatDateShort(d: string | null | undefined | Date) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("pt-BR");
}

// ============================================================
// HOOK DE ANIMAÇÃO — sweep horário + fade + scale (mesmo padrão usado em GraficoRosca).
// O `key` permite reanimar quando os dados mudam (re-render do filtro).
// ============================================================
function useSweepAnimation(key: any, duration = 1200) {
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
        (el.style as any).webkitMaskImage = mask;
        frame = requestAnimationFrame(animate);
      } else {
        el.style.maskImage = "none";
        (el.style as any).webkitMaskImage = "none";
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
// HOOK DE ANIMAÇÃO HORIZONTAL — wipe da esquerda pra direita, ideal pra barras horizontais.
// As barras "aparecem" como se uma cortina deslizasse revelando o conteúdo.
// ============================================================
function useWipeAnimation(key: any, duration = 1300) {
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

      // Fade-in nos primeiros 30%
      const opacity = Math.min(progress / 0.3, 1);
      el.style.opacity = String(opacity);

      // Slide horizontal pequeno (-12px → 0) nos primeiros 50%
      const slideProgress = Math.min(progress / 0.5, 1);
      const slideEased = 1 - Math.pow(1 - slideProgress, 3);
      el.style.transform = `translateX(${-12 + 12 * slideEased}px)`;

      if (progress < 1) {
        const mask = `linear-gradient(to right, black ${wipePct}%, transparent ${wipePct}%)`;
        el.style.maskImage = mask;
        (el.style as any).webkitMaskImage = mask;
        frame = requestAnimationFrame(animate);
      } else {
        el.style.maskImage = "none";
        (el.style as any).webkitMaskImage = "none";
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
  // Esconde o número central enquanto o usuário está com o mouse em cima do donut
  // (assim o tooltip não fica sobreposto pelo total).
  const [hovering, setHovering] = useState(false);
  // Reanima a cada mudança no conjunto de dados (carregamento inicial + troca de filtro)
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
                ).map((entry: any, idx) => (
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
          {/* Total no centro do donut — some no hover pra não brigar com o tooltip */}
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
  // Animação distinta dos donuts: wipe horizontal da esquerda pra direita, casando
  // com a orientação das barras (que crescem horizontalmente).
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
              formatter={(v: number, _n, props: any) => [
                `${v} (${props.payload.pct}%)`,
                "Processos",
              ]}
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

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function EscritorioProcessos() {
  const { user } = useAuth();
  const [processos, setProcessos] = useState<ProcessoNegocio[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroMacro, setFiltroMacro] = useState<string>("all");
  const [filtroArea, setFiltroArea] = useState<string>("all");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  const [filtroDiretoria, setFiltroDiretoria] = useState<string>("all");
  // Filtro disparado pelos cards de topo: 'all' = nenhum (mostra tudo); demais filtram por tipo de artefato
  const [filtroArtefato, setFiltroArtefato] = useState<
    "all" | "mps" | "pop" | "flux"
  >("all");
  // Busca por nome do processo — afeta apenas a tabela (não os cards/gráficos)
  const [buscaProcesso, setBuscaProcesso] = useState("");

  // Modais
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessoNegocio | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<ProcessoNegocio | null>(null);

  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isSuperadmin = (user as any)?.is_superadmin === true;
  // Apenas superadmin e usuários da SGJT podem ver/trocar o filtro de Diretoria.
  // Os demais ficam travados na própria diretoria.
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

  // Trava a diretoria do filtro pra do próprio usuário quando ele não pode trocar.
  useEffect(() => {
    if (!podeFiltrarDiretoria && user?.diretoria) {
      setFiltroDiretoria(user.diretoria);
    }
  }, [podeFiltrarDiretoria, user?.diretoria]);

  // ============================================================
  // OPÇÕES DOS FILTROS
  // ============================================================

  const macroprocessosOptions = useMemo(() => {
    const set = new Set<string>();
    processos.forEach((p) => p.macroprocesso && set.add(p.macroprocesso));
    return Array.from(set).sort();
  }, [processos]);

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
  // APLICAR FILTROS
  // ============================================================

  // Base — aplica os filtros "globais" (Macroprocesso, Área, Status, Diretoria).
  // É usado pra calcular os stat cards de topo (que precisam mostrar a contagem
  // de cada tipo de artefato no recorte atual, independente de qual card está ativo).
  const filteredBase = useMemo(() => {
    return processos.filter((p) => {
      if (filtroMacro !== "all" && p.macroprocesso !== filtroMacro)
        return false;
      if (
        filtroArea !== "all" &&
        !(p.areas_responsaveis || []).includes(filtroArea)
      )
        return false;
      if (filtroDiretoria !== "all" && p.diretoria !== filtroDiretoria)
        return false;
      if (filtroStatus !== "all" && hubStatusOf(p) !== filtroStatus)
        return false;
      return true;
    });
  }, [processos, filtroMacro, filtroArea, filtroDiretoria, filtroStatus]);

  // Conjunto totalmente filtrado (inclui o filtro disparado pelos cards). Usado nos
  // gráficos e na tabela.
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

  // Stat cards calculados sobre `filtered` — quando o usuário ativa um card de artefato,
  // o total e as demais contagens passam a refletir só o subset filtrado (ex: clicar em
  // MPS faz o total cair pro número de processos que têm MPS; POPs/Fluxogramas passam a
  // contar dentro desse subset).
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

  const statusChartData = useMemo(() => {
    const counts: Record<HubStatus, number> = {
      Ativo: 0,
      "Em Revisão": 0,
      "Aguardando Revisão": 0,
      "Revisão Pendente": 0,
    };
    filtered.forEach((p) => {
      counts[hubStatusOf(p)]++;
    });
    return HUB_STATUS.map((s) => ({
      name: s,
      value: counts[s],
      color: HUB_STATUS_DOT[s],
    }));
  }, [filtered]);

  const macroChartData = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((p) => {
      const m = p.macroprocesso || "Não informado";
      counts.set(m, (counts.get(m) || 0) + 1);
    });
    const arr = Array.from(counts.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct:
          filtered.length > 0 ? Math.round((value / filtered.length) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return arr;
  }, [filtered]);

  const revisaoChartData = useMemo(() => {
    const counts: Record<RevSituacao, number> = {
      "No prazo": 0,
      "Aguardando revisão": 0,
      "Revisão vencida": 0,
      "Em revisão": 0,
    };
    filtered.forEach((p) => {
      counts[revSituacaoOf(p)]++;
    });
    return REV_SITUACAO.map((s) => ({
      name: s,
      value: counts[s],
      color: REV_SITUACAO_COLOR[s],
    }));
  }, [filtered]);

  const maturidadeChartData = useMemo(() => {
    const counts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    filtered.forEach((p) => {
      counts[maturidadeOf(p)]++;
    });
    return ([1, 2, 3, 4] as const).map((n) => ({
      name: MATURIDADE_LABEL[n],
      desc: MATURIDADE_DESC[n],
      value: counts[n],
      color: MATURIDADE_COLOR[n],
    }));
  }, [filtered]);

  // ============================================================
  // TABELA (sem colunas Status e Maturidade, conforme solicitado)
  // ============================================================

  // Aplica a busca por nome SOMENTE na tabela — cards/gráficos continuam baseados em `filtered`.
  const tabelaProcessos = useMemo(() => {
    const q = buscaProcesso.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((p) =>
      (p.nome_processo || "").toLowerCase().includes(q),
    );
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
    try {
      const full = await processosNegocioApi.getById(p.id);
      setSelecionado((cur) => (cur && cur.id === full.id ? full : cur));
    } catch {
      /* mantém o objeto enxuto; erro já tratado pelo apiClient */
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

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Layout>
      <div className="space-y-5 page-transition-enter">
        {/* Trilha de navegação */}
        <Breadcrumbs
          items={[
            { label: "Gestão Estratégica", to: "/gestao-estrategica" },
            { label: "Escritório de Processos" },
          ]}
        />

        {/* HEADER — barra azul + label da seção + título */}
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

          <div className="flex items-end gap-3 flex-wrap">
            {/* Seletor de Diretoria — visível apenas pra superadmin e usuários da SGJT.
                Os demais ficam travados na própria diretoria (filtro aplicado no useEffect). */}
            {podeFiltrarDiretoria && (
              <div className="flex flex-col">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Diretoria
                </label>
                <Select
                  value={filtroDiretoria}
                  onValueChange={setFiltroDiretoria}
                >
                  <SelectTrigger className="w-[180px] h-10 bg-white">
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
            )}

            {isAdminOrManager && (
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

        {/* FILTROS + ÚLTIMA ATUALIZAÇÃO */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col flex-1 min-w-[200px]">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Macroprocesso
            </label>
            <Select value={filtroMacro} onValueChange={setFiltroMacro}>
              <SelectTrigger className="h-10 bg-white">
                <SelectValue placeholder="Todos os macroprocessos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os macroprocessos</SelectItem>
                {macroprocessosOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col flex-1 min-w-[200px]">
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
          <div className="flex flex-col flex-1 min-w-[200px]">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Status
            </label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-10 bg-white">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {HUB_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* STAT CARDS — cada um funciona como filtro. Clicar de novo no card ativo desativa. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Processos Mapeados"
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
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DonutChartCard
            title="Status dos Processos"
            data={statusChartData}
            total={stats.total}
          />
          <BarChartCard
            title="Processos por Macroprocesso"
            data={macroChartData}
          />
          <DonutChartCard
            title="Situação das Revisões (Próxima Revisão)"
            data={revisaoChartData}
            total={stats.total}
          />
          <DonutChartCard
            title="Maturidade dos Processos"
            data={maturidadeChartData}
            total={stats.total}
          />
        </div>

        {/* TABELA — sem colunas Status e Maturidade (conforme solicitado) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-4 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">Processos</h3>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                value={buscaProcesso}
                onChange={(e) => setBuscaProcesso(e.target.value)}
                placeholder="Buscar processo pelo nome..."
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
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Processo
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Macroprocesso
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Área
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Documentos Vinculados
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Última Atualização
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Próxima Revisão
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tabelaProcessos.map((p) => {
                      const nextRev = nextRevisionDate(p);
                      const overdue =
                        nextRev != null && nextRev.getTime() < Date.now();
                      const docs = p.documentos_anexados || [];
                      const hasMps = docs.some((d) => d.tipo === "MPS");
                      const hasPop = docs.some((d) => d.tipo === "POP");
                      const hasPri = docs.some((d) => d.tipo === "PRI");
                      const hasAux = docs.some((d) => d.tipo === "AUX");
                      const hasFlux = temFluxograma(p);
                      const areaLabel =
                        (p.areas_responsaveis || [])[0] || p.diretoria || "—";
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleAbrirDetalhe(p)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-3 text-slate-900 font-medium">
                            {p.nome_processo}
                          </td>
                          <td className="px-5 py-3 text-slate-700">
                            {p.macroprocesso || "—"}
                          </td>
                          <td className="px-5 py-3 text-slate-700">
                            {areaLabel}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {hasMps && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                                  MPS
                                </span>
                              )}
                              {hasPop && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  POP
                                </span>
                              )}
                              {hasPri && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200">
                                  PRI
                                </span>
                              )}
                              {hasAux && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">
                                  AUX
                                </span>
                              )}
                              {hasFlux && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-pink-50 text-pink-700 border-pink-200">
                                  Fluxograma
                                </span>
                              )}
                              {!hasMps &&
                                !hasPop &&
                                !hasPri &&
                                !hasAux &&
                                !hasFlux && (
                                  <span className="text-xs italic text-slate-400">
                                    —
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-700 tabular-nums">
                            {formatDateShort(p.updated_at)}
                          </td>
                          <td
                            className={`px-5 py-3 tabular-nums font-medium ${overdue ? "text-red-600" : "text-slate-700"}`}
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

              {/* Total de processos */}
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
      />
    </Layout>
  );
}
