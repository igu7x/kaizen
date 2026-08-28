import { apiClient, getApiBaseUrl } from "./apiClient";
import { ContractPlan } from "../types";
import Storage from "@/utils/storage";
import { User } from "@/types";

function getUserHeaders(): Record<string, string> {
  const user = Storage.load<User | null>("user", null);
  if (user) {
    return { "x-user-id": String(user.id) };
  }
  return {};
}

export const contractPlanService = {
  getAll: async (): Promise<ContractPlan[]> => {
    return apiClient.get(`/api/contract-plans`, { headers: getUserHeaders() });
  },

  getById: async (id: number): Promise<ContractPlan> => {
    return apiClient.get(`/api/contract-plans/${id}`, { headers: getUserHeaders() });
  },

  create: async (data: any): Promise<ContractPlan> => {
    return apiClient.post(`/api/contract-plans`, data, { headers: getUserHeaders() });
  },

  update: async (id: number, data: any): Promise<ContractPlan> => {
    return apiClient.put(`/api/contract-plans/${id}`, data, { headers: getUserHeaders() });
  },

  delete: async (id: number): Promise<void> => {
    return apiClient.delete(`/api/contract-plans/${id}`, { headers: getUserHeaders() });
  },

  // --- Members ---
  addMember: async (id: number, userId: number, role: string): Promise<any> => {
    return apiClient.post(`/api/contract-plans/${id}/members`, { userId, role }, { headers: getUserHeaders() });
  },

  removeMember: async (id: number, memberId: number): Promise<void> => {
    return apiClient.delete(`/api/contract-plans/${id}/members/${memberId}`, { headers: getUserHeaders() });
  },

  // --- Attachments ---
  getAttachments: async (id: number, documentType?: string): Promise<any[]> => {
    const url = documentType 
      ? `/api/contract-plans/${id}/attachments?documentType=${documentType}` 
      : `/api/contract-plans/${id}/attachments`;
    return apiClient.get(url, { headers: getUserHeaders() });
  },

  uploadAttachment: async (id: number, file: File, documentType: string): Promise<any> => {
    const formData = new FormData();
    formData.append("arquivo", file);
    formData.append("documentType", documentType.toLowerCase());

    // O apiClient pode precisar tratar multipart/form-data ou delegamos para o fetch padrão se der problema.
    // O axios/fetch por padrão ajusta o content-type quando passamos FormData, gerando o boundary correto.
    return apiClient.post(`/api/contract-plans/${id}/attachments`, formData, { 
      headers: { ...getUserHeaders() } 
    });
  },

  deleteAttachment: async (id: number, attachmentId: number): Promise<void> => {
    return apiClient.delete(`/api/contract-plans/${id}/attachments/${attachmentId}`, { headers: getUserHeaders() });
  },
  
  updateAttachmentType: async (id: number, attachmentId: number, documentType: string): Promise<any> => {
    return apiClient.patch(`/api/contract-plans/${id}/attachments/${attachmentId}/type`, { documentType }, { headers: getUserHeaders() });
  },
  
  getAttachmentDownloadUrl: (id: number, attachmentId: number): string => {
    return `${getApiBaseUrl()}/api/contract-plans/${id}/attachments/${attachmentId}/download`;
  },

  // --- Notes (Interlocução) ---
  getNotes: async (id: number): Promise<any[]> => {
    return apiClient.get(`/api/contract-plans/${id}/notes`, { headers: getUserHeaders() });
  },

  addNoteRecord: async (id: number, message: string): Promise<any> => {
    return apiClient.post(`/api/contract-plans/${id}/notes`, { message }, { headers: getUserHeaders() });
  },

  deleteNoteRecord: async (id: number, noteId: number): Promise<void> => {
    return apiClient.delete(`/api/contract-plans/${id}/notes/${noteId}`, { headers: getUserHeaders() });
  }
};
