import {
  Form,
  FormField,
  FormSection,
  FormResponse,
  FormAnswer,
  FormWithDetails,
  ResponseWithAnswers,
  Directorate
} from '@/types';
import { apiClient, ApiError } from './apiClient';

// ============================================================
// FORMS
// ============================================================

export const getForms = async (
  directorate?: Directorate, 
  options?: { isAdmin?: boolean; filterByVisibility?: boolean }
): Promise<Form[]> => {
  const params = new URLSearchParams();

  if (options?.isAdmin) {
    params.set('isAdmin', 'true');
  } else if (directorate) {
    params.set('directorate', directorate);
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/api/forms?${queryString}` : '/api/forms';
  
  return apiClient.get<Form[]>(endpoint);
};

export const getFormById = async (id: string): Promise<FormWithDetails | null> => {
  try {
    return await apiClient.get<FormWithDetails>(`/api/forms/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

export const createForm = async (
  data: Omit<Form, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Form> => {
  return apiClient.post<Form>('/api/forms', data);
};

export const updateForm = async (id: string, data: Partial<Form>): Promise<Form> => {
  return apiClient.put<Form>(`/api/forms/${id}`, data);
};

export const deleteForm = async (id: string): Promise<void> => {
  await apiClient.delete<void>(`/api/forms/${id}`);
};

// ============================================================
// SECTIONS & FIELDS (Batch Operations)
// ============================================================

/**
 * Salva seções e campos de um formulário em batch
 * @throws {ApiError} Se houver erro na operação
 */
export const saveSectionsAndFields = async (
  formId: string,
  sections: FormSection[],
  fields: FormField[]
): Promise<{ sections: FormSection[]; fields: FormField[] }> => {
  await apiClient.post(`/api/forms/${formId}/structure`, {
    sections,
    fields
  });

  // Recarregar o formulário para pegar os IDs gerados
  const updatedForm = await getFormById(formId);

  if (!updatedForm) {
    throw new Error('Erro ao recarregar formulário após salvar');
  }

  return {
    sections: updatedForm.sections,
    fields: updatedForm.fields
  };
};

/**
 * Carrega estrutura do formulário (seções e campos)
 */
export const getFormStructure = async (
  formId: string
): Promise<{ sections: FormSection[]; fields: FormField[] }> => {
  return apiClient.get<{ sections: FormSection[]; fields: FormField[] }>(
    `/api/forms/${formId}/structure`
  );
};

// Métodos legados - mantidos para compatibilidade mas lançam erro
export const createSection = async (): Promise<never> => {
  throw new Error('Use saveSectionsAndFields instead');
};

export const updateSection = async (): Promise<never> => {
  throw new Error('Use saveSectionsAndFields instead');
};

export const deleteSection = async (): Promise<never> => {
  throw new Error('Use saveSectionsAndFields instead');
};

export const createField = async (): Promise<never> => {
  throw new Error('Use saveSectionsAndFields instead');
};

export const updateField = async (): Promise<never> => {
  throw new Error('Use saveSectionsAndFields instead');
};

export const deleteField = async (): Promise<never> => {
  throw new Error('Use saveSectionsAndFields instead');
};

// ============================================================
// RESPONSES
// ============================================================

/**
 * Busca todas as respostas de um formulário
 */
export const getFormResponses = async (formId: string): Promise<ResponseWithAnswers[]> => {
  return apiClient.get<ResponseWithAnswers[]>(`/api/forms/${formId}/responses`);
};

/**
 * Busca respostas de um usuário específico
 */
export const getUserResponses = async (userId: string): Promise<ResponseWithAnswers[]> => {
  return apiClient.get<ResponseWithAnswers[]>(`/api/users/${userId}/responses`);
};

/**
 * Cria ou atualiza uma resposta de formulário
 * @throws {ApiError} com status 409 se o formulário já foi respondido
 */
export const createResponse = async (
  data: Omit<FormResponse, 'id' | 'createdAt' | 'updatedAt'> & { answers?: FormAnswer[] }
): Promise<FormResponse> => {
  const { answers, ...responseData } = data as FormResponse & { answers?: FormAnswer[] };

  return apiClient.post<FormResponse>(`/api/forms/${responseData.formId}/responses`, {
    userId: responseData.userId,
    status: responseData.status,
    answers: answers || []
  });
};

/**
 * Submete resposta de formulário
 */
export const submitFormResponse = async (
  formId: string,
  userId: string,
  answers: { fieldId: string; value: string | string[] | number }[]
): Promise<FormResponse> => {
  return apiClient.post<FormResponse>(`/api/forms/${formId}/responses`, {
    userId,
    status: 'SUBMITTED',
    answers
  });
};

/**
 * Salva rascunho de resposta
 */
export const saveDraftResponse = async (
  formId: string,
  userId: string,
  answers: { fieldId: string; value: string | string[] | number }[]
): Promise<FormResponse> => {
  return apiClient.post<FormResponse>(`/api/forms/${formId}/responses`, {
    userId,
    status: 'DRAFT',
    answers
  });
};

// Métodos legados
export const updateResponse = async (
  id: string, 
  data: Partial<FormResponse>
): Promise<FormResponse> => {
  console.warn('updateResponse: Use createResponse com status DRAFT para atualizar');
  return {} as FormResponse;
};

export const saveAnswers = async (
  responseId: string, 
  answers: Omit<FormAnswer, 'id'>[]
): Promise<FormAnswer[]> => {
  console.warn('saveAnswers: Use createResponse ou submitFormResponse');
  return [];
};

// ============================================================
// EXPORT
// ============================================================

export const formApi = {
  // Forms
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  
  // Structure
  getFormStructure,
  saveSectionsAndFields,
  createSection,
  updateSection,
  deleteSection,
  createField,
  updateField,
  deleteField,
  
  // Responses
  getFormResponses,
  getUserResponses,
  createResponse,
  submitFormResponse,
  saveDraftResponse,
  updateResponse,
  saveAnswers
};

export default formApi;
