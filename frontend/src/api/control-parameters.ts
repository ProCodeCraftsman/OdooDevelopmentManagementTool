import { api } from "@/lib/api";

export interface ControlParameterWithUsage {
  id: number;
  name: string;
  description: string | null;
  category?: string;
  level?: number;
  is_active: boolean;
  display_order: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface ControlParameterCreate {
  name: string;
  description?: string;
  category?: string;
  level?: number;
}

const PARAM_TYPE_MAP: Record<string, string> = {
  "request-types": "request-types",
  "request-states": "request-states",
  "functional-categories": "functional-categories",
  priorities: "priorities",
};

export const controlParametersApi = {
  listAll: async (paramType: string): Promise<ControlParameterWithUsage[]> => {
    const endpoint = PARAM_TYPE_MAP[paramType] || paramType;
    const response = await api.get(`/development-requests/control-parameters/${endpoint}/all`);
    return response.data;
  },

  create: async (
    paramType: string,
    data: ControlParameterCreate
  ): Promise<ControlParameterWithUsage> => {
    const endpoint = PARAM_TYPE_MAP[paramType] || paramType;
    const response = await api.post(`/development-requests/control-parameters/${endpoint}`, data);
    return response.data;
  },

  archive: async (
    paramType: string,
    id: number
  ): Promise<{ success: boolean; message: string }> => {
    const endpoint = PARAM_TYPE_MAP[paramType] || paramType;
    const response = await api.post(`/development-requests/control-parameters/${endpoint}/${id}/archive`);
    return response.data;
  },

  restore: async (
    paramType: string,
    id: number
  ): Promise<{ success: boolean; message: string }> => {
    const endpoint = PARAM_TYPE_MAP[paramType] || paramType;
    const response = await api.post(`/development-requests/control-parameters/${endpoint}/${id}/restore`);
    return response.data;
  },
};
