/**
 * API REFATORADA - PostgreSQL Backend
 *
 * Este arquivo fornece funções para comunicação com o backend PostgreSQL.
 * Todas as funções propagam erros para tratamento adequado nos componentes.
 */

import {
  User,
  Objective,
  KeyResult,
  Initiative,
  Program,
  ProgramInitiative,
  ExecutionControl,
  Directorate,
  DirectorateInfo,
} from "@/types";
import { apiClient, ApiError } from "./apiClient";

// ============================================================
// HELPER - Hash SHA-256 (compatibilidade com backend)
// ============================================================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

// ============================================================
// API DE AUTENTICAÇÃO
// ============================================================

export async function login(email: string, password: string): Promise<User> {
  // Hash da senha (SHA-256) - manter compatibilidade com backend
  const passwordHash = await hashPassword(password);

  const response = await apiClient.post<{
    user: User;
    accessToken: string;
    expiresAt: number;
  }>("/api/auth/login", {
    email,
    password: passwordHash,
  });

  // Salvar token para autenticação nas próximas requisições
  if (response.accessToken) {
    localStorage.setItem("auth_token", response.accessToken);
    localStorage.setItem("token_expires_at", response.expiresAt.toString());
  }

  return response.user;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post("/api/auth/logout", {});
  } catch (error) {
    // Ignorar erro de logout - limpar dados locais de qualquer forma
    console.warn("Erro no logout:", error);
  } finally {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
  }
}

// ============================================================
// API DE USUÁRIOS
// ============================================================

export async function getUsers(dominio?: string): Promise<User[]> {
  const url = dominio
    ? `/api/users?dominio=${encodeURIComponent(dominio)}`
    : "/api/users";
  return apiClient.get<User[]>(url);
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    return await apiClient.get<User>(`/api/users/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createUser(userData: Omit<User, "id">): Promise<User> {
  return apiClient.post<User>("/api/users", userData);
}

export async function updateUser(
  id: string,
  userData: Partial<User>,
): Promise<User> {
  return apiClient.put<User>(`/api/users/${id}`, userData);
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/users/${id}`);
}

// Perfil do próprio usuário (matrícula, cargo/função, foto)
export async function getMeuPerfil(): Promise<User> {
  return apiClient.get<User>("/api/users/me/perfil");
}

export async function updateMeuPerfil(data: {
  matricula?: string | null;
  cargo_funcao?: string | null;
  foto_perfil?: string | null;
}): Promise<User> {
  return apiClient.patch<User>("/api/users/me/perfil", data);
}

// ============================================================
// API DE OBJECTIVES
// ============================================================

export async function getObjectives(
  directorate?: string,
): Promise<Objective[]> {
  const params = directorate
    ? `?directorate=${encodeURIComponent(directorate)}`
    : "";
  return apiClient.get<Objective[]>(`/api/objectives${params}`);
}

export async function getObjectiveById(id: string): Promise<Objective | null> {
  try {
    const objectives = await getObjectives();
    return objectives.find((obj) => String(obj.id) === String(id)) || null;
  } catch (error) {
    throw error;
  }
}

export async function createObjective(
  objectiveData: Omit<Objective, "id">,
): Promise<Objective> {
  return apiClient.post<Objective>("/api/objectives", objectiveData);
}

export async function updateObjective(
  id: string,
  objectiveData: Partial<Objective>,
): Promise<Objective> {
  return apiClient.put<Objective>(`/api/objectives/${id}`, objectiveData);
}

export async function deleteObjective(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/objectives/${id}`);
}

// ============================================================
// API DE KEY RESULTS
// ============================================================

export async function getKeyResults(
  directorate?: string,
): Promise<KeyResult[]> {
  const params = directorate
    ? `?directorate=${encodeURIComponent(directorate)}`
    : "";
  return apiClient.get<KeyResult[]>(`/api/key-results${params}`);
}

export async function getKeyResultById(id: string): Promise<KeyResult | null> {
  try {
    const krs = await getKeyResults();
    return krs.find((kr) => String(kr.id) === String(id)) || null;
  } catch (error) {
    throw error;
  }
}

export async function createKeyResult(
  krData: Omit<KeyResult, "id" | "situation">,
): Promise<KeyResult> {
  return apiClient.post<KeyResult>("/api/key-results", krData);
}

export async function updateKeyResult(
  id: string,
  krData: Partial<KeyResult>,
): Promise<KeyResult> {
  return apiClient.put<KeyResult>(`/api/key-results/${id}`, krData);
}

export async function deleteKeyResult(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/key-results/${id}`);
}

// ============================================================
// API DE INITIATIVES
// ============================================================

export async function getInitiatives(
  directorate?: string,
): Promise<Initiative[]> {
  const params = directorate
    ? `?directorate=${encodeURIComponent(directorate)}`
    : "";
  return apiClient.get<Initiative[]>(`/api/initiatives${params}`);
}

export async function getInitiativeById(
  id: string,
): Promise<Initiative | null> {
  try {
    const initiatives = await getInitiatives();
    return initiatives.find((init) => String(init.id) === String(id)) || null;
  } catch (error) {
    throw error;
  }
}

export async function createInitiative(
  initiativeData: Omit<Initiative, "id">,
): Promise<Initiative> {
  return apiClient.post<Initiative>("/api/initiatives", initiativeData);
}

export async function updateInitiative(
  id: string,
  initiativeData: Partial<Initiative>,
): Promise<Initiative> {
  return apiClient.put<Initiative>(`/api/initiatives/${id}`, initiativeData);
}

export async function deleteInitiative(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/initiatives/${id}`);
}

// ============================================================
// API DE PROGRAMS
// ============================================================

export async function getPrograms(directorate?: string): Promise<Program[]> {
  const params = directorate
    ? `?directorate=${encodeURIComponent(directorate)}`
    : "";
  return apiClient.get<Program[]>(`/api/programs${params}`);
}

export async function getProgramById(id: string): Promise<Program | null> {
  try {
    const programs = await getPrograms();
    return programs.find((prog) => String(prog.id) === String(id)) || null;
  } catch (error) {
    throw error;
  }
}

export async function createProgram(
  programData: Omit<Program, "id">,
): Promise<Program> {
  return apiClient.post<Program>("/api/programs", programData);
}

export async function updateProgram(
  id: string,
  programData: Partial<Program>,
): Promise<Program> {
  return apiClient.put<Program>(`/api/programs/${id}`, programData);
}

export async function deleteProgram(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/programs/${id}`);
}

// ============================================================
// API DE DIRECTORATES
// ============================================================

export async function getDirectorates(): Promise<DirectorateInfo[]> {
  return apiClient.get<DirectorateInfo[]>("/api/directorates");
}

export async function updateDirectorateProadLink(
  code: Directorate,
  proadLink: string | null,
): Promise<DirectorateInfo> {
  return apiClient.put<DirectorateInfo>(`/api/directorates/${code}`, {
    proadLink,
  });
}

// ============================================================
// API DE PROGRAM INITIATIVES
// ============================================================

export async function getProgramInitiatives(): Promise<ProgramInitiative[]> {
  return apiClient.get<ProgramInitiative[]>("/api/program-initiatives");
}

export async function createProgramInitiative(
  data: Omit<ProgramInitiative, "id">,
): Promise<ProgramInitiative> {
  return apiClient.post<ProgramInitiative>("/api/program-initiatives", data);
}

export async function updateProgramInitiative(
  id: string,
  data: Partial<ProgramInitiative>,
): Promise<ProgramInitiative> {
  return apiClient.put<ProgramInitiative>(
    `/api/program-initiatives/${id}`,
    data,
  );
}

export async function deleteProgramInitiative(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/program-initiatives/${id}`);
}

// ============================================================
// API DE EXECUTION CONTROLS
// ============================================================

export async function getExecutionControls(
  directorate?: string,
): Promise<ExecutionControl[]> {
  const params = directorate
    ? `?directorate=${encodeURIComponent(directorate)}`
    : "";
  return apiClient.get<ExecutionControl[]>(`/api/execution-controls${params}`);
}

export async function createExecutionControl(
  data: Omit<ExecutionControl, "id">,
): Promise<ExecutionControl> {
  return apiClient.post<ExecutionControl>("/api/execution-controls", data);
}

export async function updateExecutionControl(
  id: string,
  data: Partial<ExecutionControl>,
): Promise<ExecutionControl> {
  return apiClient.put<ExecutionControl>(`/api/execution-controls/${id}`, data);
}

export async function deleteExecutionControl(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/execution-controls/${id}`);
}

export async function updateExecutionControlOrdenacao(
  ordenacao: { id: number; linha: number; posicao: number }[],
): Promise<void> {
  await apiClient.put<void>("/api/execution-controls/ordenacao", { ordenacao });
}

// ============================================================
// EXPORTAÇÃO DEFAULT (compatibilidade)
// ============================================================

export const api = {
  // Auth
  login,
  logout,

  // Users
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getMeuPerfil,
  updateMeuPerfil,

  // Objectives
  getObjectives,
  getObjectiveById,
  createObjective,
  updateObjective,
  deleteObjective,

  // Key Results
  getKeyResults,
  getKeyResultById,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,

  // Initiatives
  getInitiatives,
  getInitiativeById,
  createInitiative,
  updateInitiative,
  deleteInitiative,

  // Programs
  getPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,

  // Directorates
  getDirectorates,
  updateDirectorateProadLink,

  // Program Initiatives
  getProgramInitiatives,
  createProgramInitiative,
  updateProgramInitiative,
  deleteProgramInitiative,

  // Execution Controls
  getExecutionControls,
  createExecutionControl,
  updateExecutionControl,
  deleteExecutionControl,
  updateExecutionControlOrdenacao,
};

export default api;
