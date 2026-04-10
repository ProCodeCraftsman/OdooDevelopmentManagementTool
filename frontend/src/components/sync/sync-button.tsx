import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTriggerSync } from "@/hooks/useSync";
import { useSyncStatus } from "@/hooks/useSync";
import { useQueryClient } from "@tanstack/react-query";
import { environmentKeys } from "@/hooks/useEnvironments";
import { toast } from "sonner";

const SYNC_TIMEOUT_MS = 60_000;

export function SyncButton({ environmentName }: { environmentName: string }) {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const triggerSync = useTriggerSync();
  const { data: syncStatus, error: syncError } = useSyncStatus(currentJobId);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRunning = syncStatus?.status === "running" || syncStatus?.status === "pending";

  const clearSyncState = useCallback(() => {
    setCurrentJobId(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleClearSyncState = useCallback(() => {
    setTimeout(() => {
      clearSyncState();
    }, 0);
  }, [clearSyncState]);

  // Completed or failed
  useEffect(() => {
    if (syncStatus?.status === "completed" || syncStatus?.status === "failed") {
      toast.dismiss(`sync-${environmentName}`);
      scheduleClearSyncState();

      queryClient.invalidateQueries({ queryKey: environmentKeys.modules(environmentName) });
      queryClient.invalidateQueries({ queryKey: environmentKeys.dependencies(environmentName) });
      queryClient.invalidateQueries({ queryKey: environmentKeys.detail(environmentName) });
      queryClient.invalidateQueries({ queryKey: environmentKeys.filterOptions(environmentName) });
      queryClient.invalidateQueries({ queryKey: ["environments", "list"] });

      if (syncStatus.status === "completed") {
        toast.success(`${environmentName} synced successfully`);
      } else {
        toast.error(`${environmentName} sync failed`, {
          description: syncStatus.error_message || "Unknown error",
        });
      }
    }
  }, [syncStatus, environmentName, queryClient, scheduleClearSyncState]);

  // Query error (e.g. job record not found — 404)
  useEffect(() => {
    if (syncError && currentJobId) {
      toast.dismiss(`sync-${environmentName}`);
      scheduleClearSyncState();
      toast.error(`${environmentName} sync status unavailable`, {
        description: "Lost track of sync job. Check server logs.",
      });
    }
  }, [syncError, currentJobId, environmentName, scheduleClearSyncState]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSync = async () => {
    if (isRunning || triggerSync.isPending) return;
    try {
      const result = await triggerSync.mutateAsync(environmentName);
      setCurrentJobId(result.job_id);
      toast.loading(`Syncing ${environmentName}...`, { id: `sync-${environmentName}`, duration: Infinity });

      // Client-side guard: give up after 60 s if no terminal state received
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        toast.dismiss(`sync-${environmentName}`);
        clearSyncState();
        toast.error(`${environmentName} sync timed out`, {
          description: "No response after 60 s. Check Odoo server connection.",
        });
      }, SYNC_TIMEOUT_MS);
    } catch {
      toast.error("Failed to start sync");
    }
  };

  const getStatusIcon = () => {
    if (!syncStatus) return null;
    switch (syncStatus.status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleSync} disabled={isRunning || triggerSync.isPending}>
        {isRunning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Now
          </>
        )}
      </Button>

      {syncStatus && (
        <div className="flex items-center gap-2 text-sm">
          {getStatusIcon()}
          <span className="capitalize">{syncStatus.status}</span>
          {syncStatus.progress_percent > 0 && (
            <span className="text-muted-foreground">({syncStatus.progress_percent}%)</span>
          )}
        </div>
      )}

      {syncStatus?.error_message && (
        <p className="text-sm text-red-500">{syncStatus.error_message}</p>
      )}
    </div>
  );
}
