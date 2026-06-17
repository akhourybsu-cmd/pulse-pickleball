import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FullscreenToggleButton } from "@/components/kiosk/FullscreenToggleButton";
import { toast } from "sonner";
import { Radio, Lock, Clock, Trophy, Palette } from "lucide-react";
import pulseLogo from "@/assets/pulse-logo-premium.svg";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// -- Theme Configuration
type KioskTheme = 'proBroadcast' | 'courtGreen' | 'oceanBlue';

const THEME_CONFIG = {
  proBroadcast: {
    name: 'Pro Broadcast',
    bg: '#1C2127',
    headerBg: '#151a1f',
    cardBg: '#23282f',
    accent: '#FFB627',
    accentRgb: '255, 182, 39',
    text: '#ffffff',
    mutedText: '#9ca3af',
  },
  courtGreen: {
    name: 'Court Green',
    bg: '#0a1a0a',
    headerBg: '#0d1f0d',
    cardBg: '#1a2e1a',
    accent: '#A6DB5A',
    accentRgb: '166, 219, 90',
    text: '#ffffff',
    mutedText: '#94a3b8',
  },
  oceanBlue: {
    name: 'Ocean Blue',
    bg: '#0a1929',
    headerBg: '#0d1f33',
    cardBg: '#1a2942',
    accent: '#3b82f6',
    accentRgb: '59, 130, 246',
    text: '#ffffff',
    mutedText: '#94a3b8',
  },
};

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  organizer_id: string;
  num_courts: number;
  num_rounds: number;
  current_round: number | null;
  status: "draft" | "live" | "completed" | "voided";
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

interface StandingsRow {
  player_id: string;
  player_name: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_diff: number;
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
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [allSchedule, setAllSchedule] = useState<ScheduleMatch[]>([]);
  
  // Theme state with localStorage persistence
  const [theme, setTheme] = useState<KioskTheme>(() => {
    const saved = localStorage.getItem('kioskTheme');
    return (saved as KioskTheme) || 'proBroadcast';
  });
  
  const themeColors = THEME_CONFIG[theme];
  
  useEffect(() => {
    localStorage.setItem('kioskTheme', theme);
  }, [theme]);

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
        (payload) => {
          console.log('Kiosk: Event changed', payload);
          fetchEventData();
        }
      )
      .subscribe((status) => {
        console.log('Kiosk: Events channel status', status);
      });

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
        (payload) => {
          console.log('Kiosk: Schedule changed', payload);
          fetchEventData();
        }
      )
      .subscribe((status) => {
        console.log('Kiosk: Schedule channel status', status);
      });

    // Auto-refresh every 5 seconds for immediate score updates
    const refreshInterval = setInterval(() => {
      fetchEventData();
    }, 5000);

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(scheduleChannel);
      clearInterval(refreshInterval);
    };
  }, [eventId]);

  const calculateStandings = (schedule: ScheduleMatch[]) => {
    const playerStats = new Map<string, StandingsRow>();

    schedule
      .filter(m => !m.is_bye && m.team1_score !== null && m.team2_score !== null)
      .forEach((match) => {
        const team1 = [match.a1_player_id, match.a2_player_id].filter((id): id is string => id !== null);
        const team2 = [match.b1_player_id, match.b2_player_id].filter((id): id is string => id !== null);

        const t1score = match.team1_score!;
        const t2score = match.team2_score!;
        const team1Won = t1score > t2score;

        [...team1, ...team2].forEach((playerId) => {
          if (!playerId) return;
          if (!playerStats.has(playerId)) {
            const playerName = getPlayerIdName(playerId, schedule);
            playerStats.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              wins: 0,
              losses: 0,
              points_for: 0,
              points_against: 0,
              point_diff: 0
            });
          }
        });

        team1.forEach((playerId) => {
          if (!playerId) return;
          const stats = playerStats.get(playerId)!;
          stats.points_for += t1score;
          stats.points_against += t2score;
          if (team1Won) stats.wins++;
          else stats.losses++;
        });

        team2.forEach((playerId) => {
          if (!playerId) return;
          const stats = playerStats.get(playerId)!;
          stats.points_for += t2score;
          stats.points_against += t1score;
          if (!team1Won) stats.wins++;
          else stats.losses++;
        });
      });

    const result = Array.from(playerStats.values())
      .map((row) => ({
        ...row,
        point_diff: row.points_for - row.points_against
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
        return b.points_for - a.points_for;
      });

    return result;
  };

  const getPlayerIdName = (playerId: string, schedule: ScheduleMatch[]): string => {
    for (const match of schedule) {
      if (match.a1_player_id === playerId && match.a1_profile) {
        return match.a1_profile.display_name || match.a1_profile.full_name;
      }
      if (match.a2_player_id === playerId && match.a2_profile) {
        return match.a2_profile.display_name || match.a2_profile.full_name;
      }
      if (match.b1_player_id === playerId && match.b1_profile) {
        return match.b1_profile.display_name || match.b1_profile.full_name;
      }
      if (match.b2_player_id === playerId && match.b2_profile) {
        return match.b2_profile.display_name || match.b2_profile.full_name;
      }
    }
    return "Unknown";
  };

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

      // Fetch ALL schedule with profiles for standings calculation
      const { data: fullSchedule, error: fullScheduleError } = await supabase
        .from("round_robin_schedule")
        .select("*")
        .eq("event_id", eventId)
        .order("round_no")
        .order("court_no");

      if (fullScheduleError) throw fullScheduleError;

      // Fetch current round schedule
      const { data: currentSchedule, error: currentError } = await supabase
        .from("round_robin_schedule")
        .select("*")
        .eq("event_id", eventId)
        .eq("round_no", currentRound)
        .eq("is_bye", false)
        .order("court_no");

      if (currentError) throw currentError;

      // Get all unique player IDs from full schedule
      const allPlayerIds = new Set<string>();
      fullSchedule?.forEach(match => {
        if (match.a1_player_id) allPlayerIds.add(match.a1_player_id);
        if (match.a2_player_id) allPlayerIds.add(match.a2_player_id);
        if (match.b1_player_id) allPlayerIds.add(match.b1_player_id);
        if (match.b2_player_id) allPlayerIds.add(match.b2_player_id);
      });

      // Fetch all profiles at once
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", Array.from(allPlayerIds));

      if (profilesError) {
        console.error("Profiles error:", profilesError);
      }

      // Create profile map
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Attach profiles to full schedule for standings
      const fullScheduleWithProfiles = fullSchedule?.map(match => ({
        ...match,
        a1_profile: match.a1_player_id ? profileMap.get(match.a1_player_id) : null,
        a2_profile: match.a2_player_id ? profileMap.get(match.a2_player_id) : null,
        b1_profile: match.b1_player_id ? profileMap.get(match.b1_player_id) : null,
        b2_profile: match.b2_player_id ? profileMap.get(match.b2_player_id) : null,
      })) || [];

      setAllSchedule(fullScheduleWithProfiles);
      setStandings(calculateStandings(fullScheduleWithProfiles));

      // Attach profiles to current round matches
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
          const nextWithProfiles = nextSchedule?.map(match => ({
            ...match,
            a1_profile: match.a1_player_id ? profileMap.get(match.a1_player_id) : null,
            a2_profile: match.a2_player_id ? profileMap.get(match.a2_player_id) : null,
            b1_profile: match.b1_player_id ? profileMap.get(match.b1_player_id) : null,
            b2_profile: match.b2_player_id ? profileMap.get(match.b2_player_id) : null,
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
    navigate(`/round-robin/${eventId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: themeColors.bg }}>
        <div className="text-2xl" style={{ color: themeColors.text }}>Loading kiosk mode...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: themeColors.bg }}>
        <div className="text-2xl" style={{ color: themeColors.text }}>Event not found</div>
      </div>
    );
  }

  if (event.status === "draft") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: themeColors.bg }}>
        <div className="text-center" style={{ color: themeColors.text }}>
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
    <>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: themeColors.bg }}>
        
        {/* Sticky Header Bar */}
        <div className="sticky top-0 z-50 border-b shadow-xl px-6 py-3 flex items-center justify-between" style={{ backgroundColor: themeColors.headerBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
          <div className="flex items-center gap-4">
            <img src={pulseLogo} alt="Pulse" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>{event?.name || "Round Robin"}</h1>
              <p className="text-sm" style={{ color: themeColors.mutedText }}>
                Round {event?.current_round || 1} of {event?.num_rounds || 1}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" style={{ borderColor: themeColors.accent, color: themeColors.accent }}>
                  <Palette className="w-4 h-4 mr-2" />
                  {themeColors.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(Object.keys(THEME_CONFIG) as KioskTheme[]).map((t) => (
                  <DropdownMenuItem key={t} onClick={() => setTheme(t)}>
                    {THEME_CONFIG[t].name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            <FullscreenToggleButton />
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleExitKiosk}
              className="gap-2 hover:opacity-80"
              style={{ borderColor: themeColors.accent, color: themeColors.accent }}
            >
              <Lock className="h-4 w-4" />
              Exit Kiosk
            </Button>
          </div>
        </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel: Current Round Courts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold" style={{ color: themeColors.text }}>Current Round</h2>
              <Badge variant="secondary" className="text-base px-3 py-1 border-0" style={{ backgroundColor: themeColors.accent, color: themeColors.headerBg }}>
                Round {currentRound} of {event.num_rounds}
              </Badge>
            </div>
            
            <div className="grid gap-4">
              {currentRoundMatches.map((match) => (
                <Card key={`${match.id}-${match.court_no}`} className="backdrop-blur shadow-xl" style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: themeColors.accent }}>
                      <div className="w-1 h-6 rounded-full" style={{ backgroundColor: themeColors.accent }}></div>
                      Court {match.court_no}
                    </h3>
                    
                    <div className="flex items-center justify-between gap-4">
                      {/* Team A */}
                      <div className="flex-1">
                        <div className="text-lg font-semibold" style={{ color: themeColors.text }}>
                          {getPlayerName(match.a1_profile)}
                        </div>
                        <div className="text-lg font-semibold" style={{ color: themeColors.text }}>
                          {getPlayerName(match.a2_profile)}
                        </div>
                      </div>

                      {/* VS / Score */}
                      <div className="text-center min-w-[120px]">
                        {match.team1_score !== null && match.team2_score !== null ? (
                          <div>
                            <div className="text-sm font-medium mb-1" style={{ color: themeColors.mutedText }}>Final</div>
                            <div className="text-3xl font-bold" style={{ color: themeColors.text }}>
                              {match.team1_score} – {match.team2_score}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-2xl font-bold" style={{ color: themeColors.accent }}>VS</div>
                            <div className="text-sm font-medium mt-1" style={{ color: themeColors.accent }}>In Progress</div>
                          </div>
                        )}
                      </div>

                      {/* Team B */}
                      <div className="flex-1 text-right">
                        <div className="text-lg font-semibold" style={{ color: themeColors.text }}>
                          {getPlayerName(match.b1_profile)}
                        </div>
                        <div className="text-lg font-semibold" style={{ color: themeColors.text }}>
                          {getPlayerName(match.b2_profile)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Right Panel: Top 3 Leaderboard + Next Round + Status */}
          <div className="space-y-4">
            {/* Top 3 Leaderboard */}
            {standings.length >= 3 && (
              <Card className="backdrop-blur shadow-xl overflow-hidden" style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
                <div className="p-4" style={{ background: `linear-gradient(135deg, ${themeColors.accent}, ${themeColors.accent}dd)` }}>
                  <div className="flex items-center gap-2" style={{ color: themeColors.headerBg }}>
                    <Trophy className="w-5 h-5" />
                    <h3 className="text-lg font-bold">Top 3 Leaders</h3>
                  </div>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {standings.slice(0, 3).map((row, idx) => (
                      <div 
                        key={row.player_id} 
                        className="p-3 rounded-lg border-2"
                        style={{
                          backgroundColor: `${themeColors.accent}${idx === 0 ? '20' : '10'}`,
                          borderColor: idx === 0 ? themeColors.accent : idx === 1 ? '#9ca3af' : '#fb923c'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl" style={{ color: idx === 0 ? themeColors.accent : idx === 1 ? '#9ca3af' : '#fb923c' }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate" style={{ color: themeColors.text }}>
                              {row.player_name}
                            </div>
                            <div className="flex gap-3 text-xs mt-1">
                              <span className="font-bold" style={{ color: themeColors.accent }}>{row.wins}W</span>
                              <span style={{ color: themeColors.mutedText }}>{row.losses}L</span>
                              <span className="font-bold" style={{ color: row.point_diff > 0 ? themeColors.accent : row.point_diff < 0 ? '#f87171' : themeColors.mutedText }}>
                                {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Next Round Preview */}
            {!isLastRound && nextRoundMatches.length > 0 && (
              <Card className="backdrop-blur shadow-xl" style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold" style={{ color: themeColors.text }}>Round {currentRound + 1} Preview</h3>
                    <div className="flex items-center gap-2" style={{ color: themeColors.mutedText }}>
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">{currentTime.toLocaleTimeString()}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {nextRoundMatches.map((match) => (
                      <div key={`next-${match.id}`} className="p-3 rounded-lg" style={{ backgroundColor: `${themeColors.accent}10`, borderColor: `${themeColors.accent}40`, borderWidth: '1px', borderStyle: 'solid' }}>
                        <div className="text-xs font-bold mb-1" style={{ color: themeColors.accent }}>C{match.court_no}</div>
                        <div className="text-sm" style={{ color: themeColors.text }}>
                          {getPlayerName(match.a1_profile)} / {getPlayerName(match.a2_profile)}
                          <span className="mx-2" style={{ color: themeColors.mutedText }}>vs</span>
                          {getPlayerName(match.b1_profile)} / {getPlayerName(match.b2_profile)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Round Status */}
            <Card className="backdrop-blur shadow-xl" style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-4" style={{ color: themeColors.text }}>Round Status</h3>
                {allFinal ? (
                  <div className="text-center py-4">
                    <div className="text-lg font-semibold mb-2" style={{ color: themeColors.accent }}>✓ All scores received</div>
                    {!isLastRound && (
                      <div className="text-sm" style={{ color: themeColors.mutedText }}>
                        Organizer will advance to Round {currentRound + 1}
                      </div>
                    )}
                    {isLastRound && (
                      <div className="text-sm" style={{ color: themeColors.mutedText }}>
                        Event Complete!
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="flex justify-center mb-3">
                      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: `${themeColors.accent}20`, borderTopColor: themeColors.accent }} />
                    </div>
                    <div className="text-sm" style={{ color: themeColors.mutedText }}>
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
      <div className="fixed bottom-0 left-0 right-0 backdrop-blur" style={{ backgroundColor: `${themeColors.headerBg}f0`, borderTopColor: themeColors.accent, borderTopWidth: '1px', borderTopStyle: 'solid' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: `${themeColors.accent}30`, borderColor: themeColors.accent, borderWidth: '1px', borderStyle: 'solid' }}>
              <div className="w-2 h-2 rounded-full animate-pulse-glow" style={{ backgroundColor: themeColors.accent }} />
              <span className="text-sm font-bold" style={{ color: themeColors.accent }}>LIVE</span>
            </div>
            <span className="text-sm" style={{ color: themeColors.text }}>
              Round {currentRound} currently live on {event.num_courts === 1 ? 'Court 1' : `Courts 1–${event.num_courts}`}
            </span>
          </div>
          
          <Badge variant="secondary" className="border" style={{ backgroundColor: `${themeColors.accent}10`, color: themeColors.accent, borderColor: `${themeColors.accent}50` }}>
            Round {currentRound} of {event.num_rounds}
          </Badge>
        </div>
      </div>

      {/* Exit PIN Modal */}
      {pinModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <Card className="p-6 max-w-sm mx-4" style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: themeColors.text }}>Exit Kiosk Mode</h3>
            <p className="text-sm mb-4" style={{ color: themeColors.mutedText }}>Enter organizer PIN to continue</p>
            <div className="flex gap-2">
              <Button onClick={() => setPinModalOpen(false)} variant="outline" className="flex-1 hover:opacity-80" style={{ borderColor: themeColors.mutedText, color: themeColors.text }}>
                Cancel
              </Button>
              <Button onClick={handlePinSuccess} className="flex-1" style={{ backgroundColor: themeColors.accent, color: themeColors.headerBg }}>
                Confirm
              </Button>
            </div>
          </Card>
        </div>
      )}
      </div>
    </>
  );
}
