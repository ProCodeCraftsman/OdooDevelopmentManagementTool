import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

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
  technical_names?: string;
  shortdescs?: string;
}

export interface ModuleMasterFilterOptions {
  technical_names: string[];
  shortdescs: string[];
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

export async function getModuleMasterList(
  params: ModuleMasterParams = {}
): Promise<ModuleMasterResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);
  if (params.search) searchParams.set("search", params.search);
  if (params.technical_names) searchParams.set("technical_names", params.technical_names);
  if (params.shortdescs) searchParams.set("shortdescs", params.shortdescs);

  const response = await api.get<ModuleMasterResponse>(
    `/modules/master/?${searchParams.toString()}`
  );
  return response.data;
}

export async function getModuleMasterFilterOptions(): Promise<ModuleMasterFilterOptions> {
  const response = await api.get<ModuleMasterFilterOptions>("/modules/master/filter-options");
  return response.data;
}

export async function exportModuleMasterXlsx(
  params?: Omit<ModuleMasterParams, "page" | "limit">,
  filename?: string
): Promise<void> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.technical_names) query.set("technical_names", params.technical_names);
  if (params?.shortdescs) query.set("shortdescs", params.shortdescs);
  if (params?.sort_by) query.set("sort_by", params.sort_by);
  if (params?.sort_order) query.set("sort_order", params.sort_order);

  const qs = query.toString();
  const url = `${API_BASE_URL}/modules/master/export${qs ? `?${qs}` : ""}`;
  const rows = await _fetchExport(url);
  _downloadXlsx(rows, "Module Master", filename ?? "module_master.xlsx");
}
