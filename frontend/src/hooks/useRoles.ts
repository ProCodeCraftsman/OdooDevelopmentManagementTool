import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi, type Role } from "@/api/roles";
import { toast } from "sonner";

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
  });
}

export function useRole(id: number) {
  return useQuery({
    queryKey: ["roles", id],
    queryFn: () => rolesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Role>) => rolesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role created successfully");
    },
    onError: () => {
      toast.error("Failed to create role");
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Role> }) => 
      rolesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role updated successfully");
    },
    onError: () => {
      toast.error("Failed to update role");
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => rolesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete role");
    },
  });
}
