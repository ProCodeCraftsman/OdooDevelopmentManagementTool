import { useState } from "react";
import type { ChangeEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Edit, RotateCcw, Archive, Trash, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useDevelopmentRequest,
  useReopenDevelopmentRequest,
  useArchiveDevelopmentRequest,
  useRestoreDevelopmentRequest,
} from "@/hooks/useDevelopmentRequests";
import { AddModuleLineDialog } from "@/components/development-requests/add-module-line-dialog";
import { toast } from "sonner";

function getStateColor(category: string): string {
  switch (category?.toLowerCase()) {
    case "open":
      return "bg-blue-100 text-blue-800";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800";
    case "closed":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getPriorityColor(level: number): string {
  if (level >= 4) return "bg-red-100 text-red-800";
  if (level >= 3) return "bg-orange-100 text-orange-800";
  if (level >= 2) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-800";
}

export function DevelopmentRequestsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const requestId = parseInt(id || "0");

  const { data: request, isLoading, error } = useDevelopmentRequest(requestId);
  const reopenMutation = useReopenDevelopmentRequest();
  const archiveMutation = useArchiveDevelopmentRequest();
  const restoreMutation = useRestoreDevelopmentRequest();
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [reopenComment, setReopenComment] = useState("");
  const [showAddModuleDialog, setShowAddModuleDialog] = useState(false);

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
          <Link to="/development-requests">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Link>
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-red-500">Error loading request: {(error as Error)?.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEdit = request.permissions?.can_update;
  const canReopen = request.permissions?.can_reopen;
  const isClosed = request.request_state?.category?.toLowerCase() === "closed";
  const isArchived = request.is_archived;

  const handleReopen = async () => {
    if (!reopenComment.trim()) {
      toast.error("Please provide a comment explaining why you're reopening this request");
      return;
    }

    try {
      await reopenMutation.mutateAsync({ id: requestId, comment: reopenComment });
      setShowReopenDialog(false);
      setReopenComment("");
    } catch {
      // Error is handled by the mutation's onError callback
    }
  };

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(requestId);
      setShowArchiveDialog(false);
    } catch {
      // Error is handled by the mutation's onError callback
    }
  };

  const handleRestore = async () => {
    try {
      await restoreMutation.mutateAsync(requestId);
    } catch {
      // Error is handled by the mutation's onError callback
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link to="/development-requests">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{request.request_number}</h1>
          <Badge className={getStateColor(request.request_state?.category || "")}>
            {request.request_state?.name || "Unknown"}
          </Badge>
        </div>
        <div className="flex gap-2">
          {isClosed && canReopen && !isArchived && (
            <Button variant="outline" onClick={() => setShowReopenDialog(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reopen
            </Button>
          )}
          {canEdit && !isArchived && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowArchiveDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
              <Button onClick={() => navigate(`/development-requests/${request.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </>
          )}
          {isArchived && canEdit && (
            <Button
              variant="outline"
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {restoreMutation.isPending ? "Restoring..." : "Restore"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <p className="font-medium">{request.request_type?.name || "Unknown"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Priority</Label>
                <Badge className={getPriorityColor(request.priority?.level || 1)}>
                  {request.priority?.name || "Unknown"}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <p className="font-medium">{request.functional_category?.name || "Unknown"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Assignee</Label>
                <p className="font-medium">
                  {request.assigned_developer?.username || "Unassigned"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Request Date</Label>
                <p className="font-medium">
                  {request.request_date
                    ? new Date(request.request_date).toLocaleDateString()
                    : "-"}
                </p>
              </div>
              {request.request_close_date && (
                <div>
                  <Label className="text-muted-foreground">Close Date</Label>
                  <p className="font-medium">
                    {new Date(request.request_close_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Iteration</Label>
                <p className="font-medium">#{request.iteration_counter}</p>
              </div>
              {request.uat_request_id && (
                <div>
                  <Label className="text-muted-foreground">UAT Request ID</Label>
                  <p className="font-medium">{request.uat_request_id}</p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="mt-1 whitespace-pre-wrap">{request.description}</p>
            </div>
            {request.comments && (
              <div>
                <Label className="text-muted-foreground">Comments</Label>
                <p className="mt-1 whitespace-pre-wrap">{request.comments}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {request.parent_request_id && (
            <Card>
              <CardHeader>
                <CardTitle>Parent Request</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => navigate(`/development-requests/${request.parent_request_id}`)}
                >
                  View Parent Request #{request.parent_request_id}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Module Lines ({request.module_lines?.length || 0})</CardTitle>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModuleDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Module
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!request.module_lines?.length ? (
                <p className="text-muted-foreground">No modules added.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {request.module_lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">
                          {line.module_technical_name}
                        </TableCell>
                        <TableCell>{line.module_version || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Release Plan ({request.release_plan_lines?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!request.release_plan_lines?.length ? (
                <p className="text-muted-foreground">No release plan entries.</p>
              ) : (
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
                        <TableCell>
                          {line.release_plan_date
                            ? new Date(line.release_plan_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{line.release_plan_status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="comment">Comment *</Label>
              <Textarea
                id="comment"
                value={reopenComment}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReopenComment(e.target.value)}
                placeholder="Explain why you're reopening this request..."
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReopen}
              disabled={reopenMutation.isPending || !reopenComment.trim()}
            >
              {reopenMutation.isPending ? "Reopening..." : "Reopen Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              Are you sure you want to archive <strong>{request.request_number}</strong>?
            </p>
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
              <div className="flex gap-3">
                <Trash className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">This action will cascade to child requests</p>
                  <p className="mt-1">
                    All child requests linked to this parent will also be archived.
                    You can restore them individually from their detail pages.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive Request"}
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
}
