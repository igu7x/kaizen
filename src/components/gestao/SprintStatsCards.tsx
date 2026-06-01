import { useMemo } from 'react';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { CardIndicador } from './CardIndicador';
import { Archive, Clock, CheckCircle, Target, TrendingUp } from 'lucide-react';
import { ExecutionControl } from '@/types';

interface SprintStatsCardsProps {
  executionData: ExecutionControl[];
}

export function SprintStatsCards({ executionData }: SprintStatsCardsProps) {
  const { selectedDirectorate } = useDirectorate();

  const stats = useMemo(() => {
    const filteredData = executionData.filter(item => item.directorate === selectedDirectorate);
    
    // Backlog = total de tarefas planejadas (todas as linhas com conteúdo em backlogTasks)
    const backlog = filteredData.filter(item => item.backlogTasks && item.backlogTasks.trim() !== '').length;
    
    // Em Fila = tarefas com status "FORA_SPRINT"
    const emFila = filteredData.filter(item => item.sprintStatus === 'FORA_SPRINT').length;
    
    // Concluído = tarefas com progress "FEITO"
    const concluido = filteredData.filter(item => item.progress === 'FEITO').length;
    
    // Sprint Atual = tarefas com status "SPRINT_ATUAL"
    const sprintAtual = filteredData.filter(item => item.sprintStatus === 'SPRINT_ATUAL').length;
    
    // Progresso = (concluído / backlog) * 100
    const progresso = backlog > 0 ? Math.round((concluido / backlog) * 100) : 0;

    return { backlog, emFila, concluido, sprintAtual, progresso };
  }, [executionData, selectedDirectorate]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 xl:gap-5 2xl:gap-6">
      <CardIndicador title="Backlog" value={stats.backlog} icon={Archive} color="teal" />
      <CardIndicador title="Em fila" value={stats.emFila} icon={Clock} color="orange" />
      <CardIndicador title="Concluído" value={stats.concluido} icon={CheckCircle} color="green" />
      <CardIndicador title="Sprint Atual" value={stats.sprintAtual} icon={Target} color="yellow" />
      <CardIndicador title="Progresso" value={`${stats.progresso}%`} icon={TrendingUp} color="teal" />
    </div>
  );
}