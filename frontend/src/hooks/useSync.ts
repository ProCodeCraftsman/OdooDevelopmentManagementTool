import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { syncApi } from "@/api/sync";
import type { SyncJobResponse } from "@/types/api";

export const syncKeys = {
  all: ["sync"] as const,
  status: (jobId: string) => [...syncKeys.all, "status", jobId] as const,
};

export function useSyncStatus(jobId: string | null) {
  return useQuery<SyncJobResponse>({
    queryKey: syncKeys.status(jobId || ""),
    queryFn: () => syncApi.getStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 3000 : false;
    },
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
  return useMutation({
    mutationFn: syncApi.triggerAll,
  });
}
