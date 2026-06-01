import { useMemo } from 'react';
import { useGestao } from '@/contexts/GestaoContext';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { CardIndicador } from './CardIndicador';
import { GraficoBarras } from './GraficoBarras';
import { GraficoRosca } from './GraficoRosca';
import { Target, CheckCircle, Clock, PlayCircle, TrendingUp } from 'lucide-react';

export function VisaoGeral() {
  const { objectives, keyResults, initiatives } = useGestao();
  const { selectedDirectorate } = useDirectorate();

  // Filtrar por diretoria e ordenar (KRs Transversais por último)
  const filteredObjectives = useMemo(() => {
    return objectives
      .filter(obj => obj.directorate === selectedDirectorate)
      .sort((a, b) => {
        const aIsTransversal = a.code.toLowerCase().includes('transversa') || a.title?.toLowerCase().includes('transversa');
        const bIsTransversal = b.code.toLowerCase().includes('transversa') || b.title?.toLowerCase().includes('transversa');
        
        if (aIsTransversal && !bIsTransversal) return 1;
        if (!aIsTransversal && bIsTransversal) return -1;
        
        return a.code.localeCompare(b.code);
      });
  }, [objectives, selectedDirectorate]);

  const filteredKeyResults = useMemo(() => {
    return keyResults.filter(kr => kr.directorate === selectedDirectorate);
  }, [keyResults, selectedDirectorate]);

  const filteredInitiatives = useMemo(() => {
    return initiatives.filter(init => init.directorate === selectedDirectorate);
  }, [initiatives, selectedDirectorate]);

  const stats = useMemo(() => {
    const total = filteredKeyResults.length;
    const concluido = filteredKeyResults.filter(kr => kr.status === 'CONCLUIDO').length;
    const emAndamento = filteredKeyResults.filter(kr => kr.status === 'EM_ANDAMENTO').length;
    const aIniciar = filteredKeyResults.filter(kr => kr.status === 'NAO_INICIADO').length;
    const progresso = total > 0 ? Math.round((concluido / total) * 100) : 0;

    return { total, concluido, emAndamento, aIniciar, progresso };
  }, [filteredKeyResults]);

  // Status das OKRs por Objetivo
  const statusPorObjetivo = useMemo(() => {
    return filteredObjectives.map(obj => {
      const krs = filteredKeyResults.filter(kr => kr.objectiveId === obj.id);
      return {
        name: obj.code,
        concluido: krs.filter(kr => kr.status === 'CONCLUIDO').length,
        emAndamento: krs.filter(kr => kr.status === 'EM_ANDAMENTO').length,
        naoIniciado: krs.filter(kr => kr.status === 'NAO_INICIADO').length
      };
    });
  }, [filteredObjectives, filteredKeyResults]);

  // Status das OKRs por Fase (simulado - 5 fases)
  const statusPorFase = useMemo(() => {
    const fases = ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4', 'Fase 5'];
    return fases.map((fase, index) => {
      const krsNaFase = filteredKeyResults.filter((_, i) => i % 5 === index);
      return {
        name: fase,
        concluido: krsNaFase.filter(kr => kr.status === 'CONCLUIDO').length,
        emAndamento: krsNaFase.filter(kr => kr.status === 'EM_ANDAMENTO').length,
        naoIniciado: krsNaFase.filter(kr => kr.status === 'NAO_INICIADO').length
      };
    });
  }, [filteredKeyResults]);

  // Status Geral das OKRs (rosca)
  const statusGeral = useMemo(() => [
    { name: 'Concluído', value: stats.concluido },
    { name: 'Em andamento', value: stats.emAndamento },
    { name: 'Não iniciado', value: stats.aIniciar }
  ], [stats]);

  // Iniciativas por Objetivo
  const iniciativasPorObjetivo = useMemo(() => {
    return filteredObjectives.map(obj => {
      const krs = filteredKeyResults.filter(kr => kr.objectiveId === obj.id);
      const krIds = krs.map(kr => kr.id);
      const count = filteredInitiatives.filter(init => krIds.includes(init.keyResultId)).length;
      return {
        name: obj.code,
        value: count
      };
    });
  }, [filteredObjectives, filteredKeyResults, filteredInitiatives]);

  // Iniciativas por Fase
  const iniciativasPorFase = useMemo(() => {
    const fases = ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4', 'Fase 5'];
    return fases.map((fase, index) => ({
      name: fase,
      value: Math.floor(filteredInitiatives.length / 5) + (index === 0 ? filteredInitiatives.length % 5 : 0)
    }));
  }, [filteredInitiatives]);

  // Situação das OKRs
  const situacaoOKRs = useMemo(() => {
    const noPrazo = filteredKeyResults.filter(kr => kr.situation === 'NO_PRAZO').length;
    const finalizado = filteredKeyResults.filter(kr => kr.situation === 'FINALIZADO').length;
    const emAtraso = filteredKeyResults.filter(kr => kr.situation === 'EM_ATRASO').length;
    return [
      { name: 'No prazo', value: noPrazo },
      { name: 'Finalizado', value: finalizado },
      { name: 'Em atraso', value: emAtraso }
    ];
  }, [filteredKeyResults]);

  return (
    <div className="space-y-6">
      {/* Cards de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 xl:gap-5 2xl:gap-6">
        <CardIndicador title="Totais" value={stats.total} icon={Target} color="teal" />
        <CardIndicador title="Concluído" value={stats.concluido} icon={CheckCircle} color="green" />
        <CardIndicador title="Em Andamento" value={stats.emAndamento} icon={Clock} color="yellow" />
        <CardIndicador title="A iniciar" value={stats.aIniciar} icon={PlayCircle} color="orange" />
        <CardIndicador title="Progresso" value={`${stats.progresso}%`} icon={TrendingUp} color="teal" />
      </div>

      {/* Primeira linha de gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-5 2xl:gap-6">
        <GraficoBarras
          title="Status das OKRs por Objetivo"
          data={statusPorObjetivo}
          xAxisKey="name"
          dataKeys={[
            { key: 'concluido', name: 'Concluído', color: '#22c55e' },
            { key: 'emAndamento', name: 'Em andamento', color: '#facc15' },
            { key: 'naoIniciado', name: 'Não iniciado', color: '#fb923c' }
          ]}
        />
        <GraficoRosca
          title="Status Geral das OKRs"
          data={statusGeral}
          colors={['#22c55e', '#facc15', '#fb923c']}
        />
      </div>

      {/* Segunda linha com Status por Fase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-5 2xl:gap-6">
        <GraficoBarras
          title="Status das OKRs por Fase"
          data={statusPorFase}
          xAxisKey="name"
          dataKeys={[
            { key: 'concluido', name: 'Concluído', color: '#22c55e' },
            { key: 'emAndamento', name: 'Em andamento', color: '#facc15' },
            { key: 'naoIniciado', name: 'Não iniciado', color: '#fb923c' }
          ]}
        />
        <GraficoRosca
          title="Situação das OKRs"
          data={situacaoOKRs}
          colors={['#22c55e', '#3b82f6', '#ef4444']}
        />
      </div>

      {/* Terceira linha de gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-5 2xl:gap-6">
        <GraficoBarras
          title="Iniciativas por Objetivo"
          data={iniciativasPorObjetivo}
          xAxisKey="name"
          dataKeys={[
            { key: 'value', name: 'Iniciativas', color: '#3b82f6' }
          ]}
        />
        <GraficoBarras
          title="Iniciativas por Fase"
          data={iniciativasPorFase}
          xAxisKey="name"
          dataKeys={[
            { key: 'value', name: 'Iniciativas', color: '#8b5cf6' }
          ]}
        />
      </div>
    </div>
  );
}