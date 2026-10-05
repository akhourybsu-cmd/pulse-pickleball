import {
  Component,
  lazy,
  Suspense,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Info,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Minus,
} from "lucide-react";
import { PageSEO } from "@/components/seo/PageSEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/hooks/useAuthState";
import { usePlayerPulse } from "@/hooks/usePlayerPulse";
import { useAccountSessionState } from "@/lib/accountSession";
import { placementStatus } from "@/lib/rating/placementStatus";
import {
  computeMomentum,
  filterPulseMatches,
  formatPulseDate,
  formatPulseDelta,
  pulseSource,
  summarizePulseMatches,
  type PlayerPulse as PulseData,
  type PulseRange,
  type PulseMatch,
  type TimelinePoint,
} from "@/lib/playerPulse";
import "@/styles/player-pulse.css";

const PulseTrendChart = lazy(
  () => import("@/components/player/PulseTrendChart")
);
const RANGES: { key: PulseRange; label: string }[] = [
  { key: "last10", label: "Last 10" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];
const outcomeLabel = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
  unscored: "No score",
};
const deltaTint = (delta: number | null) =>
  delta === null || Math.abs(delta) < 0.0005
    ? "text-muted-foreground"
    : delta > 0
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-amber-800 dark:text-amber-300";

export default function PlayerPulse() {
  const { user, loading: authLoading } = useAuthState();
  const query = usePlayerPulse(user?.id);
  return (
    <div className="pulse-page min-h-screen bg-background pb-12">
      <PageSEO
        title="Player Pulse — Your game, in focus"
        description="Your rating journey, ranked results and the numbers behind your PULSE."
        path="/player/pulse"
      />
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/player/dashboard"
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Player home
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={query.isFetching || !user}
              onClick={() => void query.refetch()}
              className="rounded-full"
            >
              <RefreshCw
                className={cn(
                  "mr-2 h-3.5 w-3.5",
                  query.isFetching && "animate-spin motion-reduce:animate-none"
                )}
              />
              {query.isFetching ? "Updating…" : "Refresh"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-full"
            >
              <Link to="/player/matches">
                Match history <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
        {authLoading || query.isLoading ? (
          <PulseSkeleton />
        ) : query.isError && !query.data ? (
          <section role="alert" className="pulse-panel p-8 text-center">
            <Activity className="mx-auto mb-3 h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Player Pulse couldn’t load</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Your match history hasn’t been changed. Try loading your rating
              and results again.
            </p>
            <Button
              className="mt-5 rounded-xl"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          </section>
        ) : query.data && user ? (
          <>
            {query.isError && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
              >
                Couldn’t refresh your results. Showing the last loaded data from{" "}
                {new Date(query.data.asOf).toLocaleString()}. Use Refresh to try
                again.
              </div>
            )}
            <PulseAnalytics key={user.id} pulse={query.data} userId={user.id} />
          </>
        ) : (
          <p role="status" className="pulse-panel p-8">
            Sign in to see your Player Pulse.
          </p>
        )}
      </div>
    </div>
  );
}

function PulseAnalytics({
  pulse,
  userId,
}: {
  pulse: PulseData;
  userId: string;
}) {
  const [savedRange, setRange] = useAccountSessionState<PulseRange>(
    userId,
    "pulse-range",
    "all"
  );
  const range = RANGES.some((item) => item.key === savedRange)
    ? savedRange
    : "all";
  const [showChartData, setShowChartData] = useState(false);
  const matches = useMemo(
    () => filterPulseMatches(pulse.matches, range, Date.now()),
    [pulse, range]
  );
  const summary = useMemo(() => summarizePulseMatches(matches), [matches]);
  const timeline = useMemo(() => {
    const ids = new Set(matches.map((row) => row.matchId));
    return pulse.timeline.filter((row) => ids.has(row.matchId));
  }, [pulse, matches]);
  const momentum = useMemo(() => computeMomentum(matches), [matches]);
  const peak = timeline.length
    ? timeline.reduce((a, b) => (b.rating > a.rating ? b : a))
    : null;
  const lastResults = matches.slice(-10);
  const scope = RANGES.find((item) => item.key === range)!.label;
  const confidence = pulse.confidence;

  return (
    <div className="space-y-6">
      <HeroCard pulse={pulse} />
      {!pulse.matchCount ? (
        <section className="pulse-panel p-8 text-center sm:p-12">
          <Sparkles className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h2 className="text-xl font-bold">
            Your story starts with match one
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Once a ranked match is approved, your results appear here. Recorded
            rating snapshots build your journey over time.
          </p>
          <Button asChild className="mt-5 rounded-xl">
            <Link to="/player/matches/new">Record a match</Link>
          </Button>
        </section>
      ) : (
        <>
          {pulse.missingSnapshotCount > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {pulse.missingSnapshotCount} ranked{" "}
              {pulse.missingSnapshotCount === 1 ? "result has" : "results have"}{" "}
              no recorded rating yet. Results still count toward your record;
              missing ratings are excluded from the chart and rating milestones.
            </p>
          )}
          <section
            aria-labelledby="pulse-performance-heading"
            className="space-y-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="pulse-eyebrow">The numbers behind your game</p>
                <h2
                  id="pulse-performance-heading"
                  className="mt-1 text-xl font-bold tracking-tight sm:text-2xl"
                >
                  Your performance
                </h2>
              </div>
              <div
                role="group"
                aria-label="Performance period"
                className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-border/60 bg-card p-1"
              >
                {RANGES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={range === item.key}
                    onClick={() => setRange(item.key)}
                    className={cn(
                      "min-h-10 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4",
                      range === item.key
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {scope} · {matches.length} ranked{" "}
              {matches.length === 1 ? "result" : "results"}. The chart, record,
              form and match breakdown below follow this period.
            </p>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section
                aria-labelledby="pulse-journey-heading"
                className="pulse-panel min-w-0 p-4 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3
                      id="pulse-journey-heading"
                      className="flex items-center gap-2 text-base font-bold"
                    >
                      <Activity className="h-4 w-4 text-primary" /> Rating
                      journey
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Recorded PULSE after each ranked match
                    </p>
                  </div>
                  <span className="rounded-full bg-muted/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                    {timeline.length} rating{" "}
                    {timeline.length === 1 ? "snapshot" : "snapshots"}
                  </span>
                </div>
                {timeline.length ? (
                  <>
                    <div className="my-5 grid grid-cols-3 divide-x divide-border/50 rounded-xl bg-muted/25 py-3">
                      <ChartStat
                        label="First in view"
                        value={timeline[0].rating}
                      />
                      <ChartStat
                        label="Latest in view"
                        value={timeline[timeline.length - 1].rating}
                      />
                      <ChartStat label="High in view" value={peak!.rating} />
                    </div>
                    <ChartBoundary>
                      <Suspense
                        fallback={
                          <Skeleton className="h-[260px] w-full rounded-xl" />
                        }
                      >
                        <PulseTrendChart data={timeline} peakPoint={peak} />
                      </Suspense>
                    </ChartBoundary>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>Ranked match number · equally spaced by match</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" />{" "}
                        Highest recorded rating in this view
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-expanded={showChartData}
                      aria-controls="pulse-chart-data"
                      onClick={() => setShowChartData((value) => !value)}
                    >
                      View chart data{" "}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform motion-reduce:transition-none",
                          showChartData && "rotate-180"
                        )}
                      />
                    </button>
                    {showChartData && <ChartDataTable data={timeline} />}
                  </>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center px-4 text-center">
                    <BarChart3 className="mb-3 h-8 w-8 text-muted-foreground/60" />
                    <p className="text-sm font-semibold">
                      {matches.length
                        ? "No rating snapshots in this view"
                        : "No ranked results in this period"}
                    </p>
                    <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                      {matches.length
                        ? "Your recorded results are shown below. The chart will appear when rating data is available."
                        : "Choose another period to explore your match history."}
                    </p>
                    {range !== "all" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 rounded-xl"
                        onClick={() => setRange("all")}
                      >
                        Show all time
                      </Button>
                    )}
                  </div>
                )}
              </section>
              <aside className="min-w-0 space-y-4">
                <section
                  className="pulse-panel p-5"
                  aria-labelledby="pulse-form-heading"
                >
                  <p className="pulse-eyebrow">{scope}</p>
                  <h3
                    id="pulse-form-heading"
                    className="mt-1 text-base font-bold"
                  >
                    Your recorded form
                  </h3>
                  <div
                    className="mt-4 flex flex-wrap gap-1.5"
                    aria-label="Last results, oldest to newest"
                  >
                    {lastResults.map((row) => (
                      <span
                        key={row.matchId}
                        title={`${formatPulseDate(row.matchDate)} · ${
                          outcomeLabel[row.outcome]
                        } · ${row.scoreLabel}`}
                        className={cn(
                          "flex h-8 min-w-8 items-center justify-center rounded-lg border px-1 text-xs font-bold",
                          row.outcome === "win"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-border/50 bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <span aria-hidden>
                          {row.outcome === "unscored"
                            ? "?"
                            : outcomeLabel[row.outcome][0]}
                        </span>
                        <span className="sr-only">
                          {outcomeLabel[row.outcome]}, {row.scoreLabel},{" "}
                          {formatPulseDate(row.matchDate)}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {lastResults.length
                      ? `Last ${lastResults.length} in this view · oldest → newest`
                      : "No results in this view"}
                  </p>
                  {momentum ? (
                    <div className="mt-5 border-t border-border/50 pt-4">
                      <div className="flex items-center gap-2">
                        <MomentumIcon state={momentum.state} />
                        <p
                          className={cn(
                            "text-xl font-bold",
                            deltaTint(momentum.net)
                          )}
                        >
                          {momentum.label}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatPulseDelta(momentum.net)} across {momentum.count}{" "}
                        recorded changes
                      </p>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        {momentum.points.join(". ")}. Last result{" "}
                        {formatPulseDate(momentum.lastDate)}.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      A trend appears when at least five of the latest ten
                      results in this view have recorded rating changes.
                    </p>
                  )}
                </section>
                <section
                  className="pulse-panel p-5"
                  aria-labelledby="pulse-foundation-heading"
                >
                  <h3
                    id="pulse-foundation-heading"
                    className="flex items-center gap-2 text-sm font-bold"
                  >
                    <ShieldCheck className="h-4 w-4 text-primary" /> Rating
                    foundation{" "}
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                      All time
                    </span>
                  </h3>
                  <p className="mt-4 text-lg font-bold">{confidence.label}</p>
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label="Rated matches through the provisional period"
                    aria-valuemin={0}
                    aria-valuemax={confidence.target}
                    aria-valuenow={Math.min(
                      confidence.played,
                      confidence.target
                    )}
                    aria-valuetext={`${confidence.played} rated matches; ${confidence.target} complete the provisional period`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                      style={{ width: `${confidence.progress * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                    <span>{confidence.played} rated matches</span>
                    <span>{confidence.target}-match milestone</span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {confidence.detail}
                  </p>
                  {confidence.nextStep && (
                    <p className="mt-2 text-xs font-semibold leading-relaxed">
                      {confidence.nextStep}
                    </p>
                  )}
                </section>
              </aside>
            </div>
            <section
              className="pulse-panel grid min-w-0 divide-y divide-border/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
              aria-label={`${scope} results summary`}
            >
              <div className="p-5">
                <p className="pulse-eyebrow">Ranked record</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">
                  {summary.wins}
                  <span className="mx-1 text-muted-foreground/50">–</span>
                  {summary.losses}
                  {summary.draws > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {summary.draws} drawn
                    </span>
                  )}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {summary.winRate === null
                    ? "No scored results"
                    : `Wins – losses · ${summary.winRate}% win rate`}
                </p>
                <div
                  className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  <div
                    className="bg-emerald-600"
                    style={{
                      width: `${
                        summary.scoredCount
                          ? (summary.wins / summary.scoredCount) * 100
                          : 0
                      }%`,
                    }}
                  />
                  <div
                    className="bg-foreground/40"
                    style={{
                      width: `${
                        summary.scoredCount
                          ? (summary.losses / summary.scoredCount) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="p-5">
                <p className="pulse-eyebrow">Average point margin</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">
                  {summary.avgPointDiff === null
                    ? "—"
                    : `${
                        summary.avgPointDiff > 0 ? "+" : ""
                      }${summary.avgPointDiff.toFixed(1)}`}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Your points minus opponents’ points, per scored match
                </p>
              </div>
              <div className="p-5">
                <p className="pulse-eyebrow">Points on the board</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="text-2xl font-bold tabular-nums">
                    {summary.scoredCount ? summary.pointsFor : "—"}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      for
                    </span>
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-muted-foreground">
                    {summary.scoredCount ? summary.pointsAgainst : "—"}
                    <span className="ml-1 text-xs font-normal">against</span>
                  </p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {summary.unscored
                    ? `${summary.unscored} unscored ${
                        summary.unscored === 1 ? "result" : "results"
                      } excluded from score statistics`
                    : `${summary.scoredCount} scored matches in this view`}
                </p>
              </div>
            </section>
          </section>
          <RecentImpact matches={matches.slice(-10).reverse()} scope={scope} />
        </>
      )}
      <details className="pulse-panel p-5">
        <summary className="cursor-pointer rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          How to read your Player Pulse
        </summary>
        <div className="mt-4 grid gap-5 text-xs leading-relaxed text-muted-foreground sm:grid-cols-3">
          <p>
            <strong className="mb-1 block text-foreground">
              What counts here
            </strong>
            This page includes approved, non-voided ranked results. Unranked
            games remain in Match history. A result can exist before a rating
            snapshot is available; missing values appear as a dash.
          </p>
          <p>
            <strong className="mb-1 block text-foreground">
              What moves the rating
            </strong>
            The rating engine uses team and opponent ratings, the outcome, score
            margin and rating experience. It currently requires four
            account-linked players to rate a doubles match. This page reads its
            saved results.
          </p>
          <p>
            <strong className="mb-1 block text-foreground">
              Scope & precision
            </strong>
            The headline rating, 30-day movement and personal best have their
            own fixed scopes. Period controls filter the performance sections.
            Changes show three decimals, so small movements remain visible even
            when the two-decimal headline looks unchanged.
          </p>
        </div>
      </details>
    </div>
  );
}

function HeroCard({ pulse }: { pulse: PulseData }) {
  const placement = placementStatus(pulse.ratedMatchCount);
  return (
    <section className="pulse-hero relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
      <svg
        className="pointer-events-none absolute right-0 top-0 h-full w-2/3 opacity-[0.08]"
        viewBox="0 0 600 220"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <path
          d="M0 150H100L145 150L180 65L225 190L265 112L300 150H600"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M0 180H600M0 90H600" stroke="currentColor" strokeWidth="0.5" />
      </svg>
      <div className="relative grid min-w-0 gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] md:items-end">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">
            <Activity className="h-4 w-4" /> Your game, in focus
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Player Pulse
          </h1>
          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
            <span className="pulse-score text-7xl font-bold leading-none tracking-[-0.06em] tabular-nums sm:text-8xl">
              {pulse.currentRating?.toFixed(2) ?? "—"}
            </span>
            <span className="mb-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest">
              {placement.isPreliminary ? "Preliminary" : "PULSE rating"}
            </span>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/70">
            {pulse.ratedMatchCount} recorded rating results · {pulse.matchCount}{" "}
            ranked results
            {placement.isPreliminary && (
              <span className="mt-1 block">
                Placement {placement.played} of {placement.total}. Your rating
                is still an estimate.
              </span>
            )}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/[0.05] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65">
              30-day movement
            </p>
            <p className="mt-2 break-words text-2xl font-bold tabular-nums text-white">
              {formatPulseDelta(pulse.thirtyDayChange)}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/65">
              {!pulse.thirtyDayMatchCount
                ? "No ranked results in the last 30 days"
                : pulse.thirtyDayChange === null
                ? "More rating data needed to compare"
                : `${pulse.thirtyDayMatchCount} ranked results · today and the previous 29 days`}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-200/80">
              <Trophy className="h-3.5 w-3.5 shrink-0" /> Personal best
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-amber-100">
              {pulse.personalBest?.rating.toFixed(2) ?? "—"}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/65">
              {pulse.personalBest
                ? `${
                    pulse.personalBest.isCurrent
                      ? "At your best · "
                      : "All time · "
                  }${formatPulseDate(pulse.personalBest.date)}`
                : "Your first recorded rating starts this milestone"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
function ChartStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 px-3">
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">
        {value.toFixed(2)}
      </p>
    </div>
  );
}
function MomentumIcon({
  state,
}: {
  state: "rising" | "steady" | "recalibrating";
}) {
  const Icon =
    state === "rising"
      ? TrendingUp
      : state === "recalibrating"
      ? TrendingDown
      : Minus;
  return <Icon className="h-5 w-5 shrink-0 text-primary" />;
}
function ChartDataTable({ data }: { data: TimelinePoint[] }) {
  return (
    <div
      id="pulse-chart-data"
      className="mt-2 max-h-72 overflow-auto rounded-xl border border-border/60"
      tabIndex={0}
      role="region"
      aria-label="Rating chart data"
    >
      <table className="w-full text-left text-xs">
        <caption className="sr-only">
          Recorded ratings in the selected period
        </caption>
        <thead className="sticky top-0 bg-card">
          <tr>
            {["Match", "Date", "PULSE", "Change"].map((label) => (
              <th
                key={label}
                scope="col"
                className="whitespace-nowrap px-3 py-3 font-semibold"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.matchId} className="border-t border-border/40">
              <td className="px-3 py-2">#{row.index}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {formatPulseDate(row.date)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {row.rating.toFixed(3)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatPulseDelta(row.ratingChange)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function RecentImpact({
  matches,
  scope,
}: {
  matches: PulseMatch[];
  scope: string;
}) {
  const max = Math.max(
    0.001,
    ...matches.map((row) => Math.abs(row.ratingChange ?? 0))
  );
  return (
    <section
      className="pulse-panel overflow-hidden"
      aria-labelledby="pulse-impact-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 p-5 sm:px-6">
        <div>
          <p className="pulse-eyebrow">
            {scope} · latest {matches.length}
          </p>
          <h2 id="pulse-impact-heading" className="mt-1 text-lg font-bold">
            Every result, explained
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your team’s score first. Rating changes are the engine’s recorded
            values.
          </p>
        </div>
        <Target className="h-5 w-5 text-primary" />
      </div>
      {matches.length ? (
        <ul className="divide-y divide-border/40">
          {matches.map((row) => (
            <li
              key={row.matchId}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.65fr)_100px] sm:px-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                      row.outcome === "win"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {outcomeLabel[row.outcome]}
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {row.scoreLabel}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <time dateTime={row.matchDate}>
                    {formatPulseDate(row.matchDate)}
                  </time>{" "}
                  · {pulseSource(row.source)} · #{row.index}
                </p>
              </div>
              <div className="hidden min-w-0 sm:block" aria-hidden>
                <div className="relative h-5">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  {row.ratingChange !== null && (
                    <span
                      className={cn(
                        "absolute top-1 h-3 rounded-sm",
                        row.ratingChange >= 0
                          ? "bg-emerald-600/75"
                          : "bg-amber-600/75"
                      )}
                      style={{
                        width: `${(Math.abs(row.ratingChange) / max) * 48}%`,
                        left:
                          row.ratingChange >= 0
                            ? "50%"
                            : `${
                                50 - (Math.abs(row.ratingChange) / max) * 48
                              }%`,
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-base font-bold tabular-nums",
                    deltaTint(row.ratingChange)
                  )}
                >
                  {formatPulseDelta(row.ratingChange)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {row.ratingAfter === null
                    ? "Rating not recorded"
                    : `${row.ratingAfter.toFixed(2)} after`}
                </p>
                {row.ratingChange === null && (
                  <p className="text-[10px] text-muted-foreground">
                    Change not recorded
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          No results in this period. Choose another period above.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 bg-muted/15 px-5 py-3 text-[11px] text-muted-foreground">
        <span>
          Bars compare the size of recorded changes in this list. A dash means
          unavailable.
        </span>
        <Link
          to="/player/matches"
          className="inline-flex min-h-9 items-center gap-1 rounded-md font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          All match history <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
class ChartBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p
        role="alert"
        className="rounded-xl bg-muted/40 p-6 text-sm text-muted-foreground"
      >
        The chart couldn’t open. You can still view the chart data and match
        breakdown below. Reload the page to try the chart again.
      </p>
    ) : (
      this.props.children
    );
  }
}
function PulseSkeleton() {
  return (
    <div role="status" aria-label="Loading Player Pulse" className="space-y-5">
      <Skeleton className="h-72 rounded-3xl" />
      <Skeleton className="h-12 w-64 max-w-full rounded-xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
