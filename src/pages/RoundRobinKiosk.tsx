import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FullscreenToggleButton } from "@/components/kiosk/FullscreenToggleButton";
import { toast } from "sonner";
import { Radio, Lock, Clock } from "lucide-react";
import pulseLogo from "@/assets/pulse-logo-new.png";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  organizer_id: string;
  num_courts: number;
  num_rounds: number;
  current_round: number | null;
  status: "draft" | "live" | "completed";
  organizer_pin: string;
}

interface ScheduleMatch {
  id: string;
  event_id: string;
  round_no: number;
  court_no: number;
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
  a1_profile?: { display_name: string | null; full_name: string };
  a2_profile?: { display_name: string | null; full_name: string };
  b1_profile?: { display_name: string | null; full_name: string };
  b2_profile?: { display_name: string | null; full_name: string };
}

export default function RoundRobinKiosk() {
  const { id } = useParams<{ id: string }>();
  const eventId = id;
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [currentRoundMatches, setCurrentRoundMatches] = useState<ScheduleMatch[]>([]);
  const [nextRoundMatches, setNextRoundMatches] = useState<ScheduleMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pinModalOpen, setPinModalOpen] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load event data
  useEffect(() => {
    if (!eventId) return;
    fetchEventData();
    
    // Set up real-time subscriptions
    const eventsChannel = supabase
      .channel(`kiosk-events-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_events',
          filter: `id=eq.${eventId}`,
        },
        () => {
          fetchEventData();
        }
      )
      .subscribe();

    const scheduleChannel = supabase
      .channel(`kiosk-schedule-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_schedule',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchEventData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(scheduleChannel);
    };
  }, [eventId]); // Changed dependency to eventId

  const fetchEventData = async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;
      if (!eventData) {
        toast.error("Event not found");
        setLoading(false);
        return;
      }

      setEvent(eventData);

      if (eventData.status === "completed") {
        toast.info("This event has been completed");
        setLoading(false);
        return;
      }

      const currentRound = eventData.current_round || 1;

      // Fetch current round schedule - first get matches
      const { data: currentSchedule, error: currentError } = await supabase
        .from("round_robin_schedule")
        .select("*")
        .eq("event_id", eventId)
        .eq("round_no", currentRound)
        .eq("is_bye", false)
        .order("court_no");

      if (currentError) throw currentError;

      // Get all unique player IDs
      const playerIds = new Set<string>();
      currentSchedule?.forEach(match => {
        if (match.a1_player_id) playerIds.add(match.a1_player_id);
        if (match.a2_player_id) playerIds.add(match.a2_player_id);
        if (match.b1_player_id) playerIds.add(match.b1_player_id);
        if (match.b2_player_id) playerIds.add(match.b2_player_id);
      });

      // Fetch all profiles at once
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", Array.from(playerIds));

      if (profilesError) {
        console.error("Profiles error:", profilesError);
      }

      // Create profile map
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Attach profiles to matches
      const currentWithProfiles = currentSchedule?.map(match => ({
        ...match,
        a1_profile: match.a1_player_id ? profileMap.get(match.a1_player_id) : null,
        a2_profile: match.a2_player_id ? profileMap.get(match.a2_player_id) : null,
        b1_profile: match.b1_player_id ? profileMap.get(match.b1_player_id) : null,
        b2_profile: match.b2_player_id ? profileMap.get(match.b2_player_id) : null,
      })) || [];

      setCurrentRoundMatches(currentWithProfiles);

      // Fetch next round if not last round
      if (currentRound < eventData.num_rounds) {
        const { data: nextSchedule, error: nextError } = await supabase
          .from("round_robin_schedule")
          .select("*")
          .eq("event_id", eventId)
          .eq("round_no", currentRound + 1)
          .eq("is_bye", false)
          .order("court_no");

        if (nextError) {
          console.error("Error loading next round:", nextError);
        } else {
          // Get player IDs for next round
          const nextPlayerIds = new Set<string>();
          nextSchedule?.forEach(match => {
            if (match.a1_player_id) nextPlayerIds.add(match.a1_player_id);
            if (match.a2_player_id) nextPlayerIds.add(match.a2_player_id);
            if (match.b1_player_id) nextPlayerIds.add(match.b1_player_id);
            if (match.b2_player_id) nextPlayerIds.add(match.b2_player_id);
          });

          // Fetch profiles for next round
          const { data: nextProfiles } = await supabase
            .from("profiles")
            .select("id, display_name, full_name")
            .in("id", Array.from(nextPlayerIds));

          const nextProfileMap = new Map(nextProfiles?.map(p => [p.id, p]) || []);

          const nextWithProfiles = nextSchedule?.map(match => ({
            ...match,
            a1_profile: match.a1_player_id ? nextProfileMap.get(match.a1_player_id) : null,
            a2_profile: match.a2_player_id ? nextProfileMap.get(match.a2_player_id) : null,
            b1_profile: match.b1_player_id ? nextProfileMap.get(match.b1_player_id) : null,
            b2_profile: match.b2_player_id ? nextProfileMap.get(match.b2_player_id) : null,
          })) || [];

          setNextRoundMatches(nextWithProfiles);
        }
      } else {
        setNextRoundMatches([]);
      }
    } catch (error: any) {
      console.error("Error fetching event data:", error);
      toast.error("Failed to load event data");
    } finally {
      setLoading(false);
    }
  };

  const getPlayerName = (profile: any) => {
    if (!profile) return "TBD";
    return profile.display_name || profile.full_name || "TBD";
  };

  const handleExitKiosk = () => {
    setPinModalOpen(true);
  };

  const handlePinSuccess = async () => {
    setPinModalOpen(false);
    navigate(`/roundrobin/${eventId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 flex items-center justify-center">
        <div className="text-white text-2xl">Loading kiosk mode...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 flex items-center justify-center">
        <div className="text-white text-2xl">Event not found</div>
      </div>
    );
  }

  if (event.status === "draft") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">{event.name}</h1>
          <p className="text-2xl">Event has not started yet</p>
          <p className="text-xl mt-2 opacity-80">Please wait for the organizer to start the event</p>
        </div>
      </div>
    );
  }

  const currentRound = event.current_round || 1;
  const allFinal = currentRoundMatches.every(m => m.team1_score !== null && m.team2_score !== null);
  const isLastRound = currentRound >= event.num_rounds;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 pb-24">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          {/* Pulse Branding */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0B3F45] border border-white/10">
            <img src={pulseLogo} alt="Pulse" className="h-6 w-6" />
            <span className="text-white text-sm font-semibold whitespace-nowrap">Round Robin by Pulse</span>
          </div>

          {/* Event Name & Round */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{event.name}</h1>
            <Badge className="bg-[#0B3F45] text-white border border-white/20 whitespace-nowrap">
              Current Round: {currentRound} / {event.num_rounds}
            </Badge>
          </div>

          {/* LIVE Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0B3F45] border border-[#A9CF46]/50">
            <div className="w-2 h-2 rounded-full bg-[#A9CF46] animate-pulse-glow" />
            <span className="text-white text-sm font-bold">LIVE</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <FullscreenToggleButton />
            <Button
              onClick={handleExitKiosk}
              variant="ghost"
              size="sm"
              className="text-foreground"
            >
              <Lock className="w-4 h-4 mr-2" />
              End Kiosk
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel: Current Round Courts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-white">Current Round</h2>
              <Badge className="bg-[#0B3F45] text-white border border-white/20 text-base px-3 py-1">
                Round {currentRound} of {event.num_rounds}
              </Badge>
            </div>
            
            <div className="grid gap-4">
              {currentRoundMatches.map((match) => (
                <Card key={`${match.id}-${match.court_no}`} className="bg-white/95 backdrop-blur border-0 shadow-lg">
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-[#083A40] mb-4">Court {match.court_no}</h3>
                    
                    <div className="flex items-center justify-between gap-4">
                      {/* Team A */}
                      <div className="flex-1">
                        <div className="text-lg font-semibold text-[#083A40]">
                          {getPlayerName(match.a1_profile)}
                        </div>
                        <div className="text-lg font-semibold text-[#083A40]">
                          {getPlayerName(match.a2_profile)}
                        </div>
                      </div>

                      {/* VS / Score */}
                      <div className="text-center min-w-[120px]">
                        {match.team1_score !== null && match.team2_score !== null ? (
                          <div>
                            <div className="text-sm font-medium text-[#083A40]/60 mb-1">Final</div>
                            <div className="text-3xl font-bold text-[#083A40]">
                              {match.team1_score} – {match.team2_score}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-2xl font-bold text-[#0B3F45]">VS</div>
                            <div className="text-sm font-medium text-[#0B3F45] mt-1">In Progress</div>
                          </div>
                        )}
                      </div>

                      {/* Team B */}
                      <div className="flex-1 text-right">
                        <div className="text-lg font-semibold text-[#083A40]">
                          {getPlayerName(match.b1_profile)}
                        </div>
                        <div className="text-lg font-semibold text-[#083A40]">
                          {getPlayerName(match.b2_profile)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Right Panel: Next Round Preview + Status */}
          <div className="space-y-4">
            {/* Next Round Preview */}
            {!isLastRound && nextRoundMatches.length > 0 && (
              <Card className="bg-white/95 backdrop-blur border-0 shadow-lg">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-[#083A40]">Round {currentRound + 1} Preview</h3>
                    <div className="flex items-center gap-2 text-[#083A40]/60">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">{currentTime.toLocaleTimeString()}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {nextRoundMatches.map((match) => (
                      <div key={`next-${match.id}`} className="p-3 bg-[#F8FFF0] rounded-lg border border-[#0B3F45]/10">
                        <div className="text-xs font-bold text-[#0B3F45] mb-1">C{match.court_no}</div>
                        <div className="text-sm text-[#083A40]">
                          {getPlayerName(match.a1_profile)} / {getPlayerName(match.a2_profile)}
                          <span className="text-[#0B3F45] mx-2">vs</span>
                          {getPlayerName(match.b1_profile)} / {getPlayerName(match.b2_profile)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Round Status */}
            <Card className="bg-white/95 backdrop-blur border-0 shadow-lg">
              <div className="p-6">
                <h3 className="text-xl font-bold text-[#083A40] mb-4">Round Status</h3>
                {allFinal ? (
                  <div className="text-center py-4">
                    <div className="text-lg font-semibold text-[#0B3F45] mb-2">✓ All scores received</div>
                    {!isLastRound && (
                      <div className="text-sm text-[#083A40]/60">
                        Organizer will advance to Round {currentRound + 1}
                      </div>
                    )}
                    {isLastRound && (
                      <div className="text-sm text-[#083A40]/60">
                        Event Complete!
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="flex justify-center mb-3">
                      <div className="w-8 h-8 border-4 border-[#0B3F45]/20 border-t-[#0B3F45] rounded-full animate-spin" />
                    </div>
                    <div className="text-sm text-[#083A40]/60">
                      Waiting for all scores from Round {currentRound}...
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom Status Ribbon */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#083A40]/90 backdrop-blur border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B3F45] border border-[#A9CF46]/50">
              <div className="w-2 h-2 rounded-full bg-[#A9CF46] animate-pulse-glow" />
              <span className="text-white text-sm font-bold">LIVE</span>
            </div>
            <span className="text-white text-sm">
              Round {currentRound} currently live on {event.num_courts === 1 ? 'Court 1' : `Courts 1–${event.num_courts}`}
            </span>
          </div>
          
          <Badge className="bg-[#0B3F45] text-white border border-white/20">
            Round {currentRound} of {event.num_rounds}
          </Badge>
        </div>
      </div>

      {/* Exit PIN Modal */}
      {pinModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-white p-6 max-w-sm mx-4">
            <h3 className="text-xl font-bold text-[#083A40] mb-2">Exit Kiosk Mode</h3>
            <p className="text-sm text-[#083A40]/60 mb-4">Enter organizer PIN to continue</p>
            <div className="flex gap-2">
              <Button onClick={() => setPinModalOpen(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handlePinSuccess} className="flex-1">
                Confirm
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
