import { Link } from "react-router-dom";
import { Package, Server, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useComparisonReport } from "@/hooks/useReports";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const { data: environments, isLoading: envLoading } = useEnvironments();
  const { data: report, isLoading: reportLoading } = useComparisonReport();

  const modulesNeedingAttention = report?.rows.filter((r) => r.action !== null).length ?? 0;

  const stats = [
    {
      title: "Total Modules",
      value: report?.summary.total_modules ?? 0,
      icon: Package,
      loading: reportLoading,
      href: "/modules",
    },
    {
      title: "Environments",
      value: environments?.length ?? 0,
      icon: Server,
      loading: envLoading,
      href: "/environments",
    },
    {
      title: "Synced Environments",
      value: environments?.filter((e) => e.is_active).length ?? 0,
      icon: CheckCircle,
      loading: envLoading,
      href: "/environments",
    },
    {
      title: "Need Attention",
      value: modulesNeedingAttention,
      icon: AlertCircle,
      loading: reportLoading,
      href: "/reports/comparison",
      highlight: modulesNeedingAttention > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Overview</h2>
        <p className="text-muted-foreground">Quick stats at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className={cn(stat.highlight && "border-yellow-300 bg-yellow-50/30")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.highlight ? "text-yellow-600" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <Link to={stat.href} className="block">
                  <div className={cn("text-3xl font-bold hover:underline", stat.highlight && "text-yellow-700")}>
                    {stat.value}
                  </div>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Sync activity will appear here</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link to="/environments">
                View Environments
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link to="/reports/comparison">
                View Comparison Report
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link to="/modules">
                Browse Modules
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
