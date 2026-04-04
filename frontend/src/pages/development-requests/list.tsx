import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Archive } from "lucide-react";
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

function getStateColor(category: string): string {
  switch (category?.toLowerCase()) {
    case "open":
      return "bg-blue-100 text-blue-800";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800";
    case "closed":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
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

  const { data, isLoading, error } = useDevelopmentRequests(effectiveFilters, page, PAGE_SIZE);
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

            {(filters.request_type_id ||
              filters.request_state_id ||
              filters.priority_id ||
              filters.functional_category_id) && (
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
          ) : error ? (
            <div className="p-6 text-center text-red-500">
              Error loading requests: {(error as Error).message}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No development requests found.</p>
              {isAdmin && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/development-requests/new")}
                >
                  Create your first request
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
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
                        <Badge className={getStateColor(request.request_state?.category)}>
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
