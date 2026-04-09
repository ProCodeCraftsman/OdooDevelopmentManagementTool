import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

export interface SpiderChartSeries {
  name: string;
  color: string;
  data: SpiderChartDataPoint[];
}

export interface SpiderChartDataPoint {
  axis: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface SpiderChartProps {
  data: SpiderChartSeries[];
  height?: number;
  className?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  showAxisLabels?: boolean;
  axisLabelFontSize?: number;
  valueLabelFontSize?: number;
  fillOpacity?: number;
  strokeWidth?: number;
  dotRadius?: number;
  autoScale?: boolean;
  scaleMax?: number;
  tickCount?: number;
  outerRadiusPercent?: number;
  customTooltip?: (props: SpiderChartTooltipPayload) => React.ReactNode;
}

export interface SpiderChartTooltipPayload {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number;
    color?: string;
    payload?: {
      axis?: string;
      metadata?: Record<string, unknown>;
    };
  }[];
}

function DefaultTooltip({ active, payload }: SpiderChartTooltipPayload) {
  if (!active || !payload?.length) return null;

  const data = payload[0];
  if (!data?.payload) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm text-sm">
      <p className="font-semibold">{data.payload?.axis}</p>
      <p className="text-muted-foreground mt-1">
        <span
          className="inline-block w-2 h-2 rounded-full mr-2"
          style={{ backgroundColor: data.color }}
        />
        <span className="font-medium text-foreground">{data.value}</span>
      </p>
    </div>
  );
}

export function getNiceScale(
  maxValue: number,
  tickCount: number = 5
): { domainMax: number; ticks: number[] } {
  if (maxValue <= 0) {
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i);
    return { domainMax: tickCount, ticks };
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const normalized = maxValue / magnitude;

  let niceMax: number;
  if (normalized <= 1) niceMax = magnitude;
  else if (normalized <= 2) niceMax = 2 * magnitude;
  else if (normalized <= 5) niceMax = 5 * magnitude;
  else niceMax = 10 * magnitude;

  const step = niceMax / tickCount;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(Math.round(i * step * 100) / 100);
  }

  return { domainMax: niceMax, ticks };
}

export function SpiderChart({
  data,
  height = 300,
  className,
  showLegend = true,
  showGrid = true,
  showAxisLabels = true,
  axisLabelFontSize = 11,
  valueLabelFontSize = 10,
  fillOpacity = 0.15,
  strokeWidth = 2,
  dotRadius = 3,
  autoScale = true,
  scaleMax,
  tickCount = 5,
  outerRadiusPercent = 75,
  customTooltip,
}: SpiderChartProps) {
  if (!data.length || !data[0]?.data.length) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const axes = data[0].data.map((point) => point.axis);

  const formattedData = axes.map((axis) => {
    const result: Record<string, string | number> = { axis };
    data.forEach((series) => {
      const seriesPoint = series.data.find((p) => p.axis === axis);
      result[series.name] = seriesPoint?.value ?? 0;
    });
    return result;
  });

  const maxValue = scaleMax ?? Math.max(
    ...data.flatMap((s) => s.data.map((p) => p.value)),
    1
  );

  const { domainMax, ticks } = autoScale ? getNiceScale(maxValue, tickCount) : { domainMax: maxValue, ticks: [0, maxValue] };

  const TooltipComponent = customTooltip ?? DefaultTooltip;

  return (
    <div className={cn("space-y-2", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius={`${outerRadiusPercent}%`} data={formattedData}>
          {showGrid && <PolarGrid stroke="hsl(var(--muted))" />}
          
          <PolarAngleAxis
            dataKey="axis"
            tick={
              showAxisLabels
                ? { fontSize: axisLabelFontSize, fill: "hsl(var(--foreground))" }
                : false
            }
            tickLine={false}
          />
          
          <PolarRadiusAxis
            angle={90}
            domain={[0, domainMax]}
            ticks={ticks}
            tick={{ fontSize: valueLabelFontSize, fill: "hsl(var(--muted-foreground))" }}
            tickCount={tickCount + 1}
            allowDecimals={false}
            axisLine={false}
          />
          
          <Tooltip content={<TooltipComponent />} />
          
          {data.map((series) => (
            <Radar
              key={series.name}
              name={series.name}
              dataKey={series.name}
              stroke={series.color}
              fill={series.color}
              fillOpacity={fillOpacity}
              strokeWidth={strokeWidth}
              dot={{ r: dotRadius, fill: series.color, strokeWidth: 0 }}
            />
          ))}
          
          {showLegend && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            />
          )}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function getDefaultColors(count: number): string[] {
  const defaultPalette = [
    "#3b82f6", // Blue
    "#22c55e", // Green
    "#f97316", // Orange
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#eab308", // Yellow
    "#ef4444", // Red
    "#64748b", // Slate
    "#14b8a6", // Teal
  ];
  
  return Array.from({ length: count }, (_, i) => defaultPalette[i % defaultPalette.length]);
}
