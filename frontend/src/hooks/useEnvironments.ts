import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { environmentsApi } from "@/api/environments";
import type { EnvironmentUpdate } from "@/types/api";

export const environmentKeys = {
  all: ["environments"] as const,
  list: () => [...environmentKeys.all, "list"] as const,
  detail: (name: string) => [...environmentKeys.all, "detail", name] as const,
};

export function useEnvironments() {
  return useQuery({
    queryKey: environmentKeys.list(),
    queryFn: environmentsApi.list,
  });
}

export function useEnvironment(name: string) {
  return useQuery({
    queryKey: environmentKeys.detail(name),
    queryFn: () => environmentsApi.get(name),
    enabled: !!name,
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: environmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: environmentKeys.list() });
    },
  });
}

export function useUpdateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: EnvironmentUpdate }) =>
      environmentsApi.update(name, data),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: environmentKeys.list() });
      queryClient.invalidateQueries({ queryKey: environmentKeys.detail(name) });
    },
  });
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: environmentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: environmentKeys.list() });
    },
  });
}
