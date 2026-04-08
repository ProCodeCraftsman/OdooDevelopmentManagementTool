import { useRef } from "react";
import { toast } from "sonner";
import { Paperclip, Download, Trash, Upload, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttachments, useUploadAttachment, useDeleteAttachment } from "@/hooks/useDevelopmentRequests";
import { developmentRequestsApi } from "@/api/development-requests";
import type { RequestAttachment } from "@/api/development-requests";

const ALLOWED_TYPES = [
  "image/jpeg","image/png","image/gif","image/webp","image/bmp",
  "application/pdf","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip","application/x-zip-compressed","application/x-zip",
];
const MAX_MB = 5;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

interface AttachmentsTabProps {
  requestId: number;
  currentUserId?: number;
  isAdmin?: boolean;
  readonly?: boolean;
}

export function AttachmentsTab({ requestId, currentUserId, isAdmin, readonly }: AttachmentsTabProps) {
  const { data: attachments, isLoading } = useAttachments(requestId);
  const upload = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("File type not allowed. Use images, PDF, Word, Excel, or ZIP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_MB} MB limit.`);
      return;
    }
    await upload.mutateAsync({ requestId, file });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (attachment: RequestAttachment) => {
    deleteAttachment.mutate({ requestId, attachmentId: attachment.id });
  };

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {upload.isPending ? "Uploading..." : "Upload File"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Max {MAX_MB} MB · Images, PDF, Word, Excel, ZIP
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !attachments?.length ? (
        <div className="py-10 text-center text-muted-foreground">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No attachments yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-md border">
          {attachments.map((att) => {
            const canDelete = att.uploaded_by_id === currentUserId || isAdmin;
            return (
              <div key={att.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <FileIcon mimeType={att.mime_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={att.original_name}>
                    {att.original_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(att.file_size)} · {new Date(att.created_at).toLocaleDateString()}
                    {att.uploaded_by && ` · ${att.uploaded_by.username}`}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a
                      href={developmentRequestsApi.getAttachmentDownloadUrl(requestId, att.id)}
                      download={att.original_name}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(att)}
                      disabled={deleteAttachment.isPending}
                    >
                      <Trash className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
