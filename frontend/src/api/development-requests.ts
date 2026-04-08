import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

export interface DevelopmentRequestFilterOptions {
  request_type_ids: string[];
  request_state_ids: string[];
  functional_category_ids: string[];
  priority_ids: string[];
  assigned_developer_ids: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

async function _fetchExport(url: string): Promise<unknown[]> {
  const token = useAuthStore.getState().token;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export request failed");
  return res.json() as Promise<unknown[]>;
}

function _downloadXlsx(rows: unknown[], sheetName: string, filename: string): void {
  import("xlsx").then((XLSX) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  });
}

// ---------------------------------------------------------------------------
// Shared brief types
// ---------------------------------------------------------------------------

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

export interface StateTypeRuleBrief {
  id: number;
  request_state_id: number;
  request_type_id: number;
  request_state_name: string;
  request_state_category: string;
  request_type_name: string;
  request_type_category: string;
  is_active: boolean;
}

export interface RelatedRequestBrief {
  id: number;
  request_number: string;
  title: string;
  description: string;
}

export interface RequestSearchResult {
  id: number;
  request_number: string;
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Module lines
// ---------------------------------------------------------------------------

export interface RequestModuleLine {
  id: number;
  request_id: number;
  module_id: number | null;
  module_technical_name: string;
  module_version: string | null;
  module_md5_sum: string | null;
  email_thread_zip: string | null;
  uat_status: string | null;
  uat_ticket: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface RequestReleasePlanLine {
  id: number;
  request_id: number;
  release_plan_date: string;
  release_plan_status: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Comments (threaded)
// ---------------------------------------------------------------------------

export interface RequestComment {
  id: number;
  request_id: number;
  user_id: number | null;
  content: string;
  parent_comment_id: number | null;
  created_at: string;
  updated_at: string;
  user: UserBrief | null;
  replies: RequestComment[];
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface RequestAttachment {
  id: number;
  request_id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by_id: number | null;
  created_at: string;
  uploaded_by: UserBrief | null;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: number;
  record_id: number;
  table_name: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_id: number | null;
  changed_at: string;
  changed_by: UserBrief | null;
}

// ---------------------------------------------------------------------------
// Main request type
// ---------------------------------------------------------------------------

export interface DevelopmentRequest {
  id: number;
  request_number: string;
  title: string;
  request_type_id: number;
  functional_category_id: number;
  request_state_id: number;
  priority_id: number;
  description: string;
  additional_info: string | null;
  comments: string | null;
  uat_request_id: string | null;
  assigned_developer_id: number | null;
  parent_request_id: number | null;
  created_by_id: number | null;
  updated_by_id: number | null;
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
  created_by: UserBrief | null;
  updated_by: UserBrief | null;

  related_requests: RelatedRequestBrief[];
  module_lines: RequestModuleLine[];
  release_plan_lines: RequestReleasePlanLine[];
  comments_thread: RequestComment[];
  attachments: RequestAttachment[];

  permissions?: {
    can_update?: boolean;
    can_edit_request_type?: boolean;
    can_edit_description?: boolean;
    can_edit_functional_category?: boolean;
    can_edit_priority?: boolean;
    can_edit_assigned_developer?: boolean;
    can_edit_comments?: boolean;
    can_edit_uat_request_id?: boolean;
    can_edit_state?: boolean;
    can_reopen?: boolean;
    can_archive?: boolean;
    can_add_module_lines?: boolean;
    can_edit_module_lines?: boolean;
    can_delete_module_lines?: boolean;
    can_create_attachments?: boolean;
    can_delete_attachments?: boolean;
    can_manage_system?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Create / Update payloads
// ---------------------------------------------------------------------------

export interface DevelopmentRequestCreate {
  title: string;
  request_type_id: number;
  functional_category_id: number;
  priority_id: number;
  description: string;
  additional_info?: string;
  comments?: string;
  uat_request_id?: string;
  assigned_developer_id?: number;
  parent_request_id?: number;
  request_state_id?: number;
}

export interface DevelopmentRequestUpdate {
  title?: string;
  request_type_id?: number;
  functional_category_id?: number;
  priority_id?: number;
  description?: string;
  additional_info?: string;
  comments?: string;
  uat_request_id?: string;
  assigned_developer_id?: number;
  request_state_id?: number;
  parent_request_id?: number;
}

// ---------------------------------------------------------------------------
// Module line payloads
// ---------------------------------------------------------------------------

export interface ModuleLineCreate {
  module_technical_name: string;
  module_version?: string;
  module_md5_sum?: string;
  email_thread_zip?: string;
}

export interface ModuleLineUpdate {
  module_version?: string;
  module_md5_sum?: string;
  email_thread_zip?: string;
  uat_status?: string;
  uat_ticket?: string;
}

export interface BulkModuleLineCreate {
  lines: ModuleLineCreate[];
}

export interface BulkModuleLineResponse {
  added: RequestModuleLine[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Misc payloads / helpers
// ---------------------------------------------------------------------------

export interface ReopenRequest {
  comment: string;
}

// ---------------------------------------------------------------------------
// Query state (Saved Views)
// ---------------------------------------------------------------------------

export type GroupByOption =
  | "state_category"
  | "assigned_developer"
  | "priority"
  | "functional_category";

export interface FilterToken {
  field:
    | "request_type_ids"
    | "request_state_ids"
    | "functional_category_ids"
    | "priority_ids"
    | "assigned_developer_ids";
  ids: string[];
  labels: string[];
}

export interface QueryState {
  filters: FilterToken[];
  search: string;
  group_by: GroupByOption | null;
  show_archived: boolean;
}

export interface GroupInfo {
  key: string;
  label: string;
  count: number;
}

export interface DevelopmentRequestFilters {
  request_type_ids?: string;
  request_state_ids?: string;
  functional_category_ids?: string;
  priority_ids?: string;
  assigned_developer_ids?: string;
  is_archived?: boolean;
  search?: string;
  group_by?: GroupByOption;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  groups?: GroupInfo[];
}

// ---------------------------------------------------------------------------
// Bulk operation types
// ---------------------------------------------------------------------------

export interface BulkOperationResponse {
  succeeded: number[];
  failed: number[];
  errors: Record<string, string>;
}

export interface BulkAssignRequest {
  ids: number[];
  assigned_developer_id: number;
}

export interface BulkArchiveRequest {
  ids: number[];
}

export interface RejectRequest {
  request_state_id: number;
  comment: string;
}

export interface ControlParameters {
  request_types: RequestTypeBrief[];
  request_states: RequestStateBrief[];
  functional_categories: FunctionalCategoryBrief[];
  priorities: PriorityBrief[];
  state_type_rules: StateTypeRuleBrief[];
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const developmentRequestsApi = {
  // ── All IDs (for "select all N records" bulk selection) ──────────────────
  getAllIds: async (filters?: DevelopmentRequestFilters): Promise<{ ids: number[]; total: number }> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await api.get<{ ids: number[]; total: number }>(
      `/development-requests/requests/all-ids?${params.toString()}`
    );
    return response.data;
  },

  // ── Bulk operations ───────────────────────────────────────────────────────
  bulkAssign: async (data: BulkAssignRequest): Promise<BulkOperationResponse> => {
    const response = await api.post<BulkOperationResponse>(
      "/development-requests/requests/bulk-assign",
      data
    );
    return response.data;
  },

  bulkArchive: async (data: BulkArchiveRequest): Promise<BulkOperationResponse> => {
    const response = await api.post<BulkOperationResponse>(
      "/development-requests/requests/bulk-archive",
      data
    );
    return response.data;
  },

  // ── Reject (mandatory comment, atomic) ────────────────────────────────────
  reject: async (id: number, data: RejectRequest): Promise<DevelopmentRequest> => {
    const response = await api.post<DevelopmentRequest>(
      `/development-requests/requests/${id}/reject`,
      data
    );
    return response.data;
  },

  // ── Filter options ────────────────────────────────────────────────────────
  getFilterOptions: async (): Promise<DevelopmentRequestFilterOptions> => {
    const response = await api.get<DevelopmentRequestFilterOptions>("/development-requests/requests/filter-options");
    return response.data;
  },

  // ── Control parameters ────────────────────────────────────────────────
  getControlParameters: async (): Promise<ControlParameters> => {
    const response = await api.get<ControlParameters>("/development-requests/control-parameters/");
    return response.data;
  },

  // ── Export ─────────────────────────────────────────────────────────────
  /**
   * Export requests as .xlsx.
   *
   * When `selectedIds` is provided: exports only those specific records.
   * When omitted: exports all records matching the active `filters`.
   *
   * See docs/EXPORT_SELECTED_ROWS.md for the pattern to extend to other tables.
   */
  exportRequestsXlsx: async (
    filters?: Omit<DevelopmentRequestFilters, "is_archived" | "assigned_developer_ids"> & { is_archived?: string },
    filename?: string,
    selectedIds?: number[]
  ): Promise<void> => {
    const params = new URLSearchParams();
    if (selectedIds && selectedIds.length > 0) {
      params.append("ids", selectedIds.join(","));
    } else if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    const qs = params.toString();
    const url = `${API_BASE_URL}/development-requests/requests/export${qs ? `?${qs}` : ""}`;
    const rows = await _fetchExport(url);
    _downloadXlsx(rows, "Development Requests", filename ?? "development_requests.xlsx");
  },

  // ── Requests CRUD ─────────────────────────────────────────────────────
  list: async (
    filters?: DevelopmentRequestFilters,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<DevelopmentRequest>> => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    const response = await api.get<PaginatedResponse<DevelopmentRequest>>(
      `/development-requests/requests/?${params.toString()}`
    );
    return response.data;
  },

  search: async (q: string, excludeId?: number, limit = 10): Promise<RequestSearchResult[]> => {
    const params = new URLSearchParams({ q, limit: limit.toString() });
    if (excludeId !== undefined) params.append("exclude_id", excludeId.toString());
    const response = await api.get<RequestSearchResult[]>(
      `/development-requests/requests/search?${params.toString()}`
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

  // ── Module lines ──────────────────────────────────────────────────────
  addModuleLine: async (requestId: number, data: ModuleLineCreate): Promise<RequestModuleLine> => {
    const response = await api.post<RequestModuleLine>(
      `/development-requests/requests/${requestId}/modules`,
      data
    );
    return response.data;
  },

  updateModuleLine: async (
    requestId: number,
    lineId: number,
    data: ModuleLineUpdate
  ): Promise<RequestModuleLine> => {
    const response = await api.patch<RequestModuleLine>(
      `/development-requests/requests/${requestId}/modules/${lineId}`,
      data
    );
    return response.data;
  },

  deleteModuleLine: async (requestId: number, lineId: number): Promise<void> => {
    await api.delete(`/development-requests/requests/${requestId}/modules/${lineId}`);
  },

  bulkAddModuleLines: async (
    requestId: number,
    data: BulkModuleLineCreate
  ): Promise<BulkModuleLineResponse> => {
    const response = await api.post<BulkModuleLineResponse>(
      `/development-requests/requests/${requestId}/modules/bulk`,
      data
    );
    return response.data;
  },

  // ── Related requests (M2M) ────────────────────────────────────────────
  addRelatedRequest: async (
    requestId: number,
    relatedRequestId: number
  ): Promise<DevelopmentRequest> => {
    const response = await api.post<DevelopmentRequest>(
      `/development-requests/requests/${requestId}/related-requests`,
      { related_request_id: relatedRequestId }
    );
    return response.data;
  },

  removeRelatedRequest: async (
    requestId: number,
    relatedId: number
  ): Promise<DevelopmentRequest> => {
    const response = await api.delete<DevelopmentRequest>(
      `/development-requests/requests/${requestId}/related-requests/${relatedId}`
    );
    return response.data;
  },

  // ── Comments ──────────────────────────────────────────────────────────
  getComments: async (requestId: number): Promise<RequestComment[]> => {
    const response = await api.get<RequestComment[]>(
      `/development-requests/requests/${requestId}/comments`
    );
    return response.data;
  },

  addComment: async (
    requestId: number,
    content: string,
    parentCommentId?: number
  ): Promise<RequestComment> => {
    const response = await api.post<RequestComment>(
      `/development-requests/requests/${requestId}/comments`,
      { content, parent_comment_id: parentCommentId ?? null }
    );
    return response.data;
  },

  updateComment: async (
    requestId: number,
    commentId: number,
    content: string
  ): Promise<RequestComment> => {
    const response = await api.patch<RequestComment>(
      `/development-requests/requests/${requestId}/comments/${commentId}`,
      { content }
    );
    return response.data;
  },

  deleteComment: async (requestId: number, commentId: number): Promise<void> => {
    await api.delete(
      `/development-requests/requests/${requestId}/comments/${commentId}`
    );
  },

  // ── Audit log ─────────────────────────────────────────────────────────
  getAuditLog: async (requestId: number): Promise<AuditLogEntry[]> => {
    const response = await api.get<AuditLogEntry[]>(
      `/development-requests/requests/${requestId}/audit-log`
    );
    return response.data;
  },

  // ── Attachments ───────────────────────────────────────────────────────
  getAttachments: async (requestId: number): Promise<RequestAttachment[]> => {
    const response = await api.get<RequestAttachment[]>(
      `/development-requests/requests/${requestId}/attachments`
    );
    return response.data;
  },

  uploadAttachment: async (requestId: number, file: File): Promise<RequestAttachment> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<RequestAttachment>(
      `/development-requests/requests/${requestId}/attachments`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },

  getAttachmentDownloadUrl: (requestId: number, attachmentId: number): string => {
    const base = import.meta.env.VITE_API_URL ?? "";
    return `${base}/development-requests/requests/${requestId}/attachments/${attachmentId}/download`;
  },

  deleteAttachment: async (requestId: number, attachmentId: number): Promise<void> => {
    await api.delete(
      `/development-requests/requests/${requestId}/attachments/${attachmentId}`
    );
  },
};
