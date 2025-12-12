import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import { Trophy, Calendar, ChevronRight } from "lucide-react";

interface Match {
  id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  userTeam: number;
  opponentNames: string[];
  courtName: string | null;
}

interface UpcomingEvent {
  id: string;
  name: string;
  date: string;
  location: string | null;
  type: "round_robin" | "citi_event" | "calendar_event";
}

interface ActivityModuleProps {
  userId: string | undefined;
}

export const ActivityModule = ({ userId }: ActivityModuleProps) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchActivity = async () => {
      setLoading(true);

      // Fetch recent matches
      const { data: participations } = await supabase
        .from("match_participants")
        .select(`
          team,
          match:matches (
            id,
            match_date,
            team1_score,
            team2_score,
            court:courts (name)
          )
        `)
        .eq("player_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (participations) {
        const matchData: Match[] = [];
        
        for (const p of participations) {
          if (!p.match) continue;
          const match = p.match as any;
          
          // Get opponent names
          const { data: opponents } = await supabase
            .from("match_participants")
            .select("player:profiles!match_participants_player_id_fkey(display_name, full_name)")
            .eq("match_id", match.id)
            .neq("team", p.team);
          
          const opponentNames = opponents?.map((o: any) => 
            o.player?.display_name || o.player?.full_name || "Unknown"
          ) || [];

          matchData.push({
            id: match.id,
            match_date: match.match_date,
            team1_score: match.team1_score,
            team2_score: match.team2_score,
            userTeam: p.team,
            opponentNames,
            courtName: match.court?.name || null,
          });
        }
        
        setMatches(matchData);
      }

      // Fetch upcoming round robin events user is registered for
      const { data: rrEvents } = await supabase
        .from("round_robin_events")
        .select("id, name, date, location, status")
        .gte("date", new Date().toISOString().split("T")[0])
        .in("status", ["draft", "live"])
        .order("date", { ascending: true })
        .limit(10);

      const upcomingEvents: UpcomingEvent[] = [];
      
      if (rrEvents) {
        // Check which events user is registered for - do it in one query
        const eventIds = rrEvents.map(e => e.id);
        const { data: registrations } = await supabase
          .from("round_robin_registrations" as any)
          .select("event_id")
          .eq("player_id", userId)
          .eq("status", "registered")
          .in("event_id", eventIds);
        
        const registeredEventIds = new Set(registrations?.map((r: any) => r.event_id) || []);
        
        for (const event of rrEvents) {
          if (registeredEventIds.has(event.id)) {
            upcomingEvents.push({
              id: event.id,
              name: event.name,
              date: event.date,
              location: event.location,
              type: "round_robin",
            });
          }
        }
      }

      // Sort by date
      upcomingEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(upcomingEvents.slice(0, 3));
      
      setLoading(false);
    };

    fetchActivity();
  }, [userId]);

  const getMatchResult = (match: Match) => {
    const userScore = match.userTeam === 1 ? match.team1_score : match.team2_score;
    const oppScore = match.userTeam === 1 ? match.team2_score : match.team1_score;
    return userScore > oppScore ? "W" : "L";
  };

  const getResultColor = (result: string) => {
    return result === "W" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Your Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="matches" className="text-xs md:text-sm">
              <Trophy className="w-3 h-3 mr-1.5" />
              Recent Matches
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs md:text-sm">
              <Calendar className="w-3 h-3 mr-1.5" />
              Upcoming Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="mt-0">
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent matches. Record your first match!
              </p>
            ) : (
              <div className="space-y-2">
                {matches.map((match) => {
                  const result = getMatchResult(match);
                  const userScore = match.userTeam === 1 ? match.team1_score : match.team2_score;
                  const oppScore = match.userTeam === 1 ? match.team2_score : match.team1_score;
                  
                  return (
                    <button
                      key={match.id}
                      onClick={() => navigate("/match/history")}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getResultColor(result)}`}>
                        {result}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          vs {match.opponentNames.slice(0, 2).join(" & ") || "Opponents"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {userScore}-{oppScore} • {formatDistanceToNow(new Date(match.match_date), { addSuffix: true })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-0">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming events. Join a Round Robin!
              </p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => navigate(`/round-robin/${event.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-primary" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.date), "MMM d, yyyy")}
                        {event.location && ` • ${event.location}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
