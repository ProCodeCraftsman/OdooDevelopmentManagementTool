import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSync";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
  environmentName: string;
}

export function SyncStatus({ environmentName: _environmentName }: SyncStatusProps) {
  void _environmentName; // TODO: Implement environment-specific sync status
  const { data: syncStatus } = useSyncStatus(null);

  if (!syncStatus) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>No sync data available</span>
      </div>
    );
  }

  const statusConfig = {
    pending: { icon: Clock, color: "text-yellow-600", label: "Pending" },
    running: { icon: Loader2, color: "text-blue-600 animate-spin", label: "Running" },
    completed: { icon: CheckCircle, color: "text-green-600", label: "Completed" },
    failed: { icon: XCircle, color: "text-red-600", label: "Failed" },
  };

  const config = statusConfig[syncStatus.status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className={config.color}>{config.label}</span>
        {syncStatus.progress_percent > 0 && (
          <span className="text-muted-foreground">({syncStatus.progress_percent}%)</span>
        )}
      </div>
      {syncStatus.error_message && (
        <p className="text-xs text-red-500">{syncStatus.error_message}</p>
      )}
    </div>
  );
}
