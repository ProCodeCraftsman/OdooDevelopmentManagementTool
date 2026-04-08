import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import type {
  ComparisonFilterOptions,
  DriftFilterOptions,
  GenerateReportResponse,
  PaginatedDriftResponse,
  PaginatedReportResponse,
  ReportMetadataResponse,
} from "@/types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export interface ReportQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  technical_names?: string;
  sort_by?: string;
}

export interface DriftQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  action_filter?: string;
  sort_by?: string;
  include_no_action?: boolean;
}

// ---------------------------------------------------------------------------
// Export helpers
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

function _downloadCsv(url: string): void {
  const token = useAuthStore.getState().token;
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      if (!res.ok) throw new Error("Export failed");
      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? "export.csv";
      return res.blob().then((blob) => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    });
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const reportsApi = {
  // ── Metadata & generation ──────────────────────────────────────────────────

  generateReport: async (): Promise<GenerateReportResponse> => {
    const response = await api.post<GenerateReportResponse>("/reports/generate");
    return response.data;
  },

  getMetadata: async (): Promise<ReportMetadataResponse> => {
    const response = await api.get<ReportMetadataResponse>("/reports/metadata");
    return response.data;
  },

  // ── Comparison Summary (Tab 2) ─────────────────────────────────────────────

  getComparison: async (params: ReportQueryParams = {}): Promise<PaginatedReportResponse> => {
    const response = await api.get<PaginatedReportResponse>("/reports/comparison", {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 15,
        ...(params.search ? { search: params.search } : {}),
        ...(params.technical_names ? { technical_names: params.technical_names } : {}),
        ...(params.sort_by ? { sort_by: params.sort_by } : {}),
      },
    });
    return response.data;
  },

  getFilterOptions: async (): Promise<ComparisonFilterOptions> => {
    const response = await api.get<ComparisonFilterOptions>("/reports/comparison/filter-options");
    return response.data;
  },

  exportComparisonXlsx: async (
    params?: Omit<ReportQueryParams, "page" | "limit">,
    filename?: string
  ): Promise<void> => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.technical_names) query.set("technical_names", params.technical_names);
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    const qs = query.toString();
    const url = `${API_BASE_URL}/reports/comparison/export${qs ? `?${qs}` : ""}`;
    const rows = await _fetchExport(url);
    _downloadXlsx(rows, "Comparison Summary", filename ?? "comparison_summary.xlsx");
  },

  exportComparisonCsv: (): void => {
    _downloadCsv(`${API_BASE_URL}/reports/export`);
  },

  // ── Version Drift (Tab 1) ──────────────────────────────────────────────────

  getDrift: async (params: DriftQueryParams = {}): Promise<PaginatedDriftResponse> => {
    const response = await api.get<PaginatedDriftResponse>("/reports/drift", {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 15,
        ...(params.search ? { search: params.search } : {}),
        ...(params.action_filter ? { action_filter: params.action_filter } : {}),
        ...(params.sort_by ? { sort_by: params.sort_by } : {}),
        ...(params.include_no_action ? { include_no_action: true } : {}),
      },
    });
    return response.data;
  },

  getDriftFilterOptions: async (): Promise<DriftFilterOptions> => {
    const response = await api.get<DriftFilterOptions>("/reports/drift/filter-options");
    return response.data;
  },

  exportDriftCsv: (params?: Omit<DriftQueryParams, "page" | "limit">): void => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.action_filter) query.set("action_filter", params.action_filter);
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    if (params?.include_no_action) query.set("include_no_action", "true");
    const qs = query.toString();
    _downloadCsv(`${API_BASE_URL}/reports/drift/export${qs ? `?${qs}` : ""}`);
  },

  exportDriftXlsx: async (
    params?: Omit<DriftQueryParams, "page" | "limit">,
    filename?: string
  ): Promise<void> => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.action_filter) query.set("action_filter", params.action_filter);
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    if (params?.include_no_action) query.set("include_no_action", "true");
    const qs = query.toString();
    const url = `${API_BASE_URL}/reports/drift/export-data${qs ? `?${qs}` : ""}`;
    const rows = await _fetchExport(url);
    _downloadXlsx(rows, "Version Drift", filename ?? "version_drift.xlsx");
  },
};
