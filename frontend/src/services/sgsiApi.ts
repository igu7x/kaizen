import { apiClient } from "./apiClient";

/** Instrumento normativo do SGSI (POSIC/TJGO basilar + 13 complementares). */
export interface SgsiInstrumento {
  codigo: string;
  ordem: number;
  numeral_romano: string | null;
  sigla_oficial: string;
  nome_curto: string;
  nome_completo: string;
  titulo_plano: string | null;
  cor_hex: string | null;
  restrito: boolean;
  artigos: number | null;
  versao: string | null;
  ancora: string;
  vigente_desde: string | null;
  // Agregados do plano 5W2H (só no listar).
  total_tarefas?: number;
  tarefas_concluidas?: number;
  progresso?: number;
}

export type SgsiTarefaStatus =
  | "NAO_INICIADA"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "ATRASADA"
  | "BLOQUEADA";

/** Tarefa do plano de trabalho 5W2H de um instrumento. */
export interface SgsiTarefa {
  id: number;
  instrumento_codigo: string;
  numero: number;
  fase: string;
  tipo: string;
  oque: string;
  porque: string | null;
  onde: string | null;
  quem: string | null;
  como: string | null;
  custo: string | null;
  dados_levantar: string | null;
  inicio_m: number;
  fim_m: number;
  status: SgsiTarefaStatus;
  percentual: number; // 0..1
  responsavel_id: number | null;
  atualizado_por: number | null;
  atualizado_em?: string;
}

const BASE = "/api/sgsi";

// O Jackson serializa numeric/bigint como STRING — coagimos os numéricos aqui.
function normInstrumento(i: SgsiInstrumento): SgsiInstrumento {
  return {
    ...i,
    ordem: Number(i.ordem),
    total_tarefas: i.total_tarefas != null ? Number(i.total_tarefas) : undefined,
    tarefas_concluidas:
      i.tarefas_concluidas != null ? Number(i.tarefas_concluidas) : undefined,
    progresso: i.progresso != null ? Number(i.progresso) : undefined,
  };
}

function normTarefa(t: SgsiTarefa): SgsiTarefa {
  return {
    ...t,
    id: Number(t.id),
    numero: Number(t.numero),
    inicio_m: Number(t.inicio_m),
    fim_m: Number(t.fim_m),
    percentual: Number(t.percentual),
  };
}

export const sgsiApi = {
  async listarInstrumentos(): Promise<SgsiInstrumento[]> {
    const data = await apiClient.get<SgsiInstrumento[]>(`${BASE}/instrumentos`);
    return (data || []).map(normInstrumento);
  },

  async buscarInstrumento(codigo: string): Promise<SgsiInstrumento> {
    return normInstrumento(
      await apiClient.get<SgsiInstrumento>(
        `${BASE}/instrumentos/${encodeURIComponent(codigo)}`,
      ),
    );
  },

  async listarTarefas(codigo: string): Promise<SgsiTarefa[]> {
    const data = await apiClient.get<SgsiTarefa[]>(
      `${BASE}/instrumentos/${encodeURIComponent(codigo)}/tarefas`,
    );
    return (data || []).map(normTarefa);
  },

  async atualizarTarefa(
    id: number,
    dados: {
      status?: SgsiTarefaStatus;
      percentual?: number; // 0..1
      observacao?: string;
    },
  ): Promise<SgsiTarefa> {
    return normTarefa(
      await apiClient.patch<SgsiTarefa>(`${BASE}/tarefas/${id}`, dados),
    );
  },
};
