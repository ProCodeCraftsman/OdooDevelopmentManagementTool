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
  display_order?: number;
}

export interface ControlParameterUpdate {
  name?: string;
  description?: string;
  category?: string;
  display_order?: number;
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

  update: async (
    paramType: string,
    id: number,
    data: ControlParameterUpdate
  ): Promise<ControlParameterWithUsage> => {
    const endpoint = PARAM_TYPE_MAP[paramType] || paramType;
    const response = await api.patch(`/development-requests/control-parameters/${endpoint}/${id}`, data);
    return response.data;
  },
};

export interface ControlParameterRule {
  id: number;
  request_state_id: number;
  request_type_id: number;
  request_state_name: string;
  request_state_category: string;
  request_type_name: string;
  request_type_category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ControlParameterRuleCreate {
  request_state_id: number;
  request_type_id: number;
  is_active?: boolean;
}

export interface ControlParameterRuleUpdate {
  request_state_id?: number;
  request_type_id?: number;
  is_active?: boolean;
}

export const controlParameterRulesApi = {
  list: async (): Promise<ControlParameterRule[]> => {
    const response = await api.get("/development-requests/control-parameters/rules");
    return response.data.rules;
  },

  create: async (data: ControlParameterRuleCreate): Promise<ControlParameterRule> => {
    const response = await api.post("/development-requests/control-parameters/rules", data);
    return response.data;
  },

  update: async (id: number, data: ControlParameterRuleUpdate): Promise<ControlParameterRule> => {
    const response = await api.put(`/development-requests/control-parameters/rules/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/development-requests/control-parameters/rules/${id}`);
  },

  toggle: async (id: number): Promise<ControlParameterRule> => {
    const response = await api.post(`/development-requests/control-parameters/rules/${id}/toggle`);
    return response.data;
  },
};
