import { apiClient } from "./apiClient";

// ============================================================
// INTERFACES
// ============================================================

export interface Sprint {
  id: number;
  numero: number;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: "nao_iniciado" | "em_andamento" | "concluida" | "encerrada";
  ativo: boolean;
  tarefas_planejadas: number;
  tarefas_concluidas: number;
  tarefas_remanejadas: number;
  progresso: number;
}

export interface SprintComTarefas extends Sprint {
  tarefas: TarefaSprint[];
}

export interface TarefaSprint {
  id: number;
  nome: string;
  responsavel: string;
  status: string;
  entrega_id: number;
  entrega_nome: string;
  projeto_id: number;
  projeto_nome: string;
}

export interface EstatisticasSprints {
  total_sprints: number;
  sprints_com_tarefas: number;
  total_tarefas: number;
  tarefas_concluidas: number;
  progresso_geral: number;
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Lista todos os sprints com contagem de tarefas (filtrada por projeto/entrega)
 */
export async function getSprints(filters?: {
  projeto_id?: number;
  entrega_id?: number;
  diretoria?: string;
}): Promise<Sprint[]> {
  const params = new URLSearchParams();
  if (filters?.projeto_id)
    params.append("projeto_id", String(filters.projeto_id));
  if (filters?.entrega_id)
    params.append("entrega_id", String(filters.entrega_id));
  if (filters?.diretoria) params.append("diretoria", filters.diretoria);

  const query = params.toString();
  return apiClient.get<Sprint[]>(`/api/sprints${query ? `?${query}` : ""}`);
}

/**
 * Lista todos os 46 sprints (para dropdown de seleção)
 */
export async function getTodosSprints(): Promise<Sprint[]> {
  return apiClient.get<Sprint[]>("/api/sprints/todos");
}

/**
 * Busca estatísticas dos sprints
 */
export async function getEstatisticasSprints(filters?: {
  projeto_id?: number;
  entrega_id?: number;
  diretoria?: string;
}): Promise<EstatisticasSprints> {
  const params = new URLSearchParams();
  if (filters?.projeto_id)
    params.append("projeto_id", String(filters.projeto_id));
  if (filters?.entrega_id)
    params.append("entrega_id", String(filters.entrega_id));
  if (filters?.diretoria) params.append("diretoria", filters.diretoria);

  const query = params.toString();
  return apiClient.get<EstatisticasSprints>(
    `/api/sprints/estatisticas${query ? `?${query}` : ""}`,
  );
}

/**
 * Busca um sprint por ID com suas tarefas
 */
export async function getSprintById(
  id: number,
  filters?: {
    projeto_id?: number;
    entrega_id?: number;
  },
): Promise<SprintComTarefas> {
  const params = new URLSearchParams();
  if (filters?.projeto_id)
    params.append("projeto_id", String(filters.projeto_id));
  if (filters?.entrega_id)
    params.append("entrega_id", String(filters.entrega_id));

  const query = params.toString();
  return apiClient.get<SprintComTarefas>(
    `/api/sprints/${id}${query ? `?${query}` : ""}`,
  );
}

/**
 * Formata período do sprint para exibição
 */
export function formatarPeriodoSprint(
  dataInicio: string,
  dataFim: string,
): string {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  return `${formatDate(dataInicio)} a ${formatDate(dataFim)}`;
}

/**
 * Retorna a cor do status do sprint
 */
export function getCorStatusSprint(status: string): string {
  switch (status) {
    case "concluida":
      return "text-green-600";
    case "encerrada":
    case "encerrado": // Backwards compatibility
      return "text-orange-600";
    case "em_andamento":
      return "text-blue-600";
    case "nao_iniciado":
    default:
      return "text-gray-500";
  }
}

/**
 * Retorna o label do status do sprint
 */
export function getLabelStatusSprint(status: string): string {
  switch (status) {
    case "concluida":
      return "Concluída";
    case "encerrada":
    case "encerrado": // Backwards compatibility
      return "Encerrada";
    case "em_andamento":
      return "Em Andamento";
    case "nao_iniciado":
    default:
      return "Não Iniciado";
  }
}
