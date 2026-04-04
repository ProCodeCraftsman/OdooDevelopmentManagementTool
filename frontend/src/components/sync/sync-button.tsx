import { useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTriggerSync } from "@/hooks/useSync";
import { useSyncStatus } from "@/hooks/useSync";
import { toast } from "sonner";

export function SyncButton({ environmentName }: { environmentName: string }) {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const triggerSync = useTriggerSync();
  const { data: syncStatus } = useSyncStatus(currentJobId);

  const isRunning = syncStatus?.status === "running" || syncStatus?.status === "pending";

  const handleSync = async () => {
    try {
      const result = await triggerSync.mutateAsync(environmentName);
      setCurrentJobId(result.job_id);
      toast.success(`Sync started for ${environmentName}`);
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
