import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Trophy } from "lucide-react";
import { cn, toLocaleDateStringEST } from "@/lib/utils";
import { PremiumMatchCard, RatingMovement } from "./PremiumMatchCard";
import type { HistoryMatch, RoundRobinGroup } from "@/lib/matchHistory";
export type { RoundRobinGroup } from "@/lib/matchHistory";

interface Props {
  group: RoundRobinGroup;
  playerName: string;
  playerId?: string | null;
  playerAvatarUrl?: string | null;
  showVerifyActions: boolean;
  perspective?: "self" | "other";
  getVerificationStatus: (match: HistoryMatch) => {
    verifiedCount: number;
    totalPlayers: number;
    isCurrentUserVerified: boolean;
  };
  onVerify: (matchId: string) => void;
  onReport: (matchId: string) => void;
  busy?: boolean;
}
export function RoundRobinMatchGroup({
  group,
  playerName,
  playerId,
  playerAvatarUrl,
  showVerifyActions,
  perspective = "self",
  getVerificationStatus,
  onVerify,
  onReport,
  busy,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [shown, setShown] = useState(3);
  const panelId = useId();
  const reduced = useReducedMotion();
  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      aria-label={`${group.name} round robin`}
    >
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Round robin
          </span>
          <time
            dateTime={group.date.slice(0, 10)}
            className="text-xs text-muted-foreground"
          >
            {toLocaleDateStringEST(group.date)}
          </time>
        </div>
        <h3 className="break-words text-base font-semibold leading-snug">
          {group.name}
        </h3>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div>
              <p className="text-lg font-bold tabular-nums">
                {group.matches.length}
              </p>
              <p className="text-xs text-muted-foreground">Matches</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums">
                {group.wins}
                <span className="px-1 font-normal text-muted-foreground">
                  –
                </span>
                {group.losses}
              </p>
              <p className="text-xs text-muted-foreground">Wins – losses</p>
            </div>
          </div>
          <RatingMovement
            value={group.netRating}
            ranked={group.rankedCount > 0}
          />
        </div>
        {group.rankedCount > 0 && group.rankedCount < group.matches.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            {group.rankedCount} ranked ·{" "}
            {group.matches.length - group.rankedCount} unranked
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border/50 px-3 py-1.5">
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
            setShown(3);
          }}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? "Hide matches" : `Show ${group.matches.length} matches`}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 transition-transform motion-reduce:transition-none",
              expanded && "rotate-180"
            )}
          />
        </button>
        <Link
          to={`/round-robin/${encodeURIComponent(group.eventId)}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          View event
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div id={panelId}>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t border-border/50 bg-muted/25 p-2 sm:p-3">
                <p className="px-2 pt-1 text-xs text-muted-foreground">
                  Showing {Math.min(shown, group.matches.length)} of{" "}
                  {group.matches.length} matches · Round order
                </p>
                {group.matches.slice(0, shown).map((match) => (
                  <PremiumMatchCard
                    key={match.match_id}
                    matchId={match.match_id}
                    matchDate={match.match_date}
                    team1Score={match.team1_score}
                    team2Score={match.team2_score}
                    myTeam={match.my_team}
                    won={match.won}
                    playerName={playerName}
                    playerId={playerId}
                    playerAvatarUrl={playerAvatarUrl}
                    partnerName={match.partner_name}
                    partnerId={match.partner_id}
                    partnerAvatarUrl={match.partner_avatar_url}
                    opponent1Name={match.opponent1_name}
                    opponent1Id={match.opponent1_id}
                    opponent1AvatarUrl={match.opponent1_avatar_url}
                    opponent2Name={match.opponent2_name}
                    opponent2Id={match.opponent2_id}
                    opponent2AvatarUrl={match.opponent2_avatar_url}
                    ratingChange={match.rating_change}
                    isRanked={match.is_ranked}
                    courtName={match.court_name}
                    source={match.source}
                    roundNo={match.round_no}
                    courtNo={match.court_no}
                    {...getVerificationStatus(match)}
                    perspective={perspective}
                    showVerifyActions={showVerifyActions}
                    onVerify={() => onVerify(match.match_id)}
                    onReport={() => onReport(match.match_id)}
                    busy={busy}
                  />
                ))}
                {shown < group.matches.length && (
                  <button
                    type="button"
                    onClick={() => setShown((value) => value + 6)}
                    className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Show {Math.min(6, group.matches.length - shown)} more
                    matches
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
