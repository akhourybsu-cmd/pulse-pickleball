import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourtCard } from "@/components/kiosk/CourtCard";
import { ScoreEntryModal } from "@/components/kiosk/ScoreEntryModal";
import { OrganizerPinModal } from "@/components/kiosk/OrganizerPinModal";
import { NextRoundPanel } from "@/components/kiosk/NextRoundPanel";
import { BottomStatusRibbon } from "@/components/kiosk/BottomStatusRibbon";
import { FullscreenToggleButton } from "@/components/kiosk/FullscreenToggleButton";
import { toast } from "sonner";
import { Radio, Lock } from "lucide-react";

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
  
  // Modal states
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<ScheduleMatch | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinAction, setPinAction] = useState<'score' | 'advance' | 'exit'>('score');
  const [pendingScore, setPendingScore] = useState<{ scoreA: number; scoreB: number } | null>(null);

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

  const handleEnterScore = (match: ScheduleMatch) => {
    setSelectedMatch(match);
    setScoreModalOpen(true);
  };

  const handleScoreSubmit = (scoreA: number, scoreB: number) => {
    setPendingScore({ scoreA, scoreB });
    setScoreModalOpen(false);
    setPinAction('score');
    setPinModalOpen(true);
  };

  const handlePinSuccess = async () => {
    setPinModalOpen(false);

    if (pinAction === 'score' && selectedMatch && pendingScore) {
      // Save score
      const { error } = await supabase
        .from("round_robin_schedule")
        .update({
          team1_score: pendingScore.scoreA,
          team2_score: pendingScore.scoreB,
        })
        .eq("id", selectedMatch.id);

      if (error) {
        toast.error("Failed to save score");
        console.error(error);
      } else {
        toast.success("Score saved successfully");
      }

      setPendingScore(null);
      setSelectedMatch(null);
    } else if (pinAction === 'advance') {
      // Advance to next round
      if (!event) return;
      
      const nextRound = (event.current_round || 1) + 1;
      const { error } = await supabase
        .from("round_robin_events")
        .update({ current_round: nextRound })
        .eq("id", event.id);

      if (error) {
        toast.error("Failed to advance round");
        console.error(error);
      } else {
        toast.success(`Round ${nextRound} started!`);
      }
    } else if (pinAction === 'exit') {
      // Exit kiosk mode
      navigate(`/roundrobin/${eventId}`);
    }
  };

  const handleStartNextRound = () => {
    setPinAction('advance');
    setPinModalOpen(true);
  };

  const handleExitKiosk = () => {
    setPinAction('exit');
    setPinModalOpen(true);
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
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 text-white pb-24">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
            <Badge variant="default" className="text-base px-3 py-1">
              Round {currentRound} of {event.num_rounds}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-base px-3 py-1 bg-[hsl(var(--accent))]/20">
              <Radio className="w-4 h-4 mr-2 animate-pulse" />
              LIVE
            </Badge>
            <span className="text-sm text-muted-foreground">
              {currentTime.toLocaleTimeString()}
            </span>
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
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-3xl font-bold">Current Round</h2>
            <div className="grid gap-4">
              {currentRoundMatches.map((match) => (
                <CourtCard
                  key={`${match.id}-${match.court_no}`}
                  courtNumber={match.court_no}
                  teamA={[
                    getPlayerName(match.a1_profile),
                    getPlayerName(match.a2_profile),
                  ]}
                  teamB={[
                    getPlayerName(match.b1_profile),
                    getPlayerName(match.b2_profile),
                  ]}
                  status={match.team1_score !== null ? "final" : "in-progress"}
                  scoreA={match.team1_score || undefined}
                  scoreB={match.team2_score || undefined}
                  onEnterScore={() => handleEnterScore(match)}
                />
              ))}
            </div>
          </div>

          {/* Right Panel: Next Round Preview + Control */}
          <div className="space-y-6">
            <NextRoundPanel
              nextRoundMatches={nextRoundMatches.map(m => ({
                courtNumber: m.court_no,
                teamA: [
                  getPlayerName(m.a1_profile),
                  getPlayerName(m.a2_profile),
                ],
                teamB: [
                  getPlayerName(m.b1_profile),
                  getPlayerName(m.b2_profile),
                ],
              }))}
              allFinalThisRound={allFinal}
              currentRound={currentRound}
              totalRounds={event.num_rounds}
              onStartNextRound={handleStartNextRound}
              isLastRound={isLastRound}
            />
          </div>
        </div>
      </div>

      {/* Bottom Status Ribbon */}
      <BottomStatusRibbon
        currentRound={currentRound}
        totalRounds={event.num_rounds}
        numCourts={event.num_courts}
        allFinal={allFinal}
      />

      {/* Modals */}
      {selectedMatch && (
        <ScoreEntryModal
          isOpen={scoreModalOpen}
          onClose={() => {
            setScoreModalOpen(false);
            setSelectedMatch(null);
          }}
          onSubmit={handleScoreSubmit}
          courtNumber={selectedMatch.court_no}
          roundNumber={selectedMatch.round_no}
          teamA={[
            getPlayerName(selectedMatch.a1_profile),
            getPlayerName(selectedMatch.a2_profile),
          ]}
          teamB={[
            getPlayerName(selectedMatch.b1_profile),
            getPlayerName(selectedMatch.b2_profile),
          ]}
        />
      )}

      <OrganizerPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={handlePinSuccess}
        title={
          pinAction === 'score'
            ? "Confirm Final Score"
            : pinAction === 'advance'
            ? `Start Round ${currentRound + 1}`
            : "Exit Kiosk Mode"
        }
        description="Enter organizer PIN to continue"
        correctPin={event.organizer_pin}
      />
    </div>
  );
}
