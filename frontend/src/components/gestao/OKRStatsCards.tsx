import { useMemo } from "react";
import { useGestao } from "@/contexts/GestaoContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { CardIndicador } from "./CardIndicador";
import { Target, CheckCircle2, Clock, Play } from "lucide-react";

export function OKRStatsCards() {
  const { keyResults } = useGestao();
  const { selectedAreaId, selectedArea } = useDirectorate();

  const stats = useMemo(() => {
    const filteredKRs = keyResults.filter(
      (kr) => Number(kr.cadastrosAreasId) === Number(selectedAreaId),
    );
    const total = filteredKRs.length;
    const concluido = filteredKRs.filter(
      (kr) => kr.status === "CONCLUIDO",
    ).length;
    const emAndamento = filteredKRs.filter(
      (kr) => kr.status === "EM_ANDAMENTO",
    ).length;
    const aIniciar = filteredKRs.filter(
      (kr) => kr.status === "NAO_INICIADO",
    ).length;

    return { total, concluido, emAndamento, aIniciar };
  }, [keyResults, selectedAreaId]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xl:gap-3 2xl:gap-4 w-full h-full">
      <CardIndicador
        title="Totais"
        value={stats.total}
        icon={Target}
        color="blue"
      />
      <CardIndicador
        title="Concluido"
        value={stats.concluido}
        icon={CheckCircle2}
        color="green"
      />
      <CardIndicador
        title="Em andamento"
        value={stats.emAndamento}
        icon={Clock}
        color="yellow"
      />
      <CardIndicador
        title="A iniciar"
        value={stats.aIniciar}
        icon={Play}
        color="orange"
      />
    </div>
  );
}
