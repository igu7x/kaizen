import { apiClient } from "./apiClient";

export interface RespostaGestorItem {
  competencia_unidade_id?: number;
  competencia_nome: string;
  competencia_descricao?: string;
  nota: number;
  comentario?: string;
  tipo?: "tecnica" | "comportamental" | "estrategica" | "gerencial";
}

export interface AvaliacaoGestorFormulario {
  id: number;
  pessoa_id: number | null;
  pessoa_user_id?: number | null;
  pessoa_nome: string;
  pessoa_cargo?: string;
  pessoa_email?: string;
  avaliador_user_id: number;
  avaliador_nome: string;
  diretoria: string;
  unidade_id: number | null;
  unidade_nome?: string;
  tipo_inventario?: "equipe" | "gestor";
  status: string;
  respostas?: RespostaGestorItem[];
  total_respostas?: number;
  validado_por_id?: number;
  validado_por_nome?: string;
  validado_em?: string;
  tecnicas_versao?: number | null;
  versao_formulario?: number | null;
  created_at: string;
  updated_at: string;
}

export interface VersaoHistoricoGestor {
  id: number;
  formulario_id: number;
  versao: number;
  validado_em: string;
  validado_nome: string;
  created_at: string;
}

export interface CreateAvaliacaoGestorDto {
  /** Id da autoavaliação da pessoa (quando ela já se autoavaliou). */
  pessoa_id?: number;
  /** Chave estável da pessoa avaliada (gestor da unidade), usada quando ainda não há autoavaliação. */
  pessoa_user_id?: number;
  pessoa_nome: string;
  pessoa_cargo?: string;
  pessoa_email?: string;
  avaliador_nome: string;
  diretoria: string;
  unidade_id?: number;
  tipo_inventario?: "equipe" | "gestor";
  respostas: RespostaGestorItem[];
}

/** Gestor da unidade como avaliável (mesmo sem autoavaliação). */
export interface GestorDaUnidade {
  pessoa_user_id: number;
  nome: string;
  cargo?: string | null;
  email?: string | null;
  /** Id da autoavaliação, se o gestor já se autoavaliou nessa unidade/tipo (senão null). */
  autoavaliacao_id: number | null;
}

const BASE_URL = "/api/avaliacao-gestor";

export const avaliacaoGestorApi = {
  getAll(
    diretoria?: string,
    tipoInventario?: string,
  ): Promise<AvaliacaoGestorFormulario[]> {
    const params = new URLSearchParams();
    if (diretoria) params.set("diretoria", diretoria);
    if (tipoInventario) params.set("tipo_inventario", tipoInventario);
    const qs = params.toString();
    const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;
    return apiClient.request<AvaliacaoGestorFormulario[]>(url);
  },

  getById(id: number): Promise<AvaliacaoGestorFormulario> {
    return apiClient.request<AvaliacaoGestorFormulario>(`${BASE_URL}/${id}`);
  },

  /** Gestor da unidade como avaliável (mesmo sem autoavaliação). `null` se a unidade não tem responsável. */
  getGestorDaUnidade(
    unidadeId: number,
    tipoInventario: string = "gestor",
  ): Promise<GestorDaUnidade | null> {
    return apiClient.requestNullable<GestorDaUnidade>(
      `${BASE_URL}/gestor-da-unidade/${unidadeId}?tipo_inventario=${encodeURIComponent(tipoInventario)}`,
    );
  },

  /**
   * Buscar avaliação existente por pessoa+unidade (para auto-detecção em modo edição).
   * `by="user"` → `pessoaId` é o user_id da pessoa (gestor sem autoavaliação).
   * `null` quando não existe — o backend responde com corpo vazio.
   */
  getByPessoaAndUnidade(
    pessoaId: number,
    unidadeId: number,
    by?: "user",
  ): Promise<AvaliacaoGestorFormulario | null> {
    const byQs = by ? `&by=${by}` : "";
    return apiClient.requestNullable<AvaliacaoGestorFormulario>(
      `${BASE_URL}/by-pessoa/${pessoaId}?unidade_id=${unidadeId}${byQs}`,
    );
  },

  create(data: CreateAvaliacaoGestorDto): Promise<AvaliacaoGestorFormulario> {
    return apiClient.post<AvaliacaoGestorFormulario>(BASE_URL, data);
  },

  validar(id: number): Promise<AvaliacaoGestorFormulario> {
    return apiClient.patch<AvaliacaoGestorFormulario>(
      `${BASE_URL}/${id}/validar`,
    );
  },

  remove(id: number): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  /** Listar versões históricas de um formulário */
  getVersoes(id: number): Promise<VersaoHistoricoGestor[]> {
    return apiClient.request<VersaoHistoricoGestor[]>(
      `${BASE_URL}/${id}/versoes`,
    );
  },

  /** Buscar snapshot completo de uma versão específica (para gerar PDF) */
  getVersaoDados(
    id: number,
    versao: number,
  ): Promise<AvaliacaoGestorFormulario> {
    return apiClient.request<AvaliacaoGestorFormulario>(
      `${BASE_URL}/${id}/versoes/${versao}`,
    );
  },
};
