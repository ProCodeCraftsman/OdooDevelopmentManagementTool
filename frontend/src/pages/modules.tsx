import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useComparisonReport } from "@/hooks/useReports";
import { useState } from "react";
import { Search, SearchX, X } from "lucide-react";

export function ModulesPage() {
  const { data: report, isLoading } = useComparisonReport();
  const [search, setSearch] = useState("");

  const filteredRows = report?.rows.filter(
    (row) =>
      row.technical_name.toLowerCase().includes(search.toLowerCase()) ||
      row.module_name?.toLowerCase().includes(search.toLowerCase())
  );

  const hasSearch = search.trim().length > 0;
  const isEmpty = filteredRows?.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Module Master</h2>
        <p className="text-muted-foreground">Browse all tracked modules</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search modules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {hasSearch && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Modules ({filteredRows?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center p-8">
              {hasSearch ? (
                <>
                  <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No modules found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    No modules match your search "{search}".
                  </p>
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No modules</h3>
                  <p className="text-muted-foreground text-center">
                    No modules have been synced yet.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[500px]">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Technical Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows?.map((row) => (
                    <tr key={row.technical_name} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-mono">{row.technical_name}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">{row.module_name || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                        {row.module_name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">Installed</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
