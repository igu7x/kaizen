import { apiClient } from './apiClient';

export interface Meta {
  id: number;
  titulo: string;
  descricao: string | null;
  areaId: number;
  areaNome?: string;
  areaSigla?: string;
  status: string;
  situacao: string;
  prazo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMetaDto {
  titulo: string;
  descricao?: string;
  areaId: number;
  status?: string;
  situacao?: string;
  prazo?: string;
}

export interface UpdateMetaDto {
  titulo?: string;
  descricao?: string;
  areaId?: number;
  status?: string;
  situacao?: string;
  prazo?: string;
}

const BASE_URL = '/api/metas';

export const metasApi = {
  getAll(diretoria?: string): Promise<Meta[]> {
    const params = diretoria ? `?diretoria=${encodeURIComponent(diretoria)}` : '';
    return apiClient.get<Meta[]>(`${BASE_URL}${params}`);
  },
  create(dto: CreateMetaDto): Promise<Meta> {
    return apiClient.post<Meta>(BASE_URL, dto);
  },
  update(id: number, dto: UpdateMetaDto): Promise<Meta> {
    return apiClient.put<Meta>(`${BASE_URL}/${id}`, dto);
  },
  remove(id: number): Promise<void> {
    return apiClient.delete<void>(`${BASE_URL}/${id}`);
  },
};
