import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FullscreenToggleButton } from "@/components/kiosk/FullscreenToggleButton";
import { toast } from "sonner";
import { Radio, Lock, Clock, Trophy, Palette } from "lucide-react";
import { Logo } from "@/components/Logo";
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
  a1_guest_id: string | null;
  a2_guest_id: string | null;
  b1_guest_id: string | null;
  b2_guest_id: string | null;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
  a1_profile?: { display_name: string | null; full_name: string } | null;
  a2_profile?: { display_name: string | null; full_name: string } | null;
  b1_profile?: { display_name: string | null; full_name: string } | null;
  b2_profile?: { display_name: string | null; full_name: string } | null;
  a1_guest?: { display_name: string | null; linked_user_id?: string | null } | null;
  a2_guest?: { display_name: string | null; linked_user_id?: string | null } | null;
  b1_guest?: { display_name: string | null; linked_user_id?: string | null } | null;
  b2_guest?: { display_name: string | null; linked_user_id?: string | null } | null;
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
        const team1 = [
          match.a1_player_id ?? match.a1_guest_id,
          match.a2_player_id ?? match.a2_guest_id,
        ].filter((id): id is string => id !== null);
        const team2 = [
          match.b1_player_id ?? match.b1_guest_id,
          match.b2_player_id ?? match.b2_guest_id,
        ].filter((id): id is string => id !== null);

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
      const guestLabel = (g?: { display_name?: string | null; linked_user_id?: string | null } | null) =>
        g?.display_name ? (g.linked_user_id ? g.display_name : `${g.display_name} (Guest)`) : null;
      if (match.a1_guest_id === playerId && match.a1_guest?.display_name) {
        return guestLabel(match.a1_guest)!;
      }
      if (match.a2_guest_id === playerId && match.a2_guest?.display_name) {
        return guestLabel(match.a2_guest)!;
      }
      if (match.b1_guest_id === playerId && match.b1_guest?.display_name) {
        return guestLabel(match.b1_guest)!;
      }
      if (match.b2_guest_id === playerId && match.b2_guest?.display_name) {
        return guestLabel(match.b2_guest)!;
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

      // Completed events still render — the kiosk shows the celebratory final leaderboard.

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

      // Collect every player and guest id referenced anywhere in the schedule.
      const allPlayerIds = new Set<string>();
      const allGuestIds = new Set<string>();
      fullSchedule?.forEach((match: any) => {
        if (match.a1_player_id) allPlayerIds.add(match.a1_player_id);
        if (match.a2_player_id) allPlayerIds.add(match.a2_player_id);
        if (match.b1_player_id) allPlayerIds.add(match.b1_player_id);
        if (match.b2_player_id) allPlayerIds.add(match.b2_player_id);
        if (match.a1_guest_id) allGuestIds.add(match.a1_guest_id);
        if (match.a2_guest_id) allGuestIds.add(match.a2_guest_id);
        if (match.b1_guest_id) allGuestIds.add(match.b1_guest_id);
        if (match.b2_guest_id) allGuestIds.add(match.b2_guest_id);
      });

      // Fetch all profiles at once (public view — kiosk may run unauthenticated)
      const { data: profiles, error: profilesError } = allPlayerIds.size > 0
        ? await supabase
            .from("profiles_public")
            .select("id, display_name, full_name")
            .in("id", Array.from(allPlayerIds))
        : { data: [], error: null };

      if (profilesError) {
        console.error("Profiles error:", profilesError);
      }

      // Fetch guest display names
      const { data: guests } = allGuestIds.size > 0
        ? await supabase
            .from("guest_players")
            .select("id, display_name")
            .in("id", Array.from(allGuestIds))
        : { data: [] };

      const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
      const guestMap = new Map<string, any>(
        (guests || []).map((g: any) => [g.id, { id: g.id, display_name: g.display_name }]),
      );

      // Backwards-compat for downstream code that previously merged guests
      // into profileMap. Keep both maps available.
      (guests || []).forEach((g: any) => {
        if (!profileMap.has(g.id)) {
          profileMap.set(g.id, { id: g.id, display_name: g.display_name, full_name: g.display_name, is_guest: true });
        }
      });

      // Attach profile + guest joins to each schedule row so downstream code
      // can resolve every seat's display name regardless of whether it's a
      // registered player or a guest.
      const attach = (match: any) => ({
        ...match,
        a1_profile: match.a1_player_id ? profileMap.get(match.a1_player_id) : null,
        a2_profile: match.a2_player_id ? profileMap.get(match.a2_player_id) : null,
        b1_profile: match.b1_player_id ? profileMap.get(match.b1_player_id) : null,
        b2_profile: match.b2_player_id ? profileMap.get(match.b2_player_id) : null,
        a1_guest: match.a1_guest_id ? guestMap.get(match.a1_guest_id) : null,
        a2_guest: match.a2_guest_id ? guestMap.get(match.a2_guest_id) : null,
        b1_guest: match.b1_guest_id ? guestMap.get(match.b1_guest_id) : null,
        b2_guest: match.b2_guest_id ? guestMap.get(match.b2_guest_id) : null,
      });

      const fullScheduleWithProfiles = (fullSchedule || []).map(attach);
      setAllSchedule(fullScheduleWithProfiles);
      setStandings(calculateStandings(fullScheduleWithProfiles));

      const currentWithProfiles = (currentSchedule || []).map(attach);
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
          const nextWithProfiles = (nextSchedule || []).map(attach);
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

  if (event.status === "completed") {
    return (
      <FinalLeaderboardScreen
        event={event}
        standings={standings}
        themeColors={themeColors}
        currentTime={currentTime}
        onExit={handleExitKiosk}
        onChangeTheme={setTheme}
        pinModalOpen={pinModalOpen}
        setPinModalOpen={setPinModalOpen}
        handlePinSuccess={handlePinSuccess}
      />
    );
  }


  const currentRound = event.current_round || 1;
  const allFinal = currentRoundMatches.every(m => m.team1_score !== null && m.team2_score !== null);
  const isLastRound = currentRound >= event.num_rounds;

  const courtCount = currentRoundMatches.length;
  // Choose grid layout based on number of courts
  const courtsGridClass =
    courtCount <= 2
      ? "grid-cols-1"
      : courtCount <= 4
      ? "grid-cols-2"
      : courtCount <= 6
      ? "grid-cols-2"
      : "grid-cols-3";
  // Scale typography down as density grows
  const scoreTextClass =
    courtCount <= 2
      ? "text-[7vw] leading-none"
      : courtCount <= 4
      ? "text-[5vw] leading-none"
      : "text-[3.5vw] leading-none";
  const nameTextClass =
    courtCount <= 2
      ? "text-[2.2vw]"
      : courtCount <= 4
      ? "text-[1.5vw]"
      : "text-[1.1vw]";

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const ticker = allFinal
    ? `All scores received · ${isLastRound ? "Event complete" : `Round ${currentRound + 1} coming up next`}`
    : `Waiting on scores · Round ${currentRound} in progress`;

  const courtsLabel =
    event.num_courts === 1 ? "Court 1" : `Courts 1–${event.num_courts}`;

  return (
    <>
      <div
        className="fixed inset-0 flex flex-col overflow-hidden font-sans"
        style={{
          backgroundColor: themeColors.bg,
          backgroundImage: `radial-gradient(ellipse at 50% 120%, rgba(${themeColors.accentRgb},0.10), transparent 60%), radial-gradient(ellipse at 0% 0%, rgba(255,255,255,0.03), transparent 50%)`,
          color: themeColors.text,
        }}
      >
        {/* Hidden admin controls (appear on hover top-right) */}
        <div className="group absolute top-0 right-0 z-50 w-48 h-16">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-end gap-2 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" style={{ borderColor: themeColors.accent, color: themeColors.accent, backgroundColor: themeColors.headerBg }}>
                  <Palette className="w-4 h-4" />
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
            <FullscreenToggleButton />
            <Button
              size="sm"
              variant="outline"
              onClick={handleExitKiosk}
              className="gap-2"
              style={{ borderColor: themeColors.accent, color: themeColors.accent, backgroundColor: themeColors.headerBg }}
            >
              <Lock className="h-4 w-4" />
              Exit
            </Button>
          </div>
        </div>

        {/* Broadcast Header */}
        <header
          className="flex items-center justify-between px-8 h-[8vh] min-h-[64px] border-b relative"
          style={{
            backgroundColor: themeColors.headerBg,
            borderColor: `rgba(${themeColors.accentRgb}, 0.25)`,
          }}
        >
          <div className="flex items-center gap-5">
            <div style={{ color: themeColors.mutedText }}>
              <Logo className="h-[5vh] min-h-9 w-auto" />
            </div>
            <div
              className="h-[5vh] min-h-9 w-px"
              style={{ backgroundColor: `rgba(255,255,255,0.15)` }}
            />
            <div className="flex flex-col leading-tight">
              <h1 className="text-[1.8vw] font-bold tracking-tight" style={{ color: themeColors.text }}>
                {event.name}
              </h1>
              <p className="text-[0.95vw] font-medium" style={{ color: themeColors.mutedText }}>
                Round Robin · Round {currentRound} of {event.num_rounds}
              </p>
            </div>
          </div>

          {/* Center LIVE pill */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <div
              className="flex items-center gap-3 px-6 py-2 rounded-full border-2"
              style={{
                borderColor: themeColors.accent,
                backgroundColor: `rgba(${themeColors.accentRgb}, 0.08)`,
                boxShadow: `0 0 24px rgba(${themeColors.accentRgb}, 0.25)`,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ backgroundColor: themeColors.accent, boxShadow: `0 0 10px ${themeColors.accent}` }}
              />
              <span
                className="text-[1.1vw] font-extrabold tracking-[0.2em]"
                style={{ color: themeColors.accent }}
              >
                LIVE · ROUND {currentRound}
              </span>
            </div>
          </div>

          <div className="text-[1.6vw] font-semibold tabular-nums" style={{ color: themeColors.text }}>
            {formattedTime}
          </div>
        </header>

        {/* Main broadcast canvas */}
        <main className="flex-1 grid grid-cols-12 gap-6 px-8 py-6 min-h-0">
          {/* Left: Current Round courts */}
          <section className="col-span-8 flex flex-col min-h-0">
            <div className="flex items-baseline gap-4 mb-4">
              <h2 className="text-[2.4vw] font-extrabold tracking-tight" style={{ color: themeColors.text }}>
                Current Round
              </h2>
              <div
                className="px-3 py-1 rounded-full text-[0.95vw] font-bold"
                style={{
                  backgroundColor: `rgba(${themeColors.accentRgb}, 0.15)`,
                  color: themeColors.accent,
                  border: `1px solid rgba(${themeColors.accentRgb},0.5)`,
                }}
              >
                Round {currentRound} of {event.num_rounds}
              </div>
            </div>

            <div className={`grid ${courtsGridClass} gap-4 flex-1 min-h-0`}>
              {currentRoundMatches.length === 0 && (
                <div
                  className="flex items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: themeColors.cardBg,
                    color: themeColors.mutedText,
                  }}
                >
                  <span className="text-[1.4vw]">Waiting for matchup...</span>
                </div>
              )}
              {currentRoundMatches.map((match) => {
                const hasScore = match.team1_score !== null && match.team2_score !== null;
                const t1 = match.team1_score ?? 0;
                const t2 = match.team2_score ?? 0;
                const team1Won = hasScore && t1 > t2;
                const team2Won = hasScore && t2 > t1;
                const a1 = getPlayerName(match.a1_profile);
                const a2 = getPlayerName(match.a2_profile);
                const b1 = getPlayerName(match.b1_profile);
                const b2 = getPlayerName(match.b2_profile);
                const teamAPending = a1 === "TBD" && a2 === "TBD";
                const teamBPending = b1 === "TBD" && b2 === "TBD";
                const statusLabel = hasScore
                  ? "FINAL"
                  : teamAPending || teamBPending
                  ? "ASSIGNING"
                  : "LIVE";

                return (
                  <div
                    key={`${match.id}-${match.court_no}`}
                    className="relative rounded-2xl overflow-hidden flex flex-col min-h-0"
                    style={{
                      backgroundColor: themeColors.cardBg,
                      boxShadow: `0 8px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(${themeColors.accentRgb},0.12)`,
                    }}
                  >
                    {/* Court label */}
                    <div className="flex items-center justify-between px-5 pt-4">
                      <span
                        className="text-[1.1vw] font-extrabold tracking-[0.18em]"
                        style={{ color: themeColors.accent }}
                      >
                        COURT {match.court_no}
                      </span>
                      <span
                        className="text-[0.85vw] font-bold tracking-widest"
                        style={{
                          color:
                            statusLabel === "LIVE"
                              ? themeColors.accent
                              : statusLabel === "FINAL"
                              ? themeColors.mutedText
                              : themeColors.mutedText,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {/* Match row */}
                    <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 pb-5 pt-2 min-h-0">
                      {/* Team A */}
                      <div
                        className={`flex flex-col justify-center min-w-0 transition-opacity ${
                          hasScore && !team1Won ? "opacity-50" : "opacity-100"
                        }`}
                        style={{
                          borderLeft: team1Won
                            ? `4px solid ${themeColors.accent}`
                            : "4px solid transparent",
                          paddingLeft: 12,
                        }}
                      >
                        {teamAPending ? (
                          <div className={`${nameTextClass} font-medium italic`} style={{ color: themeColors.mutedText }}>
                            Players assigning…
                          </div>
                        ) : (
                          <>
                            <div className={`${nameTextClass} font-bold truncate`} style={{ color: themeColors.text }}>
                              {a1}
                            </div>
                            <div className={`${nameTextClass} font-bold truncate`} style={{ color: themeColors.text }}>
                              {a2}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Score / Status */}
                      <div className="flex flex-col items-center justify-center px-2">
                        {hasScore ? (
                          <div
                            className={`${scoreTextClass} font-black tabular-nums tracking-tighter`}
                            style={{ color: themeColors.text }}
                          >
                            <span style={{ opacity: team1Won ? 1 : 0.55 }}>{t1}</span>
                            <span className="px-2" style={{ color: themeColors.mutedText }}>–</span>
                            <span style={{ opacity: team2Won ? 1 : 0.55 }}>{t2}</span>
                          </div>
                        ) : (
                          <div
                            className={`${scoreTextClass} font-black tracking-tighter`}
                            style={{ color: themeColors.accent }}
                          >
                            VS
                          </div>
                        )}
                      </div>

                      {/* Team B */}
                      <div
                        className={`flex flex-col justify-center min-w-0 text-right transition-opacity ${
                          hasScore && !team2Won ? "opacity-50" : "opacity-100"
                        }`}
                        style={{
                          borderRight: team2Won
                            ? `4px solid ${themeColors.accent}`
                            : "4px solid transparent",
                          paddingRight: 12,
                        }}
                      >
                        {teamBPending ? (
                          <div className={`${nameTextClass} font-medium italic`} style={{ color: themeColors.mutedText }}>
                            Players assigning…
                          </div>
                        ) : (
                          <>
                            <div className={`${nameTextClass} font-bold truncate`} style={{ color: themeColors.text }}>
                              {b1}
                            </div>
                            <div className={`${nameTextClass} font-bold truncate`} style={{ color: themeColors.text }}>
                              {b2}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right: Sidebar */}
          <aside className="col-span-4 flex flex-col gap-4 min-h-0">
            {/* Leaderboard */}
            <div
              className="rounded-2xl flex flex-col min-h-0"
              style={{
                backgroundColor: themeColors.cardBg,
                boxShadow: `0 8px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(${themeColors.accentRgb},0.12)`,
              }}
            >
              <div
                className="flex items-center gap-2 px-5 py-3 border-b"
                style={{ borderColor: `rgba(${themeColors.accentRgb},0.15)` }}
              >
                <Trophy className="w-5 h-5" style={{ color: themeColors.accent }} />
                <h3 className="text-[1.2vw] font-bold tracking-tight" style={{ color: themeColors.text }}>
                  Leaderboard
                </h3>
              </div>
              <div className="flex-1 overflow-hidden px-3 py-2">
                {standings.length === 0 ? (
                  <div className="p-3 text-[1vw]" style={{ color: themeColors.mutedText }}>
                    Standings will appear after the first scored match.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {standings.slice(0, 5).map((row, idx) => (
                      <div
                        key={row.player_id}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg"
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[0.9vw] font-bold flex-shrink-0"
                          style={{
                            backgroundColor:
                              idx === 0 ? themeColors.accent : `rgba(255,255,255,0.08)`,
                            color: idx === 0 ? themeColors.headerBg : themeColors.text,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 text-[1.05vw] font-semibold truncate" style={{ color: themeColors.text }}>
                          {row.player_name}
                        </div>
                        <div className="flex items-center gap-3 text-[0.95vw] font-semibold tabular-nums">
                          <span style={{ color: themeColors.mutedText }}>
                            {row.wins}W {row.losses}L
                          </span>
                          <span
                            className="font-bold w-10 text-right"
                            style={{
                              color:
                                row.point_diff > 0
                                  ? themeColors.accent
                                  : row.point_diff < 0
                                  ? "#f87171"
                                  : themeColors.mutedText,
                            }}
                          >
                            {row.point_diff > 0 ? "+" : ""}
                            {row.point_diff}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Up Next */}
            <div
              className="rounded-2xl flex flex-col min-h-0"
              style={{
                backgroundColor: themeColors.cardBg,
                boxShadow: `0 8px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(${themeColors.accentRgb},0.12)`,
              }}
            >
              <div
                className="flex items-center gap-2 px-5 py-3 border-b"
                style={{ borderColor: `rgba(${themeColors.accentRgb},0.15)` }}
              >
                <Clock className="w-5 h-5" style={{ color: themeColors.accent }} />
                <h3 className="text-[1.2vw] font-bold tracking-tight" style={{ color: themeColors.text }}>
                  Up Next · Round {isLastRound ? currentRound : currentRound + 1}
                </h3>
              </div>
              <div className="flex-1 overflow-hidden p-3 space-y-2">
                {isLastRound ? (
                  <div className="px-2 py-3 text-[1vw]" style={{ color: themeColors.mutedText }}>
                    Final round in progress — event wraps after this round.
                  </div>
                ) : nextRoundMatches.length === 0 ? (
                  <div className="px-2 py-3 text-[1vw]" style={{ color: themeColors.mutedText }}>
                    Waiting for matchup…
                  </div>
                ) : (
                  nextRoundMatches.slice(0, 4).map((match) => (
                    <div
                      key={`next-${match.id}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: `rgba(255,255,255,0.04)` }}
                    >
                      <div
                        className="px-2 py-1 rounded text-[0.8vw] font-bold tracking-wider flex-shrink-0"
                        style={{ backgroundColor: `rgba(${themeColors.accentRgb},0.15)`, color: themeColors.accent }}
                      >
                        C{match.court_no}
                      </div>
                      <div className="flex-1 min-w-0 text-[0.95vw] leading-snug" style={{ color: themeColors.text }}>
                        <div className="truncate">
                          {getPlayerName(match.a1_profile)} / {getPlayerName(match.a2_profile)}
                        </div>
                        <div className="truncate" style={{ color: themeColors.mutedText }}>
                          vs {getPlayerName(match.b1_profile)} / {getPlayerName(match.b2_profile)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </main>

        {/* Broadcast ticker */}
        <footer
          className="h-[6vh] min-h-[48px] flex items-center justify-between px-8 border-t"
          style={{
            backgroundColor: themeColors.headerBg,
            borderColor: `rgba(${themeColors.accentRgb}, 0.25)`,
          }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full"
              style={{
                backgroundColor: `rgba(${themeColors.accentRgb}, 0.15)`,
                border: `1px solid ${themeColors.accent}`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: themeColors.accent }}
              />
              <span className="text-[0.95vw] font-extrabold tracking-widest" style={{ color: themeColors.accent }}>
                LIVE
              </span>
            </div>
            <span className="text-[1vw] truncate" style={{ color: themeColors.text }}>
              Round {currentRound} currently active on {courtsLabel}
            </span>
            <span className="text-[1vw] hidden md:inline" style={{ color: themeColors.mutedText }}>
              · {ticker}
            </span>
          </div>

          <div
            className="px-4 py-1 rounded-full text-[0.95vw] font-bold tracking-wider flex-shrink-0"
            style={{
              border: `1px solid ${themeColors.accent}`,
              color: themeColors.accent,
            }}
          >
            Round {currentRound} of {event.num_rounds}
          </div>
        </footer>

        {/* Exit PIN Modal */}
        {pinModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <Card
              className="p-6 max-w-sm mx-4"
              style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}
            >
              <h3 className="text-xl font-bold mb-2" style={{ color: themeColors.text }}>
                Exit Kiosk Mode
              </h3>
              <p className="text-sm mb-4" style={{ color: themeColors.mutedText }}>
                Enter organizer PIN to continue
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPinModalOpen(false)}
                  variant="outline"
                  className="flex-1 hover:opacity-80"
                  style={{ borderColor: themeColors.mutedText, color: themeColors.text }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePinSuccess}
                  className="flex-1"
                  style={{ backgroundColor: themeColors.accent, color: themeColors.headerBg }}
                >
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

// ============================================================
// Final Leaderboard Celebration Screen
// ============================================================

interface FinalLeaderboardScreenProps {
  event: Event;
  standings: StandingsRow[];
  themeColors: typeof THEME_CONFIG[KioskTheme];
  currentTime: Date;
  onExit: () => void;
  onChangeTheme: (t: KioskTheme) => void;
  pinModalOpen: boolean;
  setPinModalOpen: (v: boolean) => void;
  handlePinSuccess: () => void;
}

const MEDAL_COLORS = {
  gold: { bg: '#F5C542', glow: '245, 197, 66', label: 'CHAMPION' },
  silver: { bg: '#C7CDD4', glow: '199, 205, 212', label: '2ND PLACE' },
  bronze: { bg: '#C97A3A', glow: '201, 122, 58', label: '3RD PLACE' },
};

function FinalLeaderboardScreen({
  event,
  standings,
  themeColors,
  currentTime,
  onExit,
  onChangeTheme,
  pinModalOpen,
  setPinModalOpen,
  handlePinSuccess,
}: FinalLeaderboardScreenProps) {
  const champion = standings[0];
  const second = standings[1];
  const third = standings[2];
  const rest = standings.slice(3, 13);

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Stable randomized confetti seeds
  const confetti = Array.from({ length: 36 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: ((i * 13) % 60) / 10,
    duration: 6 + ((i * 7) % 40) / 10,
    color: [themeColors.accent, MEDAL_COLORS.gold.bg, MEDAL_COLORS.silver.bg, MEDAL_COLORS.bronze.bg][i % 4],
    size: 6 + (i % 4) * 2,
    rotate: (i * 23) % 360,
  }));

  return (
    <>
      <style>{`
        @keyframes kiosk-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
        @keyframes kiosk-champ-glow {
          0%, 100% { box-shadow: 0 0 60px rgba(245,197,66,0.45), 0 0 120px rgba(245,197,66,0.25); }
          50% { box-shadow: 0 0 90px rgba(245,197,66,0.7), 0 0 180px rgba(245,197,66,0.35); }
        }
        @keyframes kiosk-rise {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="fixed inset-0 flex flex-col overflow-hidden font-sans"
        style={{
          backgroundColor: themeColors.bg,
          backgroundImage: `radial-gradient(ellipse at 50% 60%, rgba(245,197,66,0.18), transparent 55%), radial-gradient(ellipse at 50% 110%, rgba(${themeColors.accentRgb},0.18), transparent 60%)`,
          color: themeColors.text,
        }}
      >
        {/* Confetti */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="absolute block rounded-sm"
              style={{
                left: `${c.left}%`,
                top: 0,
                width: c.size,
                height: c.size * 1.6,
                backgroundColor: c.color,
                transform: `rotate(${c.rotate}deg)`,
                animation: `kiosk-confetti-fall ${c.duration}s linear ${c.delay}s infinite`,
                opacity: 0.85,
              }}
            />
          ))}
        </div>

        {/* Hidden admin controls */}
        <div className="group absolute top-0 right-0 z-50 w-48 h-16">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-end gap-2 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" style={{ borderColor: themeColors.accent, color: themeColors.accent, backgroundColor: themeColors.headerBg }}>
                  <Palette className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(Object.keys(THEME_CONFIG) as KioskTheme[]).map((t) => (
                  <DropdownMenuItem key={t} onClick={() => onChangeTheme(t)}>
                    {THEME_CONFIG[t].name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FullscreenToggleButton />
            <Button
              size="sm"
              variant="outline"
              onClick={onExit}
              className="gap-2"
              style={{ borderColor: themeColors.accent, color: themeColors.accent, backgroundColor: themeColors.headerBg }}
            >
              <Lock className="h-4 w-4" />
              Exit
            </Button>
          </div>
        </div>

        {/* Header */}
        <header
          className="flex items-center justify-between px-8 h-[8vh] min-h-[64px] border-b relative z-10"
          style={{
            backgroundColor: themeColors.headerBg,
            borderColor: `rgba(${themeColors.accentRgb}, 0.25)`,
          }}
        >
          <div className="flex items-center gap-5">
            <div style={{ color: themeColors.mutedText }}>
              <Logo className="h-[5vh] min-h-9 w-auto" />
            </div>
            <div className="h-[5vh] min-h-9 w-px" style={{ backgroundColor: `rgba(255,255,255,0.15)` }} />
            <div className="flex flex-col leading-tight">
              <h1 className="text-[1.8vw] font-bold tracking-tight" style={{ color: themeColors.text }}>
                {event.name}
              </h1>
              <p className="text-[0.95vw] font-medium tracking-[0.18em] uppercase" style={{ color: MEDAL_COLORS.gold.bg }}>
                Event Complete
              </p>
            </div>
          </div>

          <div className="text-[1.6vw] font-semibold tabular-nums" style={{ color: themeColors.text }}>
            {formattedTime}
          </div>
        </header>

        {/* Body */}
        {standings.length === 0 ? (
          <main className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
            <Trophy className="w-[8vw] h-[8vw]" style={{ color: MEDAL_COLORS.gold.bg }} />
            <h2 className="text-[5vw] font-black mt-4" style={{ color: themeColors.text }}>
              Event Complete
            </h2>
            <p className="text-[1.5vw] mt-2" style={{ color: themeColors.mutedText }}>
              Thanks for playing — no results were recorded.
            </p>
          </main>
        ) : (
          <main className="flex-1 flex flex-col items-center justify-between px-8 py-4 min-h-0 relative z-10">
            {/* Title */}
            <div
              className="flex items-center gap-4"
              style={{ animation: 'kiosk-rise 600ms ease-out both' }}
            >
              <Trophy className="w-[3.5vw] h-[3.5vw]" style={{ color: MEDAL_COLORS.gold.bg }} />
              <h2
                className="text-[4.5vw] font-black tracking-tight"
                style={{
                  color: themeColors.text,
                  textShadow: `0 4px 30px rgba(245,197,66,0.45)`,
                }}
              >
                CHAMPIONS
              </h2>
              <Trophy className="w-[3.5vw] h-[3.5vw]" style={{ color: MEDAL_COLORS.gold.bg }} />
            </div>

            {/* Podium */}
            <div className="flex items-end justify-center gap-6 w-full max-w-[90vw]">
              {/* 2nd */}
              {second && (
                <PodiumCard
                  rank={2}
                  row={second}
                  medal={MEDAL_COLORS.silver}
                  themeColors={themeColors}
                  height="34vh"
                  rankSize="6vw"
                  nameSize="2.4vw"
                  delay="500ms"
                />
              )}
              {/* 1st */}
              {champion && (
                <PodiumCard
                  rank={1}
                  row={champion}
                  medal={MEDAL_COLORS.gold}
                  themeColors={themeColors}
                  height="44vh"
                  rankSize="9vw"
                  nameSize="3.2vw"
                  delay="200ms"
                  isChampion
                />
              )}
              {/* 3rd */}
              {third && (
                <PodiumCard
                  rank={3}
                  row={third}
                  medal={MEDAL_COLORS.bronze}
                  themeColors={themeColors}
                  height="28vh"
                  rankSize="5vw"
                  nameSize="2.2vw"
                  delay="700ms"
                />
              )}
            </div>

            {/* Runners up */}
            {rest.length > 0 && (
              <div
                className="w-full max-w-[90vw] grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(rest.length, 5)}, minmax(0, 1fr))`,
                  animation: 'kiosk-rise 800ms ease-out 900ms both',
                }}
              >
                {rest.map((row, i) => (
                  <div
                    key={row.player_id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{
                      backgroundColor: themeColors.cardBg,
                      boxShadow: `inset 0 0 0 1px rgba(${themeColors.accentRgb},0.12)`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[1vw] font-extrabold flex-shrink-0"
                      style={{ backgroundColor: `rgba(255,255,255,0.08)`, color: themeColors.text }}
                    >
                      {i + 4}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[1.05vw] font-bold truncate" style={{ color: themeColors.text }}>
                        {row.player_name}
                      </div>
                      <div className="text-[0.8vw] tabular-nums" style={{ color: themeColors.mutedText }}>
                        {row.wins}W · {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

        {/* Footer */}
        <footer
          className="h-[6vh] min-h-[48px] flex items-center justify-center px-8 border-t relative z-10"
          style={{
            backgroundColor: themeColors.headerBg,
            borderColor: `rgba(${themeColors.accentRgb}, 0.25)`,
          }}
        >
          <span className="text-[1vw] font-semibold tracking-[0.2em] uppercase" style={{ color: themeColors.mutedText }}>
            Thanks for playing · Powered by <span style={{ color: themeColors.accent }}>PULSE</span>
          </span>
        </footer>

        {/* Exit PIN Modal */}
        {pinModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <Card
              className="p-6 max-w-sm mx-4"
              style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}
            >
              <h3 className="text-xl font-bold mb-2" style={{ color: themeColors.text }}>
                Exit Kiosk Mode
              </h3>
              <p className="text-sm mb-4" style={{ color: themeColors.mutedText }}>
                Enter organizer PIN to continue
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPinModalOpen(false)}
                  variant="outline"
                  className="flex-1 hover:opacity-80"
                  style={{ borderColor: themeColors.mutedText, color: themeColors.text }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePinSuccess}
                  className="flex-1"
                  style={{ backgroundColor: themeColors.accent, color: themeColors.headerBg }}
                >
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

interface PodiumCardProps {
  rank: number;
  row: StandingsRow;
  medal: { bg: string; glow: string; label: string };
  themeColors: typeof THEME_CONFIG[KioskTheme];
  height: string;
  rankSize: string;
  nameSize: string;
  delay: string;
  isChampion?: boolean;
}

function PodiumCard({ rank, row, medal, themeColors, height, rankSize, nameSize, delay, isChampion }: PodiumCardProps) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-end max-w-[28vw]"
      style={{ animation: `kiosk-rise 700ms ease-out ${delay} both` }}
    >
      <div
        className="text-[1vw] font-extrabold tracking-[0.25em] mb-3"
        style={{ color: medal.bg }}
      >
        {medal.label}
      </div>
      <div
        className="w-full rounded-3xl flex flex-col items-center justify-center px-4 py-6 relative"
        style={{
          height,
          backgroundColor: themeColors.cardBg,
          boxShadow: isChampion
            ? `0 0 60px rgba(${medal.glow},0.45), 0 0 120px rgba(${medal.glow},0.25), inset 0 0 0 2px ${medal.bg}`
            : `0 10px 40px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(${medal.glow},0.6)`,
          animation: isChampion ? 'kiosk-champ-glow 2.8s ease-in-out infinite' : undefined,
        }}
      >
        <div
          className="font-black leading-none tabular-nums"
          style={{
            fontSize: rankSize,
            color: medal.bg,
            textShadow: `0 4px 30px rgba(${medal.glow},0.6)`,
          }}
        >
          {rank}
        </div>
        <div
          className="font-extrabold text-center mt-3 px-2"
          style={{ fontSize: nameSize, color: themeColors.text, lineHeight: 1.05 }}
        >
          {row.player_name}
        </div>
        <div
          className="text-[1.05vw] font-bold tabular-nums mt-2 px-3 py-1 rounded-full"
          style={{
            backgroundColor: `rgba(${medal.glow},0.15)`,
            color: medal.bg,
            border: `1px solid rgba(${medal.glow},0.4)`,
          }}
        >
          {row.wins}W · {row.losses}L · {row.point_diff > 0 ? '+' : ''}{row.point_diff}
        </div>
      </div>
    </div>
  );
}
