import { useEffect, useMemo, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GraficoRoscaProps {
  title: string;
  data: { name: string; value: number }[];
  colors: string[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  cardClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
  isMonitoramento?: boolean;
}

/**
 * Label com linha reta curta partindo da borda do gráfico.
 * Usa diretamente midAngle do Recharts (sem pré-cálculo) para evitar desalinhamento.
 */
function createLabelRenderer(_data: { name: string; value: number }[]) {
  const RADIAN = Math.PI / 180;
  const LINE_LEN = 14;

  return (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, fill } = props;
    if (percent === 0) return null;

    const text = `${(percent * 100).toFixed(0)}%`;

    // 100%: texto no centro do donut
    if (percent >= 0.99) {
      return (
        <text
          x={cx}
          y={cy}
          fill={fill}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[13px] font-bold"
        >
          {text}
        </text>
      );
    }

    const startX = cx + outerRadius * Math.cos(-midAngle * RADIAN);
    const startY = cy + outerRadius * Math.sin(-midAngle * RADIAN);
    const endX = cx + (outerRadius + LINE_LEN) * Math.cos(-midAngle * RADIAN);
    const endY = cy + (outerRadius + LINE_LEN) * Math.sin(-midAngle * RADIAN);
    const isRight = endX >= cx;

    return (
      <g>
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={fill}
          strokeWidth={1}
        />
        <text
          x={endX + (isRight ? 4 : -4)}
          y={endY}
          fill={fill}
          textAnchor={isRight ? "start" : "end"}
          dominantBaseline="central"
          className="text-[11px] font-bold"
        >
          {text}
        </text>
      </g>
    );
  };
}

/**
 * Hook: scale + fade + sweep horário combinados.
 * Gráfico cresce de 0.6→1.0, aparece com fade, e o sweep revela no sentido do relógio.
 */
function useSweepAnimation(duration = 1200) {
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

      // Fade-in nos primeiros 25%
      const opacity = Math.min(progress / 0.25, 1);
      el.style.opacity = String(opacity);

      // Scale cresce de 0.6 → 1.0 (termina nos primeiros 60% da animação)
      const scaleProgress = Math.min(progress / 0.6, 1);
      const scaleEased = 1 - Math.pow(1 - scaleProgress, 3);
      el.style.transform = `scale(${0.6 + 0.4 * scaleEased})`;

      if (progress < 1) {
        // Sweep horário: revela do topo no sentido do relógio
        const mask = `conic-gradient(from -90deg at 50% 50%, black ${angle}deg, transparent ${angle}deg)`;
        el.style.maskImage = mask;
        el.style.webkitMaskImage = mask;
        frame = requestAnimationFrame(animate);
      } else {
        el.style.maskImage = "none";
        el.style.webkitMaskImage = "none";
        el.style.opacity = "1";
        el.style.transform = "none";
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  return ref;
}

export function GraficoRosca({
  title,
  data,
  colors,
  height = 280,
  innerRadius = 55,
  outerRadius = 90,
  cardClassName,
  headerClassName,
  contentClassName,
  isMonitoramento = false,
}: GraficoRoscaProps) {
  const sweepRef = useSweepAnimation(1500);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  // Filtrar dados com valor > 0 para o gráfico (evita espaços em branco)
  const chartData = data.filter((d) => d.value > 0);
  const chartColors = data.reduce<string[]>((acc, entry, index) => {
    if (entry.value > 0) acc.push(colors[index % colors.length]);
    return acc;
  }, []);

  // Label renderer com anti-colisão, memoizado por chartData
  const labelRenderer = useMemo(
    () => createLabelRenderer(chartData),
    [JSON.stringify(chartData)],
  );

  // Para Monitoramento de OKRs: Layout horizontal com gráfico grande + legenda à direita
  if (isMonitoramento) {
    return (
      <div
        className={cn("flex items-center h-full w-full gap-4", cardClassName)}
      >
        {/* Gráfico com sweep animation via conic-gradient mask */}
        <div
          ref={sweepRef}
          className="w-[220px] h-[180px] flex-shrink-0"
          style={{ overflow: "visible" }}
        >
          <PieChart
            width={220}
            height={180}
            margin={{ top: 25, right: 35, bottom: 25, left: 35 }}
            style={{ overflow: "visible" }}
          >
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              fill="#8884d8"
              paddingAngle={2}
              dataKey="value"
              label={labelRenderer}
              labelLine={false}
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </div>

        {/* Legenda Vertical à direita */}
        <div className="flex flex-col justify-center gap-3 flex-shrink-0">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-gray-700 font-medium text-sm whitespace-nowrap">
                {entry.name}
              </span>
              <span className="text-gray-500 text-sm">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Para Visão Geral: Layout Padrão com Box
  return (
    <Card
      className={cn(
        "border border-gray-200 shadow-md rounded-lg flex flex-col h-[400px] overflow-visible",
        cardClassName,
      )}
    >
      <CardHeader className={cn(headerClassName, "pb-2 py-3 flex-shrink-0")}>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base leading-none">{title}</CardTitle>
          {/* Legenda no canto superior direito */}
          <div className="flex flex-col gap-0.5">
            {data.map((entry, index) => (
              <div
                key={entry.name}
                className="flex items-center gap-1.5 text-xs whitespace-nowrap"
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-gray-700 font-medium">{entry.name}</span>
                <span className="text-gray-600 text-xs">({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          contentClassName,
          "p-4 pt-0 flex flex-col items-center justify-center flex-1 overflow-visible",
        )}
      >
        {/* Gráfico com sweep animation */}
        <div
          ref={sweepRef}
          className="w-full h-full flex items-center justify-center"
          style={{ overflow: "visible" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart
              margin={{ top: 30, right: 40, bottom: 30, left: 40 }}
              style={{ overflow: "visible" }}
            >
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                fill="#8884d8"
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
                label={labelRenderer}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
