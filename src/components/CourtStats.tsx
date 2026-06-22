import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface CourtStat {
  court_id: string;
  wins: number;
  losses: number;
  total_matches: number;
  avg_rating: number;
  points_for: number;
  points_against: number;
}

interface CourtStatsProps {
  userId: string;
}

export const CourtStats = ({ userId }: CourtStatsProps) => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");
  const [stats, setStats] = useState<Map<string, CourtStat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    fetchCourtsAndStats();
  }, [userId]);

  const fetchCourtsAndStats = async () => {
    setLoading(true);

    // Fetch all courts and add "Other" option
    const { data: courtsData } = await supabase
      .from("courts")
      .select("*")
      .order("name");

    if (courtsData) {
      // Add "Other" as a special court option
      const courtsWithOther = [
        ...courtsData,
        { id: 'other', name: 'Other', city: '', state: '', location: '', created_at: '', updated_at: '' }
      ];
      setCourts(courtsWithOther);
      
      if (courtsData.length > 0 && !selectedCourtId) {
        setSelectedCourtId(courtsData[0].id);
      }
    }

    // Fetch matches for this user with all participants in one query
    const { data: matchesData } = await supabase
      .from("match_participants")
      .select(`
        match_id,
        rating_change,
        rating_before,
        team,
        player_id,
        matches!inner(
          id,
          court_id,
          other_location,
          team1_score,
          team2_score,
          status
        )
      `)
      .eq("player_id", userId);

    if (matchesData) {
      const courtStatsMap = new Map<string, CourtStat>();

      for (const mp of matchesData as any[]) {
        if (mp.matches.status !== "approved") continue;

        // Determine court ID - use 'other' for matches with other_location
        const courtId = mp.matches.other_location ? 'other' : mp.matches.court_id;
        if (!courtId) continue;
        
        if (!courtStatsMap.has(courtId)) {
          courtStatsMap.set(courtId, {
            court_id: courtId,
            wins: 0,
            losses: 0,
            total_matches: 0,
            avg_rating: 0,
            points_for: 0,
            points_against: 0,
          });
        }

        const stat = courtStatsMap.get(courtId)!;
        stat.total_matches++;
        
        if (mp.rating_change > 0) {
          stat.wins++;
        } else {
          stat.losses++;
        }

        // Use the team info already in the participant data
        const playerTeam = mp.team;
        
        if (playerTeam === 1) {
          stat.points_for += mp.matches.team1_score;
          stat.points_against += mp.matches.team2_score;
        } else if (playerTeam === 2) {
          stat.points_for += mp.matches.team2_score;
          stat.points_against += mp.matches.team1_score;
        }

        stat.avg_rating = (stat.avg_rating * (stat.total_matches - 1) + mp.rating_before) / stat.total_matches;
      }

      setStats(courtStatsMap);
    }

    setLoading(false);
  };

  const currentStats = selectedCourtId ? stats.get(selectedCourtId) : null;
  const selectedCourt = courts.find(c => c.id === selectedCourtId);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading court stats...
        </CardContent>
      </Card>
    );
  }

  if (courts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Stats by Court
            </CardTitle>
            <CardDescription>Your performance at different courts</CardDescription>
          </div>
          <Select value={selectedCourtId} onValueChange={(value) => {
            setSelectedCourtId(value);
            setAnimationKey(prev => prev + 1);
          }}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a court" />
            </SelectTrigger>
            <SelectContent>
              {courts.map((court) => (
                <SelectItem key={court.id} value={court.id}>
                  {court.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!currentStats || currentStats.total_matches === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No matches played at {selectedCourt?.name || "this court"} yet
          </div>
        ) : (
          <div key={animationKey} className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Matches</p>
              <p className="text-2xl font-bold">{currentStats.total_matches}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Record</p>
              <p className="text-2xl font-bold">{currentStats.wins}W - {currentStats.losses}L</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold">
                {((currentStats.wins / currentStats.total_matches) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg Rating</p>
              <p className="text-2xl font-bold">{currentStats.avg_rating.toFixed(2)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
