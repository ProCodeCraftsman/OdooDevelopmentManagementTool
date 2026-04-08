import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { savedViewsApi, type SavedViewCreate, type SavedViewUpdate } from "@/api/saved-views";
import { toast } from "sonner";

const QUERY_KEY = ["saved-views"] as const;

export function useSavedViews() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: savedViewsApi.list,
    staleTime: 60_000,
  });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SavedViewCreate) => savedViewsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("View saved");
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail ?? "Failed to save view");
    },
  });
}

export function useUpdateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SavedViewUpdate }) =>
      savedViewsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("View updated");
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail ?? "Failed to update view");
    },
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => savedViewsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("View deleted");
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail ?? "Failed to delete view");
    },
  });
}
