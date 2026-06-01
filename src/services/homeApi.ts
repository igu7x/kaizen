import { apiClient } from './apiClient';

export interface HomePendencia {
  tipo: string;
  label: string;
  count: number;
  link: string;
  color?: string;
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
    return apiClient.request<HomeResumo>('/api/home/resumo');
  },
};
