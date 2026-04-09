import { SpiderChart, type SpiderChartSeries, type SpiderChartTooltipPayload } from "@/components/ui/spider-chart";
import type { RadarChartData, PriorityBreakdownItem } from "@/api/dashboard";

interface RadarChartViewProps {
  data: RadarChartData[];
  title: string;
  height?: number;
}

function CustomTooltip({ active, payload }: SpiderChartTooltipPayload) {
  if (!active || !payload?.length) return null;

  const data = payload[0];
  if (!data?.payload) return null;

  const axis = data.payload.axis as string | undefined;
  const priority_breakdown = data.payload.metadata?.priority_breakdown as PriorityBreakdownItem[] | undefined;
  const total = data.value ?? 0;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm text-sm min-w-[140px]">
      <p className="font-semibold mb-2">{axis}</p>
      <p className="text-muted-foreground mb-2">
        Total: <span className="font-medium text-foreground">{total}</span>
      </p>
      {priority_breakdown && priority_breakdown.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground border-t pt-2 mt-2">By Priority:</p>
          {priority_breakdown.map((item: PriorityBreakdownItem) => (
            <div key={item.name} className="flex justify-between gap-4 text-xs">
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RadarChartView({ data, title, height = 300 }: RadarChartViewProps) {
  const chartData: SpiderChartSeries[] = data.map((series) => ({
    name: series.name,
    color: series.color,
    data: series.data.map((point) => ({
      axis: point.category,
      value: point.value,
      metadata: { priority_breakdown: point.priority_breakdown },
    })),
  }));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground text-center">{title}</h4>
      <SpiderChart
        data={chartData}
        height={height}
        customTooltip={CustomTooltip}
      />
    </div>
  );
}
