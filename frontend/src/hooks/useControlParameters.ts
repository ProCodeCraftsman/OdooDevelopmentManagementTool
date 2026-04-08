import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { controlParametersApi, controlParameterRulesApi, type ControlParameterCreate, type ControlParameterUpdate } from "@/api/control-parameters";
import { toast } from "sonner";

export const controlParamKeys = {
  all: ["control-params"] as const,
  list: (paramType: string) => [...controlParamKeys.all, "list", paramType] as const,
  rules: ["control-params", "rules"] as const,
};

export type ControlParameterType = 
  | "request-types" 
  | "request-states" 
  | "functional-categories" 
  | "priorities"
  | "rules";

export function useControlParameterList(paramType: ControlParameterType) {
  return useQuery({
    queryKey: controlParamKeys.list(paramType),
    queryFn: () => controlParametersApi.listAll(paramType),
  });
}

export function useCreateControlParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paramType, data }: { paramType: string; data: ControlParameterCreate }) =>
      controlParametersApi.create(paramType, data),
    onSuccess: (_, { paramType }) => {
      queryClient.invalidateQueries({ queryKey: controlParamKeys.list(paramType) });
      toast.success("Parameter created successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || "Failed to create parameter");
    },
  });
}

export function useArchiveControlParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paramType, id }: { paramType: string; id: number }) =>
      controlParametersApi.archive(paramType, id),
    onSuccess: (_, { paramType }) => {
      queryClient.invalidateQueries({ queryKey: controlParamKeys.list(paramType) });
      toast.success("Parameter archived successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || "Failed to archive parameter");
    },
  });
}

export function useRestoreControlParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paramType, id }: { paramType: string; id: number }) =>
      controlParametersApi.restore(paramType, id),
    onSuccess: (_, { paramType }) => {
      queryClient.invalidateQueries({ queryKey: controlParamKeys.list(paramType) });
      toast.success("Parameter restored successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || "Failed to restore parameter");
    },
  });
}

export function useUpdateControlParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paramType, id, data }: { paramType: string; id: number; data: ControlParameterUpdate }) =>
      controlParametersApi.update(paramType, id, data),
    onSuccess: (_, { paramType }) => {
      queryClient.invalidateQueries({ queryKey: controlParamKeys.list(paramType) });
      toast.success("Parameter updated successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || "Failed to update parameter");
    },
  });
}

// Control Parameter Rules hooks
export function useControlParameterRules() {
  return useQuery({
    queryKey: controlParamKeys.rules,
    queryFn: () => controlParameterRulesApi.list(),
  });
}

export function useCreateControlParameterRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: controlParameterRulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: controlParamKeys.rules });
      toast.success("Rule created successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || "Failed to create rule");
    },
  });
}

export function useUpdateControlParameterRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof controlParameterRulesApi.update>[1] }) =>
      controlParameterRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: controlParamKeys.rules });
      toast.success("Rule updated successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || "Failed to update rule");
    },
  });
}

export function useDeleteControlParameterRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: controlParameterRulesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: controlParamKeys.rules });
      toast.success("Rule deleted successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || "Failed to delete rule");
    },
  });
}

export function useToggleControlParameterRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: controlParameterRulesApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: controlParamKeys.rules });
      toast.success("Rule toggled successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || "Failed to toggle rule");
    },
  });
}

export function useFunctionalCategories() {
  return useQuery({
    queryKey: [...controlParamKeys.list("functional-categories")],
    queryFn: () => controlParametersApi.listAll("functional-categories"),
  });
}
