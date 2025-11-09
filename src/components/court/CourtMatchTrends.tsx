import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface CourtMatchTrendsProps {
  courtId: string;
}

interface WeeklyData {
  week: string;
  matches: number;
  avgScore: number;
}

export function CourtMatchTrends({ courtId }: CourtMatchTrendsProps) {
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [view, setView] = useState<"matches" | "scores">("matches");

  useEffect(() => {
    fetchTrends();
  }, [courtId]);

  const fetchTrends = async () => {
    // Get matches from last 6 months for trends
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: matches } = await supabase
      .from("matches")
      .select(`
        id,
        match_date,
        team1_score,
        team2_score,
        match_participants!inner(player_id)
      `)
      .eq("court_id", courtId)
      .gte("match_date", sixMonthsAgo.toISOString().split('T')[0])
      .eq("status", "approved")
      .eq("voided", false);

    if (!matches || matches.length === 0) {
      setWeeklyData([]);
      return;
    }

    // Get player IDs to filter test accounts
    const playerIds = Array.from(new Set(
      matches.flatMap((m: any) => m.match_participants.map((p: any) => p.player_id))
    ));

    // Fetch profiles to check test accounts
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .in("id", playerIds)
      .is("is_test_account", null);

    const validPlayerIds = new Set(profiles?.map(p => p.id) || []);

    // Filter out matches with test accounts
    const validMatches = matches.filter((match: any) => 
      match.match_participants.every((p: any) => validPlayerIds.has(p.player_id))
    );

    // Group by week
    const weekMap = new Map<string, { count: number; scores: number[] }>();
    
    validMatches.forEach((match: any) => {
      const date = new Date(match.match_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { count: 0, scores: [] });
      }

      const week = weekMap.get(weekKey)!;
      week.count++;
      
      if (match.team1_score !== null && match.team2_score !== null) {
        const winningScore = Math.max(match.team1_score, match.team2_score);
        week.scores.push(winningScore);
      }
    });

    // Convert to array and sort by date
    const data = Array.from(weekMap.entries())
      .map(([weekKey, { count, scores }]) => ({
        week: new Date(weekKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        matches: count,
        avgScore: scores.length > 0 
          ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
          : 0,
      }))
      .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());

    setWeeklyData(data);
  };

  if (weeklyData.length === 0) {
    return null;
  }

  const chartConfig = {
    matches: {
      label: "Matches",
      color: "hsl(var(--primary))",
    },
    avgScore: {
      label: "Avg Winning Score",
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">Match Activity (6 months)</CardTitle>
          <div className="flex gap-2">
            <button
              onClick={() => setView("matches")}
              className={`text-xs px-2 py-1 rounded ${
                view === "matches" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              Matches
            </button>
            <button
              onClick={() => setView("scores")}
              className={`text-xs px-2 py-1 rounded ${
                view === "scores" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              Scores
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey={view === "matches" ? "matches" : "avgScore"}
                stroke={view === "matches" ? "hsl(var(--primary))" : "hsl(var(--chart-2))"}
                strokeWidth={2}
                dot={{ fill: view === "matches" ? "hsl(var(--primary))" : "hsl(var(--chart-2))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
