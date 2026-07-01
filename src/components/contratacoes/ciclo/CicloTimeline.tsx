import { cn } from "@/lib/utils";

/**
 * Linha do tempo do Ciclo Orçamentário (RF-42 e RF-78).
 *
 * - Formação: 11 nós em duas pernas (Formação 1–7; Revisão e publicação 8–11).
 * - Revisão: 4 nós (Janela → Consolidação CCA/GEJUT → Comitês → Remessa DG).
 *
 * Cada nó tem área (acima), fase (na bolinha) e data-limite (abaixo). O nó ativo é derivado
 * do estado (índice global); a régua é somente-leitura. O nó "Publicação" é um marco (sem data).
 * Portada do mockup de alto nível para o design system do Kaizen.
 */

export interface CicloTimelineNode {
  /** Área/ator responsável exibido acima do nó. */
  area: string;
  /** Nome curto da fase, exibido na bolinha. */
  fase: string;
  /** Data-limite exibida abaixo do nó (ou "evento"/"—"). */
  data: string;
  /** Data em tom suave (prazos "até", eventos sem data cravada). */
  soft?: boolean;
  /** Marco de virada (ex.: Publicação) — sempre estilizado como marco, independe do ativo. */
  marco?: boolean;
}

export interface CicloTimelinePerna {
  label: string;
  nodes: CicloTimelineNode[];
}

interface CicloTimelineProps {
  /** Pernas da linha do tempo (1 na Revisão, 2 na Formação). */
  pernas: CicloTimelinePerna[];
  /** Índice global (0-based) do nó ativo. -1 = nenhum ativo (fora de janela). */
  activeIndex: number;
  /** Exibe o item "Marco" na legenda (usado na Formação). */
  showMarcoLegend?: boolean;
  className?: string;
}

type EstadoNo = "done" | "active" | "future" | "marco";

function estadoDoNo(i: number, active: number, marco?: boolean): EstadoNo {
  if (marco) return "marco";
  if (active < 0) return "future";
  if (i < active) return "done";
  if (i === active) return "active";
  return "future";
}

const BUBBLE_STYLES: Record<EstadoNo, string> = {
  done: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  active: "bg-blue-600 text-white border border-blue-600 shadow-sm",
  future: "bg-white text-slate-500 border border-slate-300",
  marco: "bg-white text-slate-500 border-[1.5px] border-dashed border-slate-300",
};

function Perna({
  nodes,
  baseIndex,
  active,
}: {
  nodes: CicloTimelineNode[];
  baseIndex: number;
  active: number;
}) {
  return (
    <div>
      {/* Áreas (acima) */}
      <div className="flex gap-1">
        {nodes.map((n, idx) => (
          <div
            key={`a-${idx}`}
            className="flex-1 min-w-0 text-center text-[10px] leading-tight text-slate-400 min-h-[26px] flex items-end justify-center"
          >
            {n.area}
          </div>
        ))}
      </div>

      {/* Bolinhas + régua */}
      <div className="relative my-1.5">
        <div className="absolute top-1/2 left-[7%] right-[7%] h-0.5 -translate-y-1/2 bg-slate-200" />
        <div className="relative z-10 flex gap-1">
          {nodes.map((n, idx) => {
            const estado = estadoDoNo(baseIndex + idx, active, n.marco);
            return (
              <div key={`b-${idx}`} className="flex-1 min-w-0 flex justify-center">
                <div
                  className={cn(
                    "mx-auto min-h-[40px] max-w-[108px] w-full flex items-center justify-center text-center px-1.5 py-1 rounded-lg text-[10.5px] font-medium leading-tight",
                    BUBBLE_STYLES[estado],
                  )}
                >
                  {n.fase}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Datas (abaixo) */}
      <div className="flex gap-1">
        {nodes.map((n, idx) => (
          <div
            key={`d-${idx}`}
            className={cn(
              "flex-1 min-w-0 text-center text-[10px] font-medium",
              n.soft ? "text-slate-400" : "text-slate-500",
            )}
          >
            {n.data}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CicloTimeline({
  pernas,
  activeIndex,
  showMarcoLegend = false,
  className,
}: CicloTimelineProps) {
  let running = 0;
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 pb-[18px]",
        className,
      )}
    >
      {pernas.map((perna, pIdx) => {
        const base = running;
        running += perna.nodes.length;
        return (
          <div key={pIdx}>
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400 mb-1.5",
                pIdx > 0 && "mt-4 border-t border-dashed border-slate-200 pt-3.5",
              )}
            >
              {perna.label}
            </p>
            <Perna nodes={perna.nodes} baseIndex={base} active={activeIndex} />
          </div>
        );
      })}

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3.5 mt-3.5 pt-3 border-t border-slate-200">
        <LegendaItem className="bg-blue-600" label="Atual" />
        <LegendaItem
          className="bg-white border border-slate-300"
          label="Futura"
        />
        <LegendaItem className="bg-emerald-50" label="Concluída" />
        {showMarcoLegend && (
          <LegendaItem
            className="bg-white border-[1.5px] border-dashed border-slate-300"
            label="Marco"
          />
        )}
      </div>
    </div>
  );
}

function LegendaItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
      <span className={cn("h-2.5 w-2.5 rounded", className)} />
      {label}
    </span>
  );
}
