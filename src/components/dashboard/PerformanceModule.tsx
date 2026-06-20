import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Trophy, TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardModuleSkeleton } from "@/components/layout/DashboardModuleSkeleton";
import { MatchCard } from "./MatchCard";

interface Match {
  id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  userTeam: number;
  team1Players: { id: string; name: string; initials: string; avatar_url?: string | null }[];
  team2Players: { id: string; name: string; initials: string; avatar_url?: string | null }[];
  courtName: string | null;
  location: string | null;
  eventName: string | null;
  ratingChange?: number;
}

interface PerformanceModuleProps {
  userId: string | undefined;
}

export const PerformanceModule = ({ userId }: PerformanceModuleProps) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchMatchHistory = async () => {
      setLoading(true);

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
            court:courts (name, city, state),
            event:events (name)
          )
        `)
        .eq("player_id", userId)
        .eq("matches.status", "approved")
        .order("created_at", { ascending: false })
        .limit(10);

      if (participations && participations.length > 0) {
        // Collect all match IDs for batched query (N+1 optimization)
        const matchIds = participations
          .filter(p => p.match)
          .map(p => (p.match as any).id);
        
        // Batch fetch all participants for all matches in single query
        const { data: allParticipants } = await supabase
          .from("match_participants")
          .select("match_id, player_id, team, player:profiles!match_participants_player_id_fkey(id, display_name, full_name, first_name, last_name)")
          .in("match_id", matchIds);
        
        // Group participants by match_id for O(1) lookup
        const participantsByMatch = (allParticipants || []).reduce((acc, p) => {
          if (!acc[p.match_id]) acc[p.match_id] = [];
          acc[p.match_id].push(p);
          return acc;
        }, {} as Record<string, any[]>);
        
        const matchData: Match[] = participations
          .filter(p => p.match)
          .map(p => {
            const match = p.match as any;
            const matchParticipants = participantsByMatch[match.id] || [];
            
            const team1Players: { id: string; name: string; initials: string }[] = [];
            const team2Players: { id: string; name: string; initials: string }[] = [];

            matchParticipants.forEach((participant: any) => {
              const player = participant.player;
              const name = player?.display_name || player?.full_name || 
                `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'Unknown';
              const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              
              const playerData = { id: player?.id || '', name, initials };
              
              if (participant.team === 1) {
                team1Players.push(playerData);
              } else {
                team2Players.push(playerData);
              }
            });

            return {
              id: match.id,
              match_date: match.match_date,
              team1_score: match.team1_score,
              team2_score: match.team2_score,
              userTeam: p.team,
              team1Players,
              team2Players,
              courtName: match.court?.name || null,
              location: match.court ? `${match.court.city}, ${match.court.state}` : null,
              eventName: match.event?.name || null,
              ratingChange: p.rating_change,
            };
          });
        
        setMatches(matchData);
      }
      
      setLoading(false);
    };

    fetchMatchHistory();
  }, [userId]);

  // Group matches by month
  const groupedMatches = matches.reduce((acc, match) => {
    const monthKey = format(new Date(match.match_date), "MMMM yyyy");
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
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
            {/* Tinted icon tile + clear primary CTA so the empty state feels
                like an onboarding moment instead of a dead end. */}
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No matches yet
            </p>
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
                    <MatchCard
                      key={match.id}
                      id={match.id}
                      matchDate={match.match_date}
                      userTeam={match.userTeam}
                      team1Score={match.team1_score}
                      team2Score={match.team2_score}
                      team1Players={match.team1Players}
                      team2Players={match.team2Players}
                      courtName={match.courtName}
                      location={match.location}
                      eventName={match.eventName}
                      ratingChange={match.ratingChange}
                      onClick={() => navigate("/match/history")}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Trends Section - Placeholder for future analytics */}
      {matches.length >= 5 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Trends</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* Recent form indicator */}
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Last 5</p>
              <div className="flex justify-center gap-1">
                {matches.slice(0, 5).map((m, i) => {
                  const userScore = m.userTeam === 1 ? m.team1_score : m.team2_score;
                  const oppScore = m.userTeam === 1 ? m.team2_score : m.team1_score;
                  const isWin = userScore > oppScore;
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
            
            {/* Win rate in recent matches */}
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Recent Rate</p>
              <p className="text-lg font-bold text-foreground">
                {Math.round((matches.slice(0, 5).filter(m => {
                  const userScore = m.userTeam === 1 ? m.team1_score : m.team2_score;
                  const oppScore = m.userTeam === 1 ? m.team2_score : m.team1_score;
                  return userScore > oppScore;
                }).length / Math.min(matches.length, 5)) * 100)}%
              </p>
            </div>
            
            {/* Avg rating change */}
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
