import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Server,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboardSummary, useVersionDrift } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";

// ─── Colour palettes ──────────────────────────────────────────────────────────

const PIPELINE_COLORS: Record<string, string> = {
  Draft: "#64748b",
  "In Progress": "#3b82f6",
  Ready: "#06b6d4",
  Done: "#22c55e",
};

const UAT_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#94a3b8"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// ─── Tab 1: Command Center ────────────────────────────────────────────────────

function CommandCenterTab({ onDriftClick }: { onDriftClick: () => void }) {
  const { data, isLoading, isError } = useDashboardSummary();

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Failed to load dashboard data. Please check the server and refresh.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card className="h-64">
              <CardContent className="flex items-center justify-center h-full">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          </div>
          <Card className="h-64">
            <CardContent className="flex items-center justify-center h-full">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-6">
      {/* ── A. KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* 1. Dev Velocity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dev Velocity</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{d.dev_velocity.active_count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Completion: {d.dev_velocity.completion_pct}%
            </p>
          </CardContent>
        </Card>

        {/* 2. Pending UAT */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending UAT</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{d.pending_uat}</div>
            <p className="text-xs text-muted-foreground mt-1">Draft, In Progress, or Ready lines</p>
          </CardContent>
        </Card>

        {/* 3. Release Pipeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Release Pipeline</CardTitle>
            <Zap className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{d.release_pipeline.active_count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Next: {formatDate(d.release_pipeline.next_deployment_date)}
            </p>
          </CardContent>
        </Card>

        {/* 4. Infra Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Infra Health</CardTitle>
            <Server className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{d.infra_health.active_env_count}</div>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              {d.infra_health.synced_last_24h} synced / 24h
              {" · "}
              {d.infra_health.pending_actions} pending
            </p>
          </CardContent>
        </Card>

        {/* 5. Urgent Drift Alert (clickable) */}
        <Card
          role="button"
          tabIndex={0}
          onClick={onDriftClick}
          onKeyDown={(e) => e.key === "Enter" && onDriftClick()}
          className={cn(
            "cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            d.urgent_drift.count > 0
              ? "border-red-400 bg-red-50/40 dark:bg-red-950/20"
              : "border-green-400 bg-green-50/40 dark:bg-green-950/20"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Urgent Drift</CardTitle>
            <AlertTriangle
              className={cn("h-4 w-4", d.urgent_drift.count > 0 ? "text-red-500" : "text-green-500")}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-3xl font-bold",
                d.urgent_drift.count > 0 ? "text-red-600" : "text-green-600"
              )}
            >
              {d.urgent_drift.count}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              Modules severely out of sync
              <ChevronRight className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── B. Middle Row ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Developer Workload Matrix */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Developer Workload Matrix</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Developer</TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                        Draft
                      </span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />
                        In Progress
                      </span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                        Done
                      </span>
                    </TableHead>
                    <TableHead className="text-center pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.workload_matrix.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No development requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    d.workload_matrix.map((row) => (
                      <TableRow key={row.developer}>
                        <TableCell className="pl-6 font-medium">
                          {row.developer === "Unassigned" ? (
                            <span className="text-muted-foreground italic">{row.developer}</span>
                          ) : (
                            row.developer
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.open > 0 ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300">
                              {row.open}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.in_progress > 0 ? (
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
                              {row.in_progress}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.closed > 0 ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300">
                              {row.closed}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center pr-6 font-semibold">
                          {row.open + row.in_progress + row.closed}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Distribution Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.pipeline_distribution} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                  {d.pipeline_distribution.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={PIPELINE_COLORS[entry.category] ?? "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── C. Bottom Row ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Upcoming Deployments */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Upcoming Deployments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {d.upcoming_deployments.length === 0 ? (
              <p className="text-muted-foreground text-sm px-6 pb-6">No upcoming deployments scheduled.</p>
            ) : (
              <ul className="divide-y">
                {d.upcoming_deployments.map((plan) => (
                  <li key={plan.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors">
                    <div>
                      <Link
                        to={`/release-plans/${plan.id}`}
                        className="text-sm font-medium hover:underline text-primary"
                      >
                        {plan.plan_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        → {plan.target_env ?? "No target env"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(plan.planned_deployment_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* UAT Activity Donut Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">UAT Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {d.uat_activity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No UAT data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={d.uat_activity}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {d.uat_activity.map((entry, index) => (
                      <Cell
                        key={entry.status}
                        fill={UAT_COLORS[index % UAT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [value, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ fontSize: 11 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab 2: Version Drift Summary ────────────────────────────────────────────

function VersionDriftTab() {
  const { data, isLoading, isError } = useVersionDrift();

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Failed to load version drift data. Please check the server and refresh.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">Version Drift Overview</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Counts from the latest comparison report across all environment pairs.
          </p>
        </div>
        <Link
          to="/reports/comparison"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
        >
          View full drift report
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !data?.has_report ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p className="text-sm">No comparison report generated yet.</p>
            <Link
              to="/reports/comparison"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Go to Reports to generate one
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Total Drifts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Drifts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data.total_drifts}</div>
              <p className="text-xs text-muted-foreground mt-1">Actionable pairs</p>
            </CardContent>
          </Card>

          {/* Upgrades */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Upgrades</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{data.upgrades}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready to promote</p>
            </CardContent>
          </Card>

          {/* Downgrades */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Downgrades</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{data.downgrades}</div>
              <p className="text-xs text-muted-foreground mt-1">Need investigation</p>
            </CardContent>
          </Card>

          {/* Missing */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Missing</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{data.missing}</div>
              <p className="text-xs text-muted-foreground mt-1">Not in one env</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState("command-center");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm">Release operations overview</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="command-center">Command Center</TabsTrigger>
          <TabsTrigger value="version-drift">Version Drift</TabsTrigger>
        </TabsList>

        <TabsContent value="command-center" className="mt-6">
          <CommandCenterTab onDriftClick={() => setActiveTab("version-drift")} />
        </TabsContent>

        <TabsContent value="version-drift" className="mt-6">
          <VersionDriftTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
