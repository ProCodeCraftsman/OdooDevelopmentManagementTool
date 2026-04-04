import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useEnvironment } from "@/hooks/useEnvironments";
import { SyncButton } from "@/components/sync/sync-button";
import { SyncStatus } from "@/components/sync/sync-status";

export function EnvironmentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { data: environment, isLoading, error } = useEnvironment(name || "");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !environment) {
    return (
      <div className="space-y-6">
        <Link to="/environments">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Environments
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">Environment not found</p>
            <p className="text-muted-foreground">The requested environment does not exist</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/environments">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold truncate">{environment.name}</h2>
            <p className="text-muted-foreground text-sm truncate">{environment.url}</p>
          </div>
        </div>
        <Badge variant={environment.is_active ? "default" : "secondary"} className="shrink-0">
          {environment.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Environment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Database</p>
                <p className="font-medium text-sm truncate">{environment.db_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">User</p>
                <p className="font-medium text-sm truncate">{environment.user}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium text-sm">{environment.category}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Order</p>
                <p className="font-medium text-sm">{environment.order}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sync Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SyncStatus environmentName={environment.name} />
            <SyncButton environmentName={environment.name} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
