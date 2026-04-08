import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import type { PaginationInfo } from "@/components/ui/data-table";
import type { PaginationState } from "@tanstack/react-table";
import { useReleasePlans, useReleasePlanStates } from "@/hooks/useReleasePlans";
import type { ReleasePlanFilters, ReleasePlan } from "@/api/release-plans";
import type { ColumnDef } from "@tanstack/react-table";

const MACRO_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  Planned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Approved: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  Executing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  Closed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function MacroBadge({ category, name }: { category: string; name: string }) {
  const color = MACRO_COLORS[category] ?? "bg-gray-100 text-gray-800";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {name}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const PAGE_SIZE = 20;

export function ReleasePlansListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ReleasePlanFilters>({});
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useReleasePlans(filters, page, PAGE_SIZE);
  const { data: states } = useReleasePlanStates();

  const handleFilterChange = (key: keyof ReleasePlanFilters, value: string) => {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      [key]: value && value !== "all" ? parseInt(value) : undefined,
    }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({});
  };

  const hasActiveFilters = !!(filters.state_id);

  const columns: ColumnDef<ReleasePlan>[] = [
    {
      accessorKey: "plan_number",
      header: "Plan No.",
      cell: ({ row }) => (
        <span className="font-mono font-medium text-sm">{row.original.plan_number}</span>
      ),
    },
    {
      accessorKey: "release_version",
      header: "Version",
      cell: ({ row }) => <span className="font-medium">{row.original.release_version}</span>,
    },
    {
      id: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.source_environment?.name ?? "—"}</span>
      ),
    },
    {
      id: "target",
      header: "Target",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.target_environment?.name ?? "—"}</span>
      ),
    },
    {
      id: "state",
      header: "State",
      cell: ({ row }) => (
        <MacroBadge
          category={row.original.state?.category}
          name={row.original.state?.name}
        />
      ),
    },
    {
      accessorKey: "planned_deployment_date",
      header: "Planned Date",
      cell: ({ row }) =>
        row.original.planned_deployment_date
          ? formatDate(row.original.planned_deployment_date)
          : <span className="text-muted-foreground text-xs">Not set</span>,
    },
    {
      id: "lines",
      header: "Lines",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.lines?.length ?? 0}</Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => formatDate(row.original.created_at),
    },
  ];

  const pagination: PaginationInfo | undefined = data
    ? {
        total_records: data.total,
        total_pages: data.pages,
        current_page: data.page,
        limit: PAGE_SIZE,
      }
    : undefined;

  const filterBar = (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filters.state_id?.toString() ?? "all"}
        onValueChange={(v) => handleFilterChange("state_id", v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All states" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All states</SelectItem>
          {states?.map((s) => (
            <SelectItem key={s.id} value={s.id.toString()}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}

      <div className="ml-auto">
        <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ServerOff className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Failed to load release plans.</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Release Plans</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage and track Odoo module deployment plans
          </p>
        </div>
        <Button onClick={() => navigate("/release-plans/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Plan
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        searchable={false}
        filterBar={filterBar}
        onRowClick={(row) => navigate(`/release-plans/${row.id}`)}
        pagination={pagination}
        pageIndex={page - 1}
        pageSize={PAGE_SIZE}
        pageCount={data?.pages ?? 0}
        onPaginationChange={({ pageIndex }: PaginationState) => setPage(pageIndex + 1)}
      />
    </div>
  );
}
