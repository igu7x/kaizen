import { API_BASE_URL } from "./apiClient";

const API_URL = API_BASE_URL;

// Helper para adicionar auth headers e devEnvironment
function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("auth_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function buildUrl(
  path: string,
  params?: Record<string, string | undefined>,
): string {
  const url = new URL(`${API_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }
  // Dev mode: injetar dominio
  const devEnv = localStorage.getItem("devEnvironment");
  if (devEnv && devEnv !== "null") {
    try {
      const parsed = JSON.parse(devEnv);
      if (
        parsed &&
        typeof parsed === "string" &&
        !url.searchParams.has("dominio")
      ) {
        url.searchParams.set("dominio", parsed);
      }
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  }
  return url.toString();
}

import { toast } from "sonner";

async function authFetch(
  path: string,
  params?: Record<string, string | undefined>,
  options?: RequestInit,
): Promise<Response> {
  const url = buildUrl(path, params);
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  });

  // Trata headers de erro e joga a exceção
  if (!response.ok) {
    let errMsg = `Erro HTTP ${response.status}`;
    const errorHeader = response.headers.get("x-flash-error");
    if (errorHeader) {
      try {
        errMsg = decodeURIComponent(errorHeader);
      } catch (e) {
        errMsg = errorHeader;
      }
    } else {
      try {
        const errData = await response.json();
        errMsg = errData.error || errData.message || errMsg;
      } catch {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    }
    toast.error(errMsg);
    throw new Error(errMsg);
  }

  // Sucessos e Avisos (X-Flash)
  const successHeader = response.headers.get("x-flash-success");
  const noticeHeader = response.headers.get("x-flash-notice");

  if (successHeader) {
    let msg = successHeader;
    try {
      msg = decodeURIComponent(successHeader);
    } catch (e) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
    toast.success(msg);
  } else if (noticeHeader) {
    let msg = noticeHeader;
    try {
      msg = decodeURIComponent(noticeHeader);
    } catch (e) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
    toast.info(msg);
  }

  return response;
}

// ============================================================
// TIPOS
// ============================================================

export interface Projeto {
  id: number;
  codigo: string;
  nome: string;
  descricao_sintetica: string | null;
  objetivo: string | null;
  contexto_justificativa: string | null;
  patrocinador_id: number | null;
  patrocinador_nome?: string;
  patrocinador_cargo?: string | null;
  gestor_id: number | null;
  gestor_nome?: string;
  gestor_cargo?: string | null;
  /** Nome do diretor (gestor da 1ª diretoria da Governança) — camada 2 do TAP. */
  diretor_nome?: string;
  /** Sigla da diretoria resolvida para a camada 2 (ex.: "DITI"). */
  diretor_diretoria_sigla?: string;
  ancoragem_estrategica_plano_gestao: boolean;
  ancoragem_estrategica_pep: boolean;
  ancoragem_estrategica_programa_x: boolean;
  escopo_sintetico: string | null;
  fora_do_escopo: string | null;
  data_prevista_inicio: string | null;
  data_prevista_conclusao: string | null;
  status: "planejado" | "em_execucao" | "suspenso" | "concluido" | "cancelado";
  prioridade: "alta" | "media" | "baixa";
  complexidade: "baixa" | "media" | "alta";
  abrangencia: "uma_unidade" | "multiplas_unidades" | "transversal";
  havera_contratacao: boolean;
  valor_estimado_contratacao: number | null;
  /** Item do PCA vinculado à contratação (quando havera_contratacao). */
  pcas_id?: number | null;
  /** Rótulo do item do PCA vinculado (montado no backend) — usado no TAP. */
  pca_item_label?: string | null;
  progresso_percentual: number;
  saude: "verde" | "amarelo" | "vermelho";
  saude_justificativa: string | null;
  saude_ultima_revisao: string | null;
  tap_vinculado: string | null;
  tap_id: string | null;
  tap_versao: number | null;
  tap_gerado_em: string | null;
  observacoes_gerais: string | null;
  diretoria: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  areas_vinculadas_ids?: number[]; // IDs das diretorias vinculadas
  total_entregas?: number;
  entregas_concluidas?: number;
  total_riscos?: number;
  entraves_pendentes?: number;
  areas_execucao_diretorias?: string;
  diretorias_nomes?: string;
  instrumentos_nomes?: string;
  total_instrumentos?: number;
  // TAP Validação
  gestor_user_id?: number;
  patrocinador_user_id?: number;
  tap_validado_gestor_em?: string | null;
  tap_validado_gestor_por?: number | null;
  tap_validado_diretor_em?: string | null;
  tap_validado_diretor_por?: number | null;
  tap_validado_patrocinador_em?: string | null;
  tap_validado_patrocinador_por?: number | null;
  // TAP Recusa
  tap_recusado_em?: string | null;
  tap_recusado_por?: number | null;
  tap_recusado_por_nome?: string | null;
  tap_recusado_comentario?: string | null;
  tap_recusado_camada?: "diretor" | "patrocinador" | null;
  // TEP — campos expostos pela view (1‑pra‑1 com tep_termos_encerramento)
  tep_tipo_encerramento?: "concluido" | "cancelado" | null;
  tep_validado_gestor_em?: string | null;
  tep_validado_diretor_em?: string | null;
  tep_validado_patrocinador_em?: string | null;
  tep_versao?: number | null;
  tep_gerado_em?: string | null;
  // Dados relacionados (quando buscar por ID)
  areasExecucao?: AreaExecucao[];
  entregas?: Entrega[];
  riscos?: Risco[];
  entraves?: Entrave[];
  instrumentos?: InstrumentoVinculado[];
}

export interface InstrumentoVinculado {
  id: number;
  instrumento_id: number;
  instrumento_nome: string;
  instrumento_tipo: string;
}

export interface Entrega {
  id: number;
  projeto_id: number;
  nome: string;
  descricao: string | null;
  /** Dois estados apenas; legados podem trazer "nao_iniciada"/"em_andamento", lidos como pendente. */
  status: "pendente" | "concluida" | "nao_iniciada" | "em_andamento";
  quantidade_sprints: number;
  ordem: number;
  area_responsavel_id?: number | null;
  area_responsavel_nome?: string | null;
  evidencia_filename?: string | null;
  evidencia_filepath?: string | null;
  evidencia_filesize?: number | null;
  /** Data em que a entrega foi concluída (definida ao anexar a evidência de conclusão). */
  data_conclusao?: string | null;
  prazo_estimado?: string | null;
  updated_at?: string;
}

export interface Tep {
  id: number;
  projeto_id: number;
  tipo_encerramento: "concluido" | "cancelado";
  motivo_cancelamento: string | null;
  consideracoes_gerente: string | null;
  consideracoes_patrocinador: string | null;
  finalizado_por: number | null;
  finalizado_por_nome: string | null;
  finalizado_em: string;
  // Camadas de validação (mesmo padrão do TAP)
  tep_validado_gestor_em?: string | null;
  tep_validado_gestor_por?: number | null;
  tep_validado_diretor_em?: string | null;
  tep_validado_diretor_por?: number | null;
  tep_validado_patrocinador_em?: string | null;
  tep_validado_patrocinador_por?: number | null;
  tep_versao?: number | null;
  tep_gerado_em?: string | null;
  // TEP Recusa
  tep_recusado_em?: string | null;
  tep_recusado_por?: number | null;
  tep_recusado_por_nome?: string | null;
  tep_recusado_comentario?: string | null;
  tep_recusado_camada?: "diretor" | "patrocinador" | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTepDto {
  tipo_encerramento: "concluido" | "cancelado";
  motivo_cancelamento?: string;
  consideracoes_gerente?: string;
  consideracoes_patrocinador?: string;
}

export interface TarefaEntrega {
  id: number;
  entrega_id: number;
  nome: string;
  descricao: string | null;
  sprint: string | null;
  sprint_id: number | null;
  responsavel: string | null;
  responsavel_id: number | null;
  status: "a_fazer" | "fazendo" | "feito";
  ordem: number;
  data_inicio: string | null;
  data_conclusao: string | null;
}

export interface CreateTarefaEntregaDto {
  nome: string;
  descricao?: string;
  sprint?: string;
  sprint_id?: number;
  responsavel?: string;
  responsavel_id?: number;
  status?: string;
  ordem?: number;
}

export interface Risco {
  id: number;
  projeto_id: number;
  descricao: string;
  probabilidade: "remota" | "possivel" | "provavel";
  impacto: "baixo" | "medio" | "alto";
  tratamento: string | null;
  observacoes: string | null;
  criticidade?: number;
}

export interface Entrave {
  id: number;
  projeto_id: number;
  descricao: string;
  data_identificacao: string;
  resolvido: boolean;
  data_resolucao: string | null;
  observacoes: string | null;
}

export interface AreaExecucao {
  id: number;
  projeto_id: number;
  area_id: number;
  area_nome?: string;
  diretoria?: string;
}

export interface Colaborador {
  id: number;
  nome: string;
  nome_exibicao?: string;
  unidade_lotacao: string;
  diretoria: string;
  area_id: number;
}

export interface Area {
  id: number;
  nome_area: string;
  diretoria: string;
  linha_organograma: number;
}

export interface CreateProjetoDto {
  codigo?: string;
  nome: string;
  descricao_sintetica?: string;
  objetivo?: string;
  contexto_justificativa?: string;
  patrocinador_id?: number;
  patrocinador_cargo?: string;
  gestor_id?: number;
  gestor_cargo?: string;
  ancoragem_estrategica_plano_gestao?: boolean;
  ancoragem_estrategica_pep?: boolean;
  ancoragem_estrategica_programa_x?: boolean;
  instrumentos_ids?: number[];
  escopo_sintetico?: string;
  fora_do_escopo?: string;
  data_prevista_inicio?: string;
  data_prevista_conclusao?: string;
  status?: string;
  prioridade?: string;
  complexidade?: string;
  abrangencia?: string;
  havera_contratacao?: boolean;
  valor_estimado_contratacao?: number;
  pcas_id?: number | null;
  saude?: string;
  saude_justificativa?: string;
  tap_vinculado?: string;
  observacoes_gerais?: string;
  diretoria?: string;
  areas_execucao?: number[];
  areas_vinculadas_ids?: number[]; // IDs das diretorias vinculadas
  entregas?: CreateEntregaDto[];
  riscos?: CreateRiscoDto[];
  entraves?: CreateEntraveDto[];
}

export interface CreateEntregaDto {
  id?: number;
  nome: string;
  descricao?: string;
  status?: string;
  quantidade_sprints?: number;
  ordem?: number;
  areas_responsaveis?: number[];
  area_responsavel_id?: number | null;
  prazo_estimado?: string | null;
}

export interface CreateRiscoDto {
  descricao: string;
  probabilidade?: string;
  impacto?: string;
  tratamento?: string;
  observacoes?: string;
}

export interface CreateEntraveDto {
  id?: number;
  descricao: string;
  data_identificacao?: string;
  observacoes?: string;
}

// ============================================================
// API
// ============================================================

export const cadastrosProjetosApi = {
  // Projetos
  async getProjetos(cadastrosAreasId?: number): Promise<Projeto[]> {
    const response = await authFetch("/api/cadastros/projetos", { cadastrosAreasId });
    if (!response.ok) throw new Error("Erro ao buscar projetos");
    return response.json();
  },

  async getProjetoById(id: number): Promise<Projeto> {
    const response = await authFetch(`/api/cadastros/projetos/${id}`);
    if (!response.ok) throw new Error("Erro ao buscar projeto");
    return response.json();
  },

  async getProjetosByInstrumentoId(
    instrumentoId: number,
    cadastrosAreasId?: number,
  ): Promise<Projeto[]> {
    const response = await authFetch(
      `/api/cadastros/projetos/instrumento/${instrumentoId}`,
      { cadastrosAreasId },
    );
    if (!response.ok) throw new Error("Erro ao buscar projetos do instrumento");
    return response.json();
  },

  async createProjeto(data: CreateProjetoDto): Promise<Projeto> {
    const response = await authFetch("/api/cadastros/projetos", undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Erro ao criar projeto");
    return response.json();
  },

  async updateProjeto(
    id: number,
    data: Partial<CreateProjetoDto>,
  ): Promise<Projeto> {
    const response = await authFetch(
      `/api/cadastros/projetos/${id}`,
      undefined,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error("Erro ao atualizar projeto");
    return response.json();
  },

  async gerarTapId(id: number): Promise<Projeto> {
    const response = await authFetch(
      `/api/cadastros/projetos/${id}/gerar-tap`,
      undefined,
      { method: "POST" },
    );
    if (!response.ok) throw new Error("Erro ao gerar TAP ID");
    return response.json();
  },

  async regenerarTap(id: number): Promise<Projeto> {
    const response = await authFetch(
      `/api/cadastros/projetos/${id}/regenerar-tap`,
      undefined,
      { method: "POST" },
    );
    if (!response.ok) throw new Error("Erro ao regenerar TAP");
    return response.json();
  },

  async deleteProjeto(id: number): Promise<void> {
    const response = await authFetch(
      `/api/cadastros/projetos/${id}`,
      undefined,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Erro ao excluir projeto");
  },

  // Entregas
  async getEntregas(projetoId: number): Promise<Entrega[]> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/entregas`,
    );
    if (!response.ok) throw new Error("Erro ao buscar entregas");
    return response.json();
  },

  async createEntrega(
    projetoId: number,
    data: CreateEntregaDto,
  ): Promise<Entrega> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/entregas`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error("Erro ao criar entrega");
    return response.json();
  },

  async updateEntrega(
    id: number,
    data: Partial<CreateEntregaDto>,
  ): Promise<Entrega> {
    const response = await authFetch(
      `/api/cadastros/entregas/${id}`,
      undefined,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error("Erro ao atualizar entrega");
    return response.json();
  },

  async deleteEntrega(id: number): Promise<void> {
    const response = await authFetch(
      `/api/cadastros/entregas/${id}`,
      undefined,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Erro ao excluir entrega");
  },

  // Evidências de Entregas
  async uploadEvidencia(
    entregaId: number,
    file: File,
    dataConclusao?: string,
  ): Promise<{ success: boolean; filename: string; filesize: number }> {
    const formData = new FormData();
    formData.append("evidencia", file);
    if (dataConclusao) formData.append("data_conclusao", dataConclusao);
    const response = await authFetch(
      `/api/cadastros/entregas/${entregaId}/upload-evidencia`,
      undefined,
      {
        method: "POST",
        body: formData,
      },
    );
    if (!response.ok) throw new Error("Erro ao enviar evidência");
    return response.json();
  },

  getEvidenciaDownloadUrl(entregaId: number): string {
    return `${API_URL}/api/cadastros/entregas/${entregaId}/download-evidencia`;
  },

  async deleteEvidencia(entregaId: number): Promise<void> {
    const response = await authFetch(
      `/api/cadastros/entregas/${entregaId}/evidencia`,
      undefined,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Erro ao remover evidência");
  },

  // Tarefas de Entregas
  async getTarefasEntrega(entregaId: number): Promise<TarefaEntrega[]> {
    const response = await authFetch(
      `/api/cadastros/entregas/${entregaId}/tarefas`,
    );
    if (!response.ok) throw new Error("Erro ao buscar tarefas");
    return response.json();
  },

  async createTarefaEntrega(
    entregaId: number,
    data: CreateTarefaEntregaDto,
  ): Promise<TarefaEntrega> {
    const response = await authFetch(
      `/api/cadastros/entregas/${entregaId}/tarefas`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error("Erro ao criar tarefa");
    return response.json();
  },

  async updateTarefaEntrega(
    id: number,
    data: Partial<CreateTarefaEntregaDto>,
  ): Promise<TarefaEntrega> {
    const response = await authFetch(
      `/api/cadastros/tarefas/${id}`,
      undefined,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error("Erro ao atualizar tarefa");
    return response.json();
  },

  async deleteTarefaEntrega(id: number): Promise<void> {
    const response = await authFetch(
      `/api/cadastros/tarefas/${id}`,
      undefined,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Erro ao excluir tarefa");
  },

  // Riscos
  async getRiscos(projetoId: number): Promise<Risco[]> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/riscos`,
    );
    if (!response.ok) throw new Error("Erro ao buscar riscos");
    return response.json();
  },

  async createRisco(projetoId: number, data: CreateRiscoDto): Promise<Risco> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/riscos`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error("Erro ao criar risco");
    return response.json();
  },

  async updateRisco(id: number, data: Partial<CreateRiscoDto>): Promise<Risco> {
    const response = await authFetch(`/api/cadastros/riscos/${id}`, undefined, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Erro ao atualizar risco");
    return response.json();
  },

  async deleteRisco(id: number): Promise<void> {
    const response = await authFetch(`/api/cadastros/riscos/${id}`, undefined, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Erro ao excluir risco");
  },

  // Entraves
  async getEntraves(projetoId: number): Promise<Entrave[]> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/entraves`,
    );
    if (!response.ok) throw new Error("Erro ao buscar entraves");
    return response.json();
  },

  async createEntrave(
    projetoId: number,
    data: CreateEntraveDto,
  ): Promise<Entrave> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/entraves`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error("Erro ao criar entrave");
    return response.json();
  },

  async updateEntrave(
    id: number,
    data: Partial<CreateEntraveDto> & { resolvido?: boolean },
  ): Promise<Entrave> {
    const response = await authFetch(
      `/api/cadastros/entraves/${id}`,
      undefined,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error("Erro ao atualizar entrave");
    return response.json();
  },

  async deleteEntrave(id: number): Promise<void> {
    const response = await authFetch(
      `/api/cadastros/entraves/${id}`,
      undefined,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Erro ao excluir entrave");
  },

  // Auxiliares
  async getColaboradores(diretoria?: string): Promise<Colaborador[]> {
    const response = await authFetch("/api/cadastros/colaboradores", {
      diretoria,
    });
    if (!response.ok) throw new Error("Erro ao buscar colaboradores");
    return response.json();
  },

  async getAreas(diretoria?: string): Promise<Area[]> {
    const response = await authFetch("/api/cadastros/areas", { diretoria });
    if (!response.ok) throw new Error("Erro ao buscar áreas");
    return response.json();
  },

  // TAP Validação
  async validarTAP(projetoId: number, camada: number): Promise<any> {
    const response = await authFetch(
      `/api/cadastros/${projetoId}/tap/validar/${camada}`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao validar TAP");
    }
    return response.json();
  },

  async getTapVersoes(
    projetoId: number,
  ): Promise<
    Array<{
      id: number;
      projeto_id: number;
      versao: number;
      validado_em: string | null;
      validado_por: number | null;
      validado_por_nome: string | null;
      created_at: string;
    }>
  > {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tap/versoes`,
    );
    if (!response.ok) throw new Error("Erro ao buscar versões do TAP");
    return response.json();
  },

  async getTapVersaoDados(projetoId: number, versao: number): Promise<any> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tap/versoes/${versao}`,
    );
    if (!response.ok) throw new Error("Erro ao buscar dados da versão");
    return response.json();
  },

  async getTepVersoes(
    projetoId: number,
  ): Promise<
    Array<{
      id: number;
      projeto_id: number;
      versao: number;
      validado_em: string | null;
      validado_por: number | null;
      validado_por_nome: string | null;
      created_at: string;
    }>
  > {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tep/versoes`,
    );
    if (!response.ok) throw new Error("Erro ao buscar versões do TEP");
    return response.json();
  },

  async getTepVersaoDados(
    projetoId: number,
    versao: number,
  ): Promise<{ tep: any; projeto: any; entregas: any[] }> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tep/versoes/${versao}`,
    );
    if (!response.ok) throw new Error("Erro ao buscar dados da versão");
    return response.json();
  },

  async recusarTAP(
    projetoId: number,
    camada: number,
    comentario?: string | null,
  ): Promise<any> {
    const response = await authFetch(
      `/api/cadastros/${projetoId}/tap/recusar/${camada}`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario: comentario || null }),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao recusar TAP");
    }
    return response.json();
  },

  async revogarValidacaoTAP(projetoId: number, camada: number): Promise<any> {
    const response = await authFetch(
      `/api/cadastros/${projetoId}/tap/validar/${camada}`,
      undefined,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao revogar validação");
    }
    return response.json();
  },

  // ============================================================
  // TEP - Termo de Encerramento do Projeto
  // ============================================================

  async getTep(projetoId: number): Promise<Tep | null> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tep`,
    );
    if (!response.ok) throw new Error("Erro ao buscar TEP");
    return response.json();
  },

  async salvarTep(projetoId: number, data: CreateTepDto): Promise<Tep> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tep`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao salvar TEP");
    }
    return response.json();
  },

  async reverterTep(projetoId: number): Promise<void> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tep`,
      undefined,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao reverter TEP");
    }
  },

  async validarTEP(projetoId: number, camada: number): Promise<any> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tep/validar/${camada}`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao validar TEP");
    }
    return response.json();
  },

  async recusarTEP(
    projetoId: number,
    camada: number,
    comentario?: string | null,
  ): Promise<any> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tep/recusar/${camada}`,
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario: comentario || null }),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao recusar TEP");
    }
    return response.json();
  },

  async revogarValidacaoTEP(projetoId: number, camada: number): Promise<any> {
    const response = await authFetch(
      `/api/cadastros/projetos/${projetoId}/tep/validar/${camada}`,
      undefined,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao revogar validação");
    }
    return response.json();
  },
};
