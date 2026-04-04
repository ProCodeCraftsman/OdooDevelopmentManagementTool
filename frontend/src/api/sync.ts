import { api } from "@/lib/api";
import type { SyncJobResponse } from "@/types/api";

export const syncApi = {
  trigger: async (envName: string): Promise<SyncJobResponse> => {
    const response = await api.post<SyncJobResponse>(`/sync/${envName}`);
    return response.data;
  },
  getStatus: async (jobId: string): Promise<SyncJobResponse> => {
    const response = await api.get<SyncJobResponse>(`/sync/${jobId}`);
    return response.data;
  },
  triggerAll: async (): Promise<SyncJobResponse[]> => {
    const response = await api.post<SyncJobResponse[]>(`/sync/sync-all`);
    return response.data;
  },
};
