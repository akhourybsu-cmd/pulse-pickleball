import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

interface CourtStat {
  wins: number;
  losses: number;
  total_matches: number;
  points_for: number;
  points_against: number;
}

interface StatsByCourtCardProps {
  userId: string | undefined;
}

export const StatsByCourtCard = ({ userId }: StatsByCourtCardProps) => {
  const [topCourt, setTopCourt] = useState<{ name: string; stats: CourtStat } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      setLoading(true);

      const { data: participations } = await supabase
        .from("match_participants")
        .select(`
          team,
          match:matches (
            id,
            team1_score,
            team2_score,
            court:courts (id, name)
          )
        `)
        .eq("player_id", userId);

      if (!participations || participations.length === 0) {
        setLoading(false);
        return;
      }

      const courtStats: Record<string, { name: string; stats: CourtStat }> = {};

      for (const p of participations) {
        if (!p.match) continue;
        const match = p.match as any;
        const courtId = match.court?.id || "other";
        const courtName = match.court?.name || "Other Locations";

        if (!courtStats[courtId]) {
          courtStats[courtId] = {
            name: courtName,
            stats: {
              wins: 0,
              losses: 0,
              total_matches: 0,
              points_for: 0,
              points_against: 0,
            },
          };
        }

        const userScore = p.team === 1 ? match.team1_score : match.team2_score;
        const oppScore = p.team === 1 ? match.team2_score : match.team1_score;
        const isWin = userScore > oppScore;

        courtStats[courtId].stats.total_matches++;
        courtStats[courtId].stats.points_for += userScore;
        courtStats[courtId].stats.points_against += oppScore;
        if (isWin) {
          courtStats[courtId].stats.wins++;
        } else {
          courtStats[courtId].stats.losses++;
        }
      }

      let maxMatches = 0;
      let topCourtData: { name: string; stats: CourtStat } | null = null;

      for (const court of Object.values(courtStats)) {
        if (court.stats.total_matches > maxMatches) {
          maxMatches = court.stats.total_matches;
          topCourtData = court;
        }
      }

      setTopCourt(topCourtData);
      setLoading(false);
    };

    fetchStats();
  }, [userId]);

  if (loading) {
    return <Skeleton className="h-10 w-64 rounded-full" />;
  }

  if (!topCourt) {
    return null;
  }

  const winRate = topCourt.stats.total_matches > 0
    ? ((topCourt.stats.wins / topCourt.stats.total_matches) * 100).toFixed(0)
    : "0";

  const pointDiff = topCourt.stats.points_for - topCourt.stats.points_against;

  return (
    <div className="flex justify-center">
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm transition-all text-sm">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-muted-foreground">Most Played:</span>
            <span className="font-semibold text-foreground truncate max-w-[140px]">{topCourt.name}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 font-bold" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="center">
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">{topCourt.name}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Matches</p>
                <p className="font-bold">{topCourt.stats.total_matches}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Record</p>
                <p className="font-bold">{topCourt.stats.wins}W-{topCourt.stats.losses}L</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="font-bold">{winRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Point Diff</p>
                <p className={`font-bold ${pointDiff >= 0 ? "text-primary" : "text-destructive"}`}>
                  {pointDiff >= 0 ? "+" : ""}{pointDiff}
                </p>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
