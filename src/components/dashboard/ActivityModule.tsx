import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Trophy, Calendar, ChevronRight, Filter } from "lucide-react";
import { MatchCard } from "./MatchCard";

interface Match {
  id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  userTeam: number;
  team1Players: { id: string; name: string; initials: string }[];
  team2Players: { id: string; name: string; initials: string }[];
  courtName: string | null;
  location: string | null;
  eventName: string | null;
  ratingChange?: number;
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

      // Fetch recent matches with full participant info
      const { data: participations } = await supabase
        .from("match_participants")
        .select(`
          team,
          rating_change,
          match:matches (
            id,
            match_date,
            team1_score,
            team2_score,
            court:courts (name, city, state),
            event:events (name)
          )
        `)
        .eq("player_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (participations) {
        const matchData: Match[] = [];
        
        for (const p of participations) {
          if (!p.match) continue;
          const match = p.match as any;
          
          // Get all participants for this match
          const { data: allParticipants } = await supabase
            .from("match_participants")
            .select("player_id, team, player:profiles!match_participants_player_id_fkey(id, display_name, full_name, first_name, last_name)")
            .eq("match_id", match.id);

          const team1Players: { id: string; name: string; initials: string }[] = [];
          const team2Players: { id: string; name: string; initials: string }[] = [];

          allParticipants?.forEach((participant: any) => {
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

          matchData.push({
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
      setEvents(upcomingEvents.slice(0, 5));
      
      setLoading(false);
    };

    fetchActivity();
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
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-24 bg-muted rounded"></div>
            <div className="h-24 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Your Activity</span>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </CardTitle>
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
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent matches. Record your first match!
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedMatches).map(([month, monthMatches]) => (
                  <div key={month}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                      {month}
                    </h3>
                    <div className="space-y-3">
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
          </TabsContent>

          <TabsContent value="events" className="mt-0">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming events. Join a Round Robin!
              </p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => navigate(`/round-robin/${event.id}`)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-muted/50 transition-colors text-left border border-border"
                  >
                    <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.date), "EEEE, MMMM d, yyyy")}
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
