import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import type {
  EnvironmentCreate,
  EnvironmentUpdate,
  EnvironmentResponse,
  EnvironmentList,
  PaginationInfo,
  EnvironmentModuleRecord,
  ModuleDependencyRecord,
  EnvironmentFilterOptions,
} from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export interface EnvironmentModulesResponse {
  data: EnvironmentModuleRecord[];
  pagination: PaginationInfo;
}

export interface ModuleDependenciesResponse {
  data: ModuleDependencyRecord[];
  pagination: PaginationInfo;
}

export interface GetEnvironmentModulesParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
  /** Comma-separated states, e.g. "installed,to upgrade" */
  state?: string;
  /** Comma-separated technical names */
  technical_names?: string;
  /** Comma-separated versions, e.g. "17.0.1.0.0,17.0.2.0.0" */
  versions?: string;
}

export interface GetModuleDependenciesParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
  /** Comma-separated dependency states */
  dependency_state?: string;
  /** Comma-separated module technical names */
  module_names?: string;
  /** Comma-separated module versions */
  module_versions?: string;
  /** Comma-separated module states */
  module_states?: string;
  /** Comma-separated dependency names */
  dep_names?: string;
  /** Comma-separated dependency versions */
  dep_versions?: string;
}

// ---------------------------------------------------------------------------
// Excel export helpers
// ---------------------------------------------------------------------------

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
// API client
// ---------------------------------------------------------------------------

export const environmentsApi = {
  list: async (): Promise<EnvironmentList[]> => {
    const response = await api.get<EnvironmentList[]>("/environments/");
    return response.data;
  },

  get: async (name: string): Promise<EnvironmentResponse> => {
    const response = await api.get<EnvironmentResponse>(`/environments/${name}`);
    return response.data;
  },

  getModules: async (name: string, params?: GetEnvironmentModulesParams): Promise<EnvironmentModulesResponse> => {
    const response = await api.get<EnvironmentModulesResponse>(`/environments/${name}/modules/`, { params });
    return response.data;
  },

  getDependencies: async (name: string, params?: GetModuleDependenciesParams): Promise<ModuleDependenciesResponse> => {
    const response = await api.get<ModuleDependenciesResponse>(`/environments/${name}/dependencies/`, { params });
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

  getFilterOptions: async (name: string): Promise<EnvironmentFilterOptions> => {
    const response = await api.get<EnvironmentFilterOptions>(`/environments/${name}/filter-options`);
    return response.data;
  },

  exportModulesXlsx: async (
    name: string,
    params?: Omit<GetEnvironmentModulesParams, "page" | "limit">,
    filename?: string
  ): Promise<void> => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.state) query.set("state", params.state);
    if (params?.technical_names) query.set("technical_names", params.technical_names);
    if (params?.versions) query.set("versions", params.versions);
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    if (params?.sort_order) query.set("sort_order", params.sort_order);

    const qs = query.toString();
    const url = `${API_BASE_URL}/environments/${name}/modules/export${qs ? `?${qs}` : ""}`;
    const rows = await _fetchExport(url);
    _downloadXlsx(rows, "Installed Modules", filename ?? `${name}_modules.xlsx`);
  },

  exportDependenciesXlsx: async (
    name: string,
    params?: Omit<GetModuleDependenciesParams, "page" | "limit">,
    filename?: string
  ): Promise<void> => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.dependency_state) query.set("dependency_state", params.dependency_state);
    if (params?.module_names) query.set("module_names", params.module_names);
    if (params?.module_versions) query.set("module_versions", params.module_versions);
    if (params?.module_states) query.set("module_states", params.module_states);
    if (params?.dep_names) query.set("dep_names", params.dep_names);
    if (params?.dep_versions) query.set("dep_versions", params.dep_versions);
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    if (params?.sort_order) query.set("sort_order", params.sort_order);

    const qs = query.toString();
    const url = `${API_BASE_URL}/environments/${name}/dependencies/export${qs ? `?${qs}` : ""}`;
    const rows = await _fetchExport(url);
    _downloadXlsx(rows, "Dependencies", filename ?? `${name}_dependencies.xlsx`);
  },
};
