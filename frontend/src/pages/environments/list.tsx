import { Link } from "react-router-dom";
import { Server, Plus, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useTriggerSyncAll } from "@/hooks/useSync";
import { syncApi } from "@/api/sync";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";

const SYNC_JOB_TIMEOUT_MS = 60_000;

export function EnvironmentsPage() {
  const { data: environments, isLoading, refetch } = useEnvironments();
  const triggerSyncAll = useTriggerSyncAll();
  const [syncing, setSyncing] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobStartTimesRef = useRef<Record<string, number>>({});

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const handleSyncAll = async () => {
    if (syncing) return;
    if (!environments || environments.length === 0) return;

    const activeEnvs = environments.filter((e) => e.is_active);
    if (activeEnvs.length === 0) {
      toast.info("No active environments to sync");
      return;
    }

    setSyncing(true);
    const toastId = "sync-all";
    toast.loading(`Initiating sync for ${activeEnvs.length} environment(s)...`, {
      id: toastId,
      duration: Infinity,
    });

    try {
      const jobs = await triggerSyncAll.mutateAsync();

      if (jobs.length === 0) {
        toast.dismiss(toastId);
        toast.info("No sync jobs were created");
        setSyncing(false);
        return;
      }

      // Map job_id → environment name (backend returns jobs in active-env order)
      const jobEnvMap: Record<string, string> = {};
      const now = Date.now();
      jobs.forEach((job, idx) => {
        jobEnvMap[job.job_id] = activeEnvs[idx]?.name ?? `Environment ${idx + 1}`;
        jobStartTimesRef.current[job.job_id] = now;
      });

      const completedJobs = new Set<string>();
      const failedJobs = new Set<string>();
      const timedOutJobs = new Set<string>();

      toast.loading(`Syncing ${jobs.length} environment(s) — 0 / ${jobs.length} done`, {
        id: toastId,
        duration: Infinity,
      });

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      let consecutiveErrors = 0;
      const MAX_CONSECUTIVE_ERRORS = 3;

      pollIntervalRef.current = setInterval(async () => {
        // Only poll jobs still in-progress
        const pending = jobs.filter(
          (j) =>
            !completedJobs.has(j.job_id) &&
            !failedJobs.has(j.job_id) &&
            !timedOutJobs.has(j.job_id)
        );

        // Check per-job timeout
        const pollNow = Date.now();
        pending.forEach((j) => {
          const elapsed = pollNow - (jobStartTimesRef.current[j.job_id] ?? pollNow);
          if (elapsed > SYNC_JOB_TIMEOUT_MS) {
            timedOutJobs.add(j.job_id);
            toast.error(`${jobEnvMap[j.job_id]} sync timed out`, {
              description: "No response after 60 s",
            });
          }
        });

        const stillPending = pending.filter((j) => !timedOutJobs.has(j.job_id));

        if (stillPending.length > 0) {
          try {
            const statuses = await Promise.all(stillPending.map((j) => syncApi.getStatus(j.job_id)));
            consecutiveErrors = 0; // reset on success

            statuses.forEach((s) => {
              if (s.status === "completed" && !completedJobs.has(s.job_id)) {
                completedJobs.add(s.job_id);
                toast.success(`${jobEnvMap[s.job_id]} synced`);
              } else if (s.status === "failed" && !failedJobs.has(s.job_id)) {
                failedJobs.add(s.job_id);
                toast.error(`${jobEnvMap[s.job_id]} sync failed`, {
                  description: s.error_message ?? "Unknown error",
                });
              }
            });
          } catch {
            consecutiveErrors += 1;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              // Backend unreachable — fail all still-pending jobs
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              jobStartTimesRef.current = {};
              toast.dismiss(toastId);
              toast.error("Sync All aborted: backend unreachable", {
                description: `${consecutiveErrors} consecutive polling failures`,
              });
              setSyncing(false);
              return;
            }
          }
        }

        const done = completedJobs.size + failedJobs.size + timedOutJobs.size;
        toast.loading(`Syncing ${jobs.length} environment(s) — ${done} / ${jobs.length} done`, {
          id: toastId,
          duration: Infinity,
        });

        if (done >= jobs.length) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          jobStartTimesRef.current = {};
          toast.dismiss(toastId);

          if (failedJobs.size === 0 && timedOutJobs.size === 0) {
            toast.success("All environments synced successfully");
          } else {
            const issues = failedJobs.size + timedOutJobs.size;
            toast.warning("Sync all completed with issues", {
              description: `${completedJobs.size} succeeded, ${failedJobs.size} failed, ${timedOutJobs.size} timed out`,
            });
            void issues;
          }

          setSyncing(false);
          refetch();
        }
      }, 3000);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Failed to start sync all", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setSyncing(false);
    }
  };

  const formatLastSync = (lastSync: string | null | undefined) => {
    if (!lastSync) return "Never synced";
    const utcStr = lastSync.endsWith("Z") || lastSync.includes("+") ? lastSync : lastSync + "Z";
    const date = new Date(utcStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Environments</h2>
          <p className="text-muted-foreground">Manage your Odoo server environments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={syncing || !environments || environments.length === 0}
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : environments?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No environments configured</p>
            <p className="text-muted-foreground mb-4">Get started by adding your first Odoo server</p>
            <Button asChild>
              <Link to="/settings/environments">
                <Plus className="mr-2 h-4 w-4" />
                Add Environment
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {environments?.map((env) => (
            <Card key={env.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold truncate">{env.name}</CardTitle>
                <Badge variant={env.is_active ? "default" : "secondary"} className="ml-2 shrink-0">
                  {env.is_active ? "Active" : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium truncate ml-2">{env.category}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate mr-2">URL</span>
                      <span className="font-medium text-xs truncate" title={env.url || undefined}>{env.url}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-t">
                    <span className="text-muted-foreground">Last Sync</span>
                    <span className="text-xs font-medium text-muted-foreground">{formatLastSync(env.last_sync)}</span>
                  </div>
                  <Button asChild className="w-full mt-4">
                    <Link to={`/environments/${env.name}`}>View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
