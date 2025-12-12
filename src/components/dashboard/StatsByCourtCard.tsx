import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, MapPin } from "lucide-react";

interface CourtStat {
  wins: number;
  losses: number;
  total_matches: number;
  avg_rating: number;
  points_for: number;
  points_against: number;
}

interface StatsByCourtCardProps {
  userId: string | undefined;
}

export const StatsByCourtCard = ({ userId }: StatsByCourtCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [topCourt, setTopCourt] = useState<{ name: string; stats: CourtStat } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      setLoading(true);

      // Fetch all matches for user with court info
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

      // Aggregate stats by court
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
              avg_rating: 0,
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

      // Find court with most matches
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
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-2">
            <div className="h-4 bg-muted rounded w-48"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!topCourt) {
    return null;
  }

  const winRate = topCourt.stats.total_matches > 0
    ? ((topCourt.stats.wins / topCourt.stats.total_matches) * 100).toFixed(1)
    : "0.0";

  const pointDiff = topCourt.stats.points_for - topCourt.stats.points_against;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                Your Most Played Court: <span className="text-primary">{topCourt.name}</span>
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Matches</p>
                <p className="text-lg font-bold">{topCourt.stats.total_matches}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Record</p>
                <p className="text-lg font-bold">{topCourt.stats.wins}W-{topCourt.stats.losses}L</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-lg font-bold">{winRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Point Diff</p>
                <p className={`text-lg font-bold ${pointDiff >= 0 ? "text-primary" : "text-destructive"}`}>
                  {pointDiff >= 0 ? "+" : ""}{pointDiff}
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
