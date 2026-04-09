import { useQuery } from "@tanstack/react-query";
import { dashboardApi, type DashboardDriftResponse } from "@/api/dashboard";

export type { DashboardDriftResponse };

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
  versionDrift: () => [...dashboardKeys.all, "version-drift"] as const,
  requestAnalysis: (categoryIds?: number[]) =>
    [...dashboardKeys.all, "request-analysis", categoryIds] as const,
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: dashboardApi.getSummary,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useVersionDrift() {
  return useQuery({
    queryKey: dashboardKeys.versionDrift(),
    queryFn: dashboardApi.getVersionDrift,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useRequestAnalysis(categoryIds?: number[]) {
  return useQuery({
    queryKey: dashboardKeys.requestAnalysis(categoryIds),
    queryFn: () => dashboardApi.getRequestAnalysis(categoryIds),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
