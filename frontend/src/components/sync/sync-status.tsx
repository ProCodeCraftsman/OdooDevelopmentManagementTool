import { Clock, CheckCircle, XCircle, Loader2, Calendar } from "lucide-react";
import { useLastSyncStatus } from "@/hooks/useSync";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
  environmentName: string;
}

export function SyncStatus({ environmentName }: SyncStatusProps) {
  const { data: syncStatus, isLoading, error } = useLastSyncStatus(environmentName);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Loading sync status...</span>
      </div>
    );
  }

  if (error || !syncStatus) {
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

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    const utcStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
    const date = new Date(utcStr);
    const dateStr2 = date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
    const timeStr = date.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
    return `${dateStr2} ${timeStr}`;
  };

  const formatTimeAgo = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    const utcStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
    const date = new Date(utcStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(dateStr);
  };

  const syncTime = syncStatus.completed_at || syncStatus.started_at;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className={config.color}>{config.label}</span>
        {syncStatus.progress_percent > 0 && syncStatus.status === "running" && (
          <span className="text-muted-foreground">({syncStatus.progress_percent}%)</span>
        )}
      </div>
      {syncTime && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{formatTimeAgo(syncTime)}</span>
        </div>
      )}
      {syncStatus.error_message && (
        <p className="text-xs text-red-500">{syncStatus.error_message}</p>
      )}
    </div>
  );
}
