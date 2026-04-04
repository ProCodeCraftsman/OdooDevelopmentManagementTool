import { api } from "@/lib/api";

export interface PaginationInfo {
  total_records: number;
  total_pages: number;
  current_page: number;
  limit: number;
}

export interface EnvironmentModuleRecord {
  id: number;
  technical_name: string;
  module_name: string | null;
  installed_version: string | null;
  dependency_versions: string | null;
  state: string;
}

export interface EnvironmentModulesResponse {
  data: EnvironmentModuleRecord[];
  pagination: PaginationInfo;
}

export interface EnvironmentModulesParams {
  environment_id: number;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
  status?: string;
}

export async function getEnvironmentModules(
  params: EnvironmentModulesParams
): Promise<EnvironmentModulesResponse> {
  const searchParams = new URLSearchParams();
  
  searchParams.set("environment_id", String(params.environment_id));
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);

  const response = await api.get<EnvironmentModulesResponse>(
    `/environments/${params.environment_id}/modules/?${searchParams.toString()}`
  );
  return response.data;
}
