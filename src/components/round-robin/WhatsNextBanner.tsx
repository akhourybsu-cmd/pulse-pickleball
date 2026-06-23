import { ArrowRight, Users, Sparkles, Play, ClipboardCheck, Flag, CheckCircle2, ClipboardList, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";


interface WhatsNextBannerProps {
  /** Event state — drives which prompt is shown. */
  status: "draft" | "live" | "completed" | "voided";
  /** Whether the event was voided (drives the voided-state copy). */
  voided?: boolean;
  /** True when the host has not yet added any players. */
  hasPlayers: boolean;
  /** True when the schedule has been generated. */
  hasSchedule: boolean;
  /** Number of confirmed players in the roster (used for status language). */
  playerCount?: number;
  /** Number of courts allocated to the event (used for status language). */
  courtCount?: number;
  /** Number of scored matches in the current round (for live-state coaching). */
  currentRoundScoredCount: number;
  /** Total matches in the current round (excluding byes). */
  currentRoundTotalCount: number;
  /** 1-indexed current round number, if any. */
  currentRound: number | null;
  /** Total rounds in the event. */
  totalRounds: number;
  /** Whether the viewer is the host/organizer. Players see no banner. */
  isOrganizer: boolean;

  /** Host-action callbacks the banner invokes when its primary CTA fires. */
  onAddPlayers?: () => void;
  onGenerateSchedule?: () => void;
  onStartEvent?: () => void;
  onCloseRound?: () => void;
  onCompleteEvent?: () => void;
  /** Opens score management for the active round. */
  onManageRound?: () => void;
}

type Prompt = {
  icon: LucideIcon;
  /** Single-word tracker (e.g. "NEXT", "READY", "ACTION"). */
  pill: string;
  /** Main headline — past-the-fold-test readable in one glance. */
  title: string;
  /** Optional one-line helper. */
  hint?: string;
  /** Button label for the primary action. */
  cta: string;
  /** Click handler — wired from props. */
  onClick?: () => void;
  /** When true the banner is informational only (no button shown). */
  informational?: boolean;
};

/**
 * "What's next" — a state-aware banner that tells the host exactly which
 * single action they should take to move the event forward. Sits above
 * the existing lifecycle stepper and tab strip, replacing the "huh, what
 * am I supposed to do" moment with a clear primary CTA.
 *
 * The audit's #1 friction point on the host UI was that round
 * advancement was hidden in the carousel; players had to discover
 * "Close Round" to advance. This banner brings that prompt to the
 * top of the screen during live play.
 */
export function WhatsNextBanner({
  status,
  voided = false,
  hasPlayers,
  hasSchedule,
  playerCount = 0,
  courtCount = 0,
  currentRoundScoredCount,
  currentRoundTotalCount,
  currentRound,
  totalRounds,
  isOrganizer,
  onAddPlayers,
  onGenerateSchedule,
  onStartEvent,
  onCloseRound,
  onCompleteEvent,
  onManageRound,
}: WhatsNextBannerProps) {
  // Players don't see a host-coaching banner.
  if (!isOrganizer) return null;

  // Live in-event view — premium "Active Round" host control card with a
  // round-pills tracker. Replaces the generic prompt while play is live.
  if (
    status === "live" &&
    !voided &&
    currentRound != null &&
    totalRounds > 0
  ) {
    const allScored =
      currentRoundTotalCount > 0 &&
      currentRoundScoredCount >= currentRoundTotalCount;
    const isFinalRound = currentRound >= totalRounds;
    const canAdvance = allScored && !isFinalRound;
    const canComplete = allScored && isFinalRound;

    return (
      <div
        className={cn(
          "rounded-2xl border border-primary/20 overflow-hidden",
          "bg-gradient-to-br from-primary/[0.07] via-card to-primary/[0.03]",
          "shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.18)]",
        )}
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15 text-primary">
              <ClipboardList className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-xl font-bold leading-tight text-foreground">
                Active Round: Round {currentRound}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {currentRoundTotalCount > 0
                  ? `${currentRoundScoredCount} of ${currentRoundTotalCount} matches scored`
                  : "Round assigning…"}
              </p>
            </div>
            {onManageRound && (
              <Button
                variant="outline"
                size="sm"
                onClick={onManageRound}
                className="h-9 gap-1.5 flex-shrink-0 bg-card"
              >
                <span>Manage Round</span>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Round pills tracker */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
              const isPast = r < currentRound;
              const isActive = r === currentRound;
              return (
                <div
                  key={r}
                  className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap flex-shrink-0 border transition-colors",
                    isActive &&
                      "bg-primary text-primary-foreground border-primary shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]",
                    isPast &&
                      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
                    !isActive &&
                      !isPast &&
                      "bg-muted/60 text-muted-foreground border-border",
                  )}
                >
                  <span>R{r}</span>
                  {isPast && <Check className="h-3 w-3" strokeWidth={3} />}
                  {isActive && <span className="opacity-90">Active</span>}
                  {!isActive && !isPast && (
                    <span className="opacity-70">Upcoming</span>
                  )}
                </div>
              );
            })}
          </div>

          {(canAdvance || canComplete) && (
            <div className="mt-3">
              <Button
                onClick={canComplete ? onCompleteEvent : onCloseRound}
                className="gap-1.5 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
                size="sm"
              >
                {canComplete
                  ? "Complete event"
                  : `Close Round ${currentRound}`}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const prompt = pickPrompt();
  if (!prompt) return null;

  const Icon = prompt.icon;


  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/20 overflow-hidden",
        "bg-gradient-to-br from-primary/[0.07] via-card to-primary/[0.03]",
        "shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.18)]",
      )}
    >
      <div className="p-4 sm:p-5 flex items-start gap-4">
        {/* Icon tile */}
        <div
          className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0",
            "bg-primary/15 text-primary",
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>

        {/* Text + action */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {prompt.pill}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-semibold leading-tight">
            {prompt.title}
          </h3>
          {prompt.hint && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">
              {prompt.hint}
            </p>
          )}

          {!prompt.informational && prompt.onClick && (
            <div className="mt-3">
              <Button
                onClick={prompt.onClick}
                className="gap-1.5 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
                size="sm"
              >
                {prompt.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /**
   * The state machine for "what should the host do right now". Order of
   * checks matters — earliest match wins.
   */
  function pickPrompt(): Prompt | null {
    // Voided wins over the regular status branches — the host can void
    // a draft or live event, and the banner should reflect that even
    // before the row's status flips.
    if (voided || status === "voided") {
      return {
        icon: Flag,
        pill: "VOIDED",
        title: "Event voided",
        hint: "This event no longer counts toward player ratings. The schedule and standings remain visible as a record.",
        cta: "",
        informational: true,
      };
    }

    if (status === "completed") {
      return {
        icon: CheckCircle2,
        pill: "DONE",
        title: "Event complete",
        hint: "All scored matches are in the players' history. Ratings have been updated.",
        cta: "",
        informational: true,
      };
    }

    if (status === "draft") {
      if (!hasPlayers) {
        return {
          icon: Users,
          pill: "SETUP",
          title: "Add at least 4 players to get started",
          hint:
            playerCount > 0
              ? `${playerCount} of 4 minimum confirmed. Open registration is also available in Settings.`
              : "Round Robins need 4 players minimum. You can also enable open registration in Settings.",
          cta: "Add players",
          onClick: onAddPlayers,
        };
      }
      if (!hasSchedule) {
        return {
          icon: Sparkles,
          pill: "READY TO GENERATE",
          title: "Generate the schedule",
          hint:
            playerCount && courtCount
              ? `${playerCount} confirmed players · ${courtCount} ${courtCount === 1 ? "court" : "courts"} available`
              : "Locks in rounds and matchups so you can start play.",
          cta: "Generate schedule",
          onClick: onGenerateSchedule,
        };
      }
      return {
        icon: Play,
        pill: "READY TO START",
        title: "Start the event",
        hint: `${playerCount} confirmed players · ${totalRounds} ${totalRounds === 1 ? "round" : "rounds"} planned.`,
        cta: "Start event",
        onClick: onStartEvent,
      };
    }

    // status === "live"
    if (currentRoundTotalCount > 0 && currentRoundScoredCount >= currentRoundTotalCount) {
      // Every match in the current round has a score.
      if (currentRound != null && currentRound >= totalRounds) {
        // Last round complete — invite to submit.
        return {
          icon: Flag,
          pill: "FINAL",
          title: "All rounds scored",
          hint: "Submit to lock in standings. Scored matches are already in players' history.",
          cta: "Complete event",
          onClick: onCompleteEvent,
        };
      }
      // Mid-event — advance to the next round.
      return {
        icon: ArrowRight,
        pill: "ACTION",
        title: `Round ${currentRound} is done — advance to Round ${(currentRound ?? 0) + 1}`,
        hint: "Close the current round to lock its scores and move on.",
        cta: `Close Round ${currentRound}`,
        onClick: onCloseRound,
      };
    }

    if (currentRoundTotalCount > 0) {
      // Mid-round, some scores pending.
      const left = currentRoundTotalCount - currentRoundScoredCount;
      return {
        icon: ClipboardCheck,
        pill: "SCORING",
        title:
          left === currentRoundTotalCount
            ? `Score Round ${currentRound}`
            : `${left} ${left === 1 ? "match" : "matches"} left in Round ${currentRound}`,
        hint: "Tap any match below to enter scores. Matches sync to player history immediately.",
        cta: "",
        informational: true,
      };
    }

    return null;
  }
}
