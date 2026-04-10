import { useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import {
  Edit, RotateCcw, Archive, Trash, Plus, Pencil, X, Check, Search,
  ChevronRight, ChevronLeft,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useDevelopmentRequest,
  useControlParameters,
  useUpdateDevelopmentRequest,
  useReopenDevelopmentRequest,
  useArchiveDevelopmentRequest,
  useRestoreDevelopmentRequest,
  useUpdateModuleLine,
  useDeleteModuleLine,
  useAddRelatedRequest,
  useRemoveRelatedRequest,
  useSearchRequests,
} from "@/hooks/useDevelopmentRequests";
import { useLinkedPlansForDr } from "@/hooks/useReleasePlans";
import type { LinkedReleasePlanEntry } from "@/api/release-plans";
import { useAssignableUsers } from "@/hooks/useUsers";
import { AddModuleLineDialog } from "@/components/development-requests/add-module-line-dialog";
import { CommentsTab } from "@/components/development-requests/comments-tab";
import { AttachmentsTab } from "@/components/development-requests/attachments-tab";
import { AuditLogTab } from "@/components/development-requests/audit-log-tab";
import { useAuthStore } from "@/store/auth-store";
import type { RequestModuleLine, DevelopmentRequestUpdate } from "@/api/development-requests";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStateColor(category: string): string {
  switch (category?.toLowerCase()) {
    case "draft": return "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300";
    case "in progress": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "ready": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300";
    case "done": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getPriorityColor(level: number): string {
  if (level >= 4) return "bg-red-100 text-red-800";
  if (level >= 3) return "bg-orange-100 text-orange-800";
  if (level >= 2) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-800";
}

// ---------------------------------------------------------------------------
// Async parent-request combobox
// ---------------------------------------------------------------------------

interface ParentSearchProps {
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  excludeId: number;
  disabled?: boolean;
}

function ParentRequestSearch({ value, onChange, excludeId, disabled }: ParentSearchProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: results = [], isFetching } = useSearchRequests(debouncedQuery, excludeId);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(inputValue), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [inputValue]);

  const selectedLabel = value ? `#${value}` : "None";

  const handleSelect = (id: number, label: string) => {
    onChange(id);
    setInputValue(label);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setInputValue("");
    setDebouncedQuery("");
  };

  return (
    <Popover open={open && !disabled} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
          onClick={() => !disabled && setOpen((o) => !o)}
        >
          <span className="truncate">{value ? selectedLabel : "Search parent request..."}</span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Type request number or title…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          {value && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent flex items-center gap-2"
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" /> Clear parent
            </button>
          )}
          {isFetching && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          )}
          {!isFetching && debouncedQuery.length > 0 && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No results found.</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-accent flex flex-col gap-0.5"
              onClick={() => handleSelect(r.id, r.request_number)}
            >
              <span className="text-sm font-medium">{r.request_number}</span>
              <span className="text-xs text-muted-foreground truncate">{r.title}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Edit-line state
// ---------------------------------------------------------------------------

interface EditLineState {
  line: RequestModuleLine;
  version: string;
  md5_sum: string;
  email_thread_zip: string;
  uat_status: string;
  uat_ticket: string;
  tec_note: string;
}

// ---------------------------------------------------------------------------
// Form schema for inline editing
// ---------------------------------------------------------------------------

const editSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  request_type_id: z.number().min(1),
  functional_category_id: z.number().min(1),
  priority_id: z.number().min(1),
  assigned_developer_id: z.number().optional(),
  request_state_id: z.number().optional(),
  parent_request_id: z.number().optional(),
  description: z.string().min(1, "Description is required"),
});

type EditFormData = z.infer<typeof editSchema>;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DevelopmentRequestsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const requestId = parseInt(id || "0");
  const { user } = useAuthStore();

  // Prev/next navigation from list context
  const siblingIds: number[] = (location.state as { siblingIds?: number[] })?.siblingIds ?? [];
  const siblingIndex = siblingIds.indexOf(requestId);
  const prevId = siblingIndex > 0 ? siblingIds[siblingIndex - 1] : null;
  const nextId = siblingIndex >= 0 && siblingIndex < siblingIds.length - 1 ? siblingIds[siblingIndex + 1] : null;

  const { data: request, isLoading, error } = useDevelopmentRequest(requestId);
  const { data: controlParams } = useControlParameters();
  const { data: assignableUsers } = useAssignableUsers();

  const updateMutation = useUpdateDevelopmentRequest();
  const reopenMutation = useReopenDevelopmentRequest();
  const archiveMutation = useArchiveDevelopmentRequest();
  const restoreMutation = useRestoreDevelopmentRequest();
  const updateLineMutation = useUpdateModuleLine();
  const deleteLineMutation = useDeleteModuleLine();
  const addRelated = useAddRelatedRequest();
  const removeRelated = useRemoveRelatedRequest();

  const [isEditing, setIsEditing] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [reopenComment, setReopenComment] = useState("");
  const [showAddModuleDialog, setShowAddModuleDialog] = useState(false);
  const [editLine, setEditLine] = useState<EditLineState | null>(null);
  const [relatedInput, setRelatedInput] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  });
  const selectedRequestTypeId = watch("request_type_id");
  const allowedStateIds = new Set(
    (controlParams?.state_type_rules ?? [])
      .filter((rule) => rule.is_active && rule.request_type_id === selectedRequestTypeId)
      .map((rule) => rule.request_state_id)
  );
  const availableStates = (controlParams?.request_states ?? []).filter(
    (state) => allowedStateIds.size === 0 || allowedStateIds.has(state.id)
  );

  // Populate form whenever the request loads or edit mode is toggled on
  useEffect(() => {
    if (request) {
      reset({
        title: request.title,
        request_type_id: request.request_type_id,
        functional_category_id: request.functional_category_id,
        priority_id: request.priority_id,
        assigned_developer_id: request.assigned_developer_id ?? undefined,
        request_state_id: request.request_state_id,
        parent_request_id: request.parent_request_id ?? undefined,
        description: request.description,
      });
    }
  }, [request, reset]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/development-requests">Back to List</Link>
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-destructive">
              Error loading request: {(error as Error)?.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------
  const canEdit = request.permissions?.can_update;
  const canManageLines = request.permissions?.can_add_module_lines;
  const canReopen = request.permissions?.can_reopen;
  const canEditState = request.permissions?.can_edit_state ?? false;
  const canEditType = request.permissions?.can_edit_request_type ?? false;
  const canEditPriority = request.permissions?.can_edit_priority ?? false;
  const canEditCategory = request.permissions?.can_edit_functional_category ?? false;
  const canEditAssignee = request.permissions?.can_edit_assigned_developer ?? false;
  const canEditDescription = request.permissions?.can_edit_description ?? false;
  const isAdmin = request.permissions?.can_manage_system ?? false;
  const isClosed = ["done", "cancelled"].includes(
    request.request_state?.category?.toLowerCase() || ""
  );
  const isArchived = request.is_archived;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCancelEdit = () => {
    setIsEditing(false);
    reset({
      title: request.title,
      request_type_id: request.request_type_id,
      functional_category_id: request.functional_category_id,
      priority_id: request.priority_id,
      assigned_developer_id: request.assigned_developer_id ?? undefined,
      request_state_id: request.request_state_id,
      parent_request_id: request.parent_request_id ?? undefined,
      description: request.description,
    });
  };

  const onSave = async (data: EditFormData) => {
    const payload: DevelopmentRequestUpdate = {
      title: data.title,
      request_type_id: data.request_type_id,
      functional_category_id: data.functional_category_id,
      priority_id: data.priority_id,
      description: data.description,
      assigned_developer_id: data.assigned_developer_id,
      request_state_id: data.request_state_id,
      parent_request_id: data.parent_request_id,
    };
    try {
      await updateMutation.mutateAsync({ id: requestId, data: payload });
      setIsEditing(false);
    } catch {
      // error toasted by mutation
    }
  };

  const handleReopen = async () => {
    if (!reopenComment.trim()) {
      toast.error("Please provide a comment explaining why you're reopening this request");
      return;
    }
    try {
      await reopenMutation.mutateAsync({ id: requestId, comment: reopenComment });
      setShowReopenDialog(false);
      setReopenComment("");
    } catch { /* handled by mutation */ }
  };

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(requestId);
      setShowArchiveDialog(false);
    } catch { /* handled by mutation */ }
  };

  const handleEditLine = (line: RequestModuleLine) => {
    setEditLine({
      line,
      version: line.module_version ?? "",
      md5_sum: line.module_md5_sum ?? "",
      email_thread_zip: line.email_thread_zip ?? "",
      uat_status: line.uat_status ?? "",
      uat_ticket: line.uat_ticket ?? "",
      tec_note: line.tec_note ?? "",
    });
  };

  const handleSaveEditLine = async () => {
    if (!editLine) return;
    try {
      await updateLineMutation.mutateAsync({
        requestId,
        lineId: editLine.line.id,
        data: {
          module_version: editLine.version || undefined,
          module_md5_sum: editLine.md5_sum || undefined,
          email_thread_zip: editLine.email_thread_zip || undefined,
          tec_note: editLine.tec_note || undefined,
          uat_status: editLine.uat_status || undefined,
          uat_ticket: editLine.uat_ticket || undefined,
        },
      });
      setEditLine(null);
    } catch { /* handled by mutation */ }
  };

  const handleAddRelated = async () => {
    const relatedId = parseInt(relatedInput.trim());
    if (!relatedId || isNaN(relatedId)) {
      toast.error("Enter a valid request ID");
      return;
    }
    try {
      await addRelated.mutateAsync({ requestId, relatedId });
      setRelatedInput("");
    } catch { /* handled by mutation */ }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderViewField = (label: string, value: React.ReactNode) => (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <div className="text-sm font-medium">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="space-y-3">
        {/* Breadcrumb + Prev/Next Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/development-requests" className="hover:text-foreground transition-colors">
              Development Requests
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{request.request_number}</span>
          </div>
          {siblingIds.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!prevId}
                onClick={() => prevId && navigate(`/development-requests/${prevId}`, { state: location.state })}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />Prev
              </Button>
              <span className="text-xs text-muted-foreground px-1">
                {siblingIndex + 1} / {siblingIds.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!nextId}
                onClick={() => nextId && navigate(`/development-requests/${nextId}`, { state: location.state })}
                className="h-7 px-2"
              >
                Next<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        {/* Title + State Badge + Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {!isEditing ? (
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight">{request.title}</h1>
                <Badge className={getStateColor(request.request_state?.category || "")}>
                  {request.request_state?.name || "Unknown"}
                </Badge>
                {isArchived && <Badge variant="secondary">Archived</Badge>}
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <Input
                    className="text-xl font-bold h-10 max-w-[520px]"
                    placeholder="Title"
                    {...register("title")}
                  />
                  {errors.title && (
                    <span className="text-xs text-destructive">{errors.title.message}</span>
                  )}
                </div>
                <Badge className={getStateColor(request.request_state?.category || "")}>
                  {request.request_state?.name || "Unknown"}
                </Badge>
                {isArchived && <Badge variant="secondary">Archived</Badge>}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing && isClosed && canReopen && !isArchived && (
              <Button variant="outline" size="sm" onClick={() => setShowReopenDialog(true)}>
                <RotateCcw className="mr-2 h-4 w-4" />Reopen
              </Button>
            )}
            {!isEditing && isArchived && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => restoreMutation.mutate(requestId)}
                disabled={restoreMutation.isPending}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {restoreMutation.isPending ? "Restoring…" : "Restore"}
              </Button>
            )}
            {!isEditing && canEdit && !isArchived && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchiveDialog(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Archive className="mr-2 h-4 w-4" />Archive
                </Button>
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />Edit
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSubmitting}>
                  <X className="mr-2 h-4 w-4" />Cancel
                </Button>
                <Button size="sm" onClick={handleSubmit(onSave)} disabled={isSubmitting}>
                  <Check className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Saving…" : "Save Changes"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Main layout: row 1 = Description + Sidebar, row 2 = full-width Tabs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch lg:[grid-template-areas:'desc_desc_side''tabs_tabs_tabs']">
        {/* Description */}
        <div className="lg:[grid-area:desc] lg:flex lg:flex-col">
          <Card className="lg:flex-1">
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {!isEditing ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {request.description}
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Textarea
                    placeholder="Describe the request…"
                    className="min-h-[180px] text-sm"
                    disabled={!canEditDescription}
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-xs text-destructive">{errors.description.message}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Full-width Tabs row ── */}
        <div className="lg:[grid-area:tabs]">
          <Tabs defaultValue="modules">
            <TabsList className="h-auto flex-wrap gap-y-1">
              <TabsTrigger value="modules">
                Modules ({request.module_lines?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="comments">
                Comments ({request.comments_thread?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="attachments">
                Attachments ({request.attachments?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="linked-plans">Release Plans</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="other-info">Other Information</TabsTrigger>
            </TabsList>

            {/* Modules Tab */}
            <TabsContent value="modules" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Module Lines ({request.module_lines?.length || 0})</CardTitle>
                  {canManageLines && !isClosed && !isArchived && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddModuleDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />Add Module
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {!request.module_lines?.length ? (
                    <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                      No modules added yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto min-w-full">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[140px] whitespace-nowrap">Module</TableHead>
                            <TableHead className="min-w-[140px] whitespace-nowrap">Version</TableHead>
                            <TableHead className="min-w-[140px] whitespace-nowrap">MD5 Sum</TableHead>
                            <TableHead className="min-w-[140px] whitespace-nowrap">UAT Status</TableHead>
                            <TableHead className="min-w-[140px] whitespace-nowrap">UAT Ticket</TableHead>
                            <TableHead className="min-w-[140px] whitespace-nowrap">Tec. Note</TableHead>
                            <TableHead className="min-w-[140px] whitespace-nowrap">Added</TableHead>
                            {canManageLines && !isClosed && !isArchived && (
                              <TableHead className="min-w-[140px] text-right">Actions</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {request.module_lines.map((line) => (
                            <TableRow key={line.id} className="h-10">
                              <TableCell className="font-medium whitespace-nowrap align-middle py-2">
                                {line.module_technical_name}
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-middle py-2">
                                {line.module_version || <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-middle py-2">
                                {line.module_md5_sum ? (
                                  <span className="font-mono text-xs" title={line.module_md5_sum}>
                                    {line.module_md5_sum.slice(0, 12)}…
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-middle py-2">
                                {line.uat_status ? (
                                  <Badge variant="outline" className="text-xs">{line.uat_status}</Badge>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-middle py-2">
                                {line.uat_ticket || <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-middle py-2">
                                {line.tec_note ? (
                                  <span className="truncate block" title={line.tec_note}>{line.tec_note}</span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-middle py-2">
                                {new Date(line.created_at).toLocaleDateString()}
                              </TableCell>
                              {canManageLines && !isClosed && !isArchived && (
                                <TableCell className="text-right align-middle py-2">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost" size="icon" className="h-7 w-7"
                                      onClick={() => handleEditLine(line)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-7 w-7"
                                      onClick={() => handleDeleteLine(line.id)}
                                      disabled={deleteLineMutation.isPending}
                                    >
                                      <Trash className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Comments Tab */}
            <TabsContent value="comments" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
                <CardContent>
                  <CommentsTab
                    requestId={requestId}
                    currentUserId={user?.id}
                    isAdmin={isAdmin}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Attachments Tab */}
            <TabsContent value="attachments" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
                <CardContent>
                  <AttachmentsTab
                    requestId={requestId}
                    currentUserId={user?.id}
                    isAdmin={isAdmin}
                    readonly={isArchived}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Linked Release Plans Tab */}
            <TabsContent value="linked-plans" className="mt-4">
              <LinkedReleasePlansTab requestId={requestId} />
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Change History</CardTitle></CardHeader>
                <CardContent>
                  <AuditLogTab requestId={requestId} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Other Information Tab */}
            <TabsContent value="other-info" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Dates column */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Dates &amp; Tracking
                      </p>
                      {renderViewField("Iteration", `#${request.iteration_counter}`)}
                      {renderViewField(
                        "Request Date",
                        request.request_date
                          ? new Date(request.request_date).toLocaleDateString()
                          : null
                      )}
                      {request.request_close_date &&
                        renderViewField(
                          "Close Date",
                          new Date(request.request_close_date).toLocaleDateString()
                        )}
                      {request.created_by &&
                        renderViewField("Created By", request.created_by.username)}
                      {request.updated_by &&
                        renderViewField("Last Updated By", request.updated_by.username)}
                      {renderViewField(
                        "Created At",
                        new Date(request.created_at).toLocaleString()
                      )}
                      {renderViewField(
                        "Updated At",
                        new Date(request.updated_at).toLocaleString()
                      )}
                    </div>

                    {/* Traceability column */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Traceability
                      </p>
                      {/* Parent request */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Parent Request
                        </p>
                        {!isEditing ? (
                          request.parent_request_id ? (
                            <Button
                              variant="link"
                              className="p-0 h-auto text-sm"
                              onClick={() => navigate(`/development-requests/${request.parent_request_id}`)}
                            >
                              View #{request.parent_request_id}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )
                        ) : (
                          <div className="space-y-1">
                            <ParentRequestSearch
                              value={watch("parent_request_id")}
                              onChange={(id) => setValue("parent_request_id", id)}
                              excludeId={requestId}
                              disabled={isClosed}
                            />
                            {isClosed && (
                              <p className="text-xs text-muted-foreground">
                                Disabled — request is in a final state.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Related requests */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Related Requests
                        </p>
                        {request.related_requests?.length ? (
                          <div className="space-y-1 mb-2">
                            {request.related_requests.map((rel) => (
                              <div key={rel.id} className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <Button
                                    variant="link"
                                    className="p-0 h-auto text-sm"
                                    onClick={() => navigate(`/development-requests/${rel.id}`)}
                                  >
                                    {rel.request_number}
                                  </Button>
                                  <p className="text-xs text-muted-foreground truncate">{rel.title}</p>
                                </div>
                                {canEdit && !isArchived && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => removeRelated.mutate({ requestId, relatedId: rel.id })}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mb-2">No related requests.</p>
                        )}
                        {canEdit && !isArchived && (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Request ID"
                              value={relatedInput}
                              onChange={(e) => setRelatedInput(e.target.value)}
                              className="h-8 text-sm"
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddRelated(); }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={handleAddRelated}
                              disabled={addRelated.isPending}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:[grid-area:side] space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardContent className="p-0 divide-y">
              {/* Section 1: Details */}
              <div className="p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Details
                </p>
                {!isEditing ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {renderViewField("Type", request.request_type?.name)}
                    {renderViewField("Category", request.functional_category?.name)}
                    {renderViewField(
                      "Priority",
                      <Badge className={getPriorityColor(request.priority?.level || 1)}>
                        {request.priority?.name}
                      </Badge>
                    )}
                    {renderViewField(
                      "Assigned",
                      request.assigned_developer?.username || "Unassigned"
                    )}
                    {renderViewField(
                      "State",
                      <Badge className={getStateColor(request.request_state?.category || "")}>
                        {request.request_state?.name}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Request Type</Label>
                      <Select
                        value={watch("request_type_id")?.toString() || ""}
                        onValueChange={(v) => setValue("request_type_id", parseInt(v))}
                        disabled={!canEditType}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {controlParams?.request_types.map((t) => (
                            <SelectItem key={t.id} value={t.id.toString()}>
                              {t.name} ({t.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Functional Category</Label>
                      <Select
                        value={watch("functional_category_id")?.toString() || ""}
                        onValueChange={(v) => setValue("functional_category_id", parseInt(v))}
                        disabled={!canEditCategory}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {controlParams?.functional_categories.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Priority</Label>
                      <Select
                        value={watch("priority_id")?.toString() || ""}
                        onValueChange={(v) => setValue("priority_id", parseInt(v))}
                        disabled={!canEditPriority}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {controlParams?.priorities.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Assigned Developer</Label>
                      <Select
                        value={watch("assigned_developer_id")?.toString() || "none"}
                        onValueChange={(v) =>
                          setValue(
                            "assigned_developer_id",
                            v === "none" ? undefined : parseInt(v)
                          )
                        }
                        disabled={!canEditAssignee}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {assignableUsers?.map((u) => (
                            <SelectItem key={u.id} value={u.id.toString()}>
                              {u.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {canEditState && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">State</Label>
                        <Select
                          value={watch("request_state_id")?.toString() || ""}
                          onValueChange={(v) =>
                            setValue("request_state_id", v ? parseInt(v) : undefined)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableStates.map((s) => (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Release Plan (view only) */}
          {(request.release_plan_lines?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Release Plan ({request.release_plan_lines?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {request.release_plan_lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-sm">
                          {new Date(line.release_plan_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{line.release_plan_status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Edit Module Line Dialog ── */}
      <Dialog open={!!editLine} onOpenChange={(open) => { if (!open) setEditLine(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Module Line</DialogTitle>
            <DialogDescription>{editLine?.line.module_technical_name}</DialogDescription>
          </DialogHeader>
          {editLine && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Version</Label>
                <Input
                  placeholder="e.g. 17.0.1.0.0"
                  value={editLine.version}
                  onChange={(e) => setEditLine({ ...editLine, version: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>MD5 Sum</Label>
                <Input
                  placeholder="32–64 char hex"
                  value={editLine.md5_sum}
                  maxLength={64}
                  className="font-mono"
                  onChange={(e) => setEditLine({ ...editLine, md5_sum: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email / Zip Path</Label>
                <Input
                  placeholder="/path/to/email.zip"
                  value={editLine.email_thread_zip}
                  maxLength={500}
                  onChange={(e) => setEditLine({ ...editLine, email_thread_zip: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>UAT Status</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={editLine.uat_status}
                    onChange={(e) => setEditLine({ ...editLine, uat_status: e.target.value })}
                  >
                    <option value="">—</option>
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Closed</option>
                    <option>Rejected</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>UAT Ticket</Label>
                  <Input
                    placeholder="UAT-XXXX"
                    value={editLine.uat_ticket}
                    onChange={(e) => setEditLine({ ...editLine, uat_ticket: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tec. Note</Label>
                <Textarea
                  placeholder="Technical notes for this module line…"
                  className="min-h-[80px] text-sm"
                  value={editLine.tec_note}
                  onChange={(e) => setEditLine({ ...editLine, tec_note: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLine(null)}>Cancel</Button>
            <Button onClick={handleSaveEditLine} disabled={updateLineMutation.isPending}>
              {updateLineMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reopen Dialog ── */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reopen Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Label htmlFor="reopen-comment">Comment *</Label>
            <Textarea
              id="reopen-comment"
              value={reopenComment}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReopenComment(e.target.value)}
              placeholder="Explain why you're reopening this request…"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>Cancel</Button>
            <Button
              onClick={handleReopen}
              disabled={reopenMutation.isPending || !reopenComment.trim()}
            >
              {reopenMutation.isPending ? "Reopening…" : "Reopen Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Archive Dialog ── */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Archive Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p>Are you sure you want to archive <strong>{request.request_number}</strong>?</p>
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 dark:bg-yellow-900/10 dark:border-yellow-800">
              <div className="flex gap-3">
                <Archive className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-300">
                  <p className="font-medium">Requires Cancelled state</p>
                  <p className="mt-1">
                    Request must be in a Cancelled state and must not be
                    linked to any active Release Plans. Child requests will also be archived.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? "Archiving…" : "Archive Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddModuleLineDialog
        open={showAddModuleDialog}
        onOpenChange={setShowAddModuleDialog}
        request={request}
      />
    </div>
  );

  function handleDeleteLine(lineId: number) {
    deleteLineMutation.mutate({ requestId, lineId });
  }
}

// ─── Linked Release Plans Tab ─────────────────────────────────────────────────

const PLAN_STATE_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  Planned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Approved: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  Executing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  Closed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function LinkedReleasePlansTab({ requestId }: { requestId: number }) {
  const { data: plans, isLoading } = useLinkedPlansForDr(requestId);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Linked Release Plans</CardTitle></CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2"><div className="h-8 bg-muted animate-pulse rounded" /><div className="h-8 bg-muted animate-pulse rounded" /></div>
        ) : !plans?.length ? (
          <div className="px-6 py-8 text-center text-muted-foreground text-sm">No release plans linked to this request.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Release Plan</TableHead>
                  <TableHead>Source → Target</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Planned Date</TableHead>
                  <TableHead>Actual Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(plans as LinkedReleasePlanEntry[]).map((entry) => (
                  <TableRow key={entry.release_plan_line_id}>
                    <TableCell className="font-mono text-sm">{entry.module_technical_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{entry.module_version ?? "—"}</TableCell>
                    <TableCell>
                      <Link to={`/release-plans/${entry.plan_id}`}
                        className="text-primary hover:underline font-mono text-sm font-medium">
                        {entry.plan_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{entry.source_env_name} → {entry.target_env_name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_STATE_COLORS[entry.state_category] ?? "bg-gray-100 text-gray-800"}`}>
                        {entry.state_name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(entry.planned_deployment_date)}</TableCell>
                    <TableCell className="text-sm">{formatDate(entry.actual_deployment_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
