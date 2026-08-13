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

export type SgsiDocumentoStatus =
  | "PENDENTE"
  | "EM_ELABORACAO"
  | "EM_REVISAO"
  | "EM_ASSINATURA"
  | "ASSINADO"
  | "PUBLICADO"
  | "CANCELADO";

/** Obrigação documental exigida por um instrumento (286 no total). */
export interface SgsiDocumento {
  id: number;
  seed_key: string | null;
  nome: string;
  tipo: string;
  instrumento_codigo: string | null;
  tarefa_id: number | null;
  atividade: string | null;
  referencia: string | null;
  responsavel: string | null;
  prazo_marco: number | null;
  prazo_data: string | null;
  status: SgsiDocumentoStatus;
  origem: string;
  numero_emissao: string | null;
  atualizado_em?: string;
  // Enriquecimento (join).
  instrumento_sigla: string | null;
  instrumento_numeral: string | null;
  instrumento_ordem: number | null;
  tarefa_numero: number | null;
}

/** Indicador do SGSI (31). Meta/tolerância podem ser nulas (aguardando deliberação do CGSI). */
export interface SgsiIndicador {
  id: number;
  seed_key: string | null;
  instrumento_codigo: string | null;
  tarefa_id: number | null;
  nome: string;
  referencia: string | null;
  responsavel: string | null;
  formula: string | null;
  unidade: string;
  meta: number | null;
  tolerancia: number | null;
  direcao: ">=" | "<=";
  frequencia: string | null;
  ativo: boolean;
  instrumento_sigla: string | null;
  instrumento_ordem: number | null;
  ultimo_valor: number | null;
  ultima_competencia: string | null;
  ultima_data: string | null;
}

/** Medição de um indicador numa competência (AAAA-MM). */
export interface SgsiMedicao {
  id: number;
  indicador_id: number;
  competencia: string;
  data_referencia: string;
  valor: number;
  observacao: string | null;
  criado_em?: string;
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

function num(v: unknown): number | null {
  return v == null ? null : Number(v);
}

function normDocumento(d: SgsiDocumento): SgsiDocumento {
  return {
    ...d,
    id: Number(d.id),
    tarefa_id: num(d.tarefa_id),
    prazo_marco: num(d.prazo_marco),
    instrumento_ordem: num(d.instrumento_ordem),
    tarefa_numero: num(d.tarefa_numero),
  };
}

function normIndicador(i: SgsiIndicador): SgsiIndicador {
  return {
    ...i,
    id: Number(i.id),
    tarefa_id: num(i.tarefa_id),
    meta: num(i.meta),
    tolerancia: num(i.tolerancia),
    ultimo_valor: num(i.ultimo_valor),
    instrumento_ordem: num(i.instrumento_ordem),
  };
}

function normMedicao(m: SgsiMedicao): SgsiMedicao {
  return {
    ...m,
    id: Number(m.id),
    indicador_id: Number(m.indicador_id),
    valor: Number(m.valor),
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

  async listarDocumentos(filtros?: {
    instrumento?: string;
    status?: string;
    tipo?: string;
  }): Promise<SgsiDocumento[]> {
    const qs = new URLSearchParams();
    if (filtros?.instrumento) qs.set("instrumento", filtros.instrumento);
    if (filtros?.status) qs.set("status", filtros.status);
    if (filtros?.tipo) qs.set("tipo", filtros.tipo);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const data = await apiClient.get<SgsiDocumento[]>(
      `${BASE}/documentos${suffix}`,
    );
    return (data || []).map(normDocumento);
  },

  async atualizarStatusDocumento(
    id: number,
    status: SgsiDocumentoStatus,
  ): Promise<SgsiDocumento> {
    return normDocumento(
      await apiClient.patch<SgsiDocumento>(`${BASE}/documentos/${id}`, {
        status,
      }),
    );
  },

  async listarIndicadores(): Promise<SgsiIndicador[]> {
    const data = await apiClient.get<SgsiIndicador[]>(`${BASE}/indicadores`);
    return (data || []).map(normIndicador);
  },

  async listarMedicoes(indicadorId: number): Promise<SgsiMedicao[]> {
    const data = await apiClient.get<SgsiMedicao[]>(
      `${BASE}/indicadores/${indicadorId}/medicoes`,
    );
    return (data || []).map(normMedicao);
  },

  async registrarMedicao(
    indicadorId: number,
    dados: { competencia: string; valor: number; observacao?: string },
  ): Promise<SgsiMedicao> {
    return normMedicao(
      await apiClient.post<SgsiMedicao>(
        `${BASE}/indicadores/${indicadorId}/medicoes`,
        dados,
      ),
    );
  },
};
