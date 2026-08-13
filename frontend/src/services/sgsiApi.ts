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

/** Visão executiva agregada do módulo (Painel de Compliance). */
export interface SgsiPainel {
  tarefas: {
    total: number;
    concluidas: number;
    em_andamento: number;
    atrasadas: number;
    bloqueadas: number;
    nao_iniciadas: number;
    progresso: number;
  };
  documentos: {
    total: number;
    pendentes: number;
    publicados: number;
    cancelados: number;
  };
  indicadores: {
    total: number;
    com_meta: number;
    com_medicao: number;
    dentro_meta: number;
    fora_meta: number;
  };
  instrumentos: {
    codigo: string;
    sigla_oficial: string;
    numeral_romano: string | null;
    ordem: number;
    cor_hex: string | null;
    restrito: boolean;
    total_tarefas: number;
    tarefas_concluidas: number;
    progresso: number;
  }[];
}

/** Framework de governança (CIS, NIST, ISO 27001/27002, COBIT, LGPD). */
export interface SgsiFramework {
  codigo: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  total_itens: number;
  avaliados: number;
  conformes: number;
}

export type SgsiAvaliacaoStatus =
  | "NAO_AVALIADO"
  | "CONFORME"
  | "PARCIALMENTE_CONFORME"
  | "NAO_CONFORME"
  | "NAO_APLICAVEL";

/** Item de um framework, com instrumentos vinculados e avaliação de conformidade. */
export interface SgsiFrameworkItem {
  id: number;
  framework_codigo: string;
  item_id: string;
  nome: string;
  ordem: number;
  avaliacao_status: SgsiAvaliacaoStatus;
  avaliacao_observacao: string | null;
  avaliado_em?: string | null;
  instrumentos: string | null; // siglas separadas por vírgula
}

export type SgsiRiscoStatus =
  | "IDENTIFICADO"
  | "EM_ANALISE"
  | "EM_TRATAMENTO"
  | "MITIGADO"
  | "ACEITO";
export type SgsiPlanoStatus = "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO";

/** Risco do registro do SGSI. O IRS é calculado no backend (prob × sev × relevância). */
export interface SgsiRisco {
  id: number;
  instrumento_codigo: string | null;
  instrumento_sigla: string | null;
  titulo: string;
  ativo_informacao: string | null;
  ameaca: string | null;
  vulnerabilidade: string | null;
  dono: string | null;
  probabilidade: number;
  severidade: number;
  relevancia: number;
  probabilidade_residual: number | null;
  severidade_residual: number | null;
  controles: string | null;
  status: SgsiRiscoStatus;
  criado_em?: string;
  atualizado_em?: string;
  irs_inerente: number;
  irs_residual: number;
  plano_descricao: string | null;
  plano_responsavel: string | null;
  plano_prazo: string | null;
  plano_status: SgsiPlanoStatus | null;
}

export type SgsiRiscoInput = {
  titulo: string;
  instrumento_codigo?: string | null;
  status?: SgsiRiscoStatus;
  ativo_informacao?: string | null;
  ameaca?: string | null;
  vulnerabilidade?: string | null;
  dono?: string | null;
  probabilidade: number;
  severidade: number;
  relevancia: number;
  probabilidade_residual?: number | null;
  severidade_residual?: number | null;
  controles?: string | null;
  plano_descricao?: string | null;
  plano_responsavel?: string | null;
  plano_prazo?: string | null;
  plano_status?: SgsiPlanoStatus | null;
};

/** Linha da Matriz de Rastreabilidade (atividade → normativo → documento → emissão). */
export interface SgsiMatrizItem {
  id: number;
  instrumento_codigo: string | null;
  instrumento_sigla: string | null;
  instrumento_numeral: string | null;
  instrumento_ordem: number | null;
  tarefa_numero: number | null;
  tarefa_fase: string | null;
  atividade: string | null;
  documento: string;
  tipo: string;
  normativo_origem: string | null;
  responsavel: string | null;
  prazo_marco: number | null;
  status: string;
  numero_emissao: string | null;
  prazo_efetivo: string | null;
}

/** Série de numeração de documentos. */
export interface SgsiSerie {
  codigo: string;
  nome: string;
  prefixo: string;
  mascara: string;
  digitos: number;
  reinicia: "ANO" | "NUNCA";
  orgao: string | null;
  ativa: boolean;
}

export type SgsiClassificacao =
  | "PUBLICA"
  | "INTERNA"
  | "RESTRITA"
  | "SIGILOSA_CLASSIFICADA";

/** Emissão (documento numerado) do livro de emissões. */
export interface SgsiEmissao {
  id: number;
  numero: string;
  serie_codigo: string;
  serie_nome: string | null;
  sequencial: number;
  ano: number;
  documento_id: number | null;
  titulo: string;
  tipo: string | null;
  instrumento_codigo: string | null;
  instrumento_sigla: string | null;
  referencia: string | null;
  data_emissao: string;
  autoridade: string;
  proad: string | null;
  classificacao: SgsiClassificacao;
  observacoes: string | null;
  hash_sha256: string;
  status: "EMITIDO" | "CANCELADO";
  cancel_motivo: string | null;
  cancel_em: string | null;
  emitido_em?: string;
  digitalizado: boolean;
  arquivo_nome: string | null;
  arquivo_hash: string | null;
}

/** Modelo de relatório do catálogo do SGSI. */
export interface SgsiRelatorioCatalogo {
  codigo: string;
  nome: string;
  obrigatorio: boolean;
  periodicidade: string;
  destinatario: string;
  base_normativa: string;
  instrumento_codigo: string | null;
  instrumento_sigla: string | null;
  ordem: number;
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

function nrec<T extends Record<string, unknown>>(o: T): T {
  const r: Record<string, unknown> = { ...o };
  for (const k of Object.keys(r)) r[k] = Number(r[k]);
  return r as T;
}

export const sgsiApi = {
  async getPainel(): Promise<SgsiPainel> {
    const p = await apiClient.get<SgsiPainel>(`${BASE}/painel`);
    return {
      tarefas: nrec(p.tarefas),
      documentos: nrec(p.documentos),
      indicadores: nrec(p.indicadores),
      instrumentos: (p.instrumentos || []).map((i) => ({
        ...i,
        ordem: Number(i.ordem),
        total_tarefas: Number(i.total_tarefas),
        tarefas_concluidas: Number(i.tarefas_concluidas),
        progresso: Number(i.progresso),
      })),
    };
  },

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

  async listarFrameworks(): Promise<SgsiFramework[]> {
    const data = await apiClient.get<SgsiFramework[]>(`${BASE}/frameworks`);
    return (data || []).map((f) => ({
      ...f,
      ordem: Number(f.ordem),
      total_itens: Number(f.total_itens),
      avaliados: Number(f.avaliados),
      conformes: Number(f.conformes),
    }));
  },

  async listarItensFramework(codigo: string): Promise<SgsiFrameworkItem[]> {
    const data = await apiClient.get<SgsiFrameworkItem[]>(
      `${BASE}/frameworks/${encodeURIComponent(codigo)}/itens`,
    );
    return (data || []).map((i) => ({ ...i, id: Number(i.id), ordem: Number(i.ordem) }));
  },

  async avaliarItemFramework(
    itemId: number,
    dados: { status: SgsiAvaliacaoStatus; observacao?: string },
  ): Promise<SgsiFrameworkItem> {
    const i = await apiClient.put<SgsiFrameworkItem>(
      `${BASE}/frameworks/itens/${itemId}/avaliacao`,
      dados,
    );
    return { ...i, id: Number(i.id), ordem: Number(i.ordem) };
  },

  async listarRiscos(): Promise<SgsiRisco[]> {
    const data = await apiClient.get<SgsiRisco[]>(`${BASE}/riscos`);
    return (data || []).map(normRisco);
  },

  async criarRisco(input: SgsiRiscoInput): Promise<SgsiRisco> {
    return normRisco(await apiClient.post<SgsiRisco>(`${BASE}/riscos`, input));
  },

  async atualizarRisco(id: number, input: SgsiRiscoInput): Promise<SgsiRisco> {
    return normRisco(
      await apiClient.put<SgsiRisco>(`${BASE}/riscos/${id}`, input),
    );
  },

  removerRisco(id: number): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`${BASE}/riscos/${id}`);
  },

  async listarSeries(): Promise<SgsiSerie[]> {
    const data = await apiClient.get<SgsiSerie[]>(`${BASE}/series`);
    return (data || []).map((s) => ({ ...s, digitos: Number(s.digitos) }));
  },

  async listarEmissoes(): Promise<SgsiEmissao[]> {
    const data = await apiClient.get<SgsiEmissao[]>(`${BASE}/emissoes`);
    return (data || []).map(normEmissao);
  },

  async emitir(input: Record<string, unknown>): Promise<SgsiEmissao> {
    return normEmissao(await apiClient.post<SgsiEmissao>(`${BASE}/emissoes`, input));
  },

  async anexarDigitalizacao(
    id: number,
    arquivo: { nome: string; mime: string; conteudo: string },
  ): Promise<SgsiEmissao> {
    return normEmissao(
      await apiClient.put<SgsiEmissao>(
        `${BASE}/emissoes/${id}/digitalizacao`,
        arquivo,
      ),
    );
  },

  getDigitalizacao(
    id: number,
  ): Promise<{ nome: string; mime: string; conteudo_base64: string }> {
    return apiClient.get(`${BASE}/emissoes/${id}/digitalizacao`);
  },

  async cancelarEmissao(id: number, motivo: string): Promise<SgsiEmissao> {
    return normEmissao(
      await apiClient.patch<SgsiEmissao>(`${BASE}/emissoes/${id}/cancelar`, {
        motivo,
      }),
    );
  },

  async getCatalogoRelatorios(): Promise<SgsiRelatorioCatalogo[]> {
    const data = await apiClient.get<SgsiRelatorioCatalogo[]>(
      `${BASE}/relatorios/catalogo`,
    );
    return (data || []).map((c) => ({
      ...c,
      ordem: Number(c.ordem),
      obrigatorio: c.obrigatorio === true || String(c.obrigatorio) === "true",
    }));
  },

  async getMatriz(): Promise<SgsiMatrizItem[]> {
    const data = await apiClient.get<SgsiMatrizItem[]>(`${BASE}/matriz`);
    return (data || []).map((m) => ({
      ...m,
      id: Number(m.id),
      instrumento_ordem: num(m.instrumento_ordem),
      tarefa_numero: num(m.tarefa_numero),
      prazo_marco: num(m.prazo_marco),
    }));
  },
};

function normEmissao(e: SgsiEmissao): SgsiEmissao {
  return {
    ...e,
    id: Number(e.id),
    sequencial: Number(e.sequencial),
    ano: Number(e.ano),
    documento_id: num(e.documento_id),
    digitalizado: e.digitalizado === true || String(e.digitalizado) === "true",
  };
}

function normRisco(r: SgsiRisco): SgsiRisco {
  return {
    ...r,
    id: Number(r.id),
    probabilidade: Number(r.probabilidade),
    severidade: Number(r.severidade),
    relevancia: Number(r.relevancia),
    probabilidade_residual: num(r.probabilidade_residual),
    severidade_residual: num(r.severidade_residual),
    irs_inerente: Number(r.irs_inerente),
    irs_residual: Number(r.irs_residual),
  };
}
