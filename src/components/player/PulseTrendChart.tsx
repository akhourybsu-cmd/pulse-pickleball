import { useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceDot,
  Tooltip,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import {
  formatPulseDate,
  formatPulseDelta,
  type TimelinePoint,
} from "@/lib/playerPulse";

const chartConfig = {
  rating: { label: "PULSE", color: "hsl(var(--primary))" },
};
/** One responsive container, linear segments between real snapshots, and a
 * numeric match axis. Date details are in the keyboard/touch tooltip and the
 * equivalent table. Never smooth a curve into ratings that were not recorded. */
export default function PulseTrendChart({
  data,
  peakPoint,
}: {
  data: TimelinePoint[];
  peakPoint: TimelinePoint | null;
}) {
  const gradient = `pulse-fill-${useId().replace(/:/g, "")}`;
  const ratings = data.map((row) => row.rating);
  const min = Math.min(...ratings),
    max = Math.max(...ratings);
  // Round the scale to readable 0.05 steps instead of fractional tick values
  // such as 3.48333 being presented as though they were exactly 3.48.
  const step = Math.max(0.05, Math.ceil((max - min + 0.04) / 4 / 0.05) * 0.05);
  const low = Math.max(0, Math.floor((min - 0.02) / step) * step);
  const high = Math.ceil((max + 0.02) / step) * step;
  const ticks = Array.from(
    { length: Math.round((high - low) / step) + 1 },
    (_, i) => Number((low + i * step).toFixed(2))
  );
  const first = data[0].index,
    last = data[data.length - 1].index;
  return (
    <ChartContainer
      config={chartConfig}
      className="h-[260px] w-full min-w-0 aspect-auto"
      aria-label="Recorded PULSE rating by ranked match number"
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="hsl(var(--primary))"
              stopOpacity={0.25}
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--primary))"
              stopOpacity={0.015}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="hsl(var(--border) / 0.5)"
          strokeDasharray="3 5"
        />
        <XAxis
          dataKey="index"
          type="number"
          domain={first === last ? [first - 0.5, last + 0.5] : [first, last]}
          ticks={first === last ? [first] : undefined}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          minTickGap={25}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => `#${value}`}
        />
        <YAxis
          domain={[low, high]}
          ticks={ticks}
          tickFormatter={(value: number) => value.toFixed(2)}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          cursor={{
            stroke: "hsl(var(--primary) / 0.35)",
            strokeDasharray: "3 3",
          }}
          content={<PulseTooltip />}
        />
        <Area
          type="linear"
          dataKey="rating"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          fill={`url(#${gradient})`}
          fillOpacity={1}
          dot={
            data.length <= 10
              ? {
                  r: 3,
                  fill: "hsl(var(--primary))",
                  strokeWidth: 2,
                  stroke: "hsl(var(--card))",
                }
              : false
          }
          activeDot={{
            r: 5,
            fill: "hsl(var(--primary))",
            stroke: "hsl(var(--card))",
            strokeWidth: 2,
          }}
          isAnimationActive={false}
        />
        {peakPoint && (
          <ReferenceDot
            x={peakPoint.index}
            y={peakPoint.rating}
            r={5}
            fill="hsl(var(--primary))"
            stroke="hsl(var(--card))"
            strokeWidth={2}
            isFront
          />
        )}
      </AreaChart>
    </ChartContainer>
  );
}
function PulseTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TimelinePoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="max-w-[230px] rounded-xl border border-border bg-popover p-3 text-xs shadow-lg">
      <p className="font-semibold">
        Match #{point.index} · {formatPulseDate(point.date)}
      </p>
      <p className="mt-2 text-lg font-bold tabular-nums">
        {point.rating.toFixed(3)}{" "}
        <span className="text-xs font-medium text-muted-foreground">PULSE</span>
      </p>
      <p className="mt-1 text-muted-foreground">
        {point.scoreLabel} ·{" "}
        {point.outcome === "unscored" ? "Score unavailable" : point.outcome}
      </p>
      <p className="mt-1 text-muted-foreground">
        Change {formatPulseDelta(point.ratingChange)}
        {point.ratingChange === null ? " · not recorded" : ""}
      </p>
    </div>
  );
}
