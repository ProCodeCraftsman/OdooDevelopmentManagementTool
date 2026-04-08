import { useState } from "react";
import { MessageSquare, Reply, Pencil, Trash, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useComments,
  useAddComment,
  useUpdateComment,
  useDeleteComment,
} from "@/hooks/useDevelopmentRequests";
import type { RequestComment } from "@/api/development-requests";

interface CommentsTabProps {
  requestId: number;
  currentUserId?: number;
  isAdmin?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

interface CommentItemProps {
  comment: RequestComment;
  requestId: number;
  currentUserId?: number;
  isAdmin?: boolean;
  depth?: number;
}

function CommentItem({
  comment,
  requestId,
  currentUserId,
  isAdmin,
  depth = 0,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editText, setEditText] = useState(comment.content);

  const addComment = useAddComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const isOwner = comment.user_id === currentUserId;
  const canEdit = isOwner;
  const canDelete = isOwner || isAdmin;

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await addComment.mutateAsync({
      requestId,
      content: replyText.trim(),
      parentCommentId: comment.id,
    });
    setReplyText("");
    setIsReplying(false);
  };

  const handleEdit = async () => {
    if (!editText.trim()) return;
    await updateComment.mutateAsync({
      requestId,
      commentId: comment.id,
      content: editText.trim(),
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteComment.mutateAsync({ requestId, commentId: comment.id });
  };

  return (
    <div className={depth > 0 ? "ml-8 border-l-2 border-muted pl-4" : ""}>
      <div className="group flex gap-3 py-3">
        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold uppercase text-muted-foreground">
          {comment.user?.username?.[0] ?? "?"}
        </div>

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              {comment.user?.username ?? "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.created_at)}
            </span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-xs text-muted-foreground italic">(edited)</span>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[80px] text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleEdit}
                  disabled={updateComment.isPending || !editText.trim()}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setIsEditing(false); setEditText(comment.content); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap text-foreground">{comment.content}</p>
          )}

          {/* Action row */}
          {!isEditing && (
            <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {depth === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => setIsReplying(!isReplying)}
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive"
                  onClick={handleDelete}
                  disabled={deleteComment.isPending}
                >
                  <Trash className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          )}

          {/* Reply input */}
          {isReplying && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[70px] text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={addComment.isPending || !replyText.trim()}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Reply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setIsReplying(false); setReplyText(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          requestId={requestId}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function CommentsTab({ requestId, currentUserId, isAdmin }: CommentsTabProps) {
  const { data: comments, isLoading } = useComments(requestId);
  const addComment = useAddComment();
  const [newComment, setNewComment] = useState("");

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync({ requestId, content: newComment.trim() });
    setNewComment("");
  };

  return (
    <div className="space-y-4">
      {/* New comment input */}
      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="min-h-[90px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              handleAddComment();
            }
          }}
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Ctrl+Enter to submit</p>
          <Button
            size="sm"
            onClick={handleAddComment}
            disabled={addComment.isPending || !newComment.trim()}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Comment
          </Button>
        </div>
      </div>

      {/* Thread */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : !comments?.length ? (
        <div className="py-10 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No comments yet. Start the conversation.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              requestId={requestId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
