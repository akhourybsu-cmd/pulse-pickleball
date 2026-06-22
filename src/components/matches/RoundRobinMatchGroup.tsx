import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toLocaleDateStringEST } from "@/lib/utils";
import { PremiumMatchCard } from "@/components/matches/PremiumMatchCard";

interface GroupMatch {
  match_id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  my_team: number;
  partner_name: string;
  partner_id: string;
  partner_avatar_url?: string | null;
  opponent1_name: string;
  opponent1_id: string;
  opponent1_avatar_url?: string | null;
  opponent2_name: string;
  opponent2_id: string;
  opponent2_avatar_url?: string | null;
  rating_change: number;
  court_name: string;
  source?: string;
  round_no?: number;
  court_no?: number;
  won: boolean;
}

export interface RoundRobinGroup {
  eventId: string;
  name: string;
  date: string;
  matches: GroupMatch[];
  wins: number;
  losses: number;
  netRating: number;
}

interface Props {
  group: RoundRobinGroup;
  playerName: string;
  showVerifyActions: boolean;
  perspective?: 'self' | 'other';
  getVerificationStatus: (match: any) => {
    verifiedCount: number;
    totalPlayers: number;
    isCurrentUserVerified: boolean;
  };
  onVerify: (matchId: string) => void;
  onReport: (matchId: string) => void;
}

export function RoundRobinMatchGroup({
  group,
  playerName,
  showVerifyActions,
  perspective = 'self',
  getVerificationStatus,
  onVerify,
  onReport,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const netSign = group.netRating > 0 ? "+" : "";
  const netColor =
    group.netRating > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : group.netRating < 0
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";

  return (
    <Card className="rounded-2xl border-2 border-border shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{group.name}</span>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                Round Robin
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {toLocaleDateStringEST(group.date)} · {group.matches.length} match
              {group.matches.length === 1 ? "" : "es"} · {group.wins}-{group.losses}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={cn("text-sm font-semibold tabular-nums", netColor)}>
              {netSign}
              {group.netRating}
            </span>
            <ChevronDown
              className={cn(
                "w-5 h-5 text-muted-foreground transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </div>
        </CardContent>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border bg-muted/20">
              {group.matches.map((match) => {
                const { verifiedCount, totalPlayers, isCurrentUserVerified } =
                  getVerificationStatus(match);
                return (
                  <PremiumMatchCard
                    perspective={perspective}
                    key={match.match_id}
                    matchId={match.match_id}
                    matchDate={match.match_date}
                    team1Score={match.team1_score}
                    team2Score={match.team2_score}
                    myTeam={match.my_team as 1 | 2}
                    won={match.won}
                    playerName={playerName}
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
                    courtName={match.court_name}
                    source={match.source}
                    roundNo={match.round_no}
                    courtNo={match.court_no}
                    verifiedCount={verifiedCount}
                    totalPlayers={totalPlayers}
                    isCurrentUserVerified={isCurrentUserVerified}
                    showVerifyActions={showVerifyActions}
                    onVerify={() => onVerify(match.match_id)}
                    onReport={() => onReport(match.match_id)}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
