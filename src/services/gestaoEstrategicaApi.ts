import { apiClient } from "./apiClient";
import type {
  PlanoPrograma,
  PlanoComProjetos,
  KrProjeto,
  GestaoTarefa,
  CreatePlanoDto,
  UpdatePlanoDto,
  CreateProjetoDto,
  UpdateProjetoDto,
  CreateGestaoTarefaDto,
  UpdateGestaoTarefaDto,
  EstatisticasDiretoria,
} from "@/types";

const BASE_URL = "/api/gestao-estrategica";

// ============================================================
// PLANOS/PROGRAMAS
// ============================================================

export async function getPlanos(diretoria?: string): Promise<PlanoPrograma[]> {
  const params = diretoria ? `?diretoria=${diretoria}` : "";
  return apiClient.request<PlanoPrograma[]>(`${BASE_URL}/planos${params}`);
}

export async function getPlanoById(id: number): Promise<PlanoPrograma> {
  return apiClient.request<PlanoPrograma>(`${BASE_URL}/planos/${id}`);
}

export async function getPlanoCompleto(id: number): Promise<PlanoComProjetos> {
  return apiClient.request<PlanoComProjetos>(
    `${BASE_URL}/planos/${id}/completo`,
  );
}

export async function createPlano(dto: CreatePlanoDto): Promise<PlanoPrograma> {
  return apiClient.request<PlanoPrograma>(`${BASE_URL}/planos`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function updatePlano(
  id: number,
  dto: UpdatePlanoDto,
): Promise<PlanoPrograma> {
  return apiClient.request<PlanoPrograma>(`${BASE_URL}/planos/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export async function deletePlano(id: number): Promise<void> {
  await apiClient.request(`${BASE_URL}/planos/${id}`, {
    method: "DELETE",
  });
}

// ============================================================
// KRs/PROJETOS
// ============================================================

export async function getProjetos(planoId?: number): Promise<KrProjeto[]> {
  const params = planoId ? `?plano_id=${planoId}` : "";
  return apiClient.request<KrProjeto[]>(`${BASE_URL}/projetos${params}`);
}

export async function getProjetoById(id: number): Promise<KrProjeto> {
  return apiClient.request<KrProjeto>(`${BASE_URL}/projetos/${id}`);
}

export async function createProjeto(dto: CreateProjetoDto): Promise<KrProjeto> {
  // Suporta tanto plano_id (legado) quanto instrumento_id (novo)
  return apiClient.request<KrProjeto>(`${BASE_URL}/projetos`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function updateProjeto(
  id: number,
  dto: UpdateProjetoDto,
): Promise<KrProjeto> {
  return apiClient.request<KrProjeto>(`${BASE_URL}/projetos/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export async function deleteProjeto(id: number): Promise<void> {
  await apiClient.request(`${BASE_URL}/projetos/${id}`, {
    method: "DELETE",
  });
}

// ============================================================
// TAREFAS
// ============================================================

export async function getTarefas(projetoId?: number): Promise<GestaoTarefa[]> {
  const params = projetoId ? `?projeto_id=${projetoId}` : "";
  return apiClient.request<GestaoTarefa[]>(`${BASE_URL}/tarefas${params}`);
}

export async function getTarefaById(id: number): Promise<GestaoTarefa> {
  return apiClient.request<GestaoTarefa>(`${BASE_URL}/tarefas/${id}`);
}

export async function createTarefa(
  dto: CreateGestaoTarefaDto,
): Promise<GestaoTarefa> {
  return apiClient.request<GestaoTarefa>(`${BASE_URL}/tarefas`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function updateTarefa(
  id: number,
  dto: UpdateGestaoTarefaDto,
): Promise<GestaoTarefa> {
  return apiClient.request<GestaoTarefa>(`${BASE_URL}/tarefas/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export async function deleteTarefa(id: number): Promise<void> {
  await apiClient.request(`${BASE_URL}/tarefas/${id}`, {
    method: "DELETE",
  });
}

export async function updateOrdenacaoTarefas(
  ordenacao: { id: number; ordem: number }[],
): Promise<void> {
  await apiClient.request(`${BASE_URL}/tarefas/ordenacao`, {
    method: "PUT",
    body: JSON.stringify({ ordenacao }),
  });
}

// ============================================================
// ESTATÍSTICAS
// ============================================================

export async function getEstatisticas(
  diretoria: string,
): Promise<EstatisticasDiretoria> {
  return apiClient.request<EstatisticasDiretoria>(
    `${BASE_URL}/estatisticas?diretoria=${diretoria}`,
  );
}

// Export all functions as a single object for convenience
export const gestaoEstrategicaApi = {
  // Planos
  getPlanos,
  getPlanoById,
  getPlanoCompleto,
  createPlano,
  updatePlano,
  deletePlano,
  // Projetos
  getProjetos,
  getProjetoById,
  createProjeto,
  updateProjeto,
  deleteProjeto,
  // Tarefas
  getTarefas,
  getTarefaById,
  createTarefa,
  updateTarefa,
  deleteTarefa,
  updateOrdenacaoTarefas,
  // Estatísticas
  getEstatisticas,
};
