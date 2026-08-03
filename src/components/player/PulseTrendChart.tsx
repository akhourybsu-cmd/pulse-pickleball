import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { TimelinePoint } from "@/lib/playerPulse";

const chartConfig = {
  rating: { label: "PULSE", color: "hsl(var(--primary))" },
};

interface PulseTrendChartProps {
  data: TimelinePoint[];
  peakPoint: TimelinePoint | null;
  relativeDate: (iso: string) => string;
}

/**
 * The PULSE rating trend line. Split into its own lazily-loaded chunk so the
 * (heavy) recharts dependency doesn't block the initial render of the Player
 * Pulse page — the rating number and stats paint immediately, and the chart
 * streams in behind a skeleton.
 */
export default function PulseTrendChart({
  data,
  peakPoint,
  relativeDate,
}: PulseTrendChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-muted"
            vertical={false}
          />
          <XAxis
            dataKey="index"
            type="number"
            domain={["dataMin", "dataMax"]}
            allowDecimals={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={["dataMin - 0.1", "dataMax + 0.1"]}
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload;
                  return p ? relativeDate(p.date) : "";
                }}
                formatter={(value) => `${Number(value).toFixed(2)} PULSE`}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="rating"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
          />
          {peakPoint && (
            <ReferenceDot
              x={peakPoint.index}
              y={peakPoint.rating}
              r={4}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={2}
              isFront
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
