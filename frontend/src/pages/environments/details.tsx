import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useEnvironment } from "@/hooks/useEnvironments";
import { SyncButton } from "@/components/sync/sync-button";
import { SyncStatus } from "@/components/sync/sync-status";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";

// Mock data for demonstration - will be replaced with API call
const mockModules = [
  { id: 1, technical_name: "base", module_name: "Base", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 2, technical_name: "account", module_name: "Accounting", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 3, technical_name: "sale", module_name: "Sales", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 4, technical_name: "purchase", module_name: "Purchase", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 5, technical_name: "inventory", module_name: "Inventory", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 6, technical_name: "mrp", module_name: "Manufacturing", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 7, technical_name: "project", module_name: "Project", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 8, technical_name: "hr", module_name: "Human Resources", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 9, technical_name: "crm", module_name: "CRM", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 10, technical_name: "website", module_name: "Website", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 11, technical_name: "point_of_sale", module_name: "Point of Sale", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 12, technical_name: "helpdesk", module_name: "Helpdesk", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 13, technical_name: "calendar", module_name: "Calendar", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 14, technical_name: "notes", module_name: "Notes", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 15, technical_name: "mail", module_name: "Email", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 16, technical_name: "l10n_generic_coa", module_name: "Generic Chart of Accounts", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
  { id: 17, technical_name: "stock_account", module_name: "Stock Accounting", installed_version: "17.0", dependency_versions: "{}", state: "installed" },
];

type ModuleRecord = typeof mockModules[0];

export function EnvironmentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { data: environment, isLoading, error } = useEnvironment(name || "");
  
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  const columns: ColumnDef<ModuleRecord>[] = useMemo(
    () => [
      {
        accessorKey: "technical_name",
        header: ({ column }: { column: { getIsSorted: () => "asc" | "desc" | false; getToggleSortingHandler: () => ((event: unknown) => void) | undefined } }) => (
          <DataTableColumnHeader column={column} title="Technical Name" />
        ),
        cell: ({ row }: { row: { getValue: (key: string) => unknown } }): React.ReactNode => (
          <div className="font-mono text-sm">{String(row.getValue("technical_name"))}</div>
        ),
      },
      {
        accessorKey: "module_name",
        header: ({ column }: { column: { getIsSorted: () => "asc" | "desc" | false; getToggleSortingHandler: () => ((event: unknown) => void) | undefined } }) => (
          <DataTableColumnHeader column={column} title="Module Name" />
        ),
        cell: ({ row }: { row: { getValue: (key: string) => unknown } }): React.ReactNode => (
          <span className="text-muted-foreground">
            {String(row.getValue("module_name") || "-")}
          </span>
        ),
      },
      {
        accessorKey: "installed_version",
        header: ({ column }: { column: { getIsSorted: () => "asc" | "desc" | false; getToggleSortingHandler: () => ((event: unknown) => void) | undefined } }) => (
          <DataTableColumnHeader column={column} title="Version" />
        ),
        cell: ({ row }: { row: { getValue: (key: string) => unknown } }): React.ReactNode => (
          <span className="font-mono text-xs">{String(row.getValue("installed_version") || "-")}</span>
        ),
      },
      {
        accessorKey: "dependency_versions",
        header: ({ column }: { column: { getIsSorted: () => "asc" | "desc" | false; getToggleSortingHandler: () => ((event: unknown) => void) | undefined } }) => (
          <DataTableColumnHeader column={column} title="Dependencies" />
        ),
        cell: ({ row }: { row: { getValue: (key: string) => unknown } }): React.ReactNode => {
          const value = row.getValue("dependency_versions");
          if (!value) return <span className="text-muted-foreground">-</span>;
          try {
            const deps = JSON.parse(value as string);
            const entries = Object.entries(deps);
            if (entries.length === 0) return <span className="text-muted-foreground">-</span>;
            return (
              <div className="flex flex-wrap gap-1">
                {entries.slice(0, 3).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs">
                    {k}: {String(v)}
                  </Badge>
                ))}
                {entries.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{entries.length - 3} more
                  </Badge>
                )}
              </div>
            );
          } catch {
            return <span className="text-muted-foreground">-</span>;
          }
        },
      },
      {
        accessorKey: "state",
        header: ({ column }: { column: { getIsSorted: () => "asc" | "desc" | false; getToggleSortingHandler: () => ((event: unknown) => void) | undefined } }) => (
          <DataTableColumnHeader column={column} title="State" />
        ),
        cell: ({ row }: { row: { getValue: (key: string) => unknown } }): React.ReactNode => {
          const state = row.getValue("state") as string;
          const variant = state === "installed" ? "default" : 
                         state === "uninstalled" ? "secondary" : 
                         "outline";
          return <Badge variant={variant}>{state}</Badge>;
        },
      },
    ],
    []
  );

  const filteredModules = mockModules;

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Installed Modules ({filteredModules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredModules}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPaginationChange={(pagination) => {
              setPageIndex(pagination.pageIndex);
              setPageSize(pagination.pageSize);
            }}
            searchable={false}
            searchValue=""
            onSearchChange={() => {}}
            groupable={true}
            groupBy=""
            onGroupByChange={() => {}}
            loading={false}
            pageCount={Math.ceil(filteredModules.length / pageSize)}
          />
        </CardContent>
      </Card>
    </div>
  );
}