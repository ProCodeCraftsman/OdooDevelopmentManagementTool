import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReleasePlanState {
  id: number;
  name: string;
  description: string | null;
  category: string; // Open / In Progress / Closed / Failed/Cancelled
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentBrief {
  id: number;
  name: string;
  order: number;
  category: string;
}

export interface ReleasePlanStateBrief {
  id: number;
  name: string;
  category: string;
}

export interface UserBrief {
  id: number;
  username: string;
  email: string;
}

export interface DevelopmentRequestBrief {
  id: number;
  request_number: string;
  description: string;
}

export interface ReleasePlanLine {
  id: number;
  release_plan_id: number;
  request_module_line_id: number | null;
  development_request_id: number | null;
  module_id: number | null;
  module_technical_name: string | null;
  module_version: string | null;
  module_email: string | null;
  module_md5_hash: string | null;
  source_env_version: string | null;
  target_env_version: string | null;
  release_action: string | null;
  uat_ticket: string | null;
  uat_status: string | null;
  created_at: string;
  updated_at: string;
  development_request: DevelopmentRequestBrief | null;
}

export interface EligibleModuleLine {
  id: number; // RequestModuleLine.id
  module_id: number | null;
  module_technical_name: string;
  module_version: string | null;
  module_md5_sum: string | null;
  uat_status: string | null;
  uat_ticket: string | null;
  source_env_version: string | null;
  target_env_version: string | null;
  drift_action: string | null;
  is_eligible: boolean;
  disable_reason: string | null;
}

export interface LinkedReleasePlanEntry {
  release_plan_line_id: number;
  module_technical_name: string | null;
  module_version: string | null;
  plan_id: number;
  plan_number: string;
  source_env_name: string;
  target_env_name: string;
  state_name: string;
  state_category: string;
  planned_deployment_date: string | null;
  actual_deployment_date: string | null;
}

export interface LinkModuleLinesRequest {
  module_line_ids: number[];
}

export interface LinkModuleLinesResponse {
  added: ReleasePlanLine[];
  skipped: string[];
  errors: string[];
}

export interface ReleasePlan {
  id: number;
  plan_number: string;
  release_version: string;
  source_environment_id: number;
  target_environment_id: number;
  state_id: number;
  planned_deployment_date: string | null;
  actual_deployment_date: string | null;
  release_notes: string | null;
  comments: string | null;
  approved_by_id: number | null;
  deployed_by_id: number | null;
  related_release_plan_id: number | null;
  is_snapshot_taken: boolean;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
  source_environment: EnvironmentBrief;
  target_environment: EnvironmentBrief;
  state: ReleasePlanStateBrief;
  approved_by: UserBrief | null;
  deployed_by: UserBrief | null;
  created_by: UserBrief | null;
  lines: ReleasePlanLine[];
  permissions?: ReleasePlanPermissions;
  _warning?: string;
}

export interface ReleasePlanPermissions {
  can_create: boolean;
  can_modify: boolean;
  can_delete: boolean;
  can_manage_lines: boolean;
  can_transition_state: boolean;
  can_approve: boolean;
  can_deploy: boolean;
  current_role_level: number;
  current_role_name: string;
  macro_state: string;
}

export interface PaginatedReleasePlanResponse {
  items: ReleasePlan[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Request / Input types ────────────────────────────────────────────────────

export interface ReleasePlanCreate {
  release_version?: string;
  source_environment_id: number;
  target_environment_id: number;
  state_id?: number;
  planned_deployment_date?: string;
  release_notes?: string;
  comments?: string;
  approved_by_id?: number;
  deployed_by_id?: number;
  related_release_plan_id?: number;
}

export interface ReleasePlanUpdate {
  release_version?: string;
  source_environment_id?: number;
  target_environment_id?: number;
  state_id?: number;
  planned_deployment_date?: string;
  actual_deployment_date?: string;
  release_notes?: string;
  comments?: string;
  approved_by_id?: number;
  deployed_by_id?: number;
  related_release_plan_id?: number;
}

export interface ReleasePlanStateCreate {
  name: string;
  description?: string;
  category: string;
  is_active?: boolean;
  display_order?: number;
}

export interface ReleasePlanStateUpdate {
  name?: string;
  description?: string;
  category?: string;
  display_order?: number;
}

export interface ReleasePlanLineUpdate {
  development_request_id?: number;
  module_id?: number;
  module_technical_name?: string;
  module_version?: string;
  module_email?: string;
  module_md5_hash?: string;
  uat_ticket?: string;
  uat_status?: string;
}

export interface BulkAddLinesRequest {
  development_request_id: number;
}

export interface AddLinesFromRequestResponse {
  added: ReleasePlanLine[];
  skipped: string[];
  errors: string[];
}

export interface ReleasePlanFilters {
  state_id?: number;
  source_environment_id?: number;
  target_environment_id?: number;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const releasePlansApi = {
  // States (control parameter)
  getStates: async (includeInactive = false): Promise<ReleasePlanState[]> => {
    const res = await api.get<ReleasePlanState[]>("/release-plans/states/", {
      params: { include_inactive: includeInactive },
    });
    return res.data;
  },

  createState: async (data: ReleasePlanStateCreate): Promise<ReleasePlanState> => {
    return (await api.post<ReleasePlanState>("/release-plans/states/", data)).data;
  },

  updateState: async (id: number, data: ReleasePlanStateUpdate): Promise<ReleasePlanState> => {
    return (await api.patch<ReleasePlanState>(`/release-plans/states/${id}`, data)).data;
  },

  deactivateState: async (id: number): Promise<void> => {
    await api.delete(`/release-plans/states/${id}`);
  },

  restoreState: async (id: number): Promise<ReleasePlanState> => {
    return (await api.post<ReleasePlanState>(`/release-plans/states/${id}/restore`)).data;
  },

  getStatesAll: async (): Promise<ReleasePlanState[]> => {
    const res = await api.get<ReleasePlanState[]>("/release-plans/states/", {
      params: { include_inactive: true },
    });
    return res.data;
  },

  // Plans
  list: async (
    filters?: ReleasePlanFilters,
    page = 1,
    limit = 20
  ): Promise<PaginatedReleasePlanResponse> => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());
    if (filters?.state_id) params.append("state_id", filters.state_id.toString());
    if (filters?.source_environment_id)
      params.append("source_environment_id", filters.source_environment_id.toString());
    if (filters?.target_environment_id)
      params.append("target_environment_id", filters.target_environment_id.toString());
    return (
      await api.get<PaginatedReleasePlanResponse>(`/release-plans/?${params.toString()}`)
    ).data;
  },

  get: async (id: number): Promise<ReleasePlan> => {
    return (await api.get<ReleasePlan>(`/release-plans/${id}`)).data;
  },

  create: async (data: ReleasePlanCreate): Promise<ReleasePlan> => {
    return (await api.post<ReleasePlan>("/release-plans/", data)).data;
  },

  update: async (
    id: number,
    data: ReleasePlanUpdate,
    confirmEnvChange = false
  ): Promise<ReleasePlan> => {
    const params = confirmEnvChange ? "?confirm_env_change=true" : "";
    return (await api.patch<ReleasePlan>(`/release-plans/${id}${params}`, data)).data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/release-plans/${id}`);
  },

  // Eligible modules for Add-Modules wizard
  getEligibleModules: async (planId: number, requestId: number): Promise<EligibleModuleLine[]> => {
    return (
      await api.get<EligibleModuleLine[]>(`/release-plans/${planId}/eligible-modules`, {
        params: { request_id: requestId },
      })
    ).data;
  },

  linkModuleLines: async (planId: number, data: LinkModuleLinesRequest): Promise<LinkModuleLinesResponse> => {
    return (
      await api.post<LinkModuleLinesResponse>(`/release-plans/${planId}/lines/link`, data)
    ).data;
  },

  updateLine: async (
    planId: number,
    lineId: number,
    data: ReleasePlanLineUpdate
  ): Promise<ReleasePlanLine> => {
    return (
      await api.patch<ReleasePlanLine>(`/release-plans/${planId}/lines/${lineId}`, data)
    ).data;
  },

  deleteLine: async (planId: number, lineId: number): Promise<void> => {
    await api.delete(`/release-plans/${planId}/lines/${lineId}`);
  },

  // Linked plans for a DR
  getLinkedPlansForDr: async (requestId: number): Promise<LinkedReleasePlanEntry[]> => {
    return (
      await api.get<LinkedReleasePlanEntry[]>(
        `/development-requests/requests/linked-plans/${requestId}`
      )
    ).data;
  },

  refreshVersions: async (planId: number): Promise<ReleasePlan> => {
    return (await api.post<ReleasePlan>(`/release-plans/${planId}/refresh-versions`)).data;
  },
};
