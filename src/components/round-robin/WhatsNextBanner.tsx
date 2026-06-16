import { ArrowRight, Users, Sparkles, Play, ClipboardCheck, Flag, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface WhatsNextBannerProps {
  /** Event state — drives which prompt is shown. */
  status: "draft" | "live" | "completed";
  /** True when the host has not yet added any players. */
  hasPlayers: boolean;
  /** True when the schedule has been generated. */
  hasSchedule: boolean;
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
  hasPlayers,
  hasSchedule,
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
}: WhatsNextBannerProps) {
  // Players don't see a host-coaching banner.
  if (!isOrganizer) return null;

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
          pill: "STEP 1",
          title: "Add players to get started",
          hint: "Round Robins need at least 4 players. You can also enable open registration in Settings.",
          cta: "Manage players",
          onClick: onAddPlayers,
        };
      }
      if (!hasSchedule) {
        return {
          icon: Sparkles,
          pill: "STEP 2",
          title: "Generate the schedule",
          hint: "Locks in rounds and matchups so you can start play.",
          cta: "Generate schedule",
          onClick: onGenerateSchedule,
        };
      }
      return {
        icon: Play,
        pill: "READY",
        title: "Start the event",
        hint: "Once you start, the schedule goes live and players can enter scores.",
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
