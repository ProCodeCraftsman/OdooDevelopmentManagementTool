import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Archive, SearchX, RefreshCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  useDevelopmentRequests,
  useControlParameters,
} from "@/hooks/useDevelopmentRequests";
import type { DevelopmentRequestFilters } from "@/api/development-requests";
import { useAuthStore } from "@/store/auth-store";

function getStateBadgeVariant(category: string): "default" | "secondary" | "destructive" | "outline" | "success" {
  switch (category?.toLowerCase()) {
    case "open":
      return "default";
    case "in_progress":
      return "secondary";
    case "closed":
      return "success";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

function getPriorityColor(level: number): string {
  if (level >= 4) return "bg-red-100 text-red-800";
  if (level >= 3) return "bg-orange-100 text-orange-800";
  if (level >= 2) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-800";
}

const PAGE_SIZE = 20;

export function DevelopmentRequestsListPage() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((state) => state.user?.is_admin);

  const [filters, setFilters] = useState<DevelopmentRequestFilters>({});
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  const effectiveFilters: DevelopmentRequestFilters = {
    ...filters,
    is_archived: showArchived ? undefined : false,
  };

  const { data, isLoading, error, refetch } = useDevelopmentRequests(effectiveFilters, page, PAGE_SIZE);
  const { data: controlParams } = useControlParameters();

  const handleFilterChange = (key: keyof DevelopmentRequestFilters, value: string) => {
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

  const hasActiveFilters = filters.request_type_id || filters.request_state_id || filters.priority_id || filters.functional_category_id;
  const isNetworkError = error && (error as Error).message === "Network Error";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Development Requests</h1>
        {isAdmin && (
          <Button onClick={() => navigate("/development-requests/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select
              value={filters.request_type_id?.toString() || "all"}
              onValueChange={(v) => handleFilterChange("request_type_id", v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Request Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {controlParams?.request_types.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.request_state_id?.toString() || "all"}
              onValueChange={(v) => handleFilterChange("request_state_id", v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {controlParams?.request_states.map((state) => (
                  <SelectItem key={state.id} value={state.id.toString()}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.priority_id?.toString() || "all"}
              onValueChange={(v) => handleFilterChange("priority_id", v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {controlParams?.priorities.map((priority) => (
                  <SelectItem key={priority.id} value={priority.id.toString()}>
                    {priority.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.functional_category_id?.toString() || "all"}
              onValueChange={(v) => handleFilterChange("functional_category_id", v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {controlParams?.functional_categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={(checked) => {
                  setShowArchived(checked);
                  setPage(1);
                }}
              />
              <label htmlFor="show-archived" className="text-sm cursor-pointer flex items-center gap-1">
                <Archive className="h-4 w-4" />
                Include Archived
              </label>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isNetworkError ? (
            <div className="flex flex-col items-center justify-center p-12">
              <ServerOff className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Cannot connect to server</h3>
              <p className="text-muted-foreground text-center mb-4">
                Unable to reach the API server. Please check your connection and try again.
              </p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-12">
              <ServerOff className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error loading requests</h3>
              <p className="text-muted-foreground text-center mb-4">
                {(error as Error).message}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12">
              {hasActiveFilters ? (
                <>
                  <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No requests found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    No requests match your current filters. Try adjusting your search criteria.
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <Archive className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No development requests</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Get started by creating your first development request.
                  </p>
                  {isAdmin && (
                    <Button onClick={() => navigate("/development-requests/new")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Request
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Request Type</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((request) => (
                    <TableRow
                      key={request.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/development-requests/${request.id}`)}
                    >
                      <TableCell className="font-medium">{request.request_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.request_type?.name || "Unknown"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStateBadgeVariant(request.request_state?.category)}>
                          {request.request_state?.name || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(request.priority?.level || 1)}>
                          {request.priority?.name || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>{request.functional_category?.name || "Unknown"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {request.description}
                      </TableCell>
                      <TableCell>
                        {request.assigned_developer?.username || "-"}
                      </TableCell>
                      <TableCell>
                        {request.request_date
                          ? new Date(request.request_date).toLocaleDateString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={data?.total || 0}
                pages={data?.pages || 0}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
