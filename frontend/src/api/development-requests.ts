import { api } from "@/lib/api";

export interface RequestModuleLine {
  id: number;
  request_id: number;
  module_id: number | null;
  module_technical_name: string;
  module_version: string | null;
  module_md5_sum: string | null;
  email_thread_zip: string | null;
  created_at: string;
}

export interface RequestReleasePlanLine {
  id: number;
  request_id: number;
  release_plan_date: string;
  release_plan_status: string;
  created_at: string;
  updated_at: string;
}

export interface UserBrief {
  id: number;
  username: string;
  email: string;
}

export interface RequestTypeBrief {
  id: number;
  name: string;
  category: string;
}

export interface RequestStateBrief {
  id: number;
  name: string;
  category: string;
}

export interface FunctionalCategoryBrief {
  id: number;
  name: string;
}

export interface PriorityBrief {
  id: number;
  name: string;
  level: number;
}

export interface DevelopmentRequest {
  id: number;
  request_number: string;
  request_type_id: number;
  functional_category_id: number;
  request_state_id: number;
  priority_id: number;
  description: string;
  comments: string | null;
  uat_request_id: string | null;
  assigned_developer_id: number | null;
  parent_request_id: number | null;
  related_request_id: number | null;
  request_date: string;
  request_close_date: string | null;
  iteration_counter: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  request_type: RequestTypeBrief;
  functional_category: FunctionalCategoryBrief;
  request_state: RequestStateBrief;
  priority: PriorityBrief;
  assigned_developer: UserBrief | null;
  module_lines: RequestModuleLine[];
  release_plan_lines: RequestReleasePlanLine[];
  permissions?: {
    can_update?: boolean;
    can_delete?: boolean;
    can_add_module_lines?: boolean;
    can_delete_module_lines?: boolean;
    can_reopen?: boolean;
    can_add_comments?: boolean;
  };
}

export interface DevelopmentRequestCreate {
  request_type_id: number;
  functional_category_id: number;
  priority_id: number;
  description: string;
  comments?: string;
  uat_request_id?: string;
  assigned_developer_id?: number;
  parent_request_id?: number;
  related_request_id?: number;
  request_state_id?: number;
}

export interface DevelopmentRequestUpdate {
  request_type_id?: number;
  functional_category_id?: number;
  priority_id?: number;
  description?: string;
  comments?: string;
  uat_request_id?: string;
  assigned_developer_id?: number;
  request_state_id?: number;
  parent_request_id?: number;
}

export interface ControlParameters {
  request_types: RequestTypeBrief[];
  request_states: RequestStateBrief[];
  functional_categories: FunctionalCategoryBrief[];
  priorities: PriorityBrief[];
}

export interface ModuleLineCreate {
  module_technical_name: string;
  module_version?: string;
  module_md5_sum?: string;
  email_thread_zip?: string;
}

export interface ReopenRequest {
  comment: string;
}

export interface DevelopmentRequestFilters {
  request_type_id?: number;
  request_state_id?: number;
  functional_category_id?: number;
  priority_id?: number;
  assigned_developer_id?: number;
  is_archived?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const developmentRequestsApi = {
  getControlParameters: async (): Promise<ControlParameters> => {
    const response = await api.get<ControlParameters>("/development-requests/control-parameters/");
    return response.data;
  },

  list: async (
    filters?: DevelopmentRequestFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<DevelopmentRequest>> => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === "is_archived") {
            params.append(key, value.toString());
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }
    const response = await api.get<PaginatedResponse<DevelopmentRequest>>(
      `/development-requests/requests/?${params.toString()}`
    );
    return response.data;
  },

  get: async (id: number): Promise<DevelopmentRequest> => {
    const response = await api.get<DevelopmentRequest>(`/development-requests/requests/${id}`);
    return response.data;
  },

  create: async (data: DevelopmentRequestCreate): Promise<DevelopmentRequest> => {
    const response = await api.post<DevelopmentRequest>("/development-requests/requests/", data);
    return response.data;
  },

  update: async (id: number, data: DevelopmentRequestUpdate): Promise<DevelopmentRequest> => {
    const response = await api.patch<DevelopmentRequest>(
      `/development-requests/requests/${id}`,
      data
    );
    return response.data;
  },

  reopen: async (id: number, comment: string): Promise<DevelopmentRequest> => {
    const response = await api.post<DevelopmentRequest>(
      `/development-requests/requests/${id}/reopen`,
      { comment }
    );
    return response.data;
  },

  addModuleLine: async (
    requestId: number,
    data: ModuleLineCreate
  ): Promise<RequestModuleLine> => {
    const response = await api.post<RequestModuleLine>(
      `/development-requests/requests/${requestId}/modules`,
      data
    );
    return response.data;
  },

  deleteModuleLine: async (requestId: number, lineId: number): Promise<void> => {
    await api.delete(`/development-requests/requests/${requestId}/modules/${lineId}`);
  },

  archive: async (id: number): Promise<DevelopmentRequest> => {
    const response = await api.post<DevelopmentRequest>(
      `/development-requests/requests/${id}/archive`
    );
    return response.data;
  },

  restore: async (id: number): Promise<DevelopmentRequest> => {
    const response = await api.post<DevelopmentRequest>(
      `/development-requests/requests/${id}/restore`
    );
    return response.data;
  },
};
