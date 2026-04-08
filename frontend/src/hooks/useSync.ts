import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { syncApi } from "@/api/sync";
import { environmentKeys } from "@/hooks/useEnvironments";
import { reportKeys } from "@/hooks/useReports";
import type { SyncJobResponse } from "@/types/api";

export const syncKeys = {
  all: ["sync"] as const,
  status: (jobId: string) => [...syncKeys.all, "status", jobId] as const,
  lastSync: (envName: string) => [...syncKeys.all, "lastSync", envName] as const,
};

export function useSyncStatus(jobId: string | null) {
  return useQuery<SyncJobResponse>({
    queryKey: syncKeys.status(jobId || ""),
    queryFn: () => syncApi.getStatus(jobId!),
    enabled: !!jobId,
    retry: false,
    refetchInterval: (query) => {
      // Stop polling on any query error (e.g. 404 — job record not found)
      if (query.state.error) return false;
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 2000 : false;
    },
  });
}

export function useLastSyncStatus(envName: string) {
  return useQuery<SyncJobResponse>({
    queryKey: syncKeys.lastSync(envName),
    queryFn: () => syncApi.getLastSync(envName),
    enabled: !!envName,
    retry: false,
    staleTime: 30000,
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncApi.trigger,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: syncKeys.status(data.job_id) });
    },
  });
}

export function useTriggerSyncAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncApi.triggerAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: environmentKeys.all });
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}
