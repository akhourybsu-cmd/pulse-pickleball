import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Trophy, AlertCircle, Settings, Trash2, Ban, CheckCircle, Edit, Edit3, Bell, Monitor, ExternalLink, Share2, Users, Calendar, MapPin, Zap, RefreshCw, Medal, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { ScheduleRoundCarousel } from "@/components/round-robin/ScheduleRoundCarousel";
import { toast } from "sonner";

import { format, parseISO } from "date-fns";
import { EditEventDialog } from "@/components/round-robin/EditEventDialog";
import { EditModeBanner } from "@/components/round-robin/EditModeBanner";
import { InviteCodeCard } from "@/components/round-robin/InviteCodeCard";
import { WhatsNextBanner } from "@/components/round-robin/WhatsNextBanner";
import { RoundRobinTopBar } from "@/components/round-robin/RoundRobinTopBar";
import { RoundRobinHostHero } from "@/components/round-robin/RoundRobinHostHero";
import { HostControlsMenu } from "@/components/round-robin/HostControlsMenu";
import { PlayerManagementDialog } from "@/components/round-robin/PlayerManagementDialog";
import { CourtsRoundsDialog } from "@/components/round-robin/CourtsRoundsDialog";
import { ScheduleEditorDialog } from "@/components/round-robin/ScheduleEditorDialog";
import { ScoreManagementDialog } from "@/components/round-robin/ScoreManagementDialog";
import { AuditHistoryDialog } from "@/components/round-robin/AuditHistoryDialog";
import { EditNotifications } from "@/components/round-robin/EditNotifications";
import { RegistrationManagement } from "@/components/round-robin/RegistrationManagement";
import { PlayerRoundRobinView } from "@/components/round-robin/PlayerRoundRobinView";
import { PageHeader } from "@/components/PageHeader";
import { z } from "zod";
import { cn } from "@/lib/utils";
import logo from "@/assets/pulse-logo-premium.svg";
import { suggestRounds } from "@/lib/roundRobinFairness";
import { isPlatformAdmin } from "@/lib/permissions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";

// Score validation schema
const scoreSchema = z.object({
  team1_score: z.number().min(0).max(99),
  team2_score: z.number().min(0).max(99),
}).refine(
  (data) => data.team1_score !== data.team2_score,
  { message: "Scores cannot be tied" }
);

interface Event {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  location: string | null;
  notes: string | null;
  organizer_id: string;
  num_courts: number;
  num_rounds: number;
  games_per_player?: number;
  current_round: number | null;
  status: "draft" | "live" | "completed" | "voided";
  rating_eligible: boolean;
  rating_type: "ladder" | "league" | "playoffs" | "casual";
  format?: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  voided: boolean;
  registration_deadline?: string | null;
  registration_mode?: string | null;
  max_players?: number | null;
  /** Auto-generated invite code for invite-only events (XYZ-ABCD format).
   *  Surfaced to the host so they can share it with players. */
  invite_code?: string | null;
  group_id?: string | null;
}

interface Player {
  id: string;
  event_id: string;
  player_id: string;
  joined_at: string;
  active: boolean;
  profiles: {
    id: string;
    full_name: string;
    display_name: string | null;
  };
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
  match_id: string | null;
}

interface StandingsRow {
  player_id: string;
  player_name: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  isRemoved?: boolean;
}

interface MatchScore {
  [matchId: string]: {
    team1_score: number;
    team2_score: number;
  };
}

export default function RoundRobinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // When the user arrived via /venue/round-robins/:id (now a redirect with
  // ?ctx=venue), back-nav should return them to the venue console rather
  // than the public RR hub.
  // Venue context still goes back to the venue console RR list; player
  // context now lands on the player's own history page (not the
  // catch-all /round-robin hub, which we're sunsetting from player
  // navigation).
  const backHref = searchParams.get("ctx") === "venue" ? "/venue/round-robins" : "/player/round-robins";
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMatch[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [scores, setScores] = useState<MatchScore>({});
  const [savingScore, setSavingScore] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'void' | 'hard'>('void');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [playerManagementOpen, setPlayerManagementOpen] = useState(false);
  const [courtsRoundsOpen, setCourtsRoundsOpen] = useState(false);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [scoreManagementOpen, setScoreManagementOpen] = useState(false);
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);

  useEffect(() => {
    fetchEventDetails();
    fetchAuditHistory();
    
    const channel = supabase
      .channel('round-robin-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_events',
          filter: `id=eq.${id}`
        },
        () => {
          fetchEventDetails();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_schedule',
          filter: `event_id=eq.${id}`
        },
        () => {
          fetchEventDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchAuditHistory = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("round_robin_audit")
      .select(`
        id,
        change_type,
        editor_id,
        changes,
        created_at,
        reason,
        profiles:editor_id (
          display_name,
          email
        )
      `)
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching audit history:", error);
      return;
    }

    const formattedEntries = data.map((entry: any) => ({
      ...entry,
      editor_name:
        entry.profiles?.display_name || entry.profiles?.email || "Unknown",
    }));

    setAuditEntries(formattedEntries);
  };

  const fetchEventDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Check if user is admin (centralized helper from src/lib/permissions)
      setIsAdmin(await isPlatformAdmin(user.id));

      const { data: eventData, error: eventError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("id", id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);
      setIsOrganizer(eventData.organizer_id === user.id);

      const { data: playersData, error: playersError } = await supabase
        .from("round_robin_players")
        .select("*, profiles(*)")
        .eq("event_id", id);

      if (playersError) throw playersError;
      setPlayers(playersData || []);
      
      // Check if user is a participant
      const userIsParticipant = playersData?.some(
        (p: Player) => p.player_id === user.id
      );
      setIsParticipant(userIsParticipant || false);


      const { data: scheduleData, error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .select(`
          *,
          a1_profile:profiles!round_robin_schedule_a1_player_id_fkey(display_name, full_name),
          a2_profile:profiles!round_robin_schedule_a2_player_id_fkey(display_name, full_name),
          b1_profile:profiles!round_robin_schedule_b1_player_id_fkey(display_name, full_name),
          b2_profile:profiles!round_robin_schedule_b2_player_id_fkey(display_name, full_name)
        `)
        .eq("event_id", id)
        .order("round_no")
        .order("court_no");

      if (scheduleError) throw scheduleError;
      setSchedule(scheduleData || []);

      if (scheduleData && playersData) {
        calculateStandings(scheduleData, playersData);
      }

      setLoading(false);
    } catch (error: any) {
      toast.error("Failed to load event details. Please try again.");
      console.error(error);
      setLoading(false);
    }
  };

  // Auto-trigger rating recalculation for completed events with unprocessed matches
  useEffect(() => {
    const checkAndRecalculateRatings = async () => {
      if (!event || event.status !== 'completed' || !event.rating_eligible) return;
      
      // Check if there are any matches with match_id but no rating_after
      const matchesWithIds = schedule.filter(m => m.match_id && !m.is_bye);
      if (matchesWithIds.length === 0) return;
      
      // Check if ratings have been calculated for these matches
      const { data: participants } = await supabase
        .from('match_participants')
        .select('rating_after')
        .in('match_id', matchesWithIds.map(m => m.match_id))
        .limit(1);
      
      // If we have matches but no ratings calculated, trigger recalculation
      if (participants && participants.length > 0 && participants[0].rating_after === null) {
        console.log('Triggering rating recalculation for completed round robin...');
        const { error } = await supabase.rpc('recalculate_all_ratings');
        if (error) {
          console.error('Failed to recalculate ratings:', error);
        } else {
          toast.success('Ratings calculated for round robin matches!');
        }
      }
    };
    
    checkAndRecalculateRatings();
  }, [event, schedule]);

  const handleGenerateSchedule = async () => {
    if (!event) return;
    
    const activePlayers = players;
    if (activePlayers.length < 4) {
      toast.error("At least 4 players are required");
      return;
    }

    // Show confirmation dialog
    const hasExistingSchedule = schedule.length > 0;
    const maxPossibleMatches = Math.floor(activePlayers.length / 4);
    const matchesPerRound = Math.min(event.num_courts, maxPossibleMatches);
    const gamesPerRoundPerPlayer = (4 * matchesPerRound) / activePlayers.length;
    const calculatedRounds = Math.ceil((event.games_per_player || 3) / gamesPerRoundPerPlayer);
    
    const confirmMessage = hasExistingSchedule 
      ? `This will DELETE the existing schedule and generate a new one.\n\nNew schedule will have:\n• ${calculatedRounds} rounds\n• ${matchesPerRound} matches per round (using ${matchesPerRound} of ${event.num_courts} courts)\n• ${event.games_per_player || 3} games per player\n\nAre you sure?`
      : `Generate schedule with:\n• ${calculatedRounds} rounds\n• ${matchesPerRound} matches per round (using ${matchesPerRound} of ${event.num_courts} courts)\n• ${event.games_per_player || 3} games per player\n\nProceed?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("generate-round-robin-schedule", {
        body: {
          event_id: event.id,
          player_ids: activePlayers.map((p) => p.player_id),
          num_courts: event.num_courts,
          num_rounds: event.num_rounds,
          games_per_player: event.games_per_player || 3,
        },
      });

      if (error) throw error;
      toast.success(`Schedule generated with ${calculatedRounds} rounds!`);
      fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to generate schedule");
      console.error(error);
    }
  };

  const handleStartEvent = async () => {
    try {
      const { error } = await supabase
        .from("round_robin_events")
        .update({ status: "live", current_round: 1 })
        .eq("id", id);

      if (error) throw error;
      toast.success("Event started!");
      fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to start event");
      console.error(error);
    }
  };

  const handleCloseRound = async (roundNo: number) => {
    if (!event) return;
    
    const roundMatches = schedule.filter(s => s.round_no === roundNo && !s.is_bye);
    const allScored = roundMatches.every(m => m.team1_score !== null && m.team2_score !== null);
    
    if (!allScored) {
      toast.error("All matches in this round must be scored before closing");
      return;
    }

    try {
      const nextRound = roundNo + 1;
      if (nextRound <= event.num_rounds) {
        await supabase
          .from("round_robin_events")
          .update({ current_round: nextRound })
          .eq("id", id);
        toast.success(`Round ${roundNo} closed! Round ${nextRound} is now active.`);
      } else {
        toast.info("This is the final round. Complete the event to submit to match history.");
      }
      fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to close round");
      console.error(error);
    }
  };

  const getPlayerName = (playerId: string | null, matchData?: any) => {
    if (!playerId) return "—";
    
    // First try to get from the match data if provided (has joined profile data)
    if (matchData) {
      const profileKey = 
        playerId === matchData.a1_player_id ? 'a1_profile' :
        playerId === matchData.a2_player_id ? 'a2_profile' :
        playerId === matchData.b1_player_id ? 'b1_profile' :
        playerId === matchData.b2_player_id ? 'b2_profile' : null;
      
      if (profileKey && matchData[profileKey]) {
        return matchData[profileKey].display_name || matchData[profileKey].full_name;
      }
    }
    
    // Fallback to players array
    const player = players.find((p) => p.player_id === playerId);
    return player?.profiles?.display_name || player?.profiles?.full_name || "Unknown Player";
  };

  const getRoundMatches = (roundNo: number) => {
    return schedule.filter((s) => s.round_no === roundNo);
  };

  const handleScoreChange = (matchId: string, team: 'team1' | 'team2', value: string) => {
    const numValue = parseInt(value) || 0;
    setScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === 'team1' ? 'team1_score' : 'team2_score']: numValue,
      }
    }));
  };

  const calculateStandings = (scheduleData: ScheduleMatch[], playersData: Player[]) => {
    const stats: Record<string, StandingsRow> = {};
    const activePlayers = playersData.filter(p => p.active);
    const removedPlayers = playersData.filter(p => !p.active);

    // Initialize stats for all players (active and removed)
    playersData.forEach((p) => {
      stats[p.player_id] = {
        player_id: p.player_id,
        player_name: p.profiles.display_name || p.profiles.full_name,
        wins: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        point_diff: 0,
      };
    });

    scheduleData.forEach((match) => {
      if (!match.is_bye && match.team1_score !== null && match.team2_score !== null) {
        const team1Won = match.team1_score > match.team2_score;

        [match.a1_player_id, match.a2_player_id].forEach((pid) => {
          if (pid && stats[pid]) {
            stats[pid].points_for += match.team1_score;
            stats[pid].points_against += match.team2_score;
            if (team1Won) stats[pid].wins++;
            else stats[pid].losses++;
          }
        });

        [match.b1_player_id, match.b2_player_id].forEach((pid) => {
          if (pid && stats[pid]) {
            stats[pid].points_for += match.team2_score;
            stats[pid].points_against += match.team1_score;
            if (!team1Won) stats[pid].wins++;
            else stats[pid].losses++;
          }
        });
      }
    });

    // Separate standings into active and removed
    const activeStandingsArray = activePlayers.map(p => ({
      ...stats[p.player_id],
      point_diff: stats[p.player_id].points_for - stats[p.player_id].points_against,
    }));

    const removedStandingsArray = removedPlayers.map(p => ({
      ...stats[p.player_id],
      point_diff: stats[p.player_id].points_for - stats[p.player_id].points_against,
      isRemoved: true,
    }));

    // Sort active players normally
    activeStandingsArray.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });

    // Combine: active players first, then removed (DNF) players
    setStandings([...activeStandingsArray, ...removedStandingsArray.map(r => ({ ...r, isRemoved: true }))]);
  };

  const handleSaveScore = async (match: ScheduleMatch) => {
    if (!event || !userId) return;

    const score = scores[match.id];
    if (!score) {
      toast.error("Enter scores for both teams");
      return;
    }

    const validation = scoreSchema.safeParse(score);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSavingScore(match.id);
    try {
      // Phase-2 immediate sync — submit_rr_match_score atomically updates
      // round_robin_schedule AND upserts the corresponding matches +
      // match_participants rows in one server-side transaction. The match
      // appears in the player's history right away instead of waiting for
      // event completion. The match-insert trigger fires the rating
      // recalc automatically (when count_for_rating = true).
      const { error } = await supabase.rpc("submit_rr_match_score", {
        p_schedule_id: match.id,
        p_team1_score: score.team1_score,
        p_team2_score: score.team2_score,
      });

      if (error) throw error;

      toast.success("Score saved");
      fetchEventDetails();

      setScores(prev => {
        const newScores = { ...prev };
        delete newScores[match.id];
        return newScores;
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to save score");
      console.error(error);
    } finally {
      setSavingScore(null);
    }
  };

  const handleCompleteEvent = async () => {
    if (!event) return;
    
    // Check if all matches have scores, show confirmation for partial submission
    const unscoredMatches = schedule.filter(m => !m.is_bye && (m.team1_score === null || m.team2_score === null));
    const scoredMatches = schedule.filter(m => !m.is_bye && m.team1_score !== null && m.team2_score !== null);
    
    if (unscoredMatches.length > 0) {
      const totalMatches = schedule.filter(m => !m.is_bye).length;
      const confirmMessage = `You have ${unscoredMatches.length} unscored match(es) out of ${totalMatches} total.\n\nOnly the ${scoredMatches.length} completed match(es) will be saved to match history.\n\nContinue?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }
    
    try {
      // Phase-2 immediate-sync model: every score entered via
      // handleSaveScore / handleEditMatchScore was already pushed into
      // matches + match_participants by submit_rr_match_score. So
      // completion has only two jobs left:
      //   1. Backfill any scored schedule rows that DON'T yet have a
      //      linked match_id (e.g. events scored before this migration
      //      shipped). Idempotent via the same RPC.
      //   2. Flip the event's status to 'completed'.
      const needsBackfill = scoredMatches.filter(m => !m.match_id);
      const errors: string[] = [];
      let backfilled = 0;

      for (const m of needsBackfill) {
        const { error } = await supabase.rpc("submit_rr_match_score", {
          p_schedule_id: m.id,
          p_team1_score: m.team1_score!,
          p_team2_score: m.team2_score!,
        });
        if (error) {
          errors.push(`Round ${m.round_no} Court ${m.court_no}: ${error.message}`);
        } else {
          backfilled += 1;
        }
      }

      // QA-flagged: previously this loop silently swallowed per-match
      // failures and then marked the event complete anyway, leaving
      // scored matches orphaned from match history. Bail before status
      // flip if anything in the backfill failed so the host knows their
      // event isn't fully synced.
      if (errors.length > 0) {
        toast.error(`Cannot complete — ${errors.length} match(es) failed to sync`, {
          description: errors.slice(0, 3).join("; "),
        });
        console.error("Match sync errors during completion:", errors);
        return;
      }

      const { error: statusError } = await supabase
        .from("round_robin_events")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_round: null,
        })
        .eq("id", id);

      if (statusError) throw statusError;

      // Audit the completion itself.
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId!,
        change_type: "event_complete",
        changes: {
          synced_total: scoredMatches.length,
          backfilled,
          unscored: unscoredMatches.length,
        },
        reason: "Event marked complete",
      });

      toast.success(
        backfilled > 0
          ? `Event completed · ${scoredMatches.length} matches in history (${backfilled} backfilled)`
          : `Event completed · ${scoredMatches.length} matches in history`,
      );

      fetchEventDetails();
    } catch (error: any) {
      toast.error(`Failed to complete event: ${error.message}`);
      console.error(error);
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;

    try {
      if (deleteMode === 'void') {
        const { error } = await supabase.rpc('void_round_robin_event', {
          p_event_id: event.id,
          p_reason: 'Event voided by organizer'
        });
        if (error) throw error;
        toast.success("Event voided. Results no longer count toward ratings.");
        // After voiding the host should return to their history — the
        // event itself is now read-only and there's nothing more to do
        // on the detail page in the moment.
        setDeleteDialogOpen(false);
        navigate(backHref);
        return;
      } else {
        const { error } = await supabase.rpc('delete_round_robin_event', {
          p_event_id: event.id
        });
        if (error) throw error;
        toast.success("Event deleted.");
        setDeleteDialogOpen(false);
        navigate(backHref);
        return;
      }
    } catch (error: any) {
      // RPC errors surface here. The void/delete RPCs raise sharp
      // messages on permission failure and on the "scored event can't
      // be hard-deleted by non-admin" guard — show them verbatim.
      toast.error(error.message || "Failed to update event");
      console.error(error);
    }
  };

  const handleSaveEventSettings = async (updates: Partial<Event>) => {
    if (!event || !userId) return;

    try {
      // Create audit entry
      const before = {
        name: event.name,
        notes: event.notes,
        rating_eligible: event.rating_eligible,
        rating_type: event.rating_type,
      };

      const after = { ...before, ...updates };

      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "event_settings",
        changes: { before, after },
        reason: "Event settings updated",
      });

      // Update event
      const { error } = await supabase
        .from("round_robin_events")
        .update(updates)
        .eq("id", event.id);

      if (error) throw error;

      toast.success("Event settings updated");
      await fetchEventDetails();
      await fetchAuditHistory();
      setHasUnsavedChanges(false);
    } catch (error: any) {
      toast.error("Failed to update event settings");
      console.error(error);
    }
  };

  const handleToggleEditMode = () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Discard them?")) {
        return;
      }
      setHasUnsavedChanges(false);
    }
    setIsEditMode(!isEditMode);
  };

  const regenerateScheduleFromRound = async (fromRound: number) => {
    if (!event) return;

    const activePlayers = players.filter(p => p.active);
    if (activePlayers.length < 4) {
      toast.error("At least 4 active players are required");
      return;
    }

    try {
      // Only delete unscored matches from the specified round onward
      const { error: deleteError } = await supabase
        .from("round_robin_schedule")
        .delete()
        .eq("event_id", event.id)
        .gte("round_no", fromRound)
        .is("team1_score", null)
        .is("team2_score", null);

      if (deleteError) throw deleteError;

      // Regenerate schedule
      const { error: generateError } = await supabase.functions.invoke("generate-round-robin-schedule", {
        body: {
          event_id: event.id,
          player_ids: activePlayers.map(p => p.player_id),
          num_courts: event.num_courts,
          num_rounds: event.num_rounds,
          games_per_player: event.games_per_player || 3,
        },
      });

      if (generateError) throw generateError;

      await fetchEventDetails();
    } catch (error: any) {
      throw error;
    }
  };

  const handleAddPlayer = async ({
    playerId,
    guestName,
  }: { playerId: string | null; guestName?: string }) => {
    if (!event || !userId) return;

    try {
      // Add player (or guest placeholder) to event
      const { error: insertError } = await supabase
        .from("round_robin_players")
        .insert({
          event_id: event.id,
          player_id: playerId,
          guest_name: guestName ?? null,
        } as never);

      if (insertError) throw insertError;

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "player_add",
        changes: { player_id: playerId, guest_name: guestName ?? null },
        reason: guestName
          ? `Guest player added by organizer (${guestName})`
          : "Player added by organizer",
      });

      // Regenerate from current round
      const fromRound = event.current_round || 1;
      await regenerateScheduleFromRound(fromRound);

      toast.success(
        guestName
          ? `${guestName} added as a guest`
          : "Player added - they will see this event in their events list",
      );
    } catch (error: any) {
      toast.error("Failed to add player");
      console.error(error);
      throw error;
    }
  };

  const handleMarkInactive = async (playerEventId: string) => {
    if (!event || !userId) return;

    const player = players.find(p => p.id === playerEventId);
    if (!player) return;

    try {
      // Delete player record completely so they can rejoin
      const { error: deleteError } = await supabase
        .from("round_robin_players")
        .delete()
        .eq("id", playerEventId);

      if (deleteError) throw deleteError;

      // Audit entry with removal round for DNF tracking
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "player_removed",
        changes: { 
          player_id: player.player_id,
          removed_at_round: event.current_round || 1,
        },
        reason: "Player removed from roster (past scores preserved)",
      });

      // Regenerate from current round
      const fromRound = event.current_round || 1;
      await regenerateScheduleFromRound(fromRound);

      toast.success("Player removed and schedule regenerated - they can rejoin later");
    } catch (error: any) {
      toast.error("Failed to remove player");
      console.error(error);
      throw error;
    }
  };

  const handleSubstitute = async (
    originalPlayerId: string,
    newPlayerId: string,
    scope: 'global' | number
  ) => {
    if (!event || !userId) return;

    try {
      if (scope === 'global') {
        // Global substitution: add new player (or reactivate if they exist), regenerate schedule
        const existingPlayer = players.find(p => p.player_id === newPlayerId);
        const wasInactive = existingPlayer && !existingPlayer.active;
        
        if (existingPlayer) {
          // Player already exists, reactivate them
          await supabase
            .from("round_robin_players")
            .update({ active: true })
            .eq("id", existingPlayer.id);
        } else {
          // New player, insert them as active
          await supabase.from("round_robin_players").insert({
            event_id: event.id,
            player_id: newPlayerId,
            active: true,
          });
        }

        // Mark the old player as inactive
        const oldPlayer = players.find(p => p.player_id === originalPlayerId);
        if (oldPlayer) {
          await supabase
            .from("round_robin_players")
            .update({ active: false })
            .eq("id", oldPlayer.id);
        }

        await supabase.from("round_robin_audit").insert({
          event_id: event.id,
          editor_id: userId,
          change_type: "player_substitute",
          changes: {
            original_player_id: originalPlayerId,
            new_player_id: newPlayerId,
            scope: 'global',
            was_reactivated: wasInactive,
          },
          reason: wasInactive 
            ? "Player reactivated and substituted globally" 
            : "Global player substitution",
        });

        // Regenerate schedule from current round for fair redistribution
        const fromRound = event.current_round || 1;
        await regenerateScheduleFromRound(fromRound);

        await fetchEventDetails();
        toast.success(
          wasInactive 
            ? "Player reactivated and schedule regenerated" 
            : "Player substituted and schedule regenerated"
        );
      } else {
        // Single round substitution: update specific unstarted matches
        const roundMatches = schedule.filter(s => 
          s.round_no === scope && 
          !s.is_bye && 
          s.team1_score === null && 
          s.team2_score === null
        );
        
        for (const match of roundMatches) {
          const updates: any = {};
          if (match.a1_player_id === originalPlayerId) updates.a1_player_id = newPlayerId;
          if (match.a2_player_id === originalPlayerId) updates.a2_player_id = newPlayerId;
          if (match.b1_player_id === originalPlayerId) updates.b1_player_id = newPlayerId;
          if (match.b2_player_id === originalPlayerId) updates.b2_player_id = newPlayerId;

          if (Object.keys(updates).length > 0) {
            await supabase
              .from("round_robin_schedule")
              .update(updates)
              .eq("id", match.id);
          }
        }

        await supabase.from("round_robin_audit").insert({
          event_id: event.id,
          editor_id: userId,
          change_type: "player_substitute",
          changes: {
            original_player_id: originalPlayerId,
            new_player_id: newPlayerId,
            scope: scope,
          },
          reason: `Player substitution for Round ${scope}`,
        });

        await fetchEventDetails();
        toast.success(`Player substituted for Round ${scope}`);
      }
    } catch (error: any) {
      toast.error("Failed to substitute player");
      console.error(error);
      throw error;
    }
  };

  const handleUpdateCourts = async (newCourts: number) => {
    if (!event || !userId) return;

    try {
      const before = { num_courts: event.num_courts };
      
      // Calculate new number of rounds needed with the new court count
      const newRounds = suggestRounds(players.length, newCourts, event.games_per_player || 3);
      const after = { num_courts: newCourts, num_rounds: newRounds };

      // Update event with both courts and rounds
      const { error: updateError } = await supabase
        .from("round_robin_events")
        .update({ 
          num_courts: newCourts,
          num_rounds: newRounds
        })
        .eq("id", event.id);

      if (updateError) throw updateError;

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "courts_update",
        changes: { before, after },
        reason: `Courts ${newCourts > event.num_courts ? 'increased' : 'decreased'} to ${newCourts}, rounds adjusted to ${newRounds}`,
      });

      // In draft mode, regenerate the entire schedule from round 1
      // In active events, regenerate from current round
      const fromRound = event.status === 'draft' ? 1 : (event.current_round || 1);
      await regenerateScheduleFromRound(fromRound);

      toast.success(`Courts updated to ${newCourts} (${newRounds} rounds)`);
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to update courts");
      console.error(error);
      throw error;
    }
  };

  const handleUpdateGamesPerPlayer = async (newGamesPerPlayer: number) => {
    if (!event || !userId) return;

    try {
      const before = { games_per_player: event.games_per_player };
      const after = { games_per_player: newGamesPerPlayer };

      // Calculate new number of rounds needed using the same algorithm as the dialog
      const newRounds = suggestRounds(players.length, event.num_courts, newGamesPerPlayer);

      // Update event
      const { error: updateError } = await supabase
        .from("round_robin_events")
        .update({ 
          games_per_player: newGamesPerPlayer,
          num_rounds: newRounds
        })
        .eq("id", event.id);

      if (updateError) throw updateError;

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "games_per_player_update",
        changes: { before, after, rounds_adjusted_to: newRounds },
        reason: `Games per player updated to ${newGamesPerPlayer}, rounds adjusted to ${newRounds}`,
      });

      // Regenerate schedule from current round
      const fromRound = event.current_round || 1;
      await regenerateScheduleFromRound(fromRound);

      toast.success(`Games per player updated to ${newGamesPerPlayer} (${newRounds} rounds)`);
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to update games per player");
      console.error(error);
      throw error;
    }
  };

  const handleSwapPartners = async (matchId: string, team: 'A' | 'B') => {
    if (!event || !userId) return;

    try {
      const match = schedule.find(m => m.id === matchId);
      if (!match) return;

      const updates = team === 'A' 
        ? { a1_player_id: match.a2_player_id, a2_player_id: match.a1_player_id }
        : { b1_player_id: match.b2_player_id, b2_player_id: match.b1_player_id };

      const { error } = await supabase
        .from("round_robin_schedule")
        .update(updates)
        .eq("id", matchId);

      if (error) throw error;

      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "schedule_edit",
        changes: {
          action: "swap_partners",
          match_id: matchId,
          team,
          before: team === 'A' 
            ? { a1: match.a1_player_id, a2: match.a2_player_id }
            : { b1: match.b1_player_id, b2: match.b2_player_id },
          after: updates,
        },
        reason: `Swapped partners in Team ${team} for Round ${match.round_no}, Court ${match.court_no}`,
      });

      toast.success("Partners swapped");
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to swap partners");
      console.error(error);
      throw error;
    }
  };

  const handleSwapOpponents = async (match1Id: string, match2Id: string) => {
    if (!event || !userId) return;

    try {
      const match1 = schedule.find(m => m.id === match1Id);
      const match2 = schedule.find(m => m.id === match2Id);
      if (!match1 || !match2) return;

      // Swap Team B from match1 with Team A from match2
      await supabase
        .from("round_robin_schedule")
        .update({
          b1_player_id: match2.a1_player_id,
          b2_player_id: match2.a2_player_id,
        })
        .eq("id", match1Id);

      await supabase
        .from("round_robin_schedule")
        .update({
          a1_player_id: match1.b1_player_id,
          a2_player_id: match1.b2_player_id,
        })
        .eq("id", match2Id);

      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "schedule_edit",
        changes: {
          action: "swap_opponents",
          match1_id: match1Id,
          match2_id: match2Id,
        },
        reason: `Swapped opponents between Round ${match1.round_no} Court ${match1.court_no} and Court ${match2.court_no}`,
      });

      toast.success("Opponents swapped");
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to swap opponents");
      console.error(error);
      throw error;
    }
  };

  const handleMoveCourt = async (matchId: string, newCourtNo: number) => {
    if (!event || !userId) return;

    try {
      const match = schedule.find(m => m.id === matchId);
      if (!match) return;

      const { error } = await supabase
        .from("round_robin_schedule")
        .update({ court_no: newCourtNo })
        .eq("id", matchId);

      if (error) throw error;

      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "schedule_edit",
        changes: {
          action: "move_court",
          match_id: matchId,
          before: { court_no: match.court_no },
          after: { court_no: newCourtNo },
        },
        reason: `Moved match from Court ${match.court_no} to Court ${newCourtNo} in Round ${match.round_no}`,
      });

      toast.success(`Match moved to Court ${newCourtNo}`);
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to move match");
      console.error(error);
      throw error;
    }
  };

  const handleEditMatchScore = async (matchId: string, team1Score: number, team2Score: number) => {
    if (!event || !userId) return;

    try {
      // matchId is the round_robin_schedule.id. submit_rr_match_score
      // handles the full edit path: updates schedule + matches +
      // match_participants, resets verification, writes the audit log,
      // and (when the match row already exists) updates the linked
      // matches row in place so ratings stay correct.
      const { error } = await supabase.rpc("submit_rr_match_score", {
        p_schedule_id: matchId,
        p_team1_score: team1Score,
        p_team2_score: team2Score,
      });

      if (error) throw error;

      toast.success("Score updated");
      await fetchEventDetails();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update score");
      console.error(error);
      throw error;
    }
  };

  const handleVoidMatch = async (matchId: string) => {
    if (!event || !userId) return;

    try {
      const match = schedule.find(m => m.id === matchId);
      if (!match) return;

      // If match is linked to matches table, void it there
      if (match.match_id) {
        await supabase
          .from("matches")
          .update({
            voided: true,
            voided_by: userId,
            voided_at: new Date().toISOString(),
            void_reason: "Voided via Round Robin editor",
          })
          .eq("id", match.match_id);

        // Recalculate ratings if event is rating eligible
        if (event.rating_eligible) {
          await supabase.rpc("recalculate_all_ratings");
        }
      }

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "match_void",
        changes: {
          match_id: matchId,
          schedule_match_id: match.match_id,
        },
        reason: `Match voided for Round ${match.round_no}, Court ${match.court_no}`,
      });

      toast.success("Match voided and removed from ratings");
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to void match");
      console.error(error);
      throw error;
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!event || !userId || !isAdmin) return;

    try {
      const match = schedule.find(m => m.id === matchId);
      if (!match) return;

      // Delete from matches table if linked
      if (match.match_id) {
        // Delete match participants first
        await supabase
          .from("match_participants")
          .delete()
          .eq("match_id", match.match_id);

        // Delete match
        await supabase
          .from("matches")
          .delete()
          .eq("id", match.match_id);

        // Recalculate ratings if event is rating eligible
        if (event.rating_eligible) {
          await supabase.rpc("recalculate_all_ratings");
        }
      }

      // Clear scores from schedule
      await supabase
        .from("round_robin_schedule")
        .update({
          team1_score: null,
          team2_score: null,
          match_id: null,
        })
        .eq("id", matchId);

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "match_delete",
        changes: {
          match_id: matchId,
          schedule_match_id: match.match_id,
        },
        reason: `Match deleted by admin for Round ${match.round_no}, Court ${match.court_no}`,
      });

      toast.success("Match deleted and ratings reflowed");
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to delete match");
      console.error(error);
      throw error;
    }
  };

  const handleLeaveEvent = async () => {
    if (!userId || !event) return;

    // Validation checks
    if (isOrganizer) {
      toast.error("Organizers cannot leave their own events");
      return;
    }

    if (event.status === 'live' || event.status === 'completed') {
      toast.error("Cannot leave event that has already started");
      return;
    }

    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      toast.error("Registration deadline has passed");
      return;
    }

    try {
      const { error } = await supabase
        .from('round_robin_players')
        .update({ active: false })
        .eq('event_id', event.id)
        .eq('player_id', userId);

      if (error) throw error;

      toast.success(`You have left ${event.name}`);
      setLeaveDialogOpen(false);
      navigate(backHref);
    } catch (error: any) {
      console.error('Leave error:', error);
      toast.error('Failed to leave event');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative h-16 w-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
          </div>
          <p className="text-muted-foreground font-medium">Loading event...</p>
        </motion.div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-4">Event not found</p>
          <Button onClick={() => navigate(backHref)} variant="outline">
            Go Back
          </Button>
        </motion.div>
      </div>
    );
  }

  // Non-organizers see simplified view
  if (!isOrganizer && !isAdmin) {
    return <PlayerRoundRobinView eventId={id || ""} userId={userId} />;
  }

  // Organizers and admins see full view
  const hasSchedule = schedule.length > 0;
  const canGenerate = players.length >= 4;
  const hasScores = schedule.some(m => m.team1_score !== null || m.team2_score !== null);
  const currentRound = event.current_round || 1;

  // Calculate progress step
  const getCurrentStep = () => {
    if (players.length < 4) return 1;
    if (!hasSchedule) return 2;
    if (event.status === 'live' || hasScores) return 3;
    if (event.status === 'completed') return 4;
    return 2;
  };

  const currentStep = getCurrentStep();

  // Estimate rounds and time
  const estimatedRounds = hasSchedule ? event.num_rounds : suggestRounds(players.length, event.num_courts, event.games_per_player || 3);
  const estimatedMinutes = estimatedRounds * 12;

  // Share functionality
  const handleShareEvent = () => {
    const eventUrl = `${window.location.origin}/round-robin/${event.id}`;
    if (navigator.share) {
      navigator.share({
        title: event.name,
        text: `Join the Round Robin event: ${event.name}`,
        url: eventUrl,
      }).catch(() => {
        navigator.clipboard.writeText(eventUrl);
        toast.success("Event link copied to clipboard!");
      });
    } else {
      navigator.clipboard.writeText(eventUrl);
      toast.success("Event link copied to clipboard!");
    }
  };

  // Get player initials
  const getPlayerInitials = (player: Player) => {
    const name = player.profiles.display_name || player.profiles.full_name;
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Handler for the overflow menu "Regenerate schedule" action.
  // Wraps the existing regenerateScheduleFromRound helper with a
  // confirm + toast envelope, matching what the old inline button did.
  const handleRegenerateSchedule = async () => {
    if (!confirm("Regenerate the entire schedule from scratch? This will reset all court assignments to match current settings.")) {
      return;
    }
    try {
      toast.loading("Regenerating schedule...");
      await regenerateScheduleFromRound(1);
      await fetchEventDetails();
      toast.success("Schedule regenerated successfully");
    } catch (error: unknown) {
      toast.error("Failed to regenerate schedule");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Slim top bar — back · "Round Robin" · share · overflow.
          Replaces the global PULSE/Bell/Profile/Theme/Sign-out toolbar
          on this route so the host has a focused command-center surface
          and prime mobile real estate isn't eaten by app-wide chrome. */}
      <RoundRobinTopBar
        backHref={backHref}
        label="Round Robin"
        onShare={isOrganizer || isParticipant ? handleShareEvent : undefined}
        overflow={
          isOrganizer && !event.voided ? (
            <HostControlsMenu
              status={event.status}
              hasSchedule={hasSchedule}
              isEditMode={isEditMode}
              canDestroy={isOrganizer}
              onSettings={() => setEditDialogOpen(true)}
              onCourtsAndGames={() => setCourtsRoundsOpen(true)}
              onRegenerateSchedule={handleRegenerateSchedule}
              onOpenKiosk={() => {
                const kioskUrl = `/round-robin/${event.id}/kiosk`;
                window.open(kioskUrl, "_blank", "width=1920,height=1080");
              }}
              onDeleteOrVoid={() => setDeleteDialogOpen(true)}
            />
          ) : undefined
        }
      />

      {isEditMode && (
        <div className="bg-warning/20 border-b border-warning">
          <div className="container mx-auto px-4 py-2">
            <p className="text-sm text-warning-foreground font-medium text-center">
              Edit Mode Active — Make changes to {event.name}
            </p>
          </div>
        </div>
      )}

      <div className="pb-20">
        {/* Consolidated host hero — title, status, metadata, invite code.
            No action row here; primary action lives in WhatsNextBanner
            below, secondary actions live in the top-bar overflow menu. */}
        <RoundRobinHostHero
          name={event.name}
          date={event.date}
          startTime={event.start_time}
          status={event.status}
          voided={event.voided}
          ratingEligible={event.rating_eligible}
          format={event.format}
          numRounds={event.num_rounds}
          numCourts={event.num_courts}
          playerCount={players.length}
          hasSchedule={hasSchedule}
          inviteCode={event.invite_code}
          registrationMode={event.registration_mode}
          eventId={event.id}
        />

        {/* Leave button for participants — kept here, just out of the hero.
            Compact, only shown when relevant. */}
        {!isOrganizer &&
          isParticipant &&
          !event.voided &&
          event.status === "draft" &&
          (!event.registration_deadline || new Date() < new Date(event.registration_deadline)) && (
            <div className="container max-w-2xl mx-auto px-4 -mt-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeaveDialogOpen(true)}
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                Leave Event
              </Button>
            </div>
          )}

      <main className="container max-w-[1280px] mx-auto px-4 py-6">
        {isOrganizer && isEditMode && (
          <div className="mb-6">
            <EditModeBanner
              isEditMode={isEditMode}
              eventName={event.name}
              hasUnsavedChanges={hasUnsavedChanges}
              onToggleEdit={handleToggleEditMode}
            />
          </div>
        )}

        {/* Removed: the redundant "Add or confirm players" Alert
            (duplicate of WhatsNextBanner's prompt) and the four-dot
            lifecycle stepper (also a duplicate). The InviteCodeCard
            is folded inline into the new RoundRobinHostHero. The host
            now sees exactly one primary action surface — the
            WhatsNextBanner — below the hero. */}

        {/* What's next — the single host action surface.
            All earlier duplicates (lifecycle stepper, Alert,
            standalone InviteCodeCard) have been removed in favor of
            this. The hero answers "what IS this event?", this banner
            answers "what should I do right now?" */}
        {isOrganizer && (
          <div className="mb-6 max-w-2xl mx-auto">
            <WhatsNextBanner
              status={event.status}
              voided={event.voided}
              hasPlayers={players.length >= 4}
              hasSchedule={hasSchedule}
              playerCount={players.length}
              courtCount={event.num_courts}
              currentRound={event.current_round}
              totalRounds={event.num_rounds}
              currentRoundScoredCount={
                event.current_round != null
                  ? schedule.filter(
                      (m) =>
                        m.round_no === event.current_round &&
                        !m.is_bye &&
                        m.team1_score != null &&
                        m.team2_score != null,
                    ).length
                  : 0
              }
              currentRoundTotalCount={
                event.current_round != null
                  ? schedule.filter(
                      (m) => m.round_no === event.current_round && !m.is_bye,
                    ).length
                  : 0
              }
              isOrganizer={isOrganizer}
              onAddPlayers={() => setPlayerManagementOpen(true)}
              onGenerateSchedule={handleGenerateSchedule}
              onStartEvent={handleStartEvent}
              onCloseRound={() => event.current_round && handleCloseRound(event.current_round)}
              onCompleteEvent={handleCompleteEvent}
            />
          </div>
        )}

        <div>
        <Tabs defaultValue="schedule" className="w-full">
          {/* Tab strip — design-system styling, no decorative blur/shadow. */}
          <TabsList className="w-full max-w-md mx-auto grid grid-cols-3 mb-6 p-1 bg-muted rounded-xl h-auto">
            <TabsTrigger
              value="schedule"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-colors py-2 gap-1.5"
            >
              <Calendar className="h-4 w-4" />
              <span>Schedule</span>
            </TabsTrigger>
            <TabsTrigger
              value="players"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-colors py-2 gap-1.5"
            >
              <Users className="h-4 w-4" />
              <span>Players · {players.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="standings"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-colors py-2 gap-1.5"
            >
              <Trophy className="h-4 w-4" />
              <span>Standings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-4 space-y-4">
            {!hasSchedule ? (
              <Card className="border-dashed border-2 bg-gradient-to-br from-card to-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                    <Zap className="h-12 w-12 text-primary" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold">No schedule yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Add or confirm players, then generate your schedule.
                    </p>
                    {players.length >= 4 && (
                      <p className="text-xs text-muted-foreground">
                        With {players.length} players you'll typically see ~{estimatedRounds} rounds (~{estimatedMinutes} min)
                      </p>
                    )}
                  </div>
                  {isOrganizer && (
                    <div className="flex flex-col items-center gap-3 mt-4">
                      <Button 
                        onClick={handleGenerateSchedule} 
                        disabled={!canGenerate}
                        size="lg"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Generate Schedule
                      </Button>
                      {players.length < 4 && (
                        <Button 
                          variant="link" 
                          size="sm"
                          onClick={() => {
                            const playersTab = document.querySelector('[value="players"]') as HTMLElement;
                            playersTab?.click();
                          }}
                        >
                          Review players
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {isOrganizer && event.status === "live" && (
                  <Button 
                    onClick={handleCompleteEvent} 
                    className="w-full mb-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Event & Submit to Match History
                  </Button>
                )}



                <ScheduleRoundCarousel 
                  totalRounds={event.num_rounds} 
                  currentRound={event.current_round || 1}
                  rightAction={
                    isOrganizer && !event.voided && event.status !== 'completed' ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setScheduleEditorOpen(true)}
                          className="text-primary hover:text-primary hover:bg-primary/10 gap-1.5 h-9 px-2.5"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="text-sm font-medium">Edit schedule</span>
                        </Button>
                        {hasScores && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setScoreManagementOpen(true)}
                            className="text-muted-foreground hover:text-foreground h-9 w-9 p-0"
                            aria-label="Manage scores"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : undefined
                  }
                >
                  {(roundNo, isActiveSlide) => {
                    const allMatches = getRoundMatches(roundNo);
                    const courtMatches = allMatches.filter(m => !m.is_bye);
                    const byeMatches = allMatches.filter(m => m.is_bye);
                    const isCurrentRound = roundNo === currentRound;
                    const isFutureRound = roundNo > currentRound;
                    const allRoundScored = courtMatches.every(m => m.team1_score !== null && m.team2_score !== null);
                    
                    return (
                      <div className={`space-y-3 ${isFutureRound ? 'opacity-60' : ''}`}>
                        {/* Section label + optional close-round action */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Court Assignments
                            {isCurrentRound && event.status === 'live' && (
                              <span className="ml-2 inline-flex items-center gap-1 text-primary normal-case font-bold tracking-normal">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                                </span>
                                Active
                              </span>
                            )}
                          </div>
                          {isOrganizer && event.status === "live" && isCurrentRound && allRoundScored && roundNo < event.num_rounds && (
                            <Button 
                              size="sm" 
                              onClick={() => handleCloseRound(roundNo)}
                              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-8"
                            >
                              <CheckCircle className="h-4 w-4 mr-1.5" />
                              Close Round
                            </Button>
                          )}
                        </div>

                        
                        <div className="grid gap-4 md:grid-cols-2">
                          {courtMatches.map((match, idx) => {
                            const isCompleted = match.team1_score !== null && match.team2_score !== null;
                            const team1Won = isCompleted && match.team1_score! > match.team2_score!;
                            const team2Won = isCompleted && match.team2_score! > match.team1_score!;

                            return (
                              <motion.div
                                key={match.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                              >
                                <Card className={`overflow-hidden transition-all hover:shadow-md ${
                                  isFutureRound ? 'pointer-events-none' : ''
                                } ${isCompleted ? 'bg-gradient-to-r from-card to-muted/30' : ''}`}>
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="font-mono bg-muted/50">Court {match.court_no}</Badge>
                                      {isCompleted && (
                                        <Badge variant="secondary" className="text-xs">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Completed
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                                        team1Won 
                                          ? 'bg-primary/15 border border-primary/30' 
                                          : 'bg-muted/50'
                                      }`}>
                                        <div className={`text-sm truncate flex-1 ${team1Won ? 'font-semibold' : ''}`}>
                                          {getPlayerName(match.a1_player_id, match)} / {getPlayerName(match.a2_player_id, match)}
                                        </div>
                                        {match.team1_score !== null ? (
                                          <div className={`text-xl font-bold font-mono ml-2 ${team1Won ? 'text-primary' : ''}`}>{match.team1_score}</div>
                                        ) : isOrganizer && event.status === "live" && isCurrentRound ? (
                                          <Input
                                            type="number"
                                            min="0"
                                            max="99"
                                            inputMode="numeric"
                                            className="w-16 h-10 text-center text-base font-bold tabular-nums ml-2 focus-visible:ring-2 focus-visible:ring-primary"
                                            placeholder="0"
                                            value={scores[match.id]?.team1_score ?? ''}
                                            onChange={(e) => handleScoreChange(match.id, 'team1', e.target.value)}
                                          />
                                        ) : (
                                          <div className="text-muted-foreground ml-2">—</div>
                                        )}
                                      </div>
                                      
                                      <div className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                                        team2Won 
                                          ? 'bg-primary/15 border border-primary/30' 
                                          : 'bg-muted/50'
                                      }`}>
                                        <div className={`text-sm truncate flex-1 ${team2Won ? 'font-semibold' : ''}`}>
                                          {getPlayerName(match.b1_player_id, match)} / {getPlayerName(match.b2_player_id, match)}
                                        </div>
                                        {match.team2_score !== null ? (
                                          <div className={`text-xl font-bold font-mono ml-2 ${team2Won ? 'text-primary' : ''}`}>{match.team2_score}</div>
                                        ) : isOrganizer && event.status === "live" && isCurrentRound ? (
                                          <Input
                                            type="number"
                                            min="0"
                                            max="99"
                                            inputMode="numeric"
                                            className="w-16 h-10 text-center text-base font-bold tabular-nums ml-2 focus-visible:ring-2 focus-visible:ring-primary"
                                            placeholder="0"
                                            value={scores[match.id]?.team2_score ?? ''}
                                            onChange={(e) => handleScoreChange(match.id, 'team2', e.target.value)}
                                          />
                                        ) : (
                                          <div className="text-muted-foreground ml-2">—</div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {isOrganizer && event.status === "live" && isCurrentRound && match.team1_score === null && (
                                      <Button
                                        onClick={() => handleSaveScore(match)}
                                        disabled={savingScore === match.id}
                                        size="sm"
                                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                      >
                                        {savingScore === match.id ? "Saving..." : "Save Score"}
                                      </Button>
                                    )}
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </div>

                        {byeMatches.length > 0 && (
                          <div className="mt-3 rounded-2xl border border-border/50 bg-muted/30 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold tracking-wider uppercase">
                                Bye
                              </span>
                              <span className="text-xs text-muted-foreground">Players resting this round</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {byeMatches.map((match) => (
                                <span
                                  key={match.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/60 text-xs font-medium text-foreground"
                                >
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                  {getPlayerName(match.a1_player_id, match)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }}
                </ScheduleRoundCarousel>
              </>
            )}
          </TabsContent>

          <TabsContent value="players" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Participants</CardTitle>
                  {isOrganizer && !event.voided && event.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlayerManagementOpen(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Manage Players
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {players.length > 0 && (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Players ({players.length})
                      </p>
                      {players.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="font-medium">
                            {player.profiles.display_name || player.profiles.full_name}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">Active</Badge>
                            {isOrganizer && !event.voided && event.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const playerName = player.profiles.display_name || player.profiles.full_name;
                                  if (!confirm(`Remove ${playerName} from this event?`)) return;
                                  
                                  try {
                                    const { error } = await supabase
                                      .from('round_robin_players')
                                      .update({ active: false })
                                      .eq('id', player.id);
                                    
                                    if (error) throw error;
                                    toast.success('Player removed');
                                    fetchEventDetails();
                                  } catch (error) {
                                    console.error('Remove error:', error);
                                    toast.error('Failed to remove player');
                                  }
                                }}
                                title="Remove player"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standings" className="mt-6 space-y-6">
            {/* Top 3 Leaderboard - only active players */}
            {standings.filter(s => !(s as any).isRemoved).length >= 3 && (
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Top 3 Leaders</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {standings.filter(s => !(s as any).isRemoved).slice(0, 3).map((row, idx) => (
                      <div 
                        key={row.player_id} 
                        className={`relative p-4 rounded-lg border-2 ${
                          idx === 0 
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600' 
                            : idx === 1
                            ? 'bg-slate-50 dark:bg-slate-950/30 border-slate-400 dark:border-slate-600'
                            : 'bg-orange-50 dark:bg-orange-950/30 border-orange-400 dark:border-orange-600'
                        }`}
                      >
                        <div className="text-center space-y-2">
                          <div className={`text-3xl font-bold ${
                            idx === 0 
                              ? 'text-amber-600 dark:text-amber-400' 
                              : idx === 1
                              ? 'text-slate-600 dark:text-slate-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                          </div>
                          <div className="font-semibold text-sm line-clamp-1">
                            {row.player_name}
                          </div>
                          <div className="flex justify-center gap-3 text-xs">
                            <div className="flex flex-col items-center">
                              <span className="text-green-600 dark:text-green-400 font-bold">{row.wins}</span>
                              <span className="text-muted-foreground">W</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-muted-foreground font-bold">{row.losses}</span>
                              <span className="text-muted-foreground">L</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className={`font-bold ${row.point_diff > 0 ? 'text-green-600 dark:text-green-400' : row.point_diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                              </span>
                              <span className="text-muted-foreground">Diff</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Full Standings Table */}
            <Card>
              <CardHeader>
                <CardTitle>Full Standings</CardTitle>
                <CardDescription>Based on completed matches</CardDescription>
              </CardHeader>
              <CardContent>
                {standings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No matches completed yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-semibold">#</th>
                          <th className="text-left py-3 px-2 font-semibold">Player</th>
                          <th className="text-center py-3 px-2 font-semibold">W</th>
                          <th className="text-center py-3 px-2 font-semibold">L</th>
                          <th className="text-center py-3 px-2 font-semibold hidden sm:table-cell">PF</th>
                          <th className="text-center py-3 px-2 font-semibold hidden sm:table-cell">PA</th>
                          <th className="text-center py-3 px-2 font-semibold">+/-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.filter(s => !(s as any).isRemoved).map((row, idx) => (
                          <tr key={row.player_id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <Badge variant={idx < 3 ? "default" : "outline"} className="w-8 h-8 flex items-center justify-center">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 font-medium">{row.player_name}</td>
                            <td className="text-center py-3 px-2 font-semibold text-green-600 dark:text-green-400">{row.wins}</td>
                            <td className="text-center py-3 px-2 text-muted-foreground">{row.losses}</td>
                            <td className="text-center py-3 px-2 hidden sm:table-cell">{row.points_for}</td>
                            <td className="text-center py-3 px-2 hidden sm:table-cell">{row.points_against}</td>
                            <td className={`text-center py-3 px-2 font-semibold ${row.point_diff > 0 ? 'text-green-600 dark:text-green-400' : row.point_diff < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                              {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                            </td>
                          </tr>
                        ))}
                        
                        {/* DNF Section for removed players */}
                        {standings.filter(s => (s as any).isRemoved).length > 0 && (
                          <>
                            <tr className="bg-muted/30">
                              <td colSpan={7} className="py-3 px-2 font-medium text-muted-foreground">
                                Did Not Finish (DNF)
                              </td>
                            </tr>
                            {standings.filter(s => (s as any).isRemoved).map((row) => (
                              <tr key={row.player_id} className="border-b hover:bg-muted/30 opacity-60">
                                <td className="py-3 px-2">
                                  <Badge variant="outline" className="w-8 h-8 flex items-center justify-center bg-muted/50">
                                    —
                                  </Badge>
                                </td>
                                <td className="py-3 px-2 font-medium text-muted-foreground">{row.player_name}</td>
                                <td className="text-center py-3 px-2 text-muted-foreground">{row.wins}</td>
                                <td className="text-center py-3 px-2 text-muted-foreground">{row.losses}</td>
                                <td className="text-center py-3 px-2 hidden sm:table-cell text-muted-foreground">{row.points_for}</td>
                                <td className="text-center py-3 px-2 hidden sm:table-cell text-muted-foreground">{row.points_against}</td>
                                <td className="text-center py-3 px-2 text-muted-foreground">
                                  {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this Round Robin?</AlertDialogTitle>
            <AlertDialogDescription>
              Pick how to handle the event. Both options remove it from
              your active list.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Two-mode picker — replaces the previous single-mode dialog
              that couldn't be toggled in place. Each option is a
              tappable card with copy + warning. */}
          <div className="grid grid-cols-1 gap-2 my-2">
            {/* VOID — soft cancel. Always available to the host. */}
            <button
              type="button"
              onClick={() => setDeleteMode('void')}
              className={cn(
                "text-left rounded-lg border-2 p-3 transition-all",
                deleteMode === 'void'
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border/80 hover:bg-muted/30",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    deleteMode === 'void'
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Ban className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">Void event</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    Keeps the record with a "Voided" badge. Matches stop
                    counting toward ratings. Reversible by an admin.
                  </div>
                </div>
              </div>
            </button>

            {/* DELETE — hard, irreversible. Disabled (not just warned)
                when the event has scores and the user is not an admin. */}
            <button
              type="button"
              onClick={() => setDeleteMode('hard')}
              disabled={hasScores && !isAdmin}
              className={cn(
                "text-left rounded-lg border-2 p-3 transition-all",
                deleteMode === 'hard'
                  ? "border-destructive bg-destructive/5"
                  : "border-border hover:border-border/80 hover:bg-muted/30",
                hasScores && !isAdmin && "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    deleteMode === 'hard'
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">Delete permanently</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {hasScores && !isAdmin
                      ? "Disabled — this event has saved scores. Void instead, or ask an admin to hard-delete."
                      : "Removes the schedule, players, and all records. Cannot be undone."}
                  </div>
                </div>
              </div>
            </button>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={deleteMode === 'hard' && hasScores && !isAdmin}
              className={deleteMode === 'hard' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {deleteMode === 'void' ? 'Void event' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {event && (
        <>
          <EditEventDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            event={event}
            onSave={handleSaveEventSettings}
            playerCount={players.length}
          />
          
          <PlayerManagementDialog
            open={playerManagementOpen}
            onOpenChange={setPlayerManagementOpen}
            players={players}
            currentRound={event.current_round}
            totalRounds={event.num_rounds}
            groupId={event.group_id}
            genderFilter={event.format === "male" ? "male" : event.format === "female" ? "female" : undefined}
            onAddPlayer={handleAddPlayer}
            onMarkInactive={handleMarkInactive}
            onSubstitute={handleSubstitute}
          />

          <CourtsRoundsDialog
            open={courtsRoundsOpen}
            onOpenChange={setCourtsRoundsOpen}
            currentCourts={event.num_courts}
            currentGamesPerPlayer={event.games_per_player || 3}
            currentRound={event.current_round}
            hasScores={hasScores}
            totalPlayers={players.length}
            onUpdateCourts={handleUpdateCourts}
            onUpdateGamesPerPlayer={handleUpdateGamesPerPlayer}
          />

          <ScheduleEditorDialog
            open={scheduleEditorOpen}
            onOpenChange={setScheduleEditorOpen}
            schedule={schedule}
            currentRound={event.current_round}
            getPlayerName={getPlayerName}
            onSwapPartners={handleSwapPartners}
            onSwapOpponents={handleSwapOpponents}
            onMoveCourt={handleMoveCourt}
          />

          <ScoreManagementDialog
            open={scoreManagementOpen}
            onOpenChange={setScoreManagementOpen}
            schedule={schedule}
            isAdmin={isAdmin}
            ratingEligible={event.rating_eligible}
            getPlayerName={getPlayerName}
            onEditScore={handleEditMatchScore}
            onVoidMatch={handleVoidMatch}
            onDeleteMatch={handleDeleteMatch}
          />

          <AuditHistoryDialog
            open={auditHistoryOpen}
            onOpenChange={setAuditHistoryOpen}
            auditEntries={auditEntries}
          />


          <EditNotifications
            eventId={id || ""}
            userId={userId}
            isOrganizer={isOrganizer}
          />
        </>
      )}
      </div>
    </div>
  );
}


