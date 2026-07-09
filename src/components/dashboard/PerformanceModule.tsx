import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Trophy, TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardModuleSkeleton } from "@/components/layout/DashboardModuleSkeleton";
import { PremiumMatchCard } from "@/components/matches/PremiumMatchCard";
import { resolvePlayerName, resolveParticipantName, didTeamWin } from "@/lib/matchDisplay";

interface Participant {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Match {
  id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  myTeam: 1 | 2;
  partner: Participant | null;
  opponent1: Participant | null;
  opponent2: Participant | null;
  courtName: string;
  source: string | null;
  ratingChange: number | null;
  verifiedCount: number;
  totalPlayers: number;
}

interface PerformanceModuleProps {
  userId: string | undefined;
}

export const PerformanceModule = ({ userId }: PerformanceModuleProps) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [me, setMe] = useState<{ name: string; avatarUrl: string | null }>({ name: "You", avatarUrl: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchMatchHistory = async () => {
      setLoading(true);

      // Self profile so the my-team avatar is consistent with the rest of the app.
      const { data: meProfile } = await supabase
        .from("profiles")
        .select("display_name, full_name, first_name, last_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (meProfile) {
        setMe({
          name: resolvePlayerName(meProfile as any),
          avatarUrl: (meProfile as any).avatar_url || null,
        });
      }

      // Fetch approved matches only (finalized historical data)
      const { data: participations } = await supabase
        .from("match_participants")
        .select(`
          team,
          rating_change,
          match:matches!inner (
            id,
            match_date,
            team1_score,
            team2_score,
            status,
            source,
            verified_by,
            other_location,
            court:courts (name)
          )
        `)
        .eq("player_id", userId)
        .eq("matches.status", "approved")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!participations || participations.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const matchIds = participations
        .filter((p: any) => p.match)
        .map((p: any) => p.match.id);

      // Include guest_player_id + guest join so the dashboard match
      // cards show guest names instead of resolving them to "Removed
      // player" — same bug the top-level MatchHistory had.
      const { data: allParticipants } = await supabase
        .from("match_participants")
        .select(`
          match_id,
          player_id,
          guest_player_id,
          team,
          player:profiles_public!match_participants_player_id_fkey(id, display_name, full_name, first_name, last_name, avatar_url),
          guest:guest_players!match_participants_guest_player_id_fkey(display_name, linked_user_id)
        `)
        .in("match_id", matchIds);

      const participantsByMatch = (allParticipants || []).reduce((acc: Record<string, any[]>, p: any) => {
        if (!acc[p.match_id]) acc[p.match_id] = [];
        acc[p.match_id].push(p);
        return acc;
      }, {});

      const matchData: Match[] = participations
        .filter((p: any) => p.match)
        .map((p: any) => {
          const m = p.match;
          const parts = participantsByMatch[m.id] || [];
          const myTeam = (p.team as 1 | 2);

          // The joined column here is aliased `player` (not `profiles`)
          // so shape it up before the shared resolver looks at it.
          const toParticipant = (row: any): Participant => ({
            id: row.player?.id || row.player_id || row.guest_player_id,
            name: resolveParticipantName({
              player_id: row.player_id,
              guest_player_id: row.guest_player_id,
              profiles: row.player,
              guest: row.guest,
            }),
            avatar_url: row.player?.avatar_url || null,
          });

          const teammate = parts.find((r) => r.team === myTeam && r.player_id !== userId);
          const opps = parts.filter((r) => r.team !== myTeam);

          const courtName = m.other_location || m.court?.name || "Unknown Location";

          const verifiedBy: string[] = m.verified_by || [];
          const totalPlayers = parts.length || 4;

          return {
            id: m.id,
            match_date: m.match_date,
            team1_score: m.team1_score,
            team2_score: m.team2_score,
            myTeam,
            partner: teammate ? toParticipant(teammate) : null,
            opponent1: opps[0] ? toParticipant(opps[0]) : null,
            opponent2: opps[1] ? toParticipant(opps[1]) : null,
            courtName,
            source: m.source ?? null,
            ratingChange: p.rating_change ?? null,
            verifiedCount: verifiedBy.length,
            totalPlayers,
          };
        });

      setMatches(matchData);
      setLoading(false);
    };

    fetchMatchHistory();
  }, [userId]);

  // Group matches by month
  const groupedMatches = matches.reduce((acc, match) => {
    const monthKey = format(new Date(match.match_date), "MMMM yyyy");
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Match History</h3>
        </div>
        <DashboardModuleSkeleton count={2} rowHeight="h-24" showHeader={false} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Match History Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Match History</h3>
          </div>
          {matches.length > 0 && (
            <button
              onClick={() => navigate("/player/matches")}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-9 px-4 bg-muted/30 rounded-xl border border-border">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No matches yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Log your first match to start building your PULSE rating.
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/player/matches/new")}
              className="h-9 gap-1.5 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
            >
              Record a match
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMatches).map(([month, monthMatches]) => (
              <div key={month}>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {month}
                </h4>
                <div className="space-y-2">
                  {monthMatches.map((match) => (
                    <PremiumMatchCard
                      key={match.id}
                      perspective="self"
                      matchId={match.id}
                      matchDate={match.match_date}
                      team1Score={match.team1_score}
                      team2Score={match.team2_score}
                      myTeam={match.myTeam}
                      won={didTeamWin(match.myTeam, match.team1_score, match.team2_score)}
                      playerName={me.name}
                      playerAvatarUrl={me.avatarUrl}
                      partnerName={match.partner?.name || ""}
                      partnerId={match.partner?.id || ""}
                      partnerAvatarUrl={match.partner?.avatar_url || null}
                      opponent1Name={match.opponent1?.name || ""}
                      opponent1Id={match.opponent1?.id || ""}
                      opponent1AvatarUrl={match.opponent1?.avatar_url || null}
                      opponent2Name={match.opponent2?.name || ""}
                      opponent2Id={match.opponent2?.id || ""}
                      opponent2AvatarUrl={match.opponent2?.avatar_url || null}
                      ratingChange={match.ratingChange}
                      courtName={match.courtName}
                      source={match.source}
                      verifiedCount={match.verifiedCount}
                      totalPlayers={match.totalPlayers}
                      isCurrentUserVerified={false}
                      showVerifyActions={false}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Trends Section */}
      {matches.length >= 5 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Trends</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Last 5</p>
              <div className="flex justify-center gap-1">
                {matches.slice(0, 5).map((m, i) => {
                  const isWin = didTeamWin(m.myTeam, m.team1_score, m.team2_score);
                  return (
                    <span
                      key={i}
                      className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        isWin ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30 text-muted-foreground'
                      }`}
                    >
                      {isWin ? 'W' : 'L'}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Recent Rate</p>
              <p className="text-lg font-bold text-foreground">
                {Math.round((matches.slice(0, 5).filter(m =>
                  didTeamWin(m.myTeam, m.team1_score, m.team2_score)
                ).length / Math.min(matches.length, 5)) * 100)}%
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Avg ±</p>
              {(() => {
                const recentWithRating = matches.slice(0, 5).filter(m => m.ratingChange != null);
                const avg = recentWithRating.length > 0
                  ? recentWithRating.reduce((sum, m) => sum + (m.ratingChange || 0), 0) / recentWithRating.length
                  : 0;
                return (
                  <p className={`text-lg font-bold ${avg >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {avg >= 0 ? '+' : ''}{avg.toFixed(2)}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
