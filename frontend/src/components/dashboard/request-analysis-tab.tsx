import { useState } from "react";
import { Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { RadarChartView } from "@/components/dashboard/radar-chart";
import { useRequestAnalysis } from "@/hooks/useDashboard";
import type { FunctionalCategoryItem } from "@/api/dashboard";

function CategoryFilter({
  categories,
  selectedIds,
  onChange,
}: {
  categories: FunctionalCategoryItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const categoryNames = categories.map((c) => c.name);

  const selectedNames = categories
    .filter((c) => selectedIds.includes(c.id))
    .map((c) => c.name);

  function handleNamesChange(names: string[]) {
    const ids = categories
      .filter((c) => names.includes(c.name))
      .map((c) => c.id);
    onChange(ids);
  }

  return (
    <SearchableMultiSelect
      options={categoryNames}
      selected={selectedNames}
      onChange={handleNamesChange}
      allLabel="All Categories"
      searchPlaceholder="Search categories..."
      triggerWidth="w-[180px]"
    />
  );
}

function SkeletonCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">By Macro State</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-sm text-muted-foreground">No development requests found</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">By Priority</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-sm text-muted-foreground">No development requests found</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function RequestAnalysisTab() {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[] | null>(null);

  const { data, isLoading, isError } = useRequestAnalysis(
    selectedCategoryIds ?? undefined
  );

  const effectiveSelectedCategoryIds = selectedCategoryIds ?? data?.functional_categories.map((c) => c.id) ?? [];

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Failed to load request analysis data. Please check the server and refresh.
        </CardContent>
      </Card>
    );
  }

  const macroStateChart = data?.macro_state_chart ?? [];
  const priorityChart = data?.priority_chart ?? [];
  const hasMacroStateData = macroStateChart.some((s) => s.data.some((p) => p.value > 0));
  const hasPriorityData = priorityChart.some((s) => s.data.some((p) => p.value > 0));
  const hasData = hasMacroStateData || hasPriorityData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Request Distribution</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Development requests across functional categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {data && (
            <CategoryFilter
              categories={data.functional_categories}
              selectedIds={effectiveSelectedCategoryIds}
              onChange={setSelectedCategoryIds}
            />
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonCharts />
      ) : !data || !hasData ? (
        <EmptyCharts />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">By Macro State</CardTitle>
                <div className="flex gap-1.5 ml-auto">
                  {macroStateChart.slice(0, 4).map((series) => (
                    <Badge
                      key={series.name}
                      variant="outline"
                      className="text-[10px] h-5 gap-1"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: series.color }}
                      />
                      {series.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <RadarChartView
                data={macroStateChart}
                title="Requests by Macro State"
                height={300}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">By Priority</CardTitle>
                <div className="flex gap-1.5 ml-auto">
                  {priorityChart.slice(0, 4).map((series) => (
                    <Badge
                      key={series.name}
                      variant="outline"
                      className="text-[10px] h-5 gap-1"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: series.color }}
                      />
                      {series.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <RadarChartView
                data={priorityChart}
                title="Requests by Priority"
                height={300}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
