import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import {
  developmentRequestsApi,
  type DevelopmentRequestCreate,
  type DevelopmentRequestUpdate,
  type DevelopmentRequestFilters,
  type ModuleLineCreate,
  type ModuleLineUpdate,

  type BulkAssignRequest,
  type BulkArchiveRequest,
  type RejectRequest,
} from "@/api/development-requests";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const queryKeys = {
  developmentRequests: (filters?: DevelopmentRequestFilters, page?: number, limit?: number) =>
    ["requests", "list", filters, page, limit] as const,
  developmentRequest: (id: number) => ["requests", "detail", id] as const,
  controlParameters: ["control-params"] as const,
  filterOptions: ["requests", "filter-options"] as const,
  comments: (requestId: number) => ["requests", "comments", requestId] as const,
  auditLog: (requestId: number) => ["requests", "audit-log", requestId] as const,
  attachments: (requestId: number) => ["requests", "attachments", requestId] as const,
};

// ---------------------------------------------------------------------------
// Request search (used by parent-request async dropdown)
// ---------------------------------------------------------------------------

export function useSearchRequests(query: string, excludeId?: number) {
  return useQuery({
    queryKey: ["requests", "search", query, excludeId],
    queryFn: () => developmentRequestsApi.search(query, excludeId),
    enabled: query.length >= 1,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Request list / detail
// ---------------------------------------------------------------------------

export function useDevelopmentRequests(
  filters?: DevelopmentRequestFilters,
  page = 1,
  limit = 20
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

export function useFilterOptions() {
  return useQuery({
    queryKey: queryKeys.filterOptions,
    queryFn: developmentRequestsApi.getFilterOptions,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Request CRUD mutations
// ---------------------------------------------------------------------------

export function useCreateDevelopmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DevelopmentRequestCreate) => developmentRequestsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Request created successfully");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }) => {
      if (error.response?.status === 403) {
        toast.error("You don't have permission to create this request");
      } else {
        toast.error(error.response?.data?.detail ?? "Failed to create request");
      }
    },
  });
}

export function useUpdateDevelopmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DevelopmentRequestUpdate }) =>
      developmentRequestsApi.update(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.id) });
      toast.success("Request updated successfully");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }, variables) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.id) });
        toast.error(error.response?.data?.detail ?? "You don't have permission to update this request");
      } else {
        toast.error(error.response?.data?.detail ?? "Failed to update request");
      }
    },
  });
}

export function useReopenDevelopmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      developmentRequestsApi.reopen(id, comment),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(variables.id) });
      toast.success("Request reopened successfully");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }, variables) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.id) });
        toast.error("You don't have permission to reopen this request");
      } else {
        toast.error(error.response?.data?.detail ?? "Failed to reopen request");
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
      toast.error(error.response?.data?.detail ?? "Failed to archive request");
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
      toast.error(error.response?.data?.detail ?? "Failed to restore request");
    },
  });
}

export function useRejectDevelopmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RejectRequest }) =>
      developmentRequestsApi.reject(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(variables.id) });
      toast.success("Request rejected");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to reject request");
    },
  });
}

export function useBulkAssign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkAssignRequest) => developmentRequestsApi.bulkAssign(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      const { succeeded, failed } = result;
      if (failed.length > 0) {
        toast.warning(`Assigned ${succeeded.length} requests. ${failed.length} failed (permission or not found).`);
      } else {
        toast.success(`Assigned ${succeeded.length} requests`);
      }
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Bulk assign failed");
    },
  });
}

export function useBulkArchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkArchiveRequest) => developmentRequestsApi.bulkArchive(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      const { succeeded, failed } = result;
      if (failed.length > 0) {
        toast.warning(`Archived ${succeeded.length} requests. ${failed.length} could not be archived.`);
      } else {
        toast.success(`Archived ${succeeded.length} requests`);
      }
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Bulk archive failed");
    },
  });
}

// ---------------------------------------------------------------------------
// Module line mutations
// ---------------------------------------------------------------------------

export function useAddModuleLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: number; data: ModuleLineCreate }) =>
      developmentRequestsApi.addModuleLine(requestId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.success("Module line added");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }, variables) => {
      if (error.response?.status === 403) {
        queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
        toast.error("You don't have permission to add module lines");
      } else {
        toast.error(error.response?.data?.detail ?? "Failed to add module line");
      }
    },
  });
}

export function useUpdateModuleLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      lineId,
      data,
    }: {
      requestId: number;
      lineId: number;
      data: ModuleLineUpdate;
    }) => developmentRequestsApi.updateModuleLine(requestId, lineId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.success("Module line updated");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.error(error.response?.data?.detail ?? "Failed to update module line");
    },
  });
}

export function useBulkAddModuleLines() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, lines }: { requestId: number; lines: ModuleLineCreate[] }) =>
      developmentRequestsApi.bulkAddModuleLines(requestId, { lines }),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      if (result.errors.length > 0) {
        toast.warning(`Added ${result.added.length} module(s). ${result.errors.length} failed.`);
      } else {
        toast.success(`Added ${result.added.length} module line(s)`);
      }
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.error(error.response?.data?.detail ?? "Failed to add module lines");
    },
  });
}

export function useDeleteModuleLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, lineId }: { requestId: number; lineId: number }) =>
      developmentRequestsApi.deleteModuleLine(requestId, lineId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.success("Module line deleted");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.error(error.response?.data?.detail ?? "Failed to delete module line");
    },
  });
}

// ---------------------------------------------------------------------------
// Related requests
// ---------------------------------------------------------------------------

export function useAddRelatedRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, relatedId }: { requestId: number; relatedId: number }) =>
      developmentRequestsApi.addRelatedRequest(requestId, relatedId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.success("Related request linked");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to link related request");
    },
  });
}

export function useRemoveRelatedRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, relatedId }: { requestId: number; relatedId: number }) =>
      developmentRequestsApi.removeRelatedRequest(requestId, relatedId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.success("Related request unlinked");
    },
    onError: (error: { response?: { status?: number; data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to unlink related request");
    },
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useComments(requestId: number) {
  return useQuery({
    queryKey: queryKeys.comments(requestId),
    queryFn: () => developmentRequestsApi.getComments(requestId),
    enabled: !!requestId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      content,
      parentCommentId,
    }: {
      requestId: number;
      content: string;
      parentCommentId?: number;
    }) => developmentRequestsApi.addComment(requestId, content, parentCommentId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(variables.requestId) });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to add comment");
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      commentId,
      content,
    }: {
      requestId: number;
      commentId: number;
      content: string;
    }) => developmentRequestsApi.updateComment(requestId, commentId, content),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(variables.requestId) });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to update comment");
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, commentId }: { requestId: number; commentId: number }) =>
      developmentRequestsApi.deleteComment(requestId, commentId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(variables.requestId) });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to delete comment");
    },
  });
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function useAuditLog(requestId: number) {
  return useQuery({
    queryKey: queryKeys.auditLog(requestId),
    queryFn: () => developmentRequestsApi.getAuditLog(requestId),
    enabled: !!requestId,
  });
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export function useAttachments(requestId: number) {
  return useQuery({
    queryKey: queryKeys.attachments(requestId),
    queryFn: () => developmentRequestsApi.getAttachments(requestId),
    enabled: !!requestId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, file }: { requestId: number; file: File }) =>
      developmentRequestsApi.uploadAttachment(requestId, file),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attachments(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.success("File uploaded successfully");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to upload file");
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, attachmentId }: { requestId: number; attachmentId: number }) =>
      developmentRequestsApi.deleteAttachment(requestId, attachmentId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attachments(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(variables.requestId) });
      toast.success("Attachment deleted");
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail ?? "Failed to delete attachment");
    },
  });
}
