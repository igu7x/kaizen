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
  peso: number | null;
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
  nivel_minimo: number;
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

  /** Gera o relatório com os dados vigentes no momento da chamada. */
  gerar(unidadeId: number, nivelMinimo: number): Promise<RelatorioLacunas> {
    const params = new URLSearchParams({
      unidadeId: String(unidadeId),
      nivelMinimo: String(nivelMinimo),
    });
    return apiClient.request<RelatorioLacunas>(`${BASE_URL}?${params}`);
  },
};
