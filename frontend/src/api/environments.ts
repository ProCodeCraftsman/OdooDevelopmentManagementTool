import { api } from "@/lib/api";
import type {
  EnvironmentCreate,
  EnvironmentUpdate,
  EnvironmentResponse,
  EnvironmentList,
} from "@/types/api";

export const environmentsApi = {
  list: async (): Promise<EnvironmentList[]> => {
    const response = await api.get<EnvironmentList[]>("/environments/");
    return response.data;
  },
  get: async (name: string): Promise<EnvironmentResponse> => {
    const response = await api.get<EnvironmentResponse>(`/environments/${name}`);
    return response.data;
  },
  create: async (data: EnvironmentCreate): Promise<EnvironmentResponse> => {
    const response = await api.post<EnvironmentResponse>("/environments/", data);
    return response.data;
  },
  update: async (name: string, data: EnvironmentUpdate): Promise<EnvironmentResponse> => {
    const response = await api.patch<EnvironmentResponse>(`/environments/${name}`, data);
    return response.data;
  },
  delete: async (name: string): Promise<void> => {
    await api.delete(`/environments/${name}`);
  },
};
