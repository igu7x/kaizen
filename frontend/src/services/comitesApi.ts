/**
 * Serviço de API para módulo de Comitês
 */

import { apiClient, getApiBaseUrl } from "./apiClient";
import type {
  Comite,
  ComiteMembro,
  ComiteReuniao,
  ComiteReuniaoPauta,
  ComiteQuadroControle,
  UpdateComiteDto,
  CreateMembroDto,
  UpdateMembroDto,
  CreateReuniaoDto,
  UpdateReuniaoDto,
  CreatePautaDto,
  UpdatePautaDto,
  CreateQuadroControleDto,
  UpdateQuadroControleDto,
  AtaInfo,
  UploadAtaResponse,
} from "@/types";

// Helper para obter headers do usuário
const getUserHeaders = (): Record<string, string> => {
  const userStr = localStorage.getItem("user");
  if (!userStr) return {};

  try {
    const user = JSON.parse(userStr);
    return {
      "x-user-id": String(user.id || "1"),
      "x-user-role": user.role || "VIEWER",
      "x-user-diretoria": user.areaSigla || (user as any).diretoria || "",
    };
  } catch {
    return {};
  }
};

// ============================================================
// API DE COMITÊS
// ============================================================

export const comitesApi = {
  /**
   * Listar todos os comitês, opcionalmente filtrados por domínio
   */
  async getAll(dominio?: string): Promise<Comite[]> {
    const url = dominio
      ? `/api/comites?dominio=${encodeURIComponent(dominio)}`
      : "/api/comites";
    return apiClient.get<Comite[]>(url, { headers: getUserHeaders() });
  },

  /**
   * Buscar comitê por sigla ou ID
   */
  async getBySigla(sigla: string): Promise<Comite> {
    return apiClient.get<Comite>(`/api/comites/${sigla}`, {
      headers: getUserHeaders(),
    });
  },

  /**
   * Buscar comitê por ID
   */
  async getById(id: number): Promise<Comite> {
    return apiClient.get<Comite>(`/api/comites/${id}`, {
      headers: getUserHeaders(),
    });
  },

  /**
   * Atualizar comitê
   */
  async update(id: number, data: UpdateComiteDto): Promise<Comite> {
    return apiClient.put<Comite>(`/api/comites/${id}`, data, {
      headers: getUserHeaders(),
    });
  },

  /**
   * Criar novo comitê
   */
  async create(data: {
    nome: string;
    sigla: string;
    descricao?: string;
    icone?: string;
    cor?: string;
    dominio?: string;
  }): Promise<Comite> {
    return apiClient.post<Comite>("/api/comites", data, {
      headers: getUserHeaders(),
    });
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/api/comites/${id}`, { headers: getUserHeaders() });
  },
};

// ============================================================
// API DE MEMBROS
// ============================================================

export const membrosApi = {
  /**
   * Listar membros de um comitê
   */
  async getByComite(comiteId: number): Promise<ComiteMembro[]> {
    return apiClient.get<ComiteMembro[]>(`/api/comites/${comiteId}/membros`, {
      headers: getUserHeaders(),
    });
  },

  /**
   * Criar membro
   */
  async create(comiteId: number, data: CreateMembroDto): Promise<ComiteMembro> {
    return apiClient.post<ComiteMembro>(
      `/api/comites/${comiteId}/membros`,
      data,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Atualizar membro
   */
  async update(
    comiteId: number,
    id: number,
    data: UpdateMembroDto,
  ): Promise<ComiteMembro> {
    return apiClient.put<ComiteMembro>(
      `/api/comites/${comiteId}/membros/${id}`,
      data,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Remover membro
   */
  async delete(comiteId: number, id: number): Promise<void> {
    return apiClient.delete(`/api/comites/${comiteId}/membros/${id}`, {
      headers: getUserHeaders(),
    });
  },
};

// ============================================================
// API DE REUNIÕES
// ============================================================

export const reunioesApi = {
  /**
   * Listar reuniões de um comitê
   */
  async getByComite(comiteId: number, ano?: number): Promise<ComiteReuniao[]> {
    const url = ano
      ? `/api/comites/${comiteId}/reunioes?ano=${ano}`
      : `/api/comites/${comiteId}/reunioes`;
    return apiClient.get<ComiteReuniao[]>(url, { headers: getUserHeaders() });
  },

  /**
   * Buscar reunião por ID
   */
  async getById(comiteId: number, id: number): Promise<ComiteReuniao> {
    return apiClient.get<ComiteReuniao>(
      `/api/comites/${comiteId}/reunioes/${id}`,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Criar reunião
   */
  async create(
    comiteId: number,
    data: CreateReuniaoDto,
  ): Promise<ComiteReuniao> {
    return apiClient.post<ComiteReuniao>(
      `/api/comites/${comiteId}/reunioes`,
      data,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Atualizar reunião
   */
  async update(
    comiteId: number,
    id: number,
    data: UpdateReuniaoDto,
  ): Promise<ComiteReuniao> {
    return apiClient.put<ComiteReuniao>(
      `/api/comites/${comiteId}/reunioes/${id}`,
      data,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Remover reunião
   */
  async delete(comiteId: number, id: number): Promise<void> {
    return apiClient.delete(`/api/comites/${comiteId}/reunioes/${id}`, {
      headers: getUserHeaders(),
    });
  },
};

// ============================================================
// API DE ATAS (PDF Upload)
// ============================================================

export const atasApi = {
  /**
   * Buscar informações da ata de uma reunião
   */
  async getInfo(sigla: string, reuniaoId: number): Promise<AtaInfo> {
    return apiClient.get<AtaInfo>(
      `/api/comites/${sigla}/reunioes/${reuniaoId}/ata`,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Upload de PDF da ata
   */
  async upload(
    sigla: string,
    reuniaoId: number,
    file: File,
    numero: number,
    ano: number,
  ): Promise<UploadAtaResponse> {
    const formData = new FormData();
    formData.append("ata", file);
    formData.append("numero", String(numero));
    formData.append("ano", String(ano));

    const headers = getUserHeaders();

    const response = await fetch(
      `${getApiBaseUrl()}/api/comites/${sigla}/reunioes/${reuniaoId}/upload-ata`,
      {
        method: "POST",
        headers: {
          ...headers,
          // Não definir Content-Type - o browser define automaticamente para FormData
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao fazer upload da ata");
    }

    return response.json();
  },

  /**
   * Obter URL para visualização/download da ata
   */
  getDownloadUrl(sigla: string, reuniaoId: number): string {
    return `${getApiBaseUrl()}/api/comites/${sigla}/reunioes/${reuniaoId}/download-ata`;
  },

  /**
   * Deletar ata de uma reunião
   */
  async delete(sigla: string, reuniaoId: number): Promise<void> {
    return apiClient.delete(`/api/comites/${sigla}/reunioes/${reuniaoId}/ata`, {
      headers: getUserHeaders(),
    });
  },
};

// ============================================================
// API DE PAUTA
// ============================================================

export const pautaApi = {
  /**
   * Listar itens da pauta de uma reunião
   */
  async getByReuniao(
    comiteId: number,
    reuniaoId: number,
  ): Promise<ComiteReuniaoPauta[]> {
    return apiClient.get<ComiteReuniaoPauta[]>(
      `/api/comites/${comiteId}/reunioes/${reuniaoId}/pauta`,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Criar item da pauta
   */
  async create(
    comiteId: number,
    reuniaoId: number,
    data: CreatePautaDto,
  ): Promise<ComiteReuniaoPauta> {
    return apiClient.post<ComiteReuniaoPauta>(
      `/api/comites/${comiteId}/reunioes/${reuniaoId}/pauta`,
      data,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Atualizar item da pauta
   */
  async update(
    comiteId: number,
    reuniaoId: number,
    id: number,
    data: UpdatePautaDto,
  ): Promise<ComiteReuniaoPauta> {
    return apiClient.put<ComiteReuniaoPauta>(
      `/api/comites/${comiteId}/reunioes/${reuniaoId}/pauta/${id}`,
      data,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Remover item da pauta
   */
  async delete(comiteId: number, reuniaoId: number, id: number): Promise<void> {
    return apiClient.delete(
      `/api/comites/${comiteId}/reunioes/${reuniaoId}/pauta/${id}`,
      { headers: getUserHeaders() },
    );
  },
};

// ============================================================
// API DE QUADRO DE CONTROLE
// ============================================================

export const quadroControleApi = {
  /**
   * Listar itens do quadro de controle
   */
  async getByComite(comiteId: number): Promise<ComiteQuadroControle[]> {
    return apiClient.get<ComiteQuadroControle[]>(
      `/api/comites/${comiteId}/quadro-controle`,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Criar item no quadro de controle
   */
  async create(
    comiteId: number,
    data: CreateQuadroControleDto,
  ): Promise<ComiteQuadroControle> {
    return apiClient.post<ComiteQuadroControle>(
      `/api/comites/${comiteId}/quadro-controle`,
      data,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Atualizar item do quadro de controle
   */
  async update(
    comiteId: number,
    id: number,
    data: UpdateQuadroControleDto,
  ): Promise<ComiteQuadroControle> {
    return apiClient.put<ComiteQuadroControle>(
      `/api/comites/${comiteId}/quadro-controle/${id}`,
      data,
      { headers: getUserHeaders() },
    );
  },

  /**
   * Remover item do quadro de controle
   */
  async delete(comiteId: number, id: number): Promise<void> {
    return apiClient.delete(`/api/comites/${comiteId}/quadro-controle/${id}`, {
      headers: getUserHeaders(),
    });
  },
};
