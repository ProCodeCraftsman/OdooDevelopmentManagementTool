import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportsApi, type DriftQueryParams, type ReportQueryParams } from "@/api/reports";

export const reportKeys = {
  all: ["reports"] as const,
  metadata: () => [...reportKeys.all, "metadata"] as const,
  comparison: (params: ReportQueryParams) =>
    [...reportKeys.all, "comparison", params] as const,
  filterOptions: () => [...reportKeys.all, "filter-options"] as const,
  drift: (params: DriftQueryParams) =>
    [...reportKeys.all, "drift", params] as const,
  driftFilterOptions: () => [...reportKeys.all, "drift-filter-options"] as const,
};

export function useReportMetadata() {
  return useQuery({
    queryKey: reportKeys.metadata(),
    queryFn: reportsApi.getMetadata,
    refetchInterval: (query) => {
      return query.state.data?.is_generating ? 2000 : false;
    },
  });
}

export function usePaginatedReport(params: ReportQueryParams) {
  return useQuery({
    queryKey: reportKeys.comparison(params),
    queryFn: () => reportsApi.getComparison(params),
    placeholderData: (prev) => prev,
  });
}

export function useComparisonFilterOptions() {
  return useQuery({
    queryKey: reportKeys.filterOptions(),
    queryFn: reportsApi.getFilterOptions,
  });
}

export function usePaginatedDrift(params: DriftQueryParams) {
  return useQuery({
    queryKey: reportKeys.drift(params),
    queryFn: () => reportsApi.getDrift(params),
    placeholderData: (prev) => prev,
  });
}

export function useDriftFilterOptions() {
  return useQuery({
    queryKey: reportKeys.driftFilterOptions(),
    queryFn: reportsApi.getDriftFilterOptions,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reportsApi.generateReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.metadata() });
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}
