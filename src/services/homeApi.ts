import { apiClient } from "./apiClient";

export interface HomePendencia {
  tipo: string;
  label: string;
  count: number;
  link: string;
  color?: string;
  /** Grupo de exibição (ex.: "Pessoas", "Projetos", "Processos"). Campos novos, opcionais. */
  categoria?: string;
  /** Urgência (menor = mais urgente). Usada para ordenar dentro de cada categoria. */
  prioridade?: number;
}

export interface HomeResumo {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    diretoria: string;
    is_superadmin: boolean;
  };
  pendencias: HomePendencia[];
  projetos: {
    total: number;
    no_prazo: number;
    em_atraso: number;
  };
}

export const homeApi = {
  getResumo(): Promise<HomeResumo> {
    return apiClient.request<HomeResumo>("/api/home/resumo");
  },
};
