import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ArrowUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { FilterControls, FilterState } from "./filter-controls";

type SortKey = "developer" | "open" | "in_progress" | "closed" | "total";
type SortDirection = "asc" | "desc";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SkeletonTable() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Developer</TableHead>
              <TableHead className="text-center">Draft</TableHead>
              <TableHead className="text-center">In Progress</TableHead>
              <TableHead className="text-center">Done</TableHead>
              <TableHead className="text-center pr-6">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-6 w-8" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-6 w-8" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-6 w-8" /></TableCell>
                <TableCell className="text-center pr-6"><Skeleton className="h-6 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SortableTableHead({
  label,
  sortKey,
  currentSort,
  onSort,
  align = "text-left",
}: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
  align?: string;
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead
      className={`${align} cursor-pointer select-none hover:bg-muted/50`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === "text-center" ? "justify-center" : ""}`}>
        {label}
        {isActive && (
          <ArrowUp
            className={`h-3 w-3 ${currentSort.direction === "desc" ? "rotate-180" : ""}`}
          />
        )}
      </div>
    </TableHead>
  );
}

export function DetailedTab() {
  const { data, isLoading, isError } = useDashboardSummary();
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "developer",
    direction: "asc",
  });
  const [filters, setFilters] = useState<FilterState>({
    developer: "",
    state: "",
    category: "",
  });

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const developers = useMemo(() => {
    if (!data?.workload_matrix) return [];
    return data.workload_matrix.map((row) => row.developer);
  }, [data?.workload_matrix]);

  const filteredAndSortedData = useMemo(() => {
    if (!data?.workload_matrix) return [];

    let result = [...data.workload_matrix];

    if (filters.developer && filters.developer !== "__all__") {
      result = result.filter((row) => row.developer === filters.developer);
    }

    result.sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      const cmp =
        typeof aVal === "string"
          ? aVal.localeCompare(bVal as string)
          : (aVal as number) - (bVal as number);
      return sort.direction === "asc" ? cmp : -cmp;
    });

    return result;
  }, [data?.workload_matrix, sort, filters]);

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Failed to load dashboard data. Please check the server and refresh.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Developer Workload Matrix</h3>
        <FilterControls
          developers={developers}
          onFilterChange={handleFilterChange}
        />

        {isLoading ? (
          <div className="mt-4">
            <SkeletonTable />
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        label="Developer"
                        sortKey="developer"
                        currentSort={sort}
                        onSort={handleSort}
                      />
                      <SortableTableHead
                        label="Draft"
                        sortKey="open"
                        currentSort={sort}
                        onSort={handleSort}
                        align="text-center"
                      />
                      <SortableTableHead
                        label="In Progress"
                        sortKey="in_progress"
                        currentSort={sort}
                        onSort={handleSort}
                        align="text-center"
                      />
                      <SortableTableHead
                        label="Done"
                        sortKey="closed"
                        currentSort={sort}
                        onSort={handleSort}
                        align="text-center"
                      />
                      <SortableTableHead
                        label="Total"
                        sortKey="total"
                        currentSort={sort}
                        onSort={handleSort}
                        align="text-center"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No development requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedData.map((row) => (
                        <TableRow key={row.developer}>
                          <TableCell className="pl-6 font-medium">
                            {row.developer === "Unassigned" ? (
                              <span className="text-muted-foreground italic">
                                {row.developer}
                              </span>
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
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Upcoming Deployments</h3>
        <Card>
          <CardContent className="p-0">
            {data?.upcoming_deployments.length === 0 ? (
              <p className="text-muted-foreground text-sm px-6 py-4">
                No upcoming deployments scheduled.
              </p>
            ) : (
              <ul className="divide-y">
                {data?.upcoming_deployments.map((plan) => (
                  <li
                    key={plan.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors"
                  >
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
      </div>
    </div>
  );
}