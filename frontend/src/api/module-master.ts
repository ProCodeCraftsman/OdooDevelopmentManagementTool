import { api } from "@/lib/api";

export interface PaginationInfo {
  total_records: number;
  total_pages: number;
  current_page: number;
  limit: number;
}

export interface ModuleMasterRecord {
  id: number;
  technical_name: string;
  shortdesc: string | null;
  first_seen_date: string | null;
}

export interface ModuleMasterResponse {
  data: ModuleMasterRecord[];
  pagination: PaginationInfo;
}

export interface ModuleMasterParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
}

export async function getModuleMasterList(
  params: ModuleMasterParams = {}
): Promise<ModuleMasterResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);
  if (params.search) searchParams.set("search", params.search);

  const response = await api.get<ModuleMasterResponse>(
    `/modules/master/?${searchParams.toString()}`
  );
  return response.data;
}
