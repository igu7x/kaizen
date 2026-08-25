import { apiClient } from "./apiClient";

const BASE_URL = "/api/competencias/lacunas";

export interface UnidadeLacunas {
  id: number;
  nome: string;
  area_id: number | null;
  area_sigla: string | null;
  /** true quando o usuário é o responsável pela unidade (e não a direção da área). */
  sou_gestor: boolean;
}

export interface LinhaLacuna {
  competencia_id: number;
  competencia_nome: string;
  competencia_descricao: string | null;
  /** Criterio antigo, mantido so como historico. */
  peso: number | null;
  /** Nivel exigido nesta competencia (1..5). */
  grau_minimo_esperado: number;
  /** "matriz" = tecnica digitada; "padrao" = comportamental do catalogo. */
  origem?: "matriz" | "padrao";
  aplicabilidade: string | null;
  /** Quantos colaboradores deveriam dominar a competência. */
  necessario: number;
  /** Quantos atingem o nível mínimo no Resultado Final. */
  possuem: number;
  /** necessario - possuem, nunca negativo. */
  debito: number;
  /** Base observável hoje: min(necessario, colaboradores com Resultado Final). */
  necessario_avaliados: number;
  /** Débito considerando só quem já foi avaliado — falta de competência, não de avaliação. */
  debito_avaliados: number;
  cobertura_percentual: number;
}

export interface RelatorioLacunas {
  unidade_id: number;
  unidade_nome: string | null;
  area_sigla: string | null;
  matriz_id: number;
  matriz_status: string | null;
  matriz_validada_em: string | null;
  qtd_colaboradores: number;
  /** Quantos colaboradores da unidade já têm Resultado Final calculado. */
  colaboradores_avaliados: number;
  total_competencias: number;
  competencias_com_debito: number;
  soma_necessario: number;
  soma_possuem: number;
  soma_debito: number;
  soma_necessario_avaliados: number;
  soma_debito_avaliados: number;
  competencias_com_debito_avaliados: number;
  cobertura_geral_percentual: number;
  competencias: LinhaLacuna[];
}

export const lacunasCompetenciasApi = {
  /** Unidades que o usuário logado pode analisar. */
  getUnidades(): Promise<UnidadeLacunas[]> {
    return apiClient.request<UnidadeLacunas[]>(`${BASE_URL}/unidades`);
  },

  /**
   * Gera o relatório com os dados vigentes no momento da chamada. O corte não é mais parâmetro:
   * cada competência traz o seu Grau mínimo esperado, definido na matriz.
   */
  gerar(unidadeId: number): Promise<RelatorioLacunas> {
    return apiClient.request<RelatorioLacunas>(
      `${BASE_URL}?unidadeId=${unidadeId}`,
    );
  },
};

// ── Lacunas do GESTOR ────────────────────────────────────────────────────────
// Forma diferente da equipe: o avaliado é UMA pessoa, então não se conta gente — pergunta-se, por
// competência, se o gestor alcança o grau mínimo esperado.

export interface UnidadeGestorLacunas {
  id: number;
  nome: string;
  area_id: number | null;
  area_sigla: string | null;
  gestor_user_id: number | null;
  gestor_nome: string | null;
}

export interface LinhaLacunaGestor {
  competencia_id: number;
  origem: "matriz" | "padrao";
  competencia_nome: string;
  competencia_descricao: string | null;
  grau_minimo_esperado: number;
  /** Nota do gestor no Resultado Final; `null` quando a competência não foi avaliada. */
  nota: number | null;
  atingiu: boolean;
  /** Quantos níveis faltam para o grau exigido; `null` sem avaliação. */
  debito_niveis: number | null;
}

export interface RelatorioLacunasGestor {
  unidade_id: number;
  unidade_nome: string | null;
  area_sigla: string | null;
  gestor_user_id: number | null;
  gestor_nome: string | null;
  matriz_id: number;
  matriz_status: string | null;
  matriz_validada_em: string | null;
  tem_resultado_final: boolean;
  total_competencias: number;
  competencias_avaliadas: number;
  atingidas: number;
  em_debito: number;
  soma_debito_niveis: number;
  /** Sobre o que foi AVALIADO — não sobre o total, que faria matriz nova parecer reprovada. */
  percentual_alcance: number;
  competencias: LinhaLacunaGestor[];
}

export const lacunasGestorApi = {
  getUnidades(): Promise<UnidadeGestorLacunas[]> {
    return apiClient.request<UnidadeGestorLacunas[]>(
      `${BASE_URL}/gestor/unidades`,
    );
  },

  gerar(unidadeId: number): Promise<RelatorioLacunasGestor> {
    return apiClient.request<RelatorioLacunasGestor>(
      `${BASE_URL}/gestor?unidadeId=${unidadeId}`,
    );
  },
};
