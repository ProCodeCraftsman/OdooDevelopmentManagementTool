import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useComparisonReport } from "@/hooks/useReports";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, XCircle, RefreshCw, AlertTriangle } from "lucide-react";

type ActionType = "upgrade" | "downgrade" | "missing" | "missing_source" | "ok" | "none";

function getActionType(action: string | null | undefined): ActionType {
  if (!action) return "none";
  const lower = action.toLowerCase();
  if (lower.includes("upgrade")) return "upgrade";
  if (lower.includes("downgrade")) return "downgrade";
  if (lower.includes("missing module")) return "missing";
  if (lower.includes("missing in source")) return "missing_source";
  if (lower.includes("no action")) return "ok";
  return "none";
}

function ActionBadge({ action }: { action: string | null | undefined }) {
  const type = getActionType(action);
  
  const config = {
    upgrade: {
      icon: TrendingUp,
      className: "bg-green-100 text-green-800 border-green-300 hover:bg-green-100",
      label: "Upgrade",
    },
    downgrade: {
      icon: TrendingDown,
      className: "bg-red-100 text-red-800 border-red-300 hover:bg-red-100",
      label: "Downgrade",
    },
    missing: {
      icon: XCircle,
      className: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100",
      label: "Missing",
    },
    missing_source: {
      icon: AlertCircle,
      className: "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100",
      label: "Source Error",
    },
    ok: {
      icon: CheckCircle,
      className: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100",
      label: "Synced",
    },
    none: {
      icon: null,
      className: "",
      label: "",
    },
  };

  const { icon: Icon, className } = config[type];

  if (type === "none") return null;

  return (
    <Badge className={cn("gap-1 text-xs", className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {action}
    </Badge>
  );
}

export function ComparisonPage() {
  const { data: report, isLoading, refetch, isRefetching } = useComparisonReport();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Comparison Report</h2>
          <p className="text-muted-foreground">Version matrix across environments</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Comparison Report</h2>
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  const rowsWithAction = report.rows.filter((row) => row.action !== null && row.action !== undefined);
  const displayedRows = showAll ? report.rows : rowsWithAction;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Comparison Report</h2>
          <p className="text-muted-foreground text-sm md:text-base">
            {report.summary.total_modules} modules across {report.summary.environments} environments
            {rowsWithAction.length > 0 && (
              <span className="ml-2 text-yellow-600 font-medium">
                ({rowsWithAction.length} need attention)
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {rowsWithAction.length > 0 && !showAll && (
        <div className="flex items-center gap-3 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <span className="text-sm text-yellow-800">
            Showing {rowsWithAction.length} modules with version differences.{" "}
            <button
              onClick={() => setShowAll(true)}
              className="underline hover:no-underline font-medium"
            >
              Show all {report.summary.total_modules} modules
            </button>
          </span>
        </div>
      )}

      {showAll && rowsWithAction.length > 0 && (
        <div className="flex items-center gap-3 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <button
            onClick={() => setShowAll(false)}
            className="text-sm text-blue-800 underline hover:no-underline font-medium"
          >
            Show only modules with differences ({rowsWithAction.length})
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">Version Matrix</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px] md:max-h-[600px] overflow-y-auto">
            <table className="w-full min-w-[800px]">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr className="border-b bg-muted/95 backdrop-blur">
                  <th className="sticky left-0 z-30 px-3 py-3 text-left text-xs font-medium bg-muted/95 backdrop-blur min-w-[150px]">
                    Module
                  </th>
                  {report.environments.map((env, idx) => (
                    <th
                      key={env}
                      className={cn(
                        "px-3 py-3 text-center text-xs font-medium min-w-[120px]",
                        idx === 0 && "bg-blue-50/80"
                      )}
                    >
                      <div className="font-medium truncate">{env}</div>
                      <div className="text-[10px] font-normal text-muted-foreground font-normal">
                        Order: {report.environment_orders?.[env] || "-"}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-medium min-w-[100px] bg-yellow-50/80">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr
                    key={row.technical_name}
                    className={cn(
                      "border-b last:border-0 hover:bg-muted/30 transition-colors",
                      row.action && "bg-yellow-50/30"
                    )}
                  >
                    <td className="sticky left-0 z-10 px-3 py-2 bg-white min-w-[150px]">
                      <div className="truncate max-w-[150px]" title={row.technical_name}>
                        <span className="font-medium text-sm">{row.technical_name}</span>
                        {row.module_name && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {row.module_name}
                          </div>
                        )}
                      </div>
                    </td>
                    {report.environments.map((env, idx) => {
                      const version = row.versions[env];
                      const isMissing = version?.version_string === "N/A";
                      return (
                        <td
                          key={env}
                          className={cn(
                            "px-3 py-2 text-center",
                            idx === 0 && "bg-blue-50/20"
                          )}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge
                              variant={isMissing ? "outline" : "secondary"}
                              className={cn(
                                "text-xs px-1.5 py-0",
                                isMissing && "text-muted-foreground border-dashed"
                              )}
                            >
                              {version?.version_string || "N/A"}
                            </Badge>
                            {version?.last_sync && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(version.last_sync).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center bg-yellow-50/20">
                      <ActionBadge action={row.action} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
