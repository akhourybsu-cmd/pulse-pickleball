import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Target, TrendingUp } from "lucide-react";

interface CourtMatchAnalyticsProps {
  courtId: string;
}

interface MatchAnalyticsData {
  totalMatches: number;
  uniquePlayers: number;
  avgWinningScore: number;
  avgLosingScore: number;
}

export function CourtMatchAnalytics({ courtId }: CourtMatchAnalyticsProps) {
  const [analytics, setAnalytics] = useState<MatchAnalyticsData | null>(null);

  useEffect(() => {
    fetchMatchAnalytics();
  }, [courtId]);

  const fetchMatchAnalytics = async () => {
    // Get all approved, non-voided matches (all-time)
    const { data: matches } = await supabase
      .from("matches")
      .select(`
        id,
        team1_score,
        team2_score,
        match_participants!inner(player_id, profiles:player_id(is_test_account))
      `)
      .eq("court_id", courtId)
      .eq("status", "approved")
      .eq("voided", false);

    if (!matches || matches.length === 0) {
      setAnalytics({
        totalMatches: 0,
        uniquePlayers: 0,
        avgWinningScore: 0,
        avgLosingScore: 0,
      });
      return;
    }

    // Filter out matches with test accounts
    const validMatches = matches.filter((match: any) => 
      !match.match_participants.some((p: any) => p.profiles?.is_test_account)
    );

    // Calculate unique players
    const uniquePlayerIds = new Set<string>();
    validMatches.forEach((match: any) => {
      match.match_participants.forEach((p: any) => {
        if (!p.profiles?.is_test_account) {
          uniquePlayerIds.add(p.player_id);
        }
      });
    });

    // Calculate average scores
    const scores = validMatches
      .filter((m: any) => m.team1_score !== null && m.team2_score !== null)
      .map((m: any) => ({
        winning: Math.max(m.team1_score, m.team2_score),
        losing: Math.min(m.team1_score, m.team2_score),
      }));

    const avgWinningScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.winning, 0) / scores.length)
      : 0;

    const avgLosingScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.losing, 0) / scores.length)
      : 0;

    setAnalytics({
      totalMatches: validMatches.length,
      uniquePlayers: uniquePlayerIds.size,
      avgWinningScore,
      avgLosingScore,
    });
  };

  if (!analytics) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.totalMatches}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unique Players</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.uniquePlayers}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Match Score</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {analytics.avgWinningScore}-{analytics.avgLosingScore}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Score Spread</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {analytics.avgWinningScore - analytics.avgLosingScore}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Avg point differential</p>
        </CardContent>
      </Card>
    </div>
  );
}
