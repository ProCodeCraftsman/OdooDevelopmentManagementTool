import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, List, GitBranch, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import {
  useEnvironment,
  useEnvironments,
  useEnvironmentModules,
  useModuleDependencies,
  useEnvironmentFilterOptions,
} from "@/hooks/useEnvironments";
import { environmentsApi } from "@/api/environments";
import { SyncButton } from "@/components/sync/sync-button";
import { SyncStatus } from "@/components/sync/sync-status";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import type { EnvironmentModuleRecord, ModuleDependencyRecord, PaginationInfo } from "@/types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function joinFilter(values: string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined;
}

function StateBadge({ state }: { state: string | null | undefined }) {
  if (!state) return <span className="text-muted-foreground">-</span>;
  const variant =
    state === "installed"
      ? "default"
      : state === "uninstalled"
      ? "secondary"
      : state === "to upgrade"
      ? "outline"
      : "destructive";
  return <Badge variant={variant}>{state}</Badge>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function EnvironmentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  const { data: environment, isLoading: envLoading, error } = useEnvironment(name || "");
  const { data: allEnvironments } = useEnvironments();
  const { data: filterOptions } = useEnvironmentFilterOptions(name || "");

  // ── Modules tab state ──────────────────────────────────────────────────
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [modTechNames, setModTechNames] = useState<string[]>([]);
  const [modVersions, setModVersions] = useState<string[]>([]);
  const [modStates, setModStates] = useState<string[]>([]);

  // ── Dependencies tab state ─────────────────────────────────────────────
  const [depPageIndex, setDepPageIndex] = useState(0);
  const [depPageSize, setDepPageSize] = useState(10);
  const [depSorting, setDepSorting] = useState<SortingState>([]);
  const [depSearch, setDepSearch] = useState("");
  const [depModuleNames, setDepModuleNames] = useState<string[]>([]);
  const [depModuleVersions, setDepModuleVersions] = useState<string[]>([]);
  const [depModuleStates, setDepModuleStates] = useState<string[]>([]);
  const [depDepNames, setDepDepNames] = useState<string[]>([]);
  const [depDepVersions, setDepDepVersions] = useState<string[]>([]);
  const [depDepStates, setDepDepStates] = useState<string[]>([]);

  // ── Sort derivation ────────────────────────────────────────────────────
  const sortBy = sorting[0]?.id || "technical_name";
  const sortOrder = sorting[0]?.desc ? "desc" : "asc";
  const depSortBy = depSorting[0]?.id || "dependency_name";
  const depSortOrder = depSorting[0]?.desc ? "desc" : "asc";

  // ── Module query ───────────────────────────────────────────────────────
  const moduleParams = {
    page: pageIndex + 1,
    limit: pageSize,
    sort_by: sortBy,
    sort_order: sortOrder as "asc" | "desc",
    search: search || undefined,
    state: joinFilter(modStates),
    technical_names: joinFilter(modTechNames),
    versions: joinFilter(modVersions),
  };

  const { data: modulesData, isLoading: modulesLoading } = useEnvironmentModules(name || "", moduleParams);

  // ── Dependencies query ─────────────────────────────────────────────────
  const depParams = {
    page: depPageIndex + 1,
    limit: depPageSize,
    sort_by: depSortBy,
    sort_order: depSortOrder as "asc" | "desc",
    search: depSearch || undefined,
    dependency_state: joinFilter(depDepStates),
    module_names: joinFilter(depModuleNames),
    module_versions: joinFilter(depModuleVersions),
    module_states: joinFilter(depModuleStates),
    dep_names: joinFilter(depDepNames),
    dep_versions: joinFilter(depDepVersions),
  };

  const { data: depsData, isLoading: depsLoading } = useModuleDependencies(name || "", depParams);

  // ── Pagination objects ─────────────────────────────────────────────────
  const pagination: PaginationInfo | undefined = modulesData?.pagination
    ? { ...modulesData.pagination }
    : undefined;

  const depPagination: PaginationInfo | undefined = depsData?.pagination
    ? { ...depsData.pagination }
    : undefined;

  const pageCount = pagination?.total_pages ?? -1;
  const depPageCount = depPagination?.total_pages ?? -1;

  // ── Environment navigation ─────────────────────────────────────────────
  const currentEnvIndex = useMemo(() => {
    if (!allEnvironments || !name) return -1;
    return allEnvironments.findIndex((e) => e.name === name);
  }, [allEnvironments, name]);

  const prevEnv = currentEnvIndex > 0 ? allEnvironments?.[currentEnvIndex - 1] : null;
  const nextEnv =
    currentEnvIndex >= 0 && currentEnvIndex < (allEnvironments?.length ?? 0) - 1
      ? allEnvironments?.[currentEnvIndex + 1]
      : null;

  // ── Export handlers ────────────────────────────────────────────────────
  const [exportingModules, setExportingModules] = useState(false);
  const [exportingDeps, setExportingDeps] = useState(false);

  async function handleExportModules() {
    if (!name) return;
    setExportingModules(true);
    try {
      await environmentsApi.exportModulesXlsx(name, {
        search: search || undefined,
        state: joinFilter(modStates),
        technical_names: joinFilter(modTechNames),
        versions: joinFilter(modVersions),
        sort_by: sortBy,
        sort_order: sortOrder as "asc" | "desc",
      });
      toast.success("Modules exported successfully");
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingModules(false);
    }
  }

  async function handleExportDeps() {
    if (!name) return;
    setExportingDeps(true);
    try {
      await environmentsApi.exportDependenciesXlsx(name, {
        search: depSearch || undefined,
        dependency_state: joinFilter(depDepStates),
        module_names: joinFilter(depModuleNames),
        module_versions: joinFilter(depModuleVersions),
        module_states: joinFilter(depModuleStates),
        dep_names: joinFilter(depDepNames),
        dep_versions: joinFilter(depDepVersions),
        sort_by: depSortBy,
        sort_order: depSortOrder as "asc" | "desc",
      });
      toast.success("Dependencies exported successfully");
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingDeps(false);
    }
  }

  // ── Column definitions ─────────────────────────────────────────────────
  const columns: ColumnDef<EnvironmentModuleRecord>[] = useMemo(
    () => [
      {
        accessorKey: "technical_name",
        id: "technical_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Technical Name" />,
        cell: ({ row }) => (
          <div className="font-mono text-sm">{row.original.technical_name || "-"}</div>
        ),
      },
      {
        accessorKey: "module_name",
        id: "module_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Module Name" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.module_name || "-"}</span>
        ),
      },
      {
        accessorKey: "installed_version",
        id: "installed_version",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Version" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.installed_version || "-"}</span>
        ),
      },
      {
        accessorKey: "state",
        id: "state",
        header: ({ column }) => <DataTableColumnHeader column={column} title="State" />,
        cell: ({ row }) => <StateBadge state={row.original.state} />,
      },
    ],
    []
  );

  const depColumns: ColumnDef<ModuleDependencyRecord>[] = useMemo(
    () => [
      {
        accessorKey: "module_technical_name",
        id: "module_technical_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Module" />,
        cell: ({ row }) => (
          <div className="font-mono text-sm">{row.original.module_technical_name || "-"}</div>
        ),
      },
      {
        accessorKey: "module_version",
        id: "module_version",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Version" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.module_version || "-"}</span>
        ),
      },
      {
        accessorKey: "module_state",
        id: "module_state",
        header: ({ column }) => <DataTableColumnHeader column={column} title="State" />,
        cell: ({ row }) => <StateBadge state={row.original.module_state} />,
      },
      {
        accessorKey: "dependency_name",
        id: "dependency_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dependency Module" />,
        cell: ({ row }) => (
          <div className="font-mono text-sm">{row.original.dependency_name || "-"}</div>
        ),
      },
      {
        accessorKey: "dependency_version",
        id: "dependency_version",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dep Version" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.dependency_version || "-"}</span>
        ),
      },
      {
        accessorKey: "dependency_state",
        id: "dependency_state",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dep State" />,
        cell: ({ row }) => <StateBadge state={row.original.dependency_state} />,
      },
    ],
    []
  );

  // ── Date formatting ────────────────────────────────────────────────────
  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const utcStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
    const d = new Date(utcStr);
    const datePart = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
    const timePart = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
    return `${datePart} ${timePart}`;
  };

  // ── Loading / error states ─────────────────────────────────────────────
  if (envLoading) {
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

  const envListEntry = allEnvironments?.find((e) => e.name === name);
  const lastSyncDisplay = formatDateTime(envListEntry?.last_sync);

  // ── Options arrays from filterOptions ─────────────────────────────────
  const moduleNames = filterOptions?.module_names ?? [];
  const moduleVersions = filterOptions?.module_versions ?? [];
  const moduleStates = filterOptions?.module_states ?? [];
  const depNames = filterOptions?.dep_names ?? [];
  const depVersions = filterOptions?.dep_versions ?? [];
  const depStates = filterOptions?.dep_states ?? [];

  // ── Render ─────────────────────────────────────────────────────────────
  const envCount = allEnvironments?.length ?? 0;
  const currentEnvPos = currentEnvIndex >= 0 ? currentEnvIndex + 1 : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Breadcrumb + Prev/Next Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/environments" className="hover:text-foreground transition-colors">
            Environments
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{environment.name}</span>
        </div>
        {envCount > 0 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!prevEnv}
              onClick={() => prevEnv && navigate(`/environments/${prevEnv.name}`)}
              className="h-7 px-2"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />Prev
            </Button>
            <span className="text-xs text-muted-foreground px-1">
              {currentEnvPos} / {envCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!nextEnv}
              onClick={() => nextEnv && navigate(`/environments/${nextEnv.name}`)}
              className="h-7 px-2"
            >
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Title + Status Badge */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold truncate">{environment.name}</h2>
          <p className="text-muted-foreground text-sm truncate">{environment.url}</p>
        </div>
        <Badge variant={environment.is_active ? "default" : "secondary"} className="shrink-0">
          {environment.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Info cards */}
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
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium text-sm">{environment.category}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Order</p>
                <p className="font-medium text-sm">{environment.order}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Sync</p>
                <p className="font-medium text-sm">{lastSyncDisplay ?? "Never synced"}</p>
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

      {/* Modules / Dependencies tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="modules" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="modules" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Installed Modules ({modulesData?.pagination.total_records ?? 0})
              </TabsTrigger>
              <TabsTrigger value="dependencies" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Dependencies ({depsData?.pagination.total_records ?? 0})
              </TabsTrigger>
            </TabsList>

            {/* ── Installed Modules tab ── */}
            <TabsContent value="modules">
              <DataTable
                columns={columns}
                data={modulesData?.data ?? []}
                pagination={pagination}
                pageIndex={pageIndex}
                pageSize={pageSize}
                pageCount={pageCount}
                onPaginationChange={(p) => {
                  setPageIndex(p.pageIndex);
                  setPageSize(p.pageSize);
                }}
                onSortingChange={setSorting}
                searchable={true}
                searchPlaceholder="Search modules..."
                onSearchChange={(v) => { setSearch(v); setPageIndex(0); }}
                searchValue={search}
                loading={modulesLoading}
                filterBar={
                  <div className="flex flex-wrap items-center gap-2">
                    <SearchableMultiSelect
                      options={moduleNames}
                      selected={modTechNames}
                      onChange={(v) => { setModTechNames(v); setPageIndex(0); }}
                      allLabel="Technical Name"
                      searchPlaceholder="Search names..."
                      triggerWidth="w-[170px]"
                    />
                    <SearchableMultiSelect
                      options={moduleVersions}
                      selected={modVersions}
                      onChange={(v) => { setModVersions(v); setPageIndex(0); }}
                      allLabel="Version"
                      searchPlaceholder="Search versions..."
                      triggerWidth="w-[150px]"
                    />
                    <SearchableMultiSelect
                      options={moduleStates}
                      selected={modStates}
                      onChange={(v) => { setModStates(v); setPageIndex(0); }}
                      allLabel="State"
                      searchPlaceholder="Search states..."
                      triggerWidth="w-[130px]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={handleExportModules}
                      disabled={exportingModules || !modulesData?.pagination.total_records}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                }
              />
            </TabsContent>

            {/* ── Dependencies tab ── */}
            <TabsContent value="dependencies">
              <DataTable
                columns={depColumns}
                data={depsData?.data ?? []}
                pagination={depPagination}
                pageIndex={depPageIndex}
                pageSize={depPageSize}
                pageCount={depPageCount}
                onPaginationChange={(p) => {
                  setDepPageIndex(p.pageIndex);
                  setDepPageSize(p.pageSize);
                }}
                onSortingChange={setDepSorting}
                searchable={true}
                searchPlaceholder="Search dependencies..."
                onSearchChange={(v) => { setDepSearch(v); setDepPageIndex(0); }}
                searchValue={depSearch}
                loading={depsLoading}
                filterBar={
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Module-side filters */}
                    <SearchableMultiSelect
                      options={moduleNames}
                      selected={depModuleNames}
                      onChange={(v) => { setDepModuleNames(v); setDepPageIndex(0); }}
                      allLabel="Module"
                      searchPlaceholder="Search modules..."
                      triggerWidth="w-[150px]"
                    />
                    <SearchableMultiSelect
                      options={moduleVersions}
                      selected={depModuleVersions}
                      onChange={(v) => { setDepModuleVersions(v); setDepPageIndex(0); }}
                      allLabel="Module Version"
                      searchPlaceholder="Search versions..."
                      triggerWidth="w-[155px]"
                    />
                    <SearchableMultiSelect
                      options={moduleStates}
                      selected={depModuleStates}
                      onChange={(v) => { setDepModuleStates(v); setDepPageIndex(0); }}
                      allLabel="Module State"
                      searchPlaceholder="Search states..."
                      triggerWidth="w-[140px]"
                    />
                    {/* Dependency-side filters */}
                    <SearchableMultiSelect
                      options={depNames}
                      selected={depDepNames}
                      onChange={(v) => { setDepDepNames(v); setDepPageIndex(0); }}
                      allLabel="Dependency"
                      searchPlaceholder="Search deps..."
                      triggerWidth="w-[145px]"
                    />
                    <SearchableMultiSelect
                      options={depVersions}
                      selected={depDepVersions}
                      onChange={(v) => { setDepDepVersions(v); setDepPageIndex(0); }}
                      allLabel="Dep Version"
                      searchPlaceholder="Search versions..."
                      triggerWidth="w-[140px]"
                    />
                    <SearchableMultiSelect
                      options={depStates}
                      selected={depDepStates}
                      onChange={(v) => { setDepDepStates(v); setDepPageIndex(0); }}
                      allLabel="Dep State"
                      searchPlaceholder="Search states..."
                      triggerWidth="w-[130px]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={handleExportDeps}
                      disabled={exportingDeps || !depsData?.pagination.total_records}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </div>
                }
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
