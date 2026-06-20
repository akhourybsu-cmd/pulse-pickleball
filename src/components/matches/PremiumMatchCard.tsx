import { useMemo } from "react";
import { format, parseISO, isToday, isYesterday, differenceInDays } from "date-fns";
import { CheckCircle2, Clock, Flag, MapPin, Trophy } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface PremiumMatchCardProps {
  /** Stable id (used by the keyed parent and the verify/report handlers). */
  matchId: string;
  matchDate: string;       // YYYY-MM-DD
  team1Score: number;
  team2Score: number;
  myTeam: 1 | 2;
  won: boolean;
  playerName: string;       // "you"
  playerAvatarUrl?: string | null;
  partnerName: string;
  partnerId: string;
  partnerAvatarUrl?: string | null;
  opponent1Name: string;
  opponent1Id: string;
  opponent1AvatarUrl?: string | null;
  opponent2Name: string;
  opponent2Id: string;
  opponent2AvatarUrl?: string | null;
  /** Rating delta from match_participants.rating_change (signed decimal). */
  ratingChange: number | null;
  courtName: string;
  source?: string | null;
  roundNo?: number | null;
  courtNo?: number | null;
  /** Verification roll-up. */
  verifiedCount: number;
  totalPlayers: number;
  isCurrentUserVerified: boolean;
  /** When false, hide the verify/report action (e.g. viewing another player's history). */
  showVerifyActions: boolean;
  onVerify?: () => void;
  onReport?: () => void;
  /** When true, render in awaiting-confirmation mode (amber accent, Pending pill, Confirm Result CTA). */
  pending?: boolean;
  /** Pending mode only — whether the current viewer already confirmed. */
  pendingConfirmedByMe?: boolean;
  /** Pending mode only — fires when the current viewer taps Confirm Result. */
  onConfirm?: () => void;
}

/**
 * Premium match-history card.
 *
 * Replaces the previous three-column "Your Team / score / Opponents" card
 * that had per-player check/warning icons (noisy) with a hero treatment
 * built around the score and the win/loss state:
 *
 *  - Top accent stripe on wins (gold gradient → fades) so wins read at a
 *    glance from across the room
 *  - WON/LOST status pill + smart date ("Today", "Yesterday", "Sun · Nov 30")
 *  - Round-Robin badge inline when source === 'round_robin'
 *  - Rating delta pill (+0.12 / −0.08) — the part the player actually
 *    cares about, prominent on the row
 *  - Massive tabular score with the winner's side in foreground and the
 *    loser's side muted — at-a-glance read
 *  - Avatar initials for both pairings so the card has human texture
 *  - Compact footer: court · verification roll-up · verify CTA / flag
 *
 * The whole card is a button (tappable area lifts on hover, presses on
 * active) so a future "match detail" sheet has somewhere to hook in.
 */
export function PremiumMatchCard(props: PremiumMatchCardProps) {
  const {
    matchDate, team1Score, team2Score, myTeam, won,
    playerName, playerAvatarUrl, partnerName, partnerAvatarUrl, opponent1Name, opponent1AvatarUrl, opponent2Name, opponent2AvatarUrl,
    ratingChange, courtName, source, roundNo, courtNo,
    verifiedCount, totalPlayers, isCurrentUserVerified,
    showVerifyActions, onVerify, onReport,
    pending = false, pendingConfirmedByMe = false, onConfirm,
  } = props;

  const myScore = myTeam === 1 ? team1Score : team2Score;
  const theirScore = myTeam === 1 ? team2Score : team1Score;

  const initials = (name: string) =>
    name.split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const smartDate = useMemo(() => {
    try {
      const d = parseISO(matchDate + "T00:00:00");
      if (isToday(d)) return "Today";
      if (isYesterday(d)) return "Yesterday";
      const days = differenceInDays(new Date(), d);
      if (days > 0 && days < 7) return format(d, "EEEE"); // Monday, Tuesday…
      return format(d, "EEE · MMM d");                    // Sun · Nov 30
    } catch {
      return matchDate;
    }
  }, [matchDate]);

  const showRatingDelta =
    ratingChange !== null && ratingChange !== undefined && Math.abs(ratingChange) > 0.0001;

  const isRRMatch = source === "round_robin";

  return (
    <div
      className={cn(
        "group relative w-full text-left rounded-2xl bg-card overflow-hidden",
        "border transition-all duration-200",
        "hover:-translate-y-0.5",
        pending
          ? "border-amber-300/60 hover:border-amber-400 hover:shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.30)]"
          : won
            ? "border-primary/25 hover:border-primary/45 hover:shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.40)]"
            : "border-border/60 hover:border-border hover:shadow-[0_12px_28px_-14px_hsl(var(--foreground)/0.10)]",
      )}
    >
      {/* Top accent stripe — amber on pending, gold on wins, none on losses. */}
      {pending ? (
        <div className="h-[3px] w-full bg-gradient-to-r from-amber-400 via-amber-400 to-amber-400/30" />
      ) : won ? (
        <div className="h-[3px] w-full bg-gradient-to-r from-primary via-primary to-primary/30" />
      ) : null}

      <div className="p-4 sm:p-5">
        {/* Row 1 — chips and rating delta */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0",
                pending
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : won
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {pending ? <Clock className="h-2.5 w-2.5" /> : won ? <Trophy className="h-2.5 w-2.5" /> : null}
              {pending ? "Pending" : won ? "Won" : "Lost"}
            </span>
            <span className="text-xs text-muted-foreground truncate">{smartDate}</span>
            {isRRMatch && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
                RR
                {roundNo != null && ` · R${roundNo}`}
                {courtNo != null && ` · C${courtNo}`}
              </span>
            )}
          </div>

          {pending ? (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tabular-nums flex-shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
              title="Players who have confirmed"
            >
              {verifiedCount}/{totalPlayers}
            </span>
          ) : showRatingDelta ? (
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tabular-nums flex-shrink-0",
                ratingChange! > 0
                  ? "bg-primary/15 text-primary"
                  : "bg-destructive/10 text-destructive",
              )}
              title="Rating change"
            >
              {ratingChange! > 0 ? "+" : ""}
              {ratingChange!.toFixed(2)}
            </span>
          ) : null}
        </div>

        {/* Row 2 — score hero */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
          {/* You & partner */}
          <div className="min-w-0">
            <div className="flex -space-x-2 mb-1.5">
              <Avatar className="h-7 w-7 ring-2 ring-card">
                <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
                  {initials(playerName)}
                </AvatarFallback>
              </Avatar>
              {partnerName && partnerName !== "Unknown" && (
                <Avatar className="h-7 w-7 ring-2 ring-card">
                  <AvatarFallback className="text-[10px] font-bold bg-muted text-foreground/80">
                    {initials(partnerName)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              You &amp; Partner
            </div>
            <div className="text-xs text-foreground/80 truncate font-medium mt-0.5">
              {partnerName && partnerName !== "Unknown" ? partnerName : "Solo"}
            </div>
          </div>

          {/* Score */}
          <div className="flex items-center gap-2 sm:gap-3 px-1 sm:px-3">
            <div
              className={cn(
                "font-bold tabular-nums leading-none tracking-tight text-4xl sm:text-5xl",
                pending ? "text-foreground" : won ? "text-foreground" : "text-muted-foreground/60",
              )}
            >
              {myScore}
            </div>
            <div className="text-2xl sm:text-3xl text-muted-foreground/30 font-light leading-none">
              –
            </div>
            <div
              className={cn(
                "font-bold tabular-nums leading-none tracking-tight text-4xl sm:text-5xl",
                pending ? "text-foreground" : won ? "text-muted-foreground/60" : "text-foreground",
              )}
            >
              {theirScore}
            </div>
          </div>

          {/* Opponents */}
          <div className="min-w-0 text-right">
            <div className="flex -space-x-2 mb-1.5 justify-end">
              <Avatar className="h-7 w-7 ring-2 ring-card">
                <AvatarFallback className="text-[10px] font-bold bg-muted text-foreground/80">
                  {initials(opponent1Name)}
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-7 w-7 ring-2 ring-card">
                <AvatarFallback className="text-[10px] font-bold bg-muted text-foreground/80">
                  {initials(opponent2Name)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Opponents
            </div>
            <div className="text-xs text-foreground/80 truncate font-medium mt-0.5">
              {opponent1Name} <span className="text-muted-foreground">·</span> {opponent2Name}
            </div>
          </div>
        </div>

        {/* Row 3 — court + verification + actions */}
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/40 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
            <MapPin className="h-3 w-3 flex-shrink-0 text-primary/70" />
            <span className="truncate">{courtName}</span>
          </span>

          {pending ? (
            pendingConfirmedByMe ? (
              <span className="flex items-center gap-1 text-muted-foreground font-medium flex-shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                You confirmed — waiting on others
              </span>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
              >
                <CheckCircle2 className="h-3 w-3" />
                Confirm Result
              </button>
            )
          ) : showVerifyActions ? (
            isCurrentUserVerified ? (
              <span className="flex items-center gap-1 text-primary font-semibold flex-shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified · {verifiedCount}/{totalPlayers}
              </span>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={onVerify}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Verify ({verifiedCount}/{totalPlayers})
                </button>
                {onReport && (
                  <button
                    type="button"
                    onClick={onReport}
                    aria-label="Report a problem"
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          ) : (
            <span className="text-muted-foreground flex-shrink-0">
              {verifiedCount}/{totalPlayers} confirmed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
