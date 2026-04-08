import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useBulkAssign, useBulkArchive } from "@/hooks/useDevelopmentRequests";
import { useAssignableUsers } from "@/hooks/useUsers";
import { developmentRequestsApi } from "@/api/development-requests";
import type { DevelopmentRequest } from "@/api/development-requests";
import { Download, UserCheck, Archive, X } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  selectedIds: number[];
  selectedRows: DevelopmentRequest[];
  onClearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkActionsToolbar({
  selectedIds,
  selectedRows,
  onClearSelection,
}: Props) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const bulkAssign = useBulkAssign();
  const bulkArchive = useBulkArchive();
  const { data: users = [] } = useAssignableUsers();

  if (selectedIds.length === 0) return null;

  // Permission guard: warn about rows the user can't edit
  const editableIds = selectedRows.filter((r) => r.permissions?.can_update).map((r) => r.id);
  const uneditableCount = selectedIds.length - editableIds.length;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await developmentRequestsApi.exportRequestsXlsx(undefined, undefined, selectedIds);
      toast.success(`Exported ${selectedIds.length} request(s)`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleAssign = async (developerId: number) => {
    setAssignDialogOpen(false);
    if (uneditableCount > 0) {
      toast.warning(`${uneditableCount} selected item(s) will be skipped (no edit permission).`);
    }
    await bulkAssign.mutateAsync({ ids: editableIds, assigned_developer_id: developerId });
    onClearSelection();
  };

  const handleArchive = async () => {
    setArchiveDialogOpen(false);
    const archivableIds = selectedRows
      .filter((r) => r.permissions?.can_archive)
      .map((r) => r.id);
    const skipped = selectedIds.length - archivableIds.length;
    if (skipped > 0) {
      toast.warning(`${skipped} item(s) will be skipped (no archive permission).`);
    }
    if (archivableIds.length === 0) {
      toast.error("No selected items can be archived with your permissions.");
      return;
    }
    await bulkArchive.mutateAsync({ ids: archivableIds });
    onClearSelection();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary/5 border-primary/20">
        <Badge variant="secondary" className="gap-1">
          {selectedIds.length} selected
          {uneditableCount > 0 && (
            <span className="text-yellow-600 ml-1">({uneditableCount} read-only)</span>
          )}
        </Badge>

        {/* Export selected */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>

        {/* Bulk Assign */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5"
          onClick={() => setAssignDialogOpen(true)}
          disabled={editableIds.length === 0}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Assign
        </Button>

        {/* Bulk Archive */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-destructive hover:text-destructive"
          onClick={() => setArchiveDialogOpen(true)}
        >
          <Archive className="h-3.5 w-3.5" />
          Archive
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 ml-auto text-muted-foreground"
          onClick={onClearSelection}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Assign dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bulk Assign ({editableIds.length} requests)</DialogTitle>
            <DialogDescription>
              Select a developer to assign all editable selected requests to.
              {uneditableCount > 0 && (
                <span className="block mt-1 text-yellow-600">
                  {uneditableCount} read-only item(s) will be skipped.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1 py-2">
            {users.map((u) => (
              <button
                key={u.id}
                className="w-full text-left px-3 py-2 rounded hover:bg-accent text-sm"
                onClick={() => handleAssign(u.id)}
              >
                {u.username}
                <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive {selectedIds.length} request(s)?</DialogTitle>
            <DialogDescription>
              This will soft-archive the selected requests. They can be restored later.
              {uneditableCount > 0 && (
                <span className="block mt-1 text-yellow-600">
                  {uneditableCount} item(s) without archive permission will be skipped.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
