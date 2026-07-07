import { apiClient } from "./apiClient";

export interface DatabaseQueryResult {
  success: boolean;
  rows: any[];
  count: number;
  executionTimeMs: number;
}

export const databaseApi = {
  executeQuery: async (query: string): Promise<DatabaseQueryResult> => {
    const response = await apiClient.post<DatabaseQueryResult>("/api/database/query", { query });
    return response;
  },
};
