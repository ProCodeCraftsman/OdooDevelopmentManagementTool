import { api } from "@/lib/api";
import type { ComparisonReport } from "@/types/api";

export const reportsApi = {
  getComparison: async (): Promise<ComparisonReport> => {
    const response = await api.get<ComparisonReport>("/reports/comparison");
    return response.data;
  },
};
