import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/api/reports";

export const reportKeys = {
  all: ["reports"] as const,
  comparison: () => [...reportKeys.all, "comparison"] as const,
};

export function useComparisonReport() {
  return useQuery({
    queryKey: reportKeys.comparison(),
    queryFn: reportsApi.getComparison,
  });
}
