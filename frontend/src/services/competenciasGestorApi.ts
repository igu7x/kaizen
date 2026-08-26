import { apiClient } from "./apiClient";

export interface CompetenciaItem {
  nome: string;
  descricao: string;
  /** Criterio antigo ("Grau de Impacto", 1..3). Mantido so como historico. */
  peso?: number;
  /** Nivel (1..5) que a pessoa precisa atingir para ser considerada apta. */
  grau_minimo_esperado?: number;
  aplicabilidade?: "todos" | "parte";
  quantidade_pessoas?: number;
  /** TRUE quando o item foi alterado/adicionado na última edição via "Gerenciar Competências Técnicas". */
  alterada?: boolean;
}

export interface FormularioCompetencias {
  id: number;
  user_id: number;
  nome_completo: string;
  matricula: string;
  cargo_funcao: string;
  email_institucional: string;
  diretoria: string;
  unidade_id: number | null;
  unidade_nome?: string;
  qtd_colaboradores: number;
  tipo?: "equipe" | "gestor";
  status: string;
  competencias?: CompetenciaItem[];
  total_competencias?: number;
  user_name?: string;
  created_at: string;
  updated_at: string;
  // Validação 3 camadas
  validado_por_autor_id?: number;
  validado_por_autor_em?: string;
  validado_por_autor_nome?: string;
  validado_por_diretoria_id?: number;
  validado_por_diretoria_em?: string;
  validado_por_diretoria_nome?: string;
  validado_final_id?: number;
  validado_final_em?: string;
  validado_final_nome?: string;
  // Versionamento: incrementado a cada ciclo completo de validação
  versao_formulario?: number;
  /**
   * Revisão em andamento sobre uma matriz já validada. Enquanto TRUE, o conteúdo devolvido aqui é
   * o REVISADO (ainda não aprovado), mas a versão vigente continua valendo para Lacunas e
   * Inventário — eles leem os itens gravados, que só são substituídos na validação final.
   */
  em_revisao?: boolean;
  revisao_iniciada_em?: string | null;
  // Flag de re-validação requerida por mudança em competências padrão
  padroes_propagacao_pendente?: boolean;
  padroes_tipos_afetados?: string[];
  /** Matriz do gestor preenchida por quem e APENAS editor: nao tem camada de autor. */
  preenchido_por_editor?: boolean;
  /**
   * Matriz do gestor preenchida por superadmin de fora da área/unidade. A camada 1 continua no
   * fluxo, mas quem valida é o GESTOR DA UNIDADE, e não o autor.
   */
  preenchido_por_superadmin?: boolean;
  /**
   * Matriz da equipe preenchida por editor (ou superadmin) de fora da unidade. Mesma regra: o
   * editor só preenche e salva, e a camada 1 é do GESTOR DA UNIDADE.
   */
  preenchido_por_editor_equipe?: boolean;
  // Recusa do formulário pela camada Diretoria ou Final
  recusado_por_id?: number | null;
  recusado_por_nome?: string | null;
  recusado_em?: string | null;
  recusado_comentario?: string | null;
  recusado_camada?: "diretoria" | "final" | null;
}

export interface VersaoHistorico {
  id: number;
  formulario_id: number;
  versao: number;
  validado_final_em: string;
  validado_final_nome: string;
  created_at: string;
}

export interface CreateFormularioDto {
  nome_completo: string;
  matricula: string;
  cargo_funcao: string;
  email_institucional: string;
  diretoria: string;
  unidade_id?: number;
  qtd_colaboradores?: number;
  tipo?: "equipe" | "gestor";
  competencias: CompetenciaItem[];
}

export interface CompetenciaPorUnidade {
  id: number;
  unidade_id: number;
  unidade_nome?: string;
  nome: string;
  descricao: string;
  peso: number;
  aplicabilidade?: "todos" | "parte";
  quantidade_pessoas?: number;
  origem_formulario_id?: number;
  created_at: string;
  updated_at: string;
}

/** Macroárea, no contexto de administração de editores. */
export interface AreaEditor {
  id: number;
  sigla: string | null;
  nome: string | null;
}

/** Unidade, no contexto de administração de editores da matriz da equipe. */
export interface UnidadeEditor {
  id: number;
  sigla: string | null;
  nome: string | null;
}

/**
 * Editor da Matriz do Gestor: preenche a matriz de todas as unidades da área, mas NÃO valida —
 * a camada 1 continua com o gestor da unidade.
 */
export interface EditorMatriz {
  id: number;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  created_at?: string;
}

export interface UnidadeAutorizada {
  id: number;
  nome: string;
  area_id: number;
  unidade_superior_id: number | null;
  /**
   * Sigla da macroárea da unidade. Quem preenche a matriz de uma unidade de outra área — editor
   * ou superadmin — precisa ver a diretoria da UNIDADE, e não a sua própria.
   */
  area_sigla?: string | null;
}

export interface FormularioPreenchido {
  id: number;
  unidade_id: number;
  unidade_nome: string;
  status: string;
  total_competencias: number;
  created_at: string;
  updated_at: string;
}

/**
 * Unidade que já tem matriz validada e que o usuário pode REVISAR.
 *
 * Espelho de UnidadeAutorizada: aquela lista as unidades SEM matriz (para preencher), esta as
 * unidades COM matriz validada. `id` é o da unidade; a matriz em si é `formulario_id`.
 */
export interface UnidadeParaRevisao {
  id: number;
  nome: string;
  area_id: number;
  area_sigla?: string | null;
  formulario_id: number;
  status: string;
  /** Versão vigente. Só incrementa quando a revisão passa por todas as camadas de novo. */
  versao_formulario: number;
  total_competencias: number;
  validado_final_em: string | null;
  /** TRUE quando já existe uma revisão salva aguardando as validações. */
  em_revisao: boolean;
  revisao_iniciada_em: string | null;
}

const BASE_URL = "/api/competencias-gestor";

export const competenciasGestorApi = {
  getAll(diretoria?: string, tipo?: string): Promise<FormularioCompetencias[]> {
    const params = new URLSearchParams();
    if (diretoria) params.set("diretoria", diretoria);
    if (tipo) params.set("tipo", tipo);
    const qs = params.toString();
    const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;
    return apiClient.request<FormularioCompetencias[]>(url);
  },

  /** `null` quando o usuário ainda não preencheu — o backend responde com corpo vazio. */
  getMeu(tipo?: string): Promise<FormularioCompetencias | null> {
    const url = tipo
      ? `${BASE_URL}/meu?tipo=${encodeURIComponent(tipo)}`
      : `${BASE_URL}/meu`;
    return apiClient.requestNullable<FormularioCompetencias>(url);
  },

  getById(id: number): Promise<FormularioCompetencias> {
    return apiClient.request<FormularioCompetencias>(`${BASE_URL}/${id}`);
  },

  create(data: CreateFormularioDto): Promise<FormularioCompetencias> {
    return apiClient.post<FormularioCompetencias>(BASE_URL, data);
  },

  update(
    id: number,
    data: CreateFormularioDto,
  ): Promise<FormularioCompetencias> {
    return apiClient.put<FormularioCompetencias>(`${BASE_URL}/${id}`, data);
  },

  remove(id: number): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  /** Buscar competências cadastradas para uma unidade (equipe - de competencias_por_unidade) */
  getCompetenciasPorUnidade(
    unidadeId: number,
  ): Promise<CompetenciaPorUnidade[]> {
    return apiClient.request<CompetenciaPorUnidade[]>(
      `${BASE_URL}/unidade/${unidadeId}`,
    );
  },

  /** Buscar competências do gestor para uma unidade (do Referencial tipo='gestor') */
  getCompetenciasGestorPorUnidade(
    unidadeId: number,
  ): Promise<CompetenciaPorUnidade[]> {
    return apiClient.request<CompetenciaPorUnidade[]>(
      `${BASE_URL}/unidade-gestor/${unidadeId}`,
    );
  },

  /** Ids das unidades que já têm a Matriz de Competências (do tipo) validada. */
  getUnidadesComMatriz(tipo: string = "gestor"): Promise<number[]> {
    return apiClient.request<number[]>(
      `${BASE_URL}/unidades-com-matriz?tipo=${encodeURIComponent(tipo)}`,
    );
  },

  /** Buscar unidades autorizadas para o usuário (exclui já preenchidas) */
  getUnidadesAutorizadas(
    tipo: string = "equipe",
  ): Promise<UnidadeAutorizada[]> {
    return apiClient.request<UnidadeAutorizada[]>(
      `${BASE_URL}/unidades-autorizadas?tipo=${encodeURIComponent(tipo)}`,
    );
  },

  /**
   * Unidades com matriz validada que o usuário pode revisar ("Revisar Matriz").
   *
   * Recorte de permissão idêntico ao de getUnidadesAutorizadas — quem pode preencher a matriz de
   * uma unidade pode revisá-la —, só que invertido: aqui entram as que JÁ têm matriz validada.
   */
  getUnidadesParaRevisao(tipo: string = "equipe"): Promise<UnidadeParaRevisao[]> {
    return apiClient.request<UnidadeParaRevisao[]>(
      `${BASE_URL}/unidades-para-revisao?tipo=${encodeURIComponent(tipo)}`,
    );
  },

  /** Buscar TODAS unidades autorizadas (sem filtro de já preenchido) — para Inventário */
  getUnidadesAutorizadasInventario(): Promise<UnidadeAutorizada[]> {
    return apiClient.request<UnidadeAutorizada[]>(
      `${BASE_URL}/unidades-autorizadas-inventario`,
    );
  },

  /** Buscar formulários já preenchidos pelo usuário (unidades autorizadas) */
  getMeusPreenchidos(tipo: string = "equipe"): Promise<FormularioPreenchido[]> {
    return apiClient.request<FormularioPreenchido[]>(
      `${BASE_URL}/meus-preenchidos?tipo=${encodeURIComponent(tipo)}`,
    );
  },

  /** Verificar se o usuário tem acesso ao Referencial de Competências */
  verificarAcesso(): Promise<{ autorizado: boolean }> {
    return apiClient.request<{ autorizado: boolean }>(
      `${BASE_URL}/verificar-acesso`,
    );
  },

  /** Verificar se o usuário é gestor (responsavel) de alguma unidade */
  ehGestorUnidade(): Promise<{ ehGestor: boolean }> {
    return apiClient.request<{ ehGestor: boolean }>(
      `${BASE_URL}/eh-gestor-unidade`,
    );
  },

  /** Verificar se o usuário é colaborador de uma unidade NÃO-macroárea */
  ehColaboradorEquipe(): Promise<{ ehColaborador: boolean }> {
    return apiClient.request<{ ehColaborador: boolean }>(
      `${BASE_URL}/eh-colaborador-equipe`,
    );
  },

  /** Buscar unidades macroárea do domínio (Avaliação da Liderança) */
  getUnidadesLideranca(): Promise<UnidadeAutorizada[]> {
    return apiClient.request<UnidadeAutorizada[]>(
      `${BASE_URL}/unidades-lideranca`,
    );
  },

  /** Buscar a unidade onde o gestor está lotado (Autoavaliação do Gestor) */
  getMinhaUnidadeGestor(): Promise<UnidadeAutorizada[]> {
    return apiClient.request<UnidadeAutorizada[]>(
      `${BASE_URL}/minha-unidade-gestor`,
    );
  },

  /** Buscar todas as unidades onde o user é responsavel (Avaliação do Gestor) */
  getMinhasUnidadesGestor(): Promise<UnidadeAutorizada[]> {
    return apiClient.request<UnidadeAutorizada[]>(
      `${BASE_URL}/minhas-unidades-gestor`,
    );
  },

  // ── Editores da Matriz do Gestor (por macroárea) ──────────────────────────

  /** Áreas que o usuário dirige — onde ele administra editores. */
  getAreasQueDirijo(): Promise<AreaEditor[]> {
    return apiClient.request<AreaEditor[]>(`${BASE_URL}/editores/minhas-areas`);
  },

  /** O usuário logado é editor de alguma área? */
  getSouEditor(): Promise<{ editor: boolean; areas: AreaEditor[] }> {
    return apiClient.request<{ editor: boolean; areas: AreaEditor[] }>(
      `${BASE_URL}/editores/sou-editor`,
    );
  },

  getEditores(cadastrosAreasId: number): Promise<EditorMatriz[]> {
    return apiClient.request<EditorMatriz[]>(
      `${BASE_URL}/editores?cadastrosAreasId=${cadastrosAreasId}`,
    );
  },

  addEditor(cadastrosAreasId: number, userId: number): Promise<EditorMatriz[]> {
    return apiClient.post<EditorMatriz[]>(`${BASE_URL}/editores`, {
      cadastros_areas_id: cadastrosAreasId,
      user_id: userId,
    });
  },

  removeEditor(
    editorId: number,
    cadastrosAreasId: number,
  ): Promise<EditorMatriz[]> {
    return apiClient.delete<EditorMatriz[]>(
      `${BASE_URL}/editores/${editorId}?cadastrosAreasId=${cadastrosAreasId}`,
    );
  },

  // ── Editores da Matriz da Equipe (por unidade) ────────────────────────────

  /** Unidades que o usuário gerencia — onde ele administra editores da equipe. */
  getUnidadesQueGerencio(): Promise<UnidadeEditor[]> {
    return apiClient.request<UnidadeEditor[]>(
      `${BASE_URL}/editores-equipe/minhas-unidades`,
    );
  },

  /** O usuário logado é editor da equipe de alguma unidade? */
  getSouEditorEquipe(): Promise<{
    editor: boolean;
    unidades: UnidadeEditor[];
  }> {
    return apiClient.request<{ editor: boolean; unidades: UnidadeEditor[] }>(
      `${BASE_URL}/editores-equipe/sou-editor`,
    );
  },

  getEditoresEquipe(unidadeId: number): Promise<EditorMatriz[]> {
    return apiClient.request<EditorMatriz[]>(
      `${BASE_URL}/editores-equipe?unidadeId=${unidadeId}`,
    );
  },

  addEditorEquipe(
    unidadeId: number,
    userId: number,
  ): Promise<EditorMatriz[]> {
    return apiClient.post<EditorMatriz[]>(`${BASE_URL}/editores-equipe`, {
      unidade_id: unidadeId,
      user_id: userId,
    });
  },

  /** Remove pelo user_id do editor (e não pelo id da associação). */
  removeEditorEquipe(
    editorUserId: number,
    unidadeId: number,
  ): Promise<EditorMatriz[]> {
    return apiClient.delete<EditorMatriz[]>(
      `${BASE_URL}/editores-equipe/${editorUserId}?unidadeId=${unidadeId}`,
    );
  },

  /** Verificar se o usuário pode editar o formulário */
  podeEditar(id: number): Promise<{ allowed: boolean; reason?: string }> {
    return apiClient.request<{ allowed: boolean; reason?: string }>(
      `${BASE_URL}/${id}/pode-editar`,
    );
  },

  /** Camada 1: Validação do autor */
  validarAutor(id: number): Promise<FormularioCompetencias> {
    return apiClient.patch<FormularioCompetencias>(
      `${BASE_URL}/${id}/validar-autor`,
    );
  },

  /** Camada 2: Validação da diretoria */
  validarDiretoria(id: number): Promise<FormularioCompetencias> {
    return apiClient.patch<FormularioCompetencias>(
      `${BASE_URL}/${id}/validar-diretoria`,
    );
  },

  /** Camada 3: Validação final */
  validarFinal(id: number): Promise<FormularioCompetencias> {
    return apiClient.patch<FormularioCompetencias>(
      `${BASE_URL}/${id}/validar-final`,
    );
  },

  recusarDiretoria(
    id: number,
    comentario?: string,
  ): Promise<FormularioCompetencias> {
    return apiClient.patch<FormularioCompetencias>(
      `${BASE_URL}/${id}/recusar-diretoria`,
      { comentario: comentario || "" },
    );
  },

  recusarFinal(
    id: number,
    comentario?: string,
  ): Promise<FormularioCompetencias> {
    return apiClient.patch<FormularioCompetencias>(
      `${BASE_URL}/${id}/recusar-final`,
      { comentario: comentario || "" },
    );
  },

  /** Listar versões históricas de um formulário */
  getVersoes(id: number): Promise<VersaoHistorico[]> {
    return apiClient.request<VersaoHistorico[]>(`${BASE_URL}/${id}/versoes`);
  },

  /** Buscar snapshot completo de uma versão específica (para gerar PDF) */
  getVersaoDados(id: number, versao: number): Promise<FormularioCompetencias> {
    return apiClient.request<FormularioCompetencias>(
      `${BASE_URL}/${id}/versoes/${versao}`,
    );
  },

  // ==================== Admin de Competências Técnicas ====================

  /** Listar unidades gerenciáveis (com referencial preenchido) */
  listarUnidadesGerenciaveis(): Promise<
    Array<{
      unidade_id: number;
      unidade_nome: string;
      formulario_id: number;
      tipo: string;
      status: string;
      tecnicas_versao: number;
      tecnicas_publicado_em: string | null;
      diretoria_sigla: string;
    }>
  > {
    return apiClient.request(`${BASE_URL}/tecnicas-admin/unidades`);
  },

  /** Buscar formulário com itens e status de pendências */
  getFormularioAdmin(id: number): Promise<any> {
    return apiClient.request(`${BASE_URL}/tecnicas-admin/formulario/${id}`);
  },

  /** Criar novo item (competência técnica) */
  criarItemAdmin(
    formularioId: number,
    data: {
      nome: string;
      descricao: string;
      peso: number;
      aplicabilidade: string;
      quantidade_pessoas?: number;
    },
  ): Promise<any> {
    return apiClient.post(
      `${BASE_URL}/tecnicas-admin/formulario/${formularioId}/itens`,
      data,
    );
  },

  /** Atualizar item */
  atualizarItemAdmin(
    itemId: number,
    data: {
      nome?: string;
      descricao?: string;
      peso?: number;
      aplicabilidade?: string;
      quantidade_pessoas?: number;
    },
  ): Promise<any> {
    return apiClient.put(`${BASE_URL}/tecnicas-admin/itens/${itemId}`, data);
  },

  /** Remover item */
  removerItemAdmin(itemId: number): Promise<void> {
    return apiClient.delete(`${BASE_URL}/tecnicas-admin/itens/${itemId}`);
  },

  /** Publicar alterações do referencial — marca formulários afetados */
  publicarTecnicas(formularioId: number): Promise<{
    versao: number;
    tiposMudancas: {
      adicionadas: any[];
      removidas: any[];
      alteradas: any[];
    } | null;
    formulariosAfetados: number;
  }> {
    return apiClient.post(
      `${BASE_URL}/tecnicas-admin/formulario/${formularioId}/publicar`,
    );
  },
};
