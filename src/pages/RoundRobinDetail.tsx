import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Play, Trophy, AlertCircle, Settings, Trash2, Ban, CheckCircle, Edit, Edit3, Bell, Monitor, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { BackToDashboard } from "@/components/BackToDashboard";
import { EditEventDialog } from "@/components/round-robin/EditEventDialog";
import { EditModeBanner } from "@/components/round-robin/EditModeBanner";
import { PlayerManagementDialog } from "@/components/round-robin/PlayerManagementDialog";
import { CourtsRoundsDialog } from "@/components/round-robin/CourtsRoundsDialog";
import { ScheduleEditorDialog } from "@/components/round-robin/ScheduleEditorDialog";
import { ScoreManagementDialog } from "@/components/round-robin/ScoreManagementDialog";
import { AuditHistoryDialog } from "@/components/round-robin/AuditHistoryDialog";
import { EditNotifications } from "@/components/round-robin/EditNotifications";
import { RegistrationManagement } from "@/components/round-robin/RegistrationManagement";
import { z } from "zod";
import logo from "@/assets/pulse-logo-new.png";

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
  status: "draft" | "live" | "completed";
  rating_eligible: boolean;
  rating_type: "ladder" | "league" | "playoffs" | "casual";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  voided: boolean;
  organizer_pin: string | null;
  registration_deadline?: string | null;
  registration_mode?: string | null;
  max_players?: number | null;
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

      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!roleData);

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
      toast.success("Schedule generated!");
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

    const standingsArray = Object.values(stats).map((s) => ({
      ...s,
      point_diff: s.points_for - s.points_against,
    }));

    standingsArray.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });

    setStandings(standingsArray);
  };

  const handleSaveScore = async (match: ScheduleMatch) => {
    if (!event || !userId) return;
    
    const score = scores[match.id];
    if (!score) {
      toast.error("Enter scores for both teams");
      return;
    }

    // Validate scores
    const validation = scoreSchema.safeParse(score);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSavingScore(match.id);
    try {
      // Update schedule with scores
      const { error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .update({ 
          team1_score: score.team1_score,
          team2_score: score.team2_score 
        })
        .eq("id", match.id);

      if (scheduleError) throw scheduleError;

      // Create match history record immediately if rating eligible
      if (event.rating_eligible && !match.match_id) {
        try {
          // Determine court_id from event location if possible
          const courtId = null; // Will use other_location instead
          
          // Create match record
          const { data: matchData, error: matchError } = await supabase
            .from("matches")
            .insert({
              match_date: event.date,
              team1_score: score.team1_score,
              team2_score: score.team2_score,
              created_by: userId,
              source: "round_robin",
              round_no: match.round_no,
              court_no: match.court_no,
              court_id: courtId,
              other_location: event.location,
              match_type: event.rating_type,
              status: "approved",
            })
            .select()
            .single();

          if (matchError) {
            console.error("Failed to create match record:", matchError);
          } else {
            // Insert participants
            const participants = [
              { match_id: matchData.id, player_id: match.a1_player_id!, team: 1 },
              { match_id: matchData.id, player_id: match.a2_player_id!, team: 1 },
              { match_id: matchData.id, player_id: match.b1_player_id!, team: 2 },
              { match_id: matchData.id, player_id: match.b2_player_id!, team: 2 },
            ];

            const { error: participantsError } = await supabase
              .from("match_participants")
              .insert(participants);

            if (participantsError) {
              console.error("Failed to create participants:", participantsError);
              // Clean up orphaned match
              await supabase.from("matches").delete().eq("id", matchData.id);
            } else {
              // Link match to schedule
              await supabase
                .from("round_robin_schedule")
                .update({ match_id: matchData.id })
                .eq("id", match.id);
              
              console.log("Match added to history in real-time");
            }
          }
        } catch (matchErr: any) {
          console.error("Error creating match history:", matchErr);
          // Continue even if match creation fails - score is still saved
        }
      }

      toast.success(event.rating_eligible && !match.match_id ? "Score saved & added to match history!" : "Score saved!");
      fetchEventDetails();
      
      setScores(prev => {
        const newScores = { ...prev };
        delete newScores[match.id];
        return newScores;
      });
    } catch (error: any) {
      toast.error("Failed to save score");
      console.error(error);
    } finally {
      setSavingScore(null);
    }
  };

  const handleCompleteEvent = async () => {
    if (!event) return;
    
    // Check if all matches have scores
    const unscoredMatches = schedule.filter(m => !m.is_bye && (m.team1_score === null || m.team2_score === null));
    if (unscoredMatches.length > 0) {
      toast.error(`${unscoredMatches.length} match(es) still need scores before completing the event.`);
      return;
    }
    
    try {
      let matchesCreated = 0;
      const errors: string[] = [];
      
      for (const match of schedule) {
        // Only process scored matches that haven't been submitted yet
        if (!match.is_bye && match.team1_score !== null && match.team2_score !== null && !match.match_id) {
          try {
            // Get court_id from event location if it matches a court name
            let courtId: string | null = null;
            if (event.location) {
              const { data: courtData } = await supabase
                .from("courts")
                .select("id")
                .or(`name.ilike.%${event.location}%,location.ilike.%${event.location}%`)
                .limit(1)
                .single();
              courtId = courtData?.id || null;
            }
            
            // Insert match (don't set event_id for round_robin as it references events table, not round_robin_events)
            const { data: matchData, error: matchError } = await supabase
              .from("matches")
              .insert({
                match_date: event.date,
                team1_score: match.team1_score,
                team2_score: match.team2_score,
                created_by: userId!,
                source: "round_robin",
                round_no: match.round_no,
                court_no: match.court_no,
                court_id: courtId,
                other_location: courtId ? null : event.location,
                match_type: event.rating_type,
                status: "approved",
              })
              .select()
              .single();

            if (matchError) {
              errors.push(`Round ${match.round_no} Court ${match.court_no}: ${matchError.message}`);
              continue;
            }

            // Insert participants
            const participants = [
              { match_id: matchData.id, player_id: match.a1_player_id!, team: 1 },
              { match_id: matchData.id, player_id: match.a2_player_id!, team: 1 },
              { match_id: matchData.id, player_id: match.b1_player_id!, team: 2 },
              { match_id: matchData.id, player_id: match.b2_player_id!, team: 2 },
            ];

            const { error: participantsError } = await supabase
              .from("match_participants")
              .insert(participants);

            if (participantsError) {
              errors.push(`Round ${match.round_no} Court ${match.court_no} participants: ${participantsError.message}`);
              // Try to clean up the orphaned match
              await supabase.from("matches").delete().eq("id", matchData.id);
              continue;
            }

            // Link match to schedule
            const { error: linkError } = await supabase
              .from("round_robin_schedule")
              .update({ match_id: matchData.id })
              .eq("id", match.id);
              
            if (linkError) {
              console.error("Failed to link match to schedule:", linkError);
            }
            
            matchesCreated++;
          } catch (matchErr: any) {
            errors.push(`Round ${match.round_no} Court ${match.court_no}: ${matchErr.message}`);
          }
        }
      }

      // Update event status
      const { error } = await supabase
        .from("round_robin_events")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
      
      if (errors.length > 0) {
        toast.error(`Event completed with ${errors.length} error(s). ${matchesCreated} match(es) added successfully. Check console for details.`);
        console.error("Match submission errors:", errors);
      } else if (matchesCreated > 0) {
        toast.success(`Event completed! ${matchesCreated} additional match(es) added to history and ratings calculated.`);
      } else {
        toast.success("Event completed! All matches were already added to history during live scoring.");
      }
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
        toast.success("Event voided. Results will not affect ratings.");
      } else {
        const { error } = await supabase.rpc('delete_round_robin_event', {
          p_event_id: event.id
        });
        if (error) throw error;
        toast.success("Event deleted successfully.");
        navigate("/round-robin");
        return;
      }
      
      setDeleteDialogOpen(false);
      fetchEventDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete event");
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

    const activePlayers = players;
    if (activePlayers.length < 4) {
      toast.error("At least 4 players are required");
      return;
    }

    try {
      // Delete schedule from the specified round onward
      const { error: deleteError } = await supabase
        .from("round_robin_schedule")
        .delete()
        .eq("event_id", event.id)
        .gte("round_no", fromRound);

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

  const handleAddPlayer = async (playerId: string) => {
    if (!event || !userId) return;

    try {
      // Add player to event
      const { error: insertError } = await supabase
        .from("round_robin_players")
        .insert({
          event_id: event.id,
          player_id: playerId,
        });

      if (insertError) throw insertError;

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "player_add",
        changes: { player_id: playerId },
        reason: "Player added by organizer",
      });

      // Regenerate from current round
      const fromRound = event.current_round || 1;
      await regenerateScheduleFromRound(fromRound);

      toast.success("Player added - they will see this event in their events list");
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

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "player_removed",
        changes: { player_id: player.player_id },
        reason: "Player removed (can rejoin later)",
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
        // Global substitution: add new player, swap in unstarted matches
        await supabase.from("round_robin_players").insert({
          event_id: event.id,
          player_id: newPlayerId,
        });

        const oldPlayer = players.find(p => p.player_id === originalPlayerId);
        if (oldPlayer) {
          await supabase
            .from("round_robin_players")
            .update({ active: false })
            .eq("id", oldPlayer.id);
        }

        // Update all unstarted matches (no scores) with the new player
        const fromRound = event.current_round || 1;
        const futureMatches = schedule.filter(s => 
          s.round_no >= fromRound && 
          !s.is_bye && 
          s.team1_score === null && 
          s.team2_score === null
        );
        
        for (const match of futureMatches) {
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
            scope: 'global',
          },
          reason: "Global player substitution",
        });

        await fetchEventDetails();
        toast.success("Player substituted globally in all unstarted matches");
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
      const after = { num_courts: newCourts };

      // Update event
      const { error: updateError } = await supabase
        .from("round_robin_events")
        .update({ num_courts: newCourts })
        .eq("id", event.id);

      if (updateError) throw updateError;

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "courts_update",
        changes: { before, after },
        reason: `Courts ${newCourts > event.num_courts ? 'increased' : 'decreased'} to ${newCourts}`,
      });

      // Regenerate from current round
      const fromRound = event.current_round || 1;
      await regenerateScheduleFromRound(fromRound);

      toast.success(`Courts updated to ${newCourts}`);
    } catch (error: any) {
      toast.error("Failed to update courts");
      console.error(error);
      throw error;
    }
  };

  const handleUpdateRounds = async (newRounds: number) => {
    if (!event || !userId) return;

    try {
      const before = { num_rounds: event.num_rounds };
      const after = { num_rounds: newRounds };

      if (newRounds < event.num_rounds) {
        // Decreasing: delete rounds beyond newRounds
        const { error: deleteError } = await supabase
          .from("round_robin_schedule")
          .delete()
          .eq("event_id", event.id)
          .gt("round_no", newRounds);

        if (deleteError) throw deleteError;
      }

      // Update event
      const { error: updateError } = await supabase
        .from("round_robin_events")
        .update({ num_rounds: newRounds })
        .eq("id", event.id);

      if (updateError) throw updateError;

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "rounds_update",
        changes: { before, after },
        reason: `Rounds ${newRounds > event.num_rounds ? 'increased' : 'decreased'} to ${newRounds}`,
      });

      if (newRounds > event.num_rounds) {
        // Increasing: regenerate to add new rounds
        await regenerateScheduleFromRound(1);
      }

      toast.success(`Rounds updated to ${newRounds}`);
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to update rounds");
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
      const match = schedule.find(m => m.id === matchId);
      if (!match) return;

      const before = {
        team1_score: match.team1_score,
        team2_score: match.team2_score,
      };

      // Update score
      const { error: updateError } = await supabase
        .from("round_robin_schedule")
        .update({
          team1_score: team1Score,
          team2_score: team2Score,
        })
        .eq("id", matchId);

      if (updateError) throw updateError;

      // Reset verification if match was linked to matches table
      if (match.match_id) {
        await supabase
          .from("matches")
          .update({
            team1_score: team1Score,
            team2_score: team2Score,
            verified_by: [],
          })
          .eq("id", match.match_id);
      }

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "score_edit",
        changes: {
          match_id: matchId,
          before,
          after: { team1_score: team1Score, team2_score: team2Score },
        },
        reason: `Score edited for Round ${match.round_no}, Court ${match.court_no}`,
      });

      // If rating eligible and match is in matches table, trigger rating recalculation
      if (event.rating_eligible && match.match_id) {
        // Trigger rating recalculation by calling the recalculate function
        await supabase.rpc("recalculate_all_ratings");
      }

      toast.success("Score updated and verification reset");
      await fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to update score");
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
      navigate('/round-robin');
    } catch (error: any) {
      console.error('Leave error:', error);
      toast.error('Failed to leave event');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const hasSchedule = schedule.length > 0;
  const canGenerate = players.length >= 4;
  const hasScores = schedule.some(m => m.team1_score !== null || m.team2_score !== null);
  const currentRound = event.current_round || 1;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Compact header banner */}
      <header className="sticky top-0 z-10 bg-secondary border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BackToDashboard />
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-semibold text-white whitespace-nowrap">Round Robin by</h1>
                <img src={logo} alt="PULSE" className="h-[34px] sm:h-[39px] w-auto" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isOrganizer && isParticipant && !event.voided && 
                event.status === 'draft' && 
                (!event.registration_deadline || new Date() < new Date(event.registration_deadline)) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLeaveDialogOpen(true)}
                  className="hidden sm:flex"
                >
                  Leave Event
                </Button>
              )}
              {isOrganizer && !event.voided && (
                <>
                  {event.status === 'live' && (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => {
                        const kioskUrl = `/round-robin/${event.id}/kiosk`;
                        window.open(kioskUrl, '_blank', 'width=1920,height=1080');
                      }}
                      className="hidden sm:flex bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/90"
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      Open Kiosk Mode
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditDialogOpen(true)}
                    disabled={isEditMode}
                    className="hidden sm:flex"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                  {event.status !== 'completed' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCourtsRoundsOpen(true)}
                      className="hidden sm:flex"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Courts & Rounds
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {event.status === 'live' && (
                        <>
                          <DropdownMenuItem
                            onClick={() => {
                              const kioskUrl = `/round-robin/${event.id}/kiosk`;
                              window.open(kioskUrl, '_blank', 'width=1920,height=1080');
                            }}
                          >
                            <Monitor className="h-4 w-4 mr-2" />
                            Open Kiosk Mode
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const kioskUrl = `${window.location.origin}/round-robin/${event.id}/kiosk`;
                              navigator.clipboard.writeText(kioskUrl);
                              toast.success("Kiosk link copied!");
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Copy Kiosk Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => setEditDialogOpen(true)}
                        className="sm:hidden"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      {event.status !== 'completed' && (
                        <DropdownMenuItem
                          onClick={() => setCourtsRoundsOpen(true)}
                          className="sm:hidden"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Courts & Rounds
                        </DropdownMenuItem>
                      )}
                      {event.status !== 'completed' && <DropdownMenuSeparator className="sm:hidden" />}
                      <DropdownMenuItem
                        onClick={() => {
                          setDeleteMode('void');
                          setDeleteDialogOpen(true);
                        }}
                        disabled={!hasScores}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Void Event
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          if (hasScores && !isAdmin) {
                            toast.error("Only admins can hard delete events with scores. Use void instead.");
                            return;
                          }
                          setDeleteMode('hard');
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Event
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Event details section below header */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{event.name}</h2>
            {event.voided && <Badge variant="destructive">Voided</Badge>}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {new Date(event.date).toLocaleDateString()}
              {event.location && ` • ${event.location}`}
            </p>
            {isOrganizer && event.organizer_pin && (
              <Badge variant="secondary" className="text-sm font-mono">
                PIN: {event.organizer_pin}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6">
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

        {!hasSchedule && isOrganizer && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Schedule not generated yet. Add players and click "Generate Schedule" to begin.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="players">Players ({players.length})</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-6 space-y-6">
            {!hasSchedule ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No schedule generated</p>
                  {isOrganizer && (
                    <Button onClick={handleGenerateSchedule} disabled={!canGenerate}>
                      Generate Schedule
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {isOrganizer && event.status === "draft" && (
                  <Button onClick={handleStartEvent} className="w-full mb-6">
                    <Play className="h-4 w-4 mr-2" />
                    Start Event
                  </Button>
                )}

                {isOrganizer && !event.voided && event.status !== 'completed' && (
                  <div className="flex gap-2 mb-6">
                    <Button 
                      variant="outline" 
                      onClick={() => setScheduleEditorOpen(true)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Schedule
                    </Button>
                    {hasScores && (
                      <Button 
                        variant="outline" 
                        onClick={() => setScoreManagementOpen(true)}
                        className="flex-1"
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Manage Scores
                      </Button>
                    )}
                  </div>
                )}

                {isOrganizer && event.status === "live" && (
                  <Button onClick={handleCompleteEvent} className="w-full mb-6" variant="default">
                    Complete Event & Submit to Match History
                  </Button>
                )}

                <div className="space-y-8">
                  {Array.from({ length: event.num_rounds }, (_, i) => i + 1).map((roundNo) => {
                    const allMatches = getRoundMatches(roundNo);
                    const courtMatches = allMatches.filter(m => !m.is_bye);
                    const byeMatches = allMatches.filter(m => m.is_bye);
                    const isCurrentRound = roundNo === currentRound;
                    const isFutureRound = roundNo > currentRound;
                    const allRoundScored = courtMatches.every(m => m.team1_score !== null && m.team2_score !== null);
                    
                    return (
                      <div key={roundNo} className={`space-y-4 ${isFutureRound ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-px bg-border flex-1 w-12" />
                            <div className={`text-lg font-bold px-4 py-2 rounded-full ${isCurrentRound ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              Round {roundNo}
                              {isCurrentRound && <span className="ml-2 text-xs">(Active)</span>}
                            </div>
                            <div className="h-px bg-border flex-1 w-12" />
                          </div>
                          {isOrganizer && event.status === "live" && isCurrentRound && allRoundScored && roundNo < event.num_rounds && (
                            <Button size="sm" onClick={() => handleCloseRound(roundNo)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Close Round
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          {courtMatches.map((match) => (
                            <Card key={match.id} className={`overflow-hidden ${isFutureRound ? 'pointer-events-none' : ''}`}>
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="font-mono">Court {match.court_no}</Badge>
                                  {match.team1_score !== null && match.team2_score !== null && (
                                    <Badge variant="secondary">Completed</Badge>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  <div className={`flex items-center justify-between p-3 rounded-lg ${match.team1_score !== null && match.team1_score > (match.team2_score || 0) ? 'bg-primary/10 font-semibold' : 'bg-muted/50'}`}>
                                    <div className="text-sm">
                                      {getPlayerName(match.a1_player_id, match)} / {getPlayerName(match.a2_player_id, match)}
                                    </div>
                                    {match.team1_score !== null ? (
                                      <div className="text-lg font-bold">{match.team1_score}</div>
                                    ) : isOrganizer && event.status === "live" && isCurrentRound ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        max="99"
                                        className="w-16 h-8 text-center"
                                        placeholder="0"
                                        value={scores[match.id]?.team1_score ?? ''}
                                        onChange={(e) => handleScoreChange(match.id, 'team1', e.target.value)}
                                      />
                                    ) : (
                                      <div className="text-muted-foreground">—</div>
                                    )}
                                  </div>
                                  
                                  <div className={`flex items-center justify-between p-3 rounded-lg ${match.team2_score !== null && match.team2_score > (match.team1_score || 0) ? 'bg-primary/10 font-semibold' : 'bg-muted/50'}`}>
                                    <div className="text-sm">
                                      {getPlayerName(match.b1_player_id, match)} / {getPlayerName(match.b2_player_id, match)}
                                    </div>
                                    {match.team2_score !== null ? (
                                      <div className="text-lg font-bold">{match.team2_score}</div>
                                    ) : isOrganizer && event.status === "live" && isCurrentRound ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        max="99"
                                        className="w-16 h-8 text-center"
                                        placeholder="0"
                                        value={scores[match.id]?.team2_score ?? ''}
                                        onChange={(e) => handleScoreChange(match.id, 'team2', e.target.value)}
                                      />
                                    ) : (
                                      <div className="text-muted-foreground">—</div>
                                    )}
                                  </div>
                                </div>
                                
                                {isOrganizer && event.status === "live" && isCurrentRound && match.team1_score === null && (
                                  <Button
                                    onClick={() => handleSaveScore(match)}
                                    disabled={savingScore === match.id}
                                    size="sm"
                                    className="w-full"
                                  >
                                    {savingScore === match.id ? "Saving..." : "Save Score"}
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {byeMatches.length > 0 && (
                          <Card className="mt-4 bg-muted/30">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="outline" className="font-mono">BYE</Badge>
                                <span className="text-sm text-muted-foreground">Players resting this round</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {byeMatches.map((match) => (
                                  <Badge key={match.id} variant="secondary" className="text-sm">
                                    {getPlayerName(match.a1_player_id, match)}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    );
                  })}
                </div>
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
            {/* Top 3 Leaderboard */}
            {standings.length >= 3 && (
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Top 3 Leaders</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {standings.slice(0, 3).map((row, idx) => (
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
                        {standings.map((row, idx) => (
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
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteMode === 'void' ? 'Void this Round Robin?' : 'Delete this Round Robin?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === 'void' ? (
                <>
                  This will mark the event as voided. The schedule and results will remain visible with a "Voided" badge, but matches will not affect player ratings. This action can be undone by an admin.
                </>
              ) : (
                <>
                  This will permanently remove the schedule and all results for this event. <strong>This cannot be undone.</strong>
                  {hasScores && !isAdmin && (
                    <p className="mt-2 text-destructive font-semibold">
                      Only admins can hard delete events with scores. Use "Void & Keep record" instead.
                    </p>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={deleteMode === 'hard' && hasScores && !isAdmin}
              className={deleteMode === 'hard' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {deleteMode === 'void' ? 'Void & Keep Record' : 'Delete'}
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
          />
          
          <PlayerManagementDialog
            open={playerManagementOpen}
            onOpenChange={setPlayerManagementOpen}
            players={players}
            currentRound={event.current_round}
            totalRounds={event.num_rounds}
            onAddPlayer={handleAddPlayer}
            onMarkInactive={handleMarkInactive}
            onSubstitute={handleSubstitute}
          />

          <CourtsRoundsDialog
            open={courtsRoundsOpen}
            onOpenChange={setCourtsRoundsOpen}
            currentCourts={event.num_courts}
            currentRounds={event.num_rounds}
            currentRound={event.current_round}
            hasScores={hasScores}
            totalPlayers={players.length}
            onUpdateCourts={handleUpdateCourts}
            onUpdateRounds={handleUpdateRounds}
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
  );
}
