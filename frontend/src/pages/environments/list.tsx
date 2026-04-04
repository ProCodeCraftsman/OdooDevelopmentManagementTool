import { Link } from "react-router-dom";
import { Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnvironments } from "@/hooks/useEnvironments";

export function EnvironmentsPage() {
  const { data: environments, isLoading } = useEnvironments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Environments</h2>
          <p className="text-muted-foreground">Manage your Odoo server environments</p>
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
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Order</span>
                    <span className="font-medium">{env.order}</span>
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
