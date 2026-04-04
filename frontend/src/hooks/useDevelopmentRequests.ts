import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import {
  developmentRequestsApi,
  type DevelopmentRequestCreate,
  type DevelopmentRequestUpdate,
  type DevelopmentRequestFilters,
  type ModuleLineCreate,
} from "@/api/development-requests";
import { toast } from "sonner";

export const queryKeys = {
  developmentRequests: (filters?: DevelopmentRequestFilters, page?: number, limit?: number) =>
    ["requests", "list", filters, page, limit] as const,
  developmentRequest: (id: number) => ["requests", "detail", id] as const,
  controlParameters: ["control-params"] as const,
};

export function useDevelopmentRequests(
  filters?: DevelopmentRequestFilters,
  page: number = 1,
  limit: number = 20
) {
  return useQuery({
    queryKey: queryKeys.developmentRequests(filters, page, limit),
    queryFn: () => developmentRequestsApi.list(filters, page, limit),
    placeholderData: keepPreviousData,
  });
}

export function useDevelopmentRequest(id: number) {
  return useQuery({
    queryKey: queryKeys.developmentRequest(id),
    queryFn: () => developmentRequestsApi.get(id),
    enabled: !!id,
  });
}

export function useControlParameters() {
  return useQuery({
    queryKey: queryKeys.controlParameters,
    queryFn: developmentRequestsApi.getControlParameters,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDevelopmentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DevelopmentRequestCreate) =>
      developmentRequestsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Request created successfully");
    },
    onError: (error: { response?: { status?: number } }) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: ["requests"] });
        toast.error("You don't have permission to create this request");
      } else {
        toast.error("Failed to create request");
      }
    },
  });
}

export function useUpdateDevelopmentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DevelopmentRequestUpdate }) =>
      developmentRequestsApi.update(id, data),
    onSuccess: () => {
      toast.success("Request updated successfully");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }, variables) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: ["requests"] });
        queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.id) });
        toast.error(error.response?.data?.detail || "You don't have permission to update this request");
      } else {
        toast.error("Failed to update request");
      }
    },
  });
}

export function useReopenDevelopmentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      developmentRequestsApi.reopen(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Request reopened successfully");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }, variables) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: ["requests"] });
        queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.id) });
        toast.error("You don't have permission to reopen this request");
      } else {
        toast.error("Failed to reopen request");
      }
    },
  });
}

export function useAddModuleLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: number; data: ModuleLineCreate }) =>
      developmentRequestsApi.addModuleLine(requestId, data),
    onSuccess: () => {
      toast.success("Module line added");
    },
    onError: (error: { response?: { status?: number } }, variables) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.developmentRequest(variables.requestId),
        });
        toast.error("You don't have permission to add module lines");
      } else {
        toast.error("Failed to add module line");
      }
    },
  });
}

export function useDeleteModuleLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, lineId }: { requestId: number; lineId: number }) =>
      developmentRequestsApi.deleteModuleLine(requestId, lineId),
    onSuccess: () => {
      toast.success("Module line deleted");
    },
    onError: (error: { response?: { status?: number } }, variables) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.developmentRequest(variables.requestId),
        });
        toast.error("You don't have permission to delete module lines");
      } else {
        toast.error("Failed to delete module line");
      }
    },
  });
}

export function useArchiveDevelopmentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => developmentRequestsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Request archived successfully");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: ["requests"] });
        toast.error(error.response?.data?.detail || "You don't have permission to archive this request");
      } else {
        toast.error("Failed to archive request");
      }
    },
  });
}

export function useRestoreDevelopmentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => developmentRequestsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Request restored successfully");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: ["requests"] });
        toast.error(error.response?.data?.detail || "You don't have permission to restore this request");
      } else {
        toast.error("Failed to restore request");
      }
    },
  });
}
