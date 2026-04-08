import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useUpdateDevelopmentRequest, useReopenDevelopmentRequest, useRejectDevelopmentRequest } from "@/hooks/useDevelopmentRequests";
import type { DevelopmentRequest, RequestStateBrief } from "@/api/development-requests";
import { ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStateBadgeClass(category: string): string {
  switch (category?.toLowerCase()) {
    case "draft":
      return "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300";
    case "in progress":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "ready":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300";
    case "done":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

function isRejectionState(name: string): boolean {
  return name.toLowerCase().includes("cancel");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  request: DevelopmentRequest;
  availableStates: RequestStateBrief[];
}

type CommentDialogMode = "reopen" | "reject" | null;

export function InlineStateEditor({ request, availableStates }: Props) {
  const [open, setOpen] = useState(false);
  const [commentMode, setCommentMode] = useState<CommentDialogMode>(null);
  const [pendingStateId, setPendingStateId] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const updateMutation = useUpdateDevelopmentRequest();
  const reopenMutation = useReopenDevelopmentRequest();
  const rejectMutation = useRejectDevelopmentRequest();

  const canEdit = request.permissions?.can_edit_state;
  const canReopen = request.permissions?.can_reopen;
  const currentCategory = request.request_state?.category?.toLowerCase();
  const isClosed = currentCategory === "done" || currentCategory === "cancelled";

  if (!canEdit && !canReopen) {
    return (
      <Badge className={getStateBadgeClass(request.request_state?.category)}>
        {request.request_state?.name ?? "Unknown"}
      </Badge>
    );
  }

  const handleStateSelect = (state: RequestStateBrief) => {
    setOpen(false);
    const targetCategory = state.category?.toLowerCase();

    if (isClosed && targetCategory === "draft" && canReopen) {
      setPendingStateId(state.id);
      setCommentMode("reopen");
      return;
    }

    // Rejection: requires mandatory comment
    if (isRejectionState(state.name)) {
      setPendingStateId(state.id);
      setCommentMode("reject");
      return;
    }

    // Regular state change
    updateMutation.mutate({ id: request.id, data: { request_state_id: state.id } });
  };

  const handleCommentConfirm = async () => {
    if (!comment.trim() || !pendingStateId) return;
    if (commentMode === "reopen") {
      await reopenMutation.mutateAsync({ id: request.id, comment });
    } else if (commentMode === "reject") {
      await rejectMutation.mutateAsync({
        id: request.id,
        data: { request_state_id: pendingStateId, comment },
      });
    }
    setCommentMode(null);
    setPendingStateId(null);
    setComment("");
  };

  const handleDialogClose = () => {
    setCommentMode(null);
    setPendingStateId(null);
    setComment("");
  };

  const isPending =
    updateMutation.isPending || reopenMutation.isPending || rejectMutation.isPending;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${getStateBadgeClass(request.request_state?.category)} ${isPending ? "opacity-50 pointer-events-none" : ""}`}
            disabled={isPending}
          >
            {request.request_state?.name ?? "Unknown"}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="start">
          <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
            Change state
          </div>
          {availableStates.map((s) => (
            <button
              key={s.id}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2"
              onClick={() => handleStateSelect(s)}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${getStateBadgeClass(s.category)}`}
              />
              {s.name}
              {isRejectionState(s.name) && (
                <span className="ml-auto text-xs text-muted-foreground">comment req.</span>
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Mandatory comment dialog (reopen / reject) */}
      <Dialog open={!!commentMode} onOpenChange={(o) => !o && handleDialogClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {commentMode === "reopen" ? "Reopen Request" : "Cancel Request"}
            </DialogTitle>
            <DialogDescription>
              {commentMode === "reopen"
                ? "A comment is required when reopening a request."
                : "A comment is required when cancelling a request."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="inline-comment">Comment</Label>
            <Textarea
              id="inline-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                commentMode === "reopen"
                  ? "Explain why this request is being reopened…"
                  : "Explain why this request is being cancelled…"
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCommentConfirm}
              disabled={!comment.trim() || reopenMutation.isPending || rejectMutation.isPending}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
