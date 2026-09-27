import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Flag,
  MapPin,
  Minus,
  Trophy,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  resolvePlayerInitials as initials,
  formatRatingChange,
} from "@/lib/matchDisplay";

export interface PremiumMatchCardProps {
  matchId: string;
  matchDate: string;
  team1Score: number;
  team2Score: number;
  myTeam: 1 | 2;
  won: boolean;
  playerName: string;
  playerId?: string | null;
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
  ratingChange: number | null;
  courtName: string;
  source?: string | null;
  roundNo?: number | null;
  courtNo?: number | null;
  isRanked?: boolean;
  verifiedCount: number;
  totalPlayers: number;
  isCurrentUserVerified: boolean;
  showVerifyActions: boolean;
  onVerify?: () => void;
  onReport?: () => void;
  pending?: boolean;
  pendingConfirmedByMe?: boolean;
  onConfirm?: () => void;
  busy?: boolean;
  perspective?: "self" | "other";
}

export function RatingMovement({
  value,
  ranked = true,
}: {
  value: number | null;
  ranked?: boolean;
}) {
  const label = formatRatingChange(value);
  const known = value != null && Number.isFinite(value);
  const Icon = !label ? Minus : value! > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="shrink-0 text-right">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {ranked ? "PULSE change" : "Unranked"}
      </div>
      {ranked ? (
        <span
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-sm font-bold tabular-nums",
            !label
              ? "text-muted-foreground"
              : value! > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {known ? label || "0" : "Pending"}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">No rating impact</span>
      )}
    </div>
  );
}

function PlayerIdentity({
  name,
  id,
  avatar,
  self = false,
}: {
  name: string;
  id?: string | null;
  avatar?: string | null;
  self?: boolean;
}) {
  const content = (
    <>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={avatar || undefined} alt="" />
        <AvatarFallback
          className={cn(
            "text-[10px] font-bold",
            self
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 break-words text-sm font-medium leading-snug">
        {self ? "You" : name || "Removed player"}
      </span>
    </>
  );
  const style = "flex min-h-11 min-w-0 items-center gap-2 rounded-lg py-1";
  return id ? (
    <Link
      to={
        self ? "/player/profile" : `/player/profile/${encodeURIComponent(id)}`
      }
      aria-label={`View ${self ? "your" : name + "’s"} profile`}
      className={cn(
        style,
        "-ml-1 px-1 hover:bg-muted/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={style}>{content}</div>
  );
}

export function PremiumMatchCard({
  matchId,
  matchDate,
  team1Score,
  team2Score,
  myTeam,
  won,
  playerName,
  playerId,
  playerAvatarUrl,
  partnerName,
  partnerId,
  partnerAvatarUrl,
  opponent1Name,
  opponent1Id,
  opponent1AvatarUrl,
  opponent2Name,
  opponent2Id,
  opponent2AvatarUrl,
  ratingChange,
  courtName,
  source,
  roundNo,
  courtNo,
  verifiedCount,
  totalPlayers,
  isCurrentUserVerified,
  showVerifyActions,
  onVerify,
  onReport,
  pending = false,
  pendingConfirmedByMe = false,
  onConfirm,
  busy = false,
  perspective = "self",
  isRanked = true,
}: PremiumMatchCardProps) {
  let date = matchDate;
  try {
    date = format(parseISO(matchDate.slice(0, 10)), "MMM d, yyyy");
  } catch {
    /* Retain an unparseable legacy date. */
  }
  const mine = myTeam === 1 ? team1Score : team2Score;
  const theirs = myTeam === 1 ? team2Score : team1Score;
  const tied = mine === theirs;
  const hasPartner = !!partnerName;
  const hasOpponent2 = !!opponent2Name;
  const confirmed = Math.min(verifiedCount, totalPlayers);
  const buttonStyle =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
  return (
    <article
      data-match-id={matchId}
      aria-label={`${
        pending
          ? "Pending match"
          : tied
          ? "Tied match"
          : won
          ? "Won match"
          : "Lost match"
      } on ${date}`}
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm",
        pending ? "border-amber-500/35" : "border-border/70"
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold",
                  pending
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : won
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {pending ? (
                  <Clock className="h-3 w-3" aria-hidden="true" />
                ) : won ? (
                  <Trophy className="h-3 w-3" aria-hidden="true" />
                ) : null}
                {pending ? "Pending" : tied ? "Tied" : won ? "Won" : "Lost"}
              </span>
              <time
                dateTime={matchDate.slice(0, 10)}
                className="text-xs text-muted-foreground"
              >
                {date}
              </time>
            </div>
            {source === "round_robin" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Round robin{roundNo != null && ` · Round ${roundNo}`}
                {courtNo != null && ` · Court ${courtNo}`}
              </p>
            )}
          </div>
          {!pending && (
            <RatingMovement value={ratingChange} ranked={isRanked} />
          )}
        </div>
        <div className="mt-4 divide-y divide-border/50 rounded-xl border border-border/50 bg-muted/15 px-3 sm:px-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {perspective === "self"
                  ? hasPartner
                    ? "Your team"
                    : "You"
                  : hasPartner
                  ? "Player’s team"
                  : "Player"}
              </p>
              <PlayerIdentity
                name={playerName}
                id={playerId}
                avatar={playerAvatarUrl}
                self={perspective === "self"}
              />
              {hasPartner && (
                <PlayerIdentity
                  name={partnerName}
                  id={partnerId}
                  avatar={partnerAvatarUrl}
                />
              )}
            </div>
            <span
              aria-label={`${
                perspective === "self" ? "Your" : playerName + "’s"
              } score: ${mine}`}
              className={cn(
                "min-w-10 text-right text-4xl font-bold tabular-nums",
                !pending && !won && !tied && "text-muted-foreground"
              )}
            >
              {mine}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {hasOpponent2 ? "Opponents" : "Opponent"}
              </p>
              <PlayerIdentity
                name={opponent1Name}
                id={opponent1Id}
                avatar={opponent1AvatarUrl}
              />
              {hasOpponent2 && (
                <PlayerIdentity
                  name={opponent2Name}
                  id={opponent2Id}
                  avatar={opponent2AvatarUrl}
                />
              )}
            </div>
            <span
              aria-label={`Opponent score: ${theirs}`}
              className={cn(
                "min-w-10 text-right text-4xl font-bold tabular-nums",
                !pending && won && "text-muted-foreground"
              )}
            >
              {theirs}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            {courtName || "Location not recorded"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                isCurrentUserVerified && "text-primary"
              )}
              aria-hidden="true"
            />
            {pendingConfirmedByMe
              ? "You confirmed · Awaiting others"
              : totalPlayers > 0
              ? `${confirmed}/${totalPlayers} players confirmed`
              : "Recorded result"}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {pending && !pendingConfirmedByMe && onConfirm && (
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className={cn(
                  buttonStyle,
                  "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {busy ? "Confirming…" : "Confirm score"}
              </button>
            )}
            {!pending &&
              showVerifyActions &&
              !isCurrentUserVerified &&
              onVerify && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onVerify}
                  className={cn(
                    buttonStyle,
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  Verify score
                </button>
              )}
            {showVerifyActions && onReport && (
              <button
                type="button"
                disabled={busy}
                onClick={onReport}
                aria-label="Report a problem with this match"
                className={cn(
                  buttonStyle,
                  "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                Report
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
