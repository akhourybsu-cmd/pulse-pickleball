import {
  ArrowRight,
  AlertTriangle,
  CircleGauge,
  ChevronDown,
  Grid3X3,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { calculateMetrics } from "@/lib/roundRobin/scheduleCore";
import type { SeatId } from "@/lib/roundRobin/scheduleCore";
import type { ScheduleAdjustmentPlan } from "@/lib/roundRobin/scheduleAdjustment";
import { cn } from "@/lib/utils";

interface PreviousScheduleSettings {
  courtCount: number;
  gamesPerPlayer: number;
  rounds?: number;
}

interface ScheduleImpactPreviewProps {
  playerCount: number;
  courtCount: number;
  gamesPerPlayer: number;
  previous?: PreviousScheduleSettings;
  currentRound?: number | null;
  preserveCompleted?: boolean;
  title?: string;
  compact?: boolean;
  className?: string;
  plan?: ScheduleAdjustmentPlan | null;
  getPlayerName?: (seatId: SeatId) => string;
  /** Count-only mixed rosters have unknown gender composition until players
   * register, so their capacity must be presented as an estimate. */
  mixedRosterEstimate?: boolean;
  /** Creation previews use plan metrics without describing them as a rebuild. */
  showImpactSummary?: boolean;
}

/**
 * Human-readable schedule preview shared by creation and live host controls.
 *
 * This deliberately describes outcomes instead of exposing scheduling math:
 * court use, rests, the expected per-player game spread, and what will be
 * rebuilt. It uses the same metrics helper as the scheduler so the preview
 * responds immediately as a host taps either stepper.
 */
export function ScheduleImpactPreview({
  playerCount,
  courtCount,
  gamesPerPlayer,
  previous,
  preserveCompleted = false,
  title = "Schedule at a glance",
  compact = false,
  className,
  plan,
  getPlayerName,
  mixedRosterEstimate = false,
  showImpactSummary = true,
}: ScheduleImpactPreviewProps) {
  if (playerCount < 4 || courtCount < 1 || gamesPerPlayer < 1) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-border bg-muted/25 p-4", className)}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <CircleGauge className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Add at least 4 players</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Your rounds, court use, rests, and game distribution will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const metrics = calculateMetrics(playerCount, courtCount, gamesPerPlayer);
  const projectedRounds = plan?.capacity.recommendedTotalRounds ?? metrics.rounds;
  const matchesPerRound = plan?.capacity.matchesPerRound ?? metrics.matchesPerRound;
  const restingPerRound = plan?.capacity.restsPerRound ?? metrics.byesPerRound;
  const unusedCourts = plan?.capacity.unusedCourts ?? Math.max(0, courtCount - metrics.matchesPerRound);
  const playersNeededForAnotherCourt = plan?.capacity.playersNeededForAnotherCourt ?? Math.max(
    0,
    (metrics.matchesPerRound + 1) * 4 - playerCount,
  );
  const totalMatches = plan
    ? plan.impact.preservedPlayableMatches + plan.impact.generatedPlayableMatches
    : metrics.rounds * metrics.matchesPerRound;
  const totalPlaySlots = metrics.rounds * metrics.onCourtPerRound;
  const estimatedMinGames = Math.floor(totalPlaySlots / playerCount);
  const estimatedPlayersWithExtraGame = totalPlaySlots % playerCount;
  const estimatedMaxGames = estimatedMinGames + (estimatedPlayersWithExtraGame > 0 ? 1 : 0);
  const minGames = plan?.fairness.gameRange.min ?? estimatedMinGames;
  const maxGames = plan?.fairness.gameRange.max ?? estimatedMaxGames;
  const gameSpread = plan?.fairness.gameRange.spread ?? (maxGames - minGames);
  const playersWithExtraGame = plan
    ? plan.fairness.perPlayer.filter((player) => player.games === maxGames).length
    : estimatedPlayersWithExtraGame;
  const oldRounds = previous?.rounds ?? (
    previous
      ? calculateMetrics(playerCount, previous.courtCount, previous.gamesPerPlayer).rounds
      : projectedRounds
  );
  const settingsChanged = !!previous && (
    previous.courtCount !== courtCount || previous.gamesPerPlayer !== gamesPerPlayer
  );
  const fairnessLabel = plan ? `${plan.fairness.score}%` : gameSpread === 0 ? "Even" : "Balanced";
  const fairnessDetail = gameSpread === 0
    ? `Every player is projected for ${minGames} games.`
    : plan
      ? `Players finish between ${minGames} and ${maxGames} actual games, a ${gameSpread}-game spread.`
      : `${playerCount - playersWithExtraGame} players are projected for ${minGames} games and ${playersWithExtraGame} for ${maxGames}.`;
  const creditedPlayers = plan?.fairness.perPlayer.filter((player) => player.gameCredit > 0) ?? [];
  const exactTargetWarning = plan?.warnings.find(
    (warning) => warning.code === "target_games_not_exact",
  );

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-[0_16px_38px_-28px_hsl(var(--primary)/0.65)]",
        className,
      )}
      aria-live="polite"
      aria-label="Schedule impact preview"
    >
      <div className={cn("border-b border-primary/10", compact ? "px-3.5 py-3" : "px-4 py-3.5")}>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-primary">
              <CircleGauge className="h-3.5 w-3.5" />
              {title}
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {playerCount} players · {matchesPerRound} simultaneous {matchesPerRound === 1 ? "match" : "matches"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-3xl font-black leading-none tracking-[-0.04em] text-foreground tabular-nums">
              {projectedRounds}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {projectedRounds === 1 ? "round" : "rounds"}
            </div>
          </div>
        </div>

        {settingsChanged && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
            <span className="rounded-full bg-background/80 px-2 py-1 ring-1 ring-border/70">
              {previous!.courtCount} {previous!.courtCount === 1 ? "court" : "courts"}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="rounded-full bg-primary px-2 py-1 text-primary-foreground">
              {courtCount} {courtCount === 1 ? "court" : "courts"}
            </span>
            {oldRounds !== projectedRounds && (
              <span className="ml-auto text-muted-foreground tabular-nums">
                {oldRounds} → {projectedRounds} rounds
              </span>
            )}
          </div>
        )}
      </div>

      <div className={cn("grid gap-px bg-border/50", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        <MetricCell
          icon={Grid3X3}
          label="Court use"
          value={`${matchesPerRound}/${courtCount}`}
          detail={unusedCourts > 0 ? `${unusedCourts} open · roster limit` : "All courts active"}
        />
        <MetricCell
          icon={Users}
          label="Resting"
          value={`${restingPerRound}`}
          detail={restingPerRound === 0 ? "No rests per round" : "Rotated each round"}
        />
        <MetricCell
          icon={ShieldCheck}
          label="Fairness"
          value={fairnessLabel}
          detail={`${gameSpread}-game spread`}
          positive={!plan || plan.fairness.score >= 75}
        />
        <MetricCell
          icon={CircleGauge}
          label="Total matches"
          value={`${totalMatches}`}
          detail={`${gamesPerPlayer} game target`}
        />
      </div>

      <div className={cn("space-y-2.5", compact ? "px-3.5 py-3" : "px-4 py-3.5")}>
        {mixedRosterEstimate && (
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-3 py-2.5">
            <CircleGauge className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Balanced mixed-roster estimate.</strong>{" "}
              These figures assume an even split of men and women. Actual court use and round count will adapt to the registered roster.
            </p>
          </div>
        )}

        {unusedCourts > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5">
            <Grid3X3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">
                {unusedCourts === 1 ? "One court stays open." : `${unusedCourts} courts stay open.`}
              </strong>{" "}
              {playerCount} players can fill {matchesPerRound} {matchesPerRound === 1 ? "court" : "courts"} at once.
              {playersNeededForAnotherCourt > 0 && ` Add ${playersNeededForAnotherCourt} more ${playersNeededForAnotherCourt === 1 ? "player" : "players"} to activate another court.`}
            </p>
          </div>
        )}

        <div className="flex items-start gap-2.5">
          <ShieldCheck className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            !plan || plan.fairness.score >= 75
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400",
          )} />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">{fairnessLabel} game distribution.</strong>{" "}
            {fairnessDetail} The scheduler prioritizes players with fewer games and longer rests.
          </p>
        </div>

        {settingsChanged && (
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/15 bg-background/65 px-3 py-2.5">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {preserveCompleted ? (
                <>
                  <strong className="font-semibold text-foreground">Completed play stays locked.</strong>{" "}
                  {plan?.capacity.protectedThroughRound
                    ? `Rounds 1–${plan.capacity.protectedThroughRound} remain unchanged. Rebuilding begins with Round ${plan.capacity.protectedThroughRound + 1}, then partners, opponents, courts, and rests are rebalanced around those saved results.`
                    : `Rebuilding begins after the current protected play, then partners, opponents, courts, and rests are rebalanced around the saved results.`}
                </>
              ) : (
                <>
                  <strong className="font-semibold text-foreground">The schedule will rebuild once.</strong>{" "}
                  Court assignments, partners, opponents, and rests will all adapt to these settings.
                </>
              )}
            </p>
          </div>
        )}

        {plan && (showImpactSummary || !plan.ok) && (
          <div className={cn(
            "rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
            plan.ok
              ? "border-primary/15 bg-primary/[0.05] text-muted-foreground"
              : "border-destructive/25 bg-destructive/[0.06] text-destructive",
          )}>
            <div className="flex items-start gap-2.5">
              {plan.ok
                ? <CircleGauge className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <p>
                <strong className="font-semibold text-foreground">
                  {plan.ok ? "What changes: " : "Schedule needs attention: "}
                </strong>
                {plan.ok
                  ? plan.impact.summary
                  : plan.warnings.find((warning) => warning.severity === "error")?.message || "These settings cannot produce a valid schedule."}
              </p>
            </div>
          </div>
        )}

        {plan?.ok && plan.capacity.unavoidableExtraPlayerGames > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Exact totals are not mathematically possible.</strong>{" "}
              {exactTargetWarning?.message ||
                `Doubles fills four seats at a time, so ${plan.capacity.unavoidableExtraPlayerGames} extra player-game ${plan.capacity.unavoidableExtraPlayerGames === 1 ? "slot is" : "slots are"} distributed as evenly as possible.`}
            </p>
          </div>
        )}

        {plan?.ok && creditedPlayers.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Scheduling credit keeps the next rotation fair.</strong>{" "}
              {creditedPlayers.length === 1 ? "One late arrival or substitute" : `${creditedPlayers.length} late arrivals or substitutes`} receive virtual credit for play completed before they joined. Credit guides future assignments only—it never counts as a played game or changes standings.
            </p>
          </div>
        )}

        {plan?.ok && plan.fairness.perPlayer.length > 0 && (
          <details className="group overflow-hidden rounded-xl border border-border/70 bg-background/70">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
              <span>Player-by-player projection</span>
              <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {minGames === maxGames ? `${minGames} each` : `${minGames}–${maxGames} games`}
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="max-h-56 divide-y divide-border/60 overflow-y-auto border-t border-border/60">
              {plan.fairness.perPlayer.map((player) => (
                <div key={player.seatId} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {getPlayerName?.(player.seatId) || `Player ${player.seatId.slice(-4)}`}
                    </div>
                    {player.gameCredit > 0 && (
                      <div className="mt-0.5 truncate text-[10px] leading-snug text-sky-700 dark:text-sky-300" title={`${player.gameCredit} scheduling credit; treated as ${player.availabilityAdjustedGames} games for rotation fairness`}>
                        +{player.gameCredit} scheduling credit · balanced as {player.availabilityAdjustedGames}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-right tabular-nums text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
                    <span>
                      <strong className="font-semibold text-foreground">{player.games}</strong> actual {player.games === 1 ? "game" : "games"}
                    </span>
                    <span className="min-w-[3.25rem]">
                      {player.rests} {player.rests === 1 ? "rest" : "rests"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function MetricCell({
  icon: Icon,
  label,
  value,
  detail,
  positive = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className="min-w-0 bg-card/90 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", positive && "text-emerald-600 dark:text-emerald-400")} />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("mt-1.5 text-lg font-bold leading-none tabular-nums", positive && "text-emerald-700 dark:text-emerald-300")}>
        {value}
      </div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground" title={detail}>
        {detail}
      </div>
    </div>
  );
}
