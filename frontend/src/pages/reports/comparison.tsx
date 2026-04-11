import { useMemo, useState, useRef, useEffect } from "react";
import { type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileBarChart,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { reportsApi } from "@/api/reports";
import { syncApi } from "@/api/sync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useComparisonFilterOptions,
  useDriftFilterOptions,
  useGenerateReport,
  usePaginatedDrift,
  usePaginatedReport,
  useReportMetadata,
} from "@/hooks/useReports";
import { useTriggerSyncAll } from "@/hooks/useSync";
import { useEnvironments } from "@/hooks/useEnvironments";
import { cn } from "@/lib/utils";
import type {
  ActionCountsMap,
  DriftSummaryCounts,
  ReportRowResponse,
  ReportVersionCell,
  VersionDriftEntry,
} from "@/types/api";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function joinFilter(values: string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined;
}

// ─── Action badge (used in both tabs) ────────────────────────────────────────

function ActionBadge({ action, missingEnv }: { action?: string | null; missingEnv?: string | null }) {
  if (!action) return <span className="text-muted-foreground text-xs">—</span>;

  const lower = action.toLowerCase();
  const isUpgrade = lower.includes("upgrade");
  const isDowngrade = lower.includes("downgrade");
  const isMissingModule = lower === "missing module";
  const isMissingSource = lower.includes("missing in source");
  const isNoAction = lower === "no action";

  const config = isUpgrade
    ? { icon: TrendingUp, className: "bg-green-100 text-green-800 border-green-300 hover:bg-green-100" }
    : isDowngrade
    ? { icon: TrendingDown, className: "bg-red-100 text-red-800 border-red-300 hover:bg-red-100" }
    : isMissingModule
    ? { icon: XCircle, className: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100" }
    : isMissingSource
    ? { icon: AlertCircle, className: "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100" }
    : isNoAction
    ? { icon: CheckCircle, className: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100" }
    : { icon: CheckCircle, className: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100" };

  const Icon = config.icon;
  const label = (isMissingModule || isMissingSource) && missingEnv ? `${action} (${missingEnv})` : action;

  return (
    <Badge className={cn("gap-1 text-xs whitespace-nowrap", config.className)}>
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </Badge>
  );
}

// ─── Version cell (comparison summary tab) ────────────────────────────────────

function VersionCell({ data }: { data?: ReportVersionCell }) {
  if (!data) {
    return (
      <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground border-dashed">
        N/A
      </Badge>
    );
  }
  const isMissing = data.version === "N/A" || data.version == null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Badge
        variant={isMissing ? "outline" : "secondary"}
        className={cn("text-xs px-1.5 py-0", isMissing && "text-muted-foreground border-dashed")}
      >
        {data.version ?? "N/A"}
      </Badge>
      {data.last_sync && (
        <span className="text-[10px] text-muted-foreground">
          {new Date(
            data.last_sync.endsWith("Z") || data.last_sync.includes("+")
              ? data.last_sync
              : data.last_sync + "Z"
          ).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
        </span>
      )}
    </div>
  );
}

// ─── Action Counts display (comparison summary tab) ───────────────────────────

function ActionCountsSummary({ counts }: { counts?: ActionCountsMap | null }) {
  if (!counts) return <span className="text-muted-foreground text-xs">—</span>;

  const upgrades = counts["Upgrade"] ?? 0;
  const downgrades = counts["Error (Downgrade)"] ?? 0;
  const missing =
    (counts["Missing Module"] ?? 0) + (counts["Error (Missing in Source)"] ?? 0);

  const hasAny = upgrades + downgrades + missing > 0;
  if (!hasAny) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <CheckCircle className="h-3 w-3 text-blue-500" />
        All OK
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {upgrades > 0 && (
        <span className="flex items-center gap-0.5 text-green-700 font-medium">
          <TrendingUp className="h-3 w-3" />
          {upgrades}
        </span>
      )}
      {downgrades > 0 && (
        <span className="flex items-center gap-0.5 text-red-700 font-medium">
          <TrendingDown className="h-3 w-3" />
          {downgrades}
        </span>
      )}
      {missing > 0 && (
        <span className="flex items-center gap-0.5 text-yellow-700 font-medium">
          <AlertCircle className="h-3 w-3" />
          {missing}
        </span>
      )}
    </div>
  );
}

// ─── Drift summary cards ──────────────────────────────────────────────────────

function DriftSummaryCards({ summary }: { summary?: DriftSummaryCounts }) {
  const cards = [
    {
      label: "Total Drifts",
      value: summary?.total ?? 0,
      className: "text-foreground",
      bg: "",
    },
    {
      label: "Upgrades",
      value: summary?.upgrades ?? 0,
      className: "text-green-600",
      bg: "border-green-200 bg-green-50/40 dark:bg-green-950/20",
    },
    {
      label: "Downgrades",
      value: summary?.downgrades ?? 0,
      className: "text-red-600",
      bg: "border-red-200 bg-red-50/40 dark:bg-red-950/20",
    },
    {
      label: "Missing",
      value: summary?.missing ?? 0,
      className: "text-yellow-600",
      bg: "border-yellow-200 bg-yellow-50/40 dark:bg-yellow-950/20",
    },
    {
      label: "Nomenclature Errors",
      value: summary?.nomenclature_errors ?? 0,
      className: "text-orange-600",
      bg: "border-orange-200 bg-orange-50/40 dark:bg-orange-950/20",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label} className={c.bg}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
            <p className={cn("text-2xl font-bold mt-0.5", c.className)}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Tab 1: Version Drift ─────────────────────────────────────────────────────

function VersionDriftTab({
  isGenerating,
  neverGenerated,
}: {
  isGenerating: boolean;
  neverGenerated: boolean;
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 });
  const [search, setSearch] = useState("");
  const [actionFilters, setActionFilters] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const { data: filterOptions } = useDriftFilterOptions();
  const sortBy = sorting[0]?.id ?? "technical_name";

  const queryParams = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: search || undefined,
      action_filter: joinFilter(actionFilters) || undefined,
      sort_by: sortBy,
    }),
    [pagination, search, actionFilters, sortBy]
  );

  const { data: driftData, isLoading, isFetching } = usePaginatedDrift(queryParams);

  const columns = useMemo<ColumnDef<VersionDriftEntry>[]>(
    () => [
      {
        accessorKey: "technical_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Module" />,
        cell: ({ row }) => (
          <div className="min-w-[140px]">
            <p className="font-medium text-sm truncate max-w-[180px]" title={row.original.technical_name}>
              {row.original.technical_name}
            </p>
            {row.original.module_name && (
              <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                {row.original.module_name}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "source_env",
        header: () => <span className="text-xs font-medium">Source Env</span>,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
            {row.original.source_env}
          </Badge>
        ),
        enableSorting: false,
      },
      {
        id: "source_version",
        header: () => <span className="text-xs font-medium">Source Ver</span>,
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.source_version ?? (
              <span className="text-muted-foreground italic text-xs">N/A</span>
            )}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "dest_env",
        header: () => <span className="text-xs font-medium">Dest Env</span>,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
            {row.original.dest_env}
          </Badge>
        ),
        enableSorting: false,
      },
      {
        id: "dest_version",
        header: () => <span className="text-xs font-medium">Dest Ver</span>,
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.dest_version ?? (
              <span className="text-muted-foreground italic text-xs">N/A</span>
            )}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "action",
        header: ({ column }) => (
          <div className="text-center">
            <DataTableColumnHeader column={column} title="Action" className="justify-center" />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <ActionBadge action={row.original.action} missingEnv={row.original.missing_env} />
          </div>
        ),
      },
    ],
    []
  );

  const handleExportCsv = () => {
    reportsApi.exportDriftCsv({
      search: search || undefined,
      action_filter: joinFilter(actionFilters) || undefined,
      sort_by: sortBy,
    });
    toast.success("CSV download started");
  };

  const handleExportXlsx = async () => {
    setExportingXlsx(true);
    try {
      await reportsApi.exportDriftXlsx({
        search: search || undefined,
        action_filter: joinFilter(actionFilters) || undefined,
        sort_by: sortBy,
      });
      toast.success("Exported successfully");
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingXlsx(false);
    }
  };

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableMultiSelect
        options={filterOptions?.action_options ?? []}
        selected={actionFilters}
        onChange={(v) => {
          setActionFilters(v);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        }}
        allLabel="Action"
        searchPlaceholder="Filter by action..."
        triggerWidth="w-[220px]"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleExportCsv}
        disabled={!driftData?.pagination.total_records}
      >
        <Download className="h-3.5 w-3.5" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleExportXlsx}
        disabled={exportingXlsx || !driftData?.pagination.total_records}
      >
        {exportingXlsx ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Excel
      </Button>
    </div>
  );

  const emptyState = (
    <tr>
      <td colSpan={columns.length} className="h-48 text-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <FileBarChart className="h-10 w-10 opacity-30" />
          {neverGenerated ? (
            <>
              <p className="font-medium">No report generated yet.</p>
              <p className="text-sm">Click &ldquo;Generate New Report&rdquo; to begin.</p>
            </>
          ) : (
            <p className="text-sm">No drift entries match your filters.</p>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <DriftSummaryCards summary={driftData?.summary} />

      <DataTable<VersionDriftEntry, unknown>
        columns={columns}
        data={driftData?.data ?? []}
        loading={isLoading || (isGenerating && !driftData)}
        pagination={driftData?.pagination}
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        pageCount={driftData?.pagination.total_pages ?? -1}
        onPaginationChange={setPagination}
        searchable
        searchPlaceholder="Search module name or technical name..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        }}
        onSortingChange={(s) => {
          setSorting(s);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        }}
        filterBar={filterBar}
        emptyState={emptyState}
      />

      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Refreshing...
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Comparison Summary ────────────────────────────────────────────────

function ComparisonSummaryTab({
  isGenerating,
  neverGenerated,
}: {
  isGenerating: boolean;
  neverGenerated: boolean;
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 });
  const [search, setSearch] = useState("");
  const [technicalNameFilters, setTechnicalNameFilters] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const { data: filterOptions } = useComparisonFilterOptions();
  const sortBy = sorting[0]?.id ?? "technical_name";

  const queryParams = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: search || undefined,
      technical_names: joinFilter(technicalNameFilters) || undefined,
      sort_by: sortBy,
    }),
    [pagination, search, technicalNameFilters, sortBy]
  );

  const { data: reportData, isLoading, isFetching } = usePaginatedReport(queryParams);

  const envKeys = useMemo(() => {
    const firstRow = reportData?.data?.[0];
    if (!firstRow?.version_data) return [];
    return Object.keys(firstRow.version_data);
  }, [reportData]);

  const columns = useMemo<ColumnDef<ReportRowResponse>[]>(
    () => [
      {
        accessorKey: "technical_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Technical Name" />,
        cell: ({ row }) => (
          <div className="min-w-[140px]">
            <p className="font-medium text-sm truncate max-w-[180px]" title={row.original.technical_name}>
              {row.original.technical_name}
            </p>
            {row.original.module_name && (
              <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                {row.original.module_name}
              </p>
            )}
          </div>
        ),
      },
      ...envKeys.map<ColumnDef<ReportRowResponse>>((envKey) => ({
        id: `env_${envKey}`,
        header: () => (
          <div className="text-center min-w-[100px]">
            <p className="font-medium text-xs">{envKey}</p>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <VersionCell data={row.original.version_data?.[envKey]} />
          </div>
        ),
        enableSorting: false,
      })),
      {
        id: "action_summary",
        header: () => (
          <div className="text-center min-w-[110px]">
            <span className="text-xs font-medium">Action Summary</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <ActionCountsSummary counts={row.original.action_counts} />
          </div>
        ),
        enableSorting: false,
      },
    ],
    [envKeys]
  );

  const handleExportXlsx = async () => {
    setExportingXlsx(true);
    try {
      await reportsApi.exportComparisonXlsx({
        search: search || undefined,
        technical_names: joinFilter(technicalNameFilters) || undefined,
        sort_by: sortBy,
      });
      toast.success("Exported successfully");
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingXlsx(false);
    }
  };

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableMultiSelect
        options={filterOptions?.technical_name_options ?? []}
        selected={technicalNameFilters}
        onChange={(v) => {
          setTechnicalNameFilters(v);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        }}
        allLabel="Module"
        searchPlaceholder="Search modules..."
        triggerWidth="w-[200px]"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => reportsApi.exportComparisonCsv()}
        disabled={!reportData?.pagination.total_records}
      >
        <Download className="h-3.5 w-3.5" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleExportXlsx}
        disabled={exportingXlsx || !reportData?.pagination.total_records}
      >
        {exportingXlsx ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Excel
      </Button>
    </div>
  );

  const emptyState = (
    <tr>
      <td colSpan={columns.length} className="h-48 text-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <FileBarChart className="h-10 w-10 opacity-30" />
          {neverGenerated ? (
            <>
              <p className="font-medium">No report generated yet.</p>
              <p className="text-sm">Click &ldquo;Generate New Report&rdquo; to begin.</p>
            </>
          ) : (
            <p className="text-sm">No modules match your filters.</p>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <DataTable<ReportRowResponse, unknown>
        columns={columns}
        data={reportData?.data ?? []}
        loading={isLoading || (isGenerating && !reportData)}
        pagination={reportData?.pagination}
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        pageCount={reportData?.pagination.total_pages ?? -1}
        onPaginationChange={setPagination}
        searchable
        searchPlaceholder="Search module name or technical name..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        }}
        onSortingChange={(s) => {
          setSorting(s);
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        }}
        filterBar={filterBar}
        emptyState={emptyState}
      />

      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Refreshing...
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SYNC_JOB_TIMEOUT_MS = 60_000;

export function ComparisonPage() {
  const { data: metadata, isLoading: metaLoading } = useReportMetadata();
  const { data: environments } = useEnvironments();
  const generateReport = useGenerateReport();
  const syncAll = useTriggerSyncAll();

  const [syncing, setSyncing] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobStartTimesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const isGenerating = metadata?.is_generating || generateReport.isPending;
  const neverGenerated = !metaLoading && !metadata?.last_generated_at && !metadata?.is_generating;

  const handleGenerate = async () => {
    try {
      const result = await generateReport.mutateAsync();
      toast.success(
        `Report generated — ${result.rows_generated} modules, ${result.drift_entries_generated} drift entries.`
      );
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Generation failed";
      toast.error(message);
    }
  };

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
      const jobs = await syncAll.mutateAsync();

      if (jobs.length === 0) {
        toast.dismiss(toastId);
        toast.info("No sync jobs were created");
        setSyncing(false);
        return;
      }

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
        const pending = jobs.filter(
          (j) =>
            !completedJobs.has(j.job_id) &&
            !failedJobs.has(j.job_id) &&
            !timedOutJobs.has(j.job_id)
        );

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
            consecutiveErrors = 0;

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

  const lastGeneratedLabel = metaLoading ? (
    <Skeleton className="h-4 w-40" />
  ) : metadata?.last_generated_at ? (
    <span className="text-sm text-muted-foreground">
      Last generated:{" "}
      <span className="font-medium text-foreground">
        {new Date(
          metadata.last_generated_at.endsWith("Z") || metadata.last_generated_at.includes("+")
            ? metadata.last_generated_at
            : metadata.last_generated_at + "Z"
        ).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
      </span>
    </span>
  ) : (
    <span className="text-sm text-muted-foreground italic">Never generated</span>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-bold">Comparison Report</h2>
          <div className="flex items-center gap-2">{lastGeneratedLabel}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New Report
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncing || !environments || environments.length === 0}
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync All Environments
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs defaultValue="version-drift">
        <TabsList>
          <TabsTrigger value="version-drift">Version Drift</TabsTrigger>
          <TabsTrigger value="comparison-summary">Comparison Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="version-drift" className="mt-4">
          <VersionDriftTab
            isGenerating={isGenerating}
            neverGenerated={neverGenerated}
          />
        </TabsContent>

        <TabsContent value="comparison-summary" className="mt-4">
          <ComparisonSummaryTab
            isGenerating={isGenerating}
            neverGenerated={neverGenerated}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
