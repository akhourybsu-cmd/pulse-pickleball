import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  Trophy,
  Sparkles,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { PageSEO } from "@/components/seo/PageSEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/hooks/useAuthState";
import { usePlayerPulse } from "@/hooks/usePlayerPulse";
import {
  filterTimeline,
  type MomentumState,
  type PulseRange,
} from "@/lib/playerPulse";
import { formatRatingChange } from "@/lib/matchDisplay";

/**
 * Player Pulse — the interactive story behind a player's rating.
 *
 * "Your rating is the headline. Your Player Pulse tells the story behind it."
 *
 * MVP scope (approved): rating-journey chart with period filters, 30-day
 * movement, record + point differential, rating confidence, recent matches
 * with per-match rating impact, one dynamic Momentum insight, and a
 * personal-best moment. Everything is derived from verified matches only and
 * every insight is data-gated (see lib/playerPulse.ts) so we never assert
 * more than the data supports. The rating engine is never touched — we read
 * the snapshots it already wrote.
 *
 * Deferred to a later phase: Competitive Range band, Player Style traits,
 * full Matchup Analytics, and the "What moves my rating" breakdown.
 */

const RANGES: { key: PulseRange; label: string }[] = [
  { key: "last10", label: "Last 10" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.round((Date.now() - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

const MOMENTUM_META: Record<
  MomentumState,
  { icon: typeof TrendingUp; tint: string; ring: string }
> = {
  rising: {
    icon: TrendingUp,
    tint: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20 bg-emerald-500/5",
  },
  steady: {
    icon: Minus,
    tint: "text-muted-foreground",
    ring: "ring-border/60 bg-muted/30",
  },
  recalibrating: {
    icon: TrendingDown,
    tint: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20 bg-amber-500/5",
  },
};

export default function PlayerPulse() {
  const navigate = useNavigate();
  const { user } = useAuthState();
  const { data: pulse, isLoading } = usePlayerPulse(user?.id);
  const [range, setRange] = useState<PulseRange>("all");

  const visibleTimeline = useMemo(
    () => (pulse ? filterTimeline(pulse.timeline, range, Date.now()) : []),
    [pulse, range],
  );

  // Peak point inside the current view, so the chart can flag the personal high.
  const peakPoint = useMemo(() => {
    if (visibleTimeline.length === 0) return null;
    return visibleTimeline.reduce((best, p) =>
      p.rating > best.rating ? p : best,
    );
  }, [visibleTimeline]);

  const chartConfig = {
    rating: { label: "PULSE", color: "hsl(var(--primary))" },
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageSEO
        title="Player Pulse — Your rating, explained"
        description="See how your PULSE rating moves, your current form, and what's behind the number."
        path="/player/pulse"
      />

      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-border/40 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Activity className="h-[18px] w-[18px]" strokeWidth={2} />
            </div>
            <h1 className="text-lg font-bold tracking-tight truncate">
              Player Pulse
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-5 space-y-5">
        {isLoading ? (
          <PulseSkeleton />
        ) : !pulse || pulse.matchCount === 0 ? (
          <EmptyState onRecord={() => navigate("/player/matches/new")} />
        ) : (
          <>
            {/* HERO */}
            <HeroCard pulse={pulse} />

            {/* RATING JOURNEY */}
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div>
                  <h2 className="text-base font-bold">Rating Journey</h2>
                  <p className="text-xs text-muted-foreground">
                    Your PULSE after every verified match
                  </p>
                </div>
              </div>

              {/* Period filters */}
              <div className="flex gap-1.5 mt-3 mb-4">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={cn(
                      "text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors",
                      range === r.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {visibleTimeline.length < 2 ? (
                <div className="h-[220px] flex items-center justify-center text-center text-sm text-muted-foreground px-6">
                  Not enough matches in this range yet — play a few more to see
                  your trend.
                </div>
              ) : (
                <ChartContainer
                  config={chartConfig}
                  className="h-[220px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={visibleTimeline}
                      margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="index"
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
                            formatter={(value) => [
                              Number(value).toFixed(2),
                              " PULSE",
                            ]}
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
              )}
            </Card>

            {/* QUICK INSIGHTS */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Record"
                value={`${pulse.wins}–${pulse.losses}`}
                sub={`${pulse.winRate}% win rate`}
              />
              <StatCard
                label="Avg. point margin"
                value={
                  pulse.avgPointDiff === null
                    ? "—"
                    : `${pulse.avgPointDiff > 0 ? "+" : ""}${pulse.avgPointDiff}`
                }
                sub="Points for − against"
                positive={pulse.avgPointDiff !== null && pulse.avgPointDiff > 0}
                negative={pulse.avgPointDiff !== null && pulse.avgPointDiff < 0}
              />
            </div>

            {/* MOMENTUM */}
            {pulse.momentum && <MomentumCard momentum={pulse.momentum} />}

            {/* CONFIDENCE */}
            <ConfidenceCard confidence={pulse.confidence} />

            {/* PERSONAL BEST */}
            {pulse.personalBest && (
              <PersonalBestCard best={pulse.personalBest} />
            )}

            {/* RECENT IMPACT */}
            <Card className="p-4 sm:p-5">
              <h2 className="text-base font-bold mb-0.5">Recent rating impact</h2>
              <p className="text-xs text-muted-foreground mb-3">
                How your last matches moved the number
              </p>
              <ul className="divide-y divide-border/50">
                {pulse.recentImpacts.map((m) => {
                  const delta = formatRatingChange(m.ratingChange);
                  const up = (m.ratingChange ?? 0) > 0;
                  return (
                    <li
                      key={m.matchId}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span
                        className={cn(
                          "text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 w-11 text-center",
                          m.won
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {m.won ? "Win" : "Loss"}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {m.scoreLabel}
                      </span>
                      {m.source === "round_robin" && (
                        <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wide">
                          Round robin
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {relativeDate(m.date)}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums w-14 text-right shrink-0",
                          delta === null
                            ? "text-muted-foreground/60"
                            : up
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {delta ?? "±0.00"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* FOOTER — how it works */}
            <HowItWorksNote />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- sub-components ---------- */

function HeroCard({ pulse }: { pulse: NonNullable<ReturnType<typeof usePlayerPulse>["data"]> }) {
  const change = pulse.thirtyDayChange;
  const hasChange = change !== null && Math.abs(change) > 0.0001;
  const up = (change ?? 0) > 0;

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6 bg-gradient-to-br from-card via-card to-primary/[0.05]">
      <div
        className="absolute top-0 right-0 w-40 h-40 -translate-y-1/3 translate-x-1/4 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 65%)",
        }}
      />
      <div className="relative">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl sm:text-6xl font-display font-bold tracking-tight tabular-nums">
            {pulse.currentRating !== null
              ? pulse.currentRating.toFixed(2)
              : "—"}
          </span>
          <span className="text-sm font-bold uppercase tracking-widest text-primary">
            PULSE
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {hasChange ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                up
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              {up ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {up ? "+" : ""}
              {change!.toFixed(2)} over 30 days
            </span>
          ) : (
            <span className="text-muted-foreground">
              Holding steady this month
            </span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {pulse.confidence.label} · {pulse.matchCount} verified{" "}
            {pulse.matchCount === 1 ? "match" : "matches"}
          </span>
        </div>
      </div>
    </Card>
  );
}

function StatCard({
  label,
  value,
  sub,
  positive,
  negative,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums mt-1",
          positive && "text-emerald-600 dark:text-emerald-400",
          negative && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

function MomentumCard({
  momentum,
}: {
  momentum: NonNullable<
    NonNullable<ReturnType<typeof usePlayerPulse>["data"]>["momentum"]
  >;
}) {
  const meta = MOMENTUM_META[momentum.state];
  const Icon = meta.icon;
  return (
    <Card className={cn("p-4 sm:p-5 ring-1", meta.ring)}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-background/60",
            meta.tint,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Your momentum
          </p>
          <p className={cn("text-lg font-bold leading-tight", meta.tint)}>
            {momentum.label}
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {momentum.points.map((p, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/60 shrink-0" />
            {p}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ConfidenceCard({
  confidence,
}: {
  confidence: NonNullable<
    ReturnType<typeof usePlayerPulse>["data"]
  >["confidence"];
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Rating confidence
        </p>
      </div>
      <p className="text-lg font-bold">{confidence.label}</p>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.round(confidence.progress * 100)}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground mt-2">{confidence.detail}</p>
      {confidence.nextStep && (
        <p className="text-sm text-primary/90 mt-1 font-medium">
          {confidence.nextStep}
        </p>
      )}
    </Card>
  );
}

function PersonalBestCard({
  best,
}: {
  best: NonNullable<
    NonNullable<ReturnType<typeof usePlayerPulse>["data"]>["personalBest"]
  >;
}) {
  return (
    <Card className="p-4 sm:p-5 ring-1 ring-primary/20 bg-primary/[0.04]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {best.isCurrent ? "Personal best — right now" : "Personal best"}
          </p>
          <p className="text-base font-bold">
            <span className="tabular-nums">{best.rating.toFixed(2)}</span> PULSE
            <span className="text-muted-foreground font-normal">
              {" "}
              ·{" "}
              {new Date(best.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}

function HowItWorksNote() {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Info className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">How PULSE works</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Your rating updates after every verified match. The biggest influences
        are your opponents' strength, the result, and the score margin — beating
        higher-rated players moves it up faster. New ratings settle over your
        first several matches, then hold steadier. Casual and guest-inclusive
        matches count less than verified ones.
      </p>
    </div>
  );
}

function EmptyState({ onRecord }: { onRecord: () => void }) {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold">Your Pulse starts with match one</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        Record a verified match and your rating journey, form, and milestones
        will start showing up here.
      </p>
      <Button className="mt-4" onClick={onRecord}>
        Record a match
      </Button>
    </Card>
  );
}

function PulseSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
