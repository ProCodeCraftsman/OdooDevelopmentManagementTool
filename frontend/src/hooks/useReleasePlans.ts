import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import {
  releasePlansApi,
  type ReleasePlanCreate,
  type ReleasePlanUpdate,
  type ReleasePlanStateCreate,
  type ReleasePlanStateUpdate,
  type ReleasePlanLineUpdate,
  type ReleasePlanFilters,
  type LinkModuleLinesRequest,
} from "@/api/release-plans";
import { toast } from "sonner";

export const releasePlanQueryKeys = {
  list: (filters?: ReleasePlanFilters, page?: number, limit?: number) =>
    ["release-plans", "list", filters, page, limit] as const,
  detail: (id: number) => ["release-plans", "detail", id] as const,
  states: ["release-plans", "states"] as const,
  statesAll: ["release-plans", "states", "all"] as const,
};

export function useReleasePlanStates() {
  return useQuery({
    queryKey: releasePlanQueryKeys.states,
    queryFn: () => releasePlansApi.getStates(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useReleasePlanStatesAll() {
  return useQuery({
    queryKey: releasePlanQueryKeys.statesAll,
    queryFn: () => releasePlansApi.getStatesAll(),
  });
}

export function useCreateReleasePlanState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReleasePlanStateCreate) => releasePlansApi.createState(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-plans", "states"] });
      toast.success("Release plan state created");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to create state");
    },
  });
}

export function useUpdateReleasePlanState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReleasePlanStateUpdate }) =>
      releasePlansApi.updateState(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-plans", "states"] });
      toast.success("Release plan state updated");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to update state");
    },
  });
}

export function useDeactivateReleasePlanState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => releasePlansApi.deactivateState(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-plans", "states"] });
      toast.success("Release plan state deactivated");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to deactivate state");
    },
  });
}

export function useRestoreReleasePlanState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => releasePlansApi.restoreState(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-plans", "states"] });
      toast.success("Release plan state restored");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to restore state");
    },
  });
}

export function useReleasePlans(
  filters?: ReleasePlanFilters,
  page = 1,
  limit = 20
) {
  return useQuery({
    queryKey: releasePlanQueryKeys.list(filters, page, limit),
    queryFn: () => releasePlansApi.list(filters, page, limit),
    placeholderData: keepPreviousData,
  });
}

export function useReleasePlan(id: number) {
  return useQuery({
    queryKey: releasePlanQueryKeys.detail(id),
    queryFn: () => releasePlansApi.get(id),
    enabled: !!id,
  });
}

export function useCreateReleasePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReleasePlanCreate) => releasePlansApi.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["release-plans"] });
      if (result._warning) {
        toast.warning(result._warning);
      } else {
        toast.success("Release plan created successfully");
      }
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string | object } } }) => {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        toast.error(detail);
      } else {
        toast.error("Failed to create release plan");
      }
    },
  });
}

export function useUpdateReleasePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
      confirmEnvChange,
    }: {
      id: number;
      data: ReleasePlanUpdate;
      confirmEnvChange?: boolean;
    }) => releasePlansApi.update(id, data, confirmEnvChange),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["release-plans"] });
      queryClient.invalidateQueries({ queryKey: releasePlanQueryKeys.detail(variables.id) });
      if (result._warning) {
        toast.warning(result._warning);
      } else {
        toast.success("Release plan updated");
      }
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string | object } } }) => {
      const detail = error.response?.data?.detail;
      if (error.response?.status === 409 && typeof detail === "object" && detail !== null) {
        // Env change confirmation required — let the caller handle this
        return;
      }
      if (typeof detail === "string") {
        toast.error(detail);
      } else {
        toast.error("Failed to update release plan");
      }
    },
  });
}

export function useDeleteReleasePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => releasePlansApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-plans"] });
      toast.success("Release plan deleted");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to delete release plan");
    },
  });
}

export function useEligibleModules(planId: number, requestId: number | null) {
  return useQuery({
    queryKey: ["release-plans", "eligible-modules", planId, requestId] as const,
    queryFn: () => releasePlansApi.getEligibleModules(planId, requestId!),
    enabled: !!requestId,
  });
}

export function useLinkModuleLines(planId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LinkModuleLinesRequest) => releasePlansApi.linkModuleLines(planId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: releasePlanQueryKeys.detail(planId) });
      const msg = `Linked ${result.added.length} module(s)${result.skipped.length ? `, skipped ${result.skipped.length}` : ""}${result.errors.length ? `, ${result.errors.length} error(s)` : ""}.`;
      toast.success(msg);
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to link modules");
    },
  });
}

export function useLinkedPlansForDr(requestId: number) {
  return useQuery({
    queryKey: ["development-requests", "linked-plans", requestId] as const,
    queryFn: () => releasePlansApi.getLinkedPlansForDr(requestId),
    enabled: !!requestId,
  });
}

export function useUpdateReleasePlanLine(planId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, data }: { lineId: number; data: ReleasePlanLineUpdate }) =>
      releasePlansApi.updateLine(planId, lineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releasePlanQueryKeys.detail(planId) });
      toast.success("Line updated");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to update line");
    },
  });
}

export function useDeleteReleasePlanLine(planId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineId: number) => releasePlansApi.deleteLine(planId, lineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releasePlanQueryKeys.detail(planId) });
      toast.success("Line removed");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to remove line");
    },
  });
}

export function useRefreshReleasePlanVersions(planId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => releasePlansApi.refreshVersions(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releasePlanQueryKeys.detail(planId) });
      toast.success("Versions refreshed");
    },
    onError: () => {
      toast.error("Failed to refresh versions");
    },
  });
}
