import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";

interface CourtTopPlayersProps {
  courtId: string;
}

interface PlayerStats {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  matchCount: number;
  wins: number;
  winRate: number;
}

export function CourtTopPlayers({ courtId }: CourtTopPlayersProps) {
  const [topPlayers, setTopPlayers] = useState<PlayerStats[]>([]);

  useEffect(() => {
    fetchTopPlayers();
  }, [courtId]);

  const fetchTopPlayers = async () => {
    // Get all approved, non-voided matches (all-time)
    const { data: matches } = await supabase
      .from("matches")
      .select(`
        id,
        team1_score,
        team2_score,
        match_participants!inner(
          player_id,
          team
        )
      `)
      .eq("court_id", courtId)
      .eq("status", "approved")
      .eq("voided", false);

    if (!matches || matches.length === 0) {
      setTopPlayers([]);
      return;
    }

    // Get unique player IDs
    const playerIds = Array.from(new Set(
      matches.flatMap((m: any) => m.match_participants.map((p: any) => p.player_id))
    ));

    // Fetch player profiles (excluding test accounts)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", playerIds)
      .is("is_test_account", null);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Aggregate player stats
    const playerMap = new Map<string, { 
      displayName: string;
      avatarUrl: string | null;
      matchCount: number;
      wins: number;
    }>();

    matches.forEach((match: any) => {
      if (match.team1_score === null || match.team2_score === null) return;

      const winningTeam = match.team1_score > match.team2_score ? 1 : 2;

      match.match_participants.forEach((p: any) => {
        // Skip if not in valid profiles (test accounts filtered out)
        const profile = profileMap.get(p.player_id);
        if (!profile) return;

        if (!playerMap.has(p.player_id)) {
          playerMap.set(p.player_id, {
            displayName: profile.display_name || 'Unknown',
            avatarUrl: profile.avatar_url || null,
            matchCount: 0,
            wins: 0,
          });
        }

        const stats = playerMap.get(p.player_id)!;
        stats.matchCount++;
        if (p.team === winningTeam) {
          stats.wins++;
        }
      });
    });

    // Convert to array and calculate win rates
    const playerStats: PlayerStats[] = Array.from(playerMap.entries())
      .map(([playerId, stats]) => ({
        playerId,
        displayName: stats.displayName,
        avatarUrl: stats.avatarUrl,
        matchCount: stats.matchCount,
        wins: stats.wins,
        winRate: stats.matchCount > 0 ? (stats.wins / stats.matchCount) * 100 : 0,
      }))
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 5);

    setTopPlayers(playerStats);
  };

  if (topPlayers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Top Players (All-Time)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topPlayers.map((player, index) => (
            <div key={player.playerId} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-muted-foreground w-6">
                  #{index + 1}
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={player.avatarUrl || undefined} />
                  <AvatarFallback>
                    {player.displayName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{player.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {player.matchCount} match{player.matchCount !== 1 ? 'es' : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">
                  {player.winRate.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {player.wins}W-{player.matchCount - player.wins}L
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
