import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FullscreenToggleButton } from "@/components/kiosk/FullscreenToggleButton";
import { toast } from "sonner";
import { Lock, Clock, Trophy, Palette } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMode } from "@/contexts/ModeContext";
import { getVenueLogoSrc, getVenueLogoFallback } from "@/lib/venueBranding";

type KioskTheme = 'venue' | 'proBroadcast' | 'courtGreen' | 'oceanBlue';

const BASE_THEMES = {
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
  num_courts: number;
  num_rounds: number;
  current_round: number | null;
  status: "draft" | "live" | "completed";
  venue_id: string | null;
}

interface ScheduleMatch {
  id: string;
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
  point_diff: number;
}

export default function VenueRoundRobinKiosk() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentVenue } = useMode();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [currentRoundMatches, setCurrentRoundMatches] = useState<ScheduleMatch[]>([]);
  const [nextRoundMatches, setNextRoundMatches] = useState<ScheduleMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [allSchedule, setAllSchedule] = useState<ScheduleMatch[]>([]);
  
  const [theme, setTheme] = useState<KioskTheme>(() => {
    const saved = localStorage.getItem('venueKioskTheme');
    return (saved as KioskTheme) || 'venue';
  });

  // Get venue branding
  const venueLogoSrc = getVenueLogoSrc(currentVenue?.logo_url, currentVenue?.venue_name);
  const venuePrimaryColor = currentVenue?.primary_color || '#22c55e';
  
  // Convert hex to RGB for venue theme
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '34, 197, 94';
  };

  const venueTheme = {
    name: currentVenue?.venue_name || 'Venue',
    bg: '#1a1a1a',
    headerBg: '#0f0f0f',
    cardBg: '#262626',
    accent: venuePrimaryColor,
    accentRgb: hexToRgb(venuePrimaryColor),
    text: '#ffffff',
    mutedText: '#9ca3af',
  };

  const THEME_CONFIG = {
    venue: venueTheme,
    ...BASE_THEMES,
  };

  const themeColors = THEME_CONFIG[theme];
  
  useEffect(() => {
    localStorage.setItem('venueKioskTheme', theme);
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchEventData();
    
    const eventsChannel = supabase
      .channel(`venue-kiosk-events-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_robin_events', filter: `id=eq.${id}` }, () => fetchEventData())
      .subscribe();

    const scheduleChannel = supabase
      .channel(`venue-kiosk-schedule-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_robin_schedule', filter: `event_id=eq.${id}` }, () => fetchEventData())
      .subscribe();

    const refreshInterval = setInterval(fetchEventData, 5000);

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(scheduleChannel);
      clearInterval(refreshInterval);
    };
  }, [id]);

  const calculateStandings = (schedule: ScheduleMatch[]) => {
    const playerStats = new Map<string, StandingsRow>();

    schedule.filter(m => !m.is_bye && m.team1_score !== null && m.team2_score !== null).forEach((match) => {
      const team1 = [match.a1_player_id, match.a2_player_id].filter((id): id is string => id !== null);
      const team2 = [match.b1_player_id, match.b2_player_id].filter((id): id is string => id !== null);
      const t1score = match.team1_score!;
      const t2score = match.team2_score!;
      const team1Won = t1score > t2score;

      [...team1, ...team2].forEach((playerId) => {
        if (!playerStats.has(playerId)) {
          playerStats.set(playerId, {
            player_id: playerId,
            player_name: getPlayerIdName(playerId, schedule),
            wins: 0, losses: 0, point_diff: 0
          });
        }
      });

      team1.forEach((playerId) => {
        const stats = playerStats.get(playerId)!;
        stats.point_diff += t1score - t2score;
        if (team1Won) stats.wins++; else stats.losses++;
      });

      team2.forEach((playerId) => {
        const stats = playerStats.get(playerId)!;
        stats.point_diff += t2score - t1score;
        if (!team1Won) stats.wins++; else stats.losses++;
      });
    });

    return Array.from(playerStats.values()).sort((a, b) => b.wins - a.wins || b.point_diff - a.point_diff);
  };

  const getPlayerIdName = (playerId: string, schedule: ScheduleMatch[]): string => {
    for (const match of schedule) {
      if (match.a1_player_id === playerId && match.a1_profile) return match.a1_profile.display_name || match.a1_profile.full_name;
      if (match.a2_player_id === playerId && match.a2_profile) return match.a2_profile.display_name || match.a2_profile.full_name;
      if (match.b1_player_id === playerId && match.b1_profile) return match.b1_profile.display_name || match.b1_profile.full_name;
      if (match.b2_player_id === playerId && match.b2_profile) return match.b2_profile.display_name || match.b2_profile.full_name;
    }
    return "Unknown";
  };

  const fetchEventData = async () => {
    if (!id) return;

    try {
      const { data: eventData, error: eventError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("id", id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      if (eventData.status === "completed") {
        setLoading(false);
        return;
      }

      const currentRound = eventData.current_round || 1;

      const { data: fullSchedule } = await supabase
        .from("round_robin_schedule")
        .select("*")
        .eq("event_id", id)
        .order("round_no")
        .order("court_no");

      const allPlayerIds = new Set<string>();
      fullSchedule?.forEach(match => {
        if (match.a1_player_id) allPlayerIds.add(match.a1_player_id);
        if (match.a2_player_id) allPlayerIds.add(match.a2_player_id);
        if (match.b1_player_id) allPlayerIds.add(match.b1_player_id);
        if (match.b2_player_id) allPlayerIds.add(match.b2_player_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", Array.from(allPlayerIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const fullScheduleWithProfiles = fullSchedule?.map(match => ({
        ...match,
        a1_profile: match.a1_player_id ? profileMap.get(match.a1_player_id) : null,
        a2_profile: match.a2_player_id ? profileMap.get(match.a2_player_id) : null,
        b1_profile: match.b1_player_id ? profileMap.get(match.b1_player_id) : null,
        b2_profile: match.b2_player_id ? profileMap.get(match.b2_player_id) : null,
      })) || [];

      setAllSchedule(fullScheduleWithProfiles);
      setStandings(calculateStandings(fullScheduleWithProfiles));

      const currentWithProfiles = fullScheduleWithProfiles.filter(m => m.round_no === currentRound && !m.is_bye);
      setCurrentRoundMatches(currentWithProfiles);

      if (currentRound < eventData.num_rounds) {
        setNextRoundMatches(fullScheduleWithProfiles.filter(m => m.round_no === currentRound + 1 && !m.is_bye));
      } else {
        setNextRoundMatches([]);
      }
    } catch (error) {
      console.error("Error fetching event data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPlayerName = (profile: any) => profile?.display_name || profile?.full_name || "TBD";

  const handleExitKiosk = () => navigate(`/venue/round-robins/${id}`);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: themeColors.bg }}>
        <div className="text-2xl" style={{ color: themeColors.text }}>Loading...</div>
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
        </div>
      </div>
    );
  }

  const currentRound = event.current_round || 1;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: themeColors.bg }}>
      {/* Header */}
      <div className="sticky top-0 z-50 border-b shadow-xl px-6 py-3 flex items-center justify-between" style={{ backgroundColor: themeColors.headerBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
        <div className="flex items-center gap-4">
          <img 
            src={venueLogoSrc} 
            alt={currentVenue?.venue_name || "Venue"} 
            className="h-10 w-auto"
            onError={(e) => { e.currentTarget.src = getVenueLogoFallback(); }}
          />
          <div>
            <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>{event.name}</h1>
            <p className="text-sm" style={{ color: themeColors.mutedText }}>
              Round {currentRound} of {event.num_rounds}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right" style={{ color: themeColors.mutedText }}>
            <Clock className="h-4 w-4 inline mr-1" />
            {currentTime.toLocaleTimeString()}
          </div>
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
          <FullscreenToggleButton />
          <Button size="sm" variant="outline" onClick={handleExitKiosk} style={{ borderColor: themeColors.accent, color: themeColors.accent }}>
            <Lock className="h-4 w-4 mr-2" />Exit
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Courts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold" style={{ color: themeColors.text }}>Current Round</h2>
              <Badge style={{ backgroundColor: themeColors.accent, color: themeColors.headerBg }}>
                Round {currentRound} of {event.num_rounds}
              </Badge>
            </div>
            
            <div className="grid gap-4">
              {currentRoundMatches.map((match) => (
                <Card key={match.id} className="p-4" style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
                  <div className="flex items-center justify-between mb-3">
                    <Badge style={{ backgroundColor: themeColors.accent, color: themeColors.headerBg }}>
                      Court {match.court_no}
                    </Badge>
                    {match.team1_score !== null && (
                      <Badge variant="outline" style={{ borderColor: themeColors.accent, color: themeColors.accent }}>Final</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold" style={{ color: themeColors.text }}>{getPlayerName(match.a1_profile)}</p>
                      <p className="text-sm" style={{ color: themeColors.mutedText }}>{getPlayerName(match.a2_profile)}</p>
                    </div>
                    
                    <div className="px-4">
                      {match.team1_score !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold" style={{ color: match.team1_score > (match.team2_score || 0) ? themeColors.accent : themeColors.text }}>
                            {match.team1_score}
                          </span>
                          <span className="text-xl" style={{ color: themeColors.mutedText }}>-</span>
                          <span className="text-3xl font-bold" style={{ color: (match.team2_score || 0) > match.team1_score ? themeColors.accent : themeColors.text }}>
                            {match.team2_score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xl font-bold" style={{ color: themeColors.accent }}>VS</span>
                      )}
                    </div>
                    
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold" style={{ color: themeColors.text }}>{getPlayerName(match.b1_profile)}</p>
                      <p className="text-sm" style={{ color: themeColors.mutedText }}>{getPlayerName(match.b2_profile)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Next Round Preview */}
            {nextRoundMatches.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4" style={{ color: themeColors.mutedText }}>Up Next: Round {currentRound + 1}</h3>
                <div className="grid gap-3 opacity-70">
                  {nextRoundMatches.map((match) => (
                    <Card key={match.id} className="p-3" style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.1)` }}>
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline" style={{ borderColor: themeColors.accent, color: themeColors.accent }}>
                          Court {match.court_no}
                        </Badge>
                        <span style={{ color: themeColors.text }}>
                          {getPlayerName(match.a1_profile)} & {getPlayerName(match.a2_profile)}
                        </span>
                        <span style={{ color: themeColors.mutedText }}>vs</span>
                        <span style={{ color: themeColors.text }}>
                          {getPlayerName(match.b1_profile)} & {getPlayerName(match.b2_profile)}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Standings */}
          <div>
            <Card className="p-4" style={{ backgroundColor: themeColors.cardBg, borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5" style={{ color: themeColors.accent }} />
                <h3 className="text-xl font-bold" style={{ color: themeColors.text }}>Standings</h3>
              </div>
              
              <div className="space-y-2">
                {standings.slice(0, 10).map((row, i) => (
                  <div key={row.player_id} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: i < 3 ? `rgba(${themeColors.accentRgb}, 0.1)` : 'transparent' }}>
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${i < 3 ? 'text-black' : ''}`} style={{ backgroundColor: i < 3 ? themeColors.accent : 'transparent', color: i < 3 ? themeColors.headerBg : themeColors.mutedText }}>
                        {i + 1}
                      </span>
                      <span className="font-medium" style={{ color: themeColors.text }}>{row.player_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold" style={{ color: themeColors.accent }}>{row.wins}W</span>
                      <span style={{ color: themeColors.mutedText }}> - {row.losses}L</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t py-2 px-6 text-center" style={{ borderColor: `rgba(${themeColors.accentRgb}, 0.2)` }}>
        <p className="text-xs" style={{ color: themeColors.mutedText }}>
          Powered by <span style={{ color: themeColors.accent }}>Pulse</span>
        </p>
      </div>
    </div>
  );
}
