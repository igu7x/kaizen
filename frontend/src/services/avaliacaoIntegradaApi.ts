import { apiClient } from "./apiClient";

export interface PessoaElegivel {
  pessoa_id: number;
  pessoa_nome: string;
  autoavaliacao_id: number;
  avaliacao_gestor_id: number;
}

export interface ParData {
  autoavaliacao: {
    id: number;
    pessoa_id?: number;
    nome_completo: string;
    diretoria: string;
    unidade_id: number | null;
    respostas: Array<{
      competencia_unidade_id?: number;
      competencia_nome: string;
      competencia_descricao?: string;
      nota: number;
      comentario?: string;
      tipo?: string;
      ordem: number;
    }>;
  } | null;
  avaliacaoGestor: {
    id: number;
    pessoa_id: number;
    pessoa_nome: string;
    avaliador_nome: string;
    diretoria: string;
    unidade_id: number | null;
    respostas: Array<{
      competencia_unidade_id?: number;
      competencia_nome: string;
      competencia_descricao?: string;
      nota: number;
      comentario?: string;
      tipo?: string;
      ordem: number;
    }>;
  } | null;
}

export interface RespostaIntegradaItem {
  competencia_unidade_id?: number;
  competencia_nome: string;
  competencia_descricao?: string;
  /** null quando a competência ainda não foi respondida na autoavaliação. */
  nota_autoavaliacao: number | null;
  /** null quando a competência ainda não foi respondida na avaliação do gestor. */
  nota_gestor: number | null;
  nota_integrada: number;
  comentario?: string;
  tipo?: "tecnica" | "comportamental" | "estrategica" | "gerencial";
}

export interface AvaliacaoIntegradaFormulario {
  id: number;
  autoavaliacao_id: number;
  avaliacao_gestor_id: number;
  pessoa_id: number;
  pessoa_nome: string;
  avaliador_user_id: number;
  avaliador_nome: string;
  diretoria: string;
  unidade_id: number | null;
  unidade_nome?: string;
  tipo_inventario?: "equipe" | "gestor";
  status: string;
  respostas?: RespostaIntegradaItem[];
  total_respostas?: number;
  validado_gestor_id?: number;
  validado_gestor_nome?: string;
  validado_gestor_em?: string;
  validado_colaborador_id?: number;
  validado_colaborador_nome?: string;
  validado_colaborador_em?: string;
  colaborador_user_id?: number;
  tecnicas_versao?: number | null;
  versao_formulario?: number | null;
  created_at: string;
  updated_at: string;
}

export interface VersaoHistoricoIntegrada {
  id: number;
  formulario_id: number;
  versao: number;
  validado_em: string;
  validado_nome: string;
  created_at: string;
}

export interface CreateAvaliacaoIntegradaDto {
  autoavaliacao_id: number;
  avaliacao_gestor_id: number;
  pessoa_id: number;
  pessoa_nome: string;
  avaliador_nome: string;
  diretoria: string;
  unidade_id?: number;
  tipo_inventario?: "equipe" | "gestor";
  respostas: RespostaIntegradaItem[];
}

const BASE_URL = "/api/avaliacao-integrada";

export const avaliacaoIntegradaApi = {
  getAll(
    diretoria?: string,
    tipoInventario?: string,
  ): Promise<AvaliacaoIntegradaFormulario[]> {
    const params = new URLSearchParams();
    if (diretoria) params.set("diretoria", diretoria);
    if (tipoInventario) params.set("tipo_inventario", tipoInventario);
    const qs = params.toString();
    const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;
    return apiClient.request<AvaliacaoIntegradaFormulario[]>(url);
  },

  getById(id: number): Promise<AvaliacaoIntegradaFormulario> {
    return apiClient.request<AvaliacaoIntegradaFormulario>(`${BASE_URL}/${id}`);
  },

  /**
   * Metadados mínimos da última avaliação integrada da pessoa. Retorna null se
   * não existir (404 do backend é convertido em null pra simplificar callers).
   */
  async getByPessoaMeta(
    pessoaId: number,
  ): Promise<{
    id: number;
    tipo_inventario: "equipe" | "gestor";
    status: string;
  } | null> {
    try {
      return await apiClient.request<{
        id: number;
        tipo_inventario: "equipe" | "gestor";
        status: string;
      }>(`${BASE_URL}/by-pessoa/${pessoaId}`);
    } catch (err: any) {
      if (err?.status === 404 || /404/.test(String(err?.message))) return null;
      throw err;
    }
  },

  getElegiveis(
    unidadeId: number,
    tipoInventario: string = "equipe",
  ): Promise<PessoaElegivel[]> {
    return apiClient.request<PessoaElegivel[]>(
      `${BASE_URL}/elegiveis/${unidadeId}?tipo_inventario=${encodeURIComponent(tipoInventario)}`,
    );
  },

  getPendentesColaborador(): Promise<AvaliacaoIntegradaFormulario[]> {
    return apiClient.request<AvaliacaoIntegradaFormulario[]>(
      `${BASE_URL}/pendentes-colaborador`,
    );
  },

  temElegiveis(): Promise<{
    equipe: boolean;
    gestor: boolean;
    equipeElegiveis: boolean;
    gestorElegiveis: boolean;
    avgestorEquipe: boolean;
    avgestorGestor: boolean;
  }> {
    return apiClient.request<{
      equipe: boolean;
      gestor: boolean;
      equipeElegiveis: boolean;
      gestorElegiveis: boolean;
      avgestorEquipe: boolean;
      avgestorGestor: boolean;
    }>(`${BASE_URL}/tem-elegiveis`);
  },

  getParData(
    autoavaliacaoId: number,
    avaliacaoGestorId: number,
  ): Promise<ParData> {
    return apiClient.request<ParData>(
      `${BASE_URL}/par/${autoavaliacaoId}/${avaliacaoGestorId}`,
    );
  },

  create(
    data: CreateAvaliacaoIntegradaDto,
  ): Promise<AvaliacaoIntegradaFormulario> {
    return apiClient.post<AvaliacaoIntegradaFormulario>(BASE_URL, data);
  },

  validarGestor(id: number): Promise<AvaliacaoIntegradaFormulario> {
    return apiClient.patch<AvaliacaoIntegradaFormulario>(
      `${BASE_URL}/${id}/validar-gestor`,
    );
  },

  validarColaborador(id: number): Promise<AvaliacaoIntegradaFormulario> {
    return apiClient.patch<AvaliacaoIntegradaFormulario>(
      `${BASE_URL}/${id}/validar-colaborador`,
    );
  },

  remove(id: number): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  /** Listar versões históricas de um formulário */
  getVersoes(id: number): Promise<VersaoHistoricoIntegrada[]> {
    return apiClient.request<VersaoHistoricoIntegrada[]>(
      `${BASE_URL}/${id}/versoes`,
    );
  },

  /** Buscar snapshot completo de uma versão específica (para gerar PDF) */
  getVersaoDados(
    id: number,
    versao: number,
  ): Promise<AvaliacaoIntegradaFormulario> {
    return apiClient.request<AvaliacaoIntegradaFormulario>(
      `${BASE_URL}/${id}/versoes/${versao}`,
    );
  },
};
