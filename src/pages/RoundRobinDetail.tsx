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
import { Play, Trophy, AlertCircle, Settings, Trash2, Ban, CheckCircle, Edit } from "lucide-react";
import { toast } from "sonner";
import { BackToDashboard } from "@/components/BackToDashboard";
import { EditEventDialog } from "@/components/round-robin/EditEventDialog";
import { EditModeBanner } from "@/components/round-robin/EditModeBanner";
import { PlayerManagementDialog } from "@/components/round-robin/PlayerManagementDialog";
import { CourtsRoundsDialog } from "@/components/round-robin/CourtsRoundsDialog";
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
  location: string | null;
  notes: string | null;
  organizer_id: string;
  num_courts: number;
  num_rounds: number;
  current_round: number | null;
  status: "draft" | "live" | "completed";
  rating_eligible: boolean;
  rating_type: "ladder" | "league" | "playoffs" | "casual";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  voided: boolean;
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
  const [scores, setScores] = useState<MatchScore>({});
  const [savingScore, setSavingScore] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'void' | 'hard'>('void');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [playerManagementOpen, setPlayerManagementOpen] = useState(false);
  const [courtsRoundsOpen, setCourtsRoundsOpen] = useState(false);

  useEffect(() => {
    fetchEventDetails();
    
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

      const { data: scheduleData, error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .select("*")
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
      toast.error("Failed to load event details");
      console.error(error);
      setLoading(false);
    }
  };

  const handleGenerateSchedule = async () => {
    if (!event) return;
    
    const activePlayers = players.filter((p) => p.active);
    if (activePlayers.length < 4) {
      toast.error("At least 4 active players are required");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("generate-round-robin-schedule", {
        body: {
          event_id: event.id,
          player_ids: activePlayers.map((p) => p.player_id),
          num_courts: event.num_courts,
          num_rounds: event.num_rounds,
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

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "—";
    const player = players.find((p) => p.player_id === playerId);
    return player?.profiles.display_name || player?.profiles.full_name || "Unknown";
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
    if (!event) return;
    
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
      const { error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .update({ 
          team1_score: score.team1_score,
          team2_score: score.team2_score 
        })
        .eq("id", match.id);

      if (scheduleError) throw scheduleError;

      toast.success("Score saved!");
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
    
    try {
      for (const match of schedule) {
        if (!match.is_bye && match.team1_score !== null && match.team2_score !== null && !match.match_id) {
          const { data: matchData, error: matchError } = await supabase
            .from("matches")
            .insert({
              match_date: event.date,
              team1_score: match.team1_score,
              team2_score: match.team2_score,
              created_by: userId!,
              source: "round_robin",
              event_id: event.id,
              round_no: match.round_no,
              court_no: match.court_no,
              match_type: event.rating_type,
              status: "approved",
            })
            .select()
            .single();

          if (matchError) throw matchError;

          const participants = [
            { match_id: matchData.id, player_id: match.a1_player_id!, team: 1 },
            { match_id: matchData.id, player_id: match.a2_player_id!, team: 1 },
            { match_id: matchData.id, player_id: match.b1_player_id!, team: 2 },
            { match_id: matchData.id, player_id: match.b2_player_id!, team: 2 },
          ];

          const { error: participantsError } = await supabase
            .from("match_participants")
            .insert(participants);

          if (participantsError) throw participantsError;

          await supabase
            .from("round_robin_schedule")
            .update({ match_id: matchData.id })
            .eq("id", match.id);
        }
      }

      const { error } = await supabase
        .from("round_robin_events")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Event completed! All matches added to history.");
      fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to complete event");
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
      fetchEventDetails();
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
          active: true,
        });

      if (insertError) throw insertError;

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "player_add",
        changes: { player_id: playerId },
        reason: "Player added (late join)",
      });

      // Regenerate from current round
      const fromRound = event.current_round || 1;
      await regenerateScheduleFromRound(fromRound);

      toast.success("Player added and schedule regenerated");
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
      // Mark player inactive
      const { error: updateError } = await supabase
        .from("round_robin_players")
        .update({ active: false })
        .eq("id", playerEventId);

      if (updateError) throw updateError;

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "player_remove",
        changes: { player_id: player.player_id },
        reason: "Player marked inactive (early exit)",
      });

      // Regenerate from current round
      const fromRound = event.current_round || 1;
      await regenerateScheduleFromRound(fromRound);

      toast.success("Player marked inactive and schedule regenerated");
    } catch (error: any) {
      toast.error("Failed to mark player inactive");
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
        // Global substitution: add new player, mark old as inactive, regenerate
        await supabase.from("round_robin_players").insert({
          event_id: event.id,
          player_id: newPlayerId,
          active: true,
        });

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
          },
          reason: "Global player substitution",
        });

        const fromRound = event.current_round || 1;
        await regenerateScheduleFromRound(fromRound);

        toast.success("Player substituted globally");
      } else {
        // Single round substitution: update specific matches
        const roundMatches = schedule.filter(s => s.round_no === scope && !s.is_bye);
        
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
        change_type: "courts_adjusted",
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
        change_type: "rounds_adjusted",
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
  const canGenerate = players.filter((p) => p.active).length >= 4;
  const hasScores = schedule.some(m => m.team1_score !== null || m.team2_score !== null);
  const currentRound = event.current_round || 1;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-secondary border-b">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <BackToDashboard />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold whitespace-nowrap">Round Robin by</h1>
                  <img src={logo} alt="PULSE" className="h-8 sm:h-10 w-auto" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <h2 className="text-base sm:text-lg font-semibold truncate">{event.name}</h2>
                {event.voided && <Badge variant="destructive">Voided</Badge>}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {new Date(event.date).toLocaleDateString()}
                {event.location && ` • ${event.location}`}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Badge variant={event.status === 'live' ? 'default' : 'outline'} className="whitespace-nowrap">{event.status.toUpperCase()}</Badge>
              {isOrganizer && !event.voided && (
                <>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditDialogOpen(true)}
                      disabled={isEditMode}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                    {event.status !== 'completed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCourtsRoundsOpen(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Courts & Rounds
                      </Button>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
            <TabsTrigger value="players">Players ({players.filter(p => p.active).length})</TabsTrigger>
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

                {isOrganizer && event.status === "live" && (
                  <Button onClick={handleCompleteEvent} className="w-full mb-6" variant="default">
                    Complete Event & Submit to Match History
                  </Button>
                )}

                <div className="space-y-8">
                  {Array.from({ length: event.num_rounds }, (_, i) => i + 1).map((roundNo) => {
                    const matches = getRoundMatches(roundNo);
                    const isCurrentRound = roundNo === currentRound;
                    const isFutureRound = roundNo > currentRound;
                    const allRoundScored = matches.filter(m => !m.is_bye).every(m => m.team1_score !== null && m.team2_score !== null);
                    
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
                          {matches.map((match) => (
                            <Card key={match.id} className={`overflow-hidden ${isFutureRound ? 'pointer-events-none' : ''}`}>
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="font-mono">Court {match.court_no}</Badge>
                                  {match.team1_score !== null && match.team2_score !== null && (
                                    <Badge variant="secondary">Completed</Badge>
                                  )}
                                </div>
                                
                                {match.is_bye ? (
                                  <p className="text-center text-muted-foreground py-4">— Bye —</p>
                                ) : (
                                  <>
                                    <div className="space-y-2">
                                      <div className={`flex items-center justify-between p-3 rounded-lg ${match.team1_score !== null && match.team1_score > (match.team2_score || 0) ? 'bg-primary/10 font-semibold' : 'bg-muted/50'}`}>
                                        <div className="text-sm">
                                          {getPlayerName(match.a1_player_id)} / {getPlayerName(match.a2_player_id)}
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
                                          {getPlayerName(match.b1_player_id)} / {getPlayerName(match.b2_player_id)}
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
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
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
                  {players.filter(p => p.active).length > 0 && (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Active Players ({players.filter(p => p.active).length})
                      </p>
                      {players.filter(p => p.active).map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="font-medium">
                            {player.profiles.display_name || player.profiles.full_name}
                          </div>
                          <Badge variant="default">Active</Badge>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {players.filter(p => !p.active).length > 0 && (
                    <>
                      <div className="pt-4 border-t mt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Inactive Players ({players.filter(p => !p.active).length})
                        </p>
                      </div>
                      {players.filter(p => !p.active).map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                          <div className="font-medium">
                            {player.profiles.display_name || player.profiles.full_name}
                          </div>
                          <Badge variant="outline">Inactive</Badge>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Standings</CardTitle>
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
                              <Badge variant={idx === 0 ? "default" : "outline"} className="w-8 h-8 flex items-center justify-center">
                                {idx + 1}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 font-medium">{row.player_name}</td>
                            <td className="text-center py-3 px-2 font-semibold text-green-600">{row.wins}</td>
                            <td className="text-center py-3 px-2 text-muted-foreground">{row.losses}</td>
                            <td className="text-center py-3 px-2 hidden sm:table-cell">{row.points_for}</td>
                            <td className="text-center py-3 px-2 hidden sm:table-cell">{row.points_against}</td>
                            <td className={`text-center py-3 px-2 font-semibold ${row.point_diff > 0 ? 'text-green-600' : row.point_diff < 0 ? 'text-red-600' : ''}`}>
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
            onUpdateCourts={handleUpdateCourts}
            onUpdateRounds={handleUpdateRounds}
          />
        </>
      )}
    </div>
  );
}
