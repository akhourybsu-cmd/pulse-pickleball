import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PlayerSelector } from "@/components/round-robin/PlayerSelector";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { z } from "zod";

const matchEditSchema = z.object({
  match_date: z.string().min(1, "Date is required"),
  team1_score: z.number().min(0, "Score must be non-negative"),
  team2_score: z.number().min(0, "Score must be non-negative"),
  team1_player1_id: z.string().uuid("Valid player required"),
  team1_player2_id: z.string().uuid("Valid player required"),
  team2_player1_id: z.string().uuid("Valid player required"),
  team2_player2_id: z.string().uuid("Valid player required"),
  match_type: z.enum(["ladder", "league", "playoffs", "casual"]),
});

interface EditMatchSheetProps {
  matchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditMatchSheet({ matchId, open, onOpenChange, onSaved }: EditMatchSheetProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  
  // Match fields
  const [matchDate, setMatchDate] = useState("");
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [matchType, setMatchType] = useState<"ladder" | "league" | "playoffs" | "casual">("league");
  const [courtId, setCourtId] = useState<string | null>(null);
  const [otherLocation, setOtherLocation] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [roundNumber, setRoundNumber] = useState("");
  const [eventCourtNumber, setEventCourtNumber] = useState<number | null>(null);
  
  // Players
  const [team1Player1, setTeam1Player1] = useState("");
  const [team1Player2, setTeam1Player2] = useState("");
  const [team2Player1, setTeam2Player1] = useState("");
  const [team2Player2, setTeam2Player2] = useState("");
  
  // Original data for comparison
  const [originalData, setOriginalData] = useState<any>(null);
  
  // Courts and events for selects
  const [courts, setCourts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  
  // Audit history
  const [editHistory, setEditHistory] = useState<any[]>([]);

  useEffect(() => {
    if (open && matchId) {
      loadMatchData();
      loadCourtsAndEvents();
      loadEditHistory();
    }
  }, [open, matchId]);

  const loadMatchData = async () => {
    setLoading(true);
    
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError) {
      toast.error("Failed to load match. Please try again.");
      console.error(matchError);
      setLoading(false);
      return;
    }

    const { data: participants, error: participantsError } = await supabase
      .from("match_participants")
      .select("player_id, team")
      .eq("match_id", matchId)
      .order("team")
      .order("player_id");

    if (participantsError) {
      toast.error("Failed to load participants. Please try again.");
      console.error(participantsError);
      setLoading(false);
      return;
    }

    // Set match fields
    setMatchDate(match.match_date);
    setTeam1Score(match.team1_score);
    setTeam2Score(match.team2_score);
    const validMatchType = match.match_type || "league";
    if (validMatchType === "ladder" || validMatchType === "league" || validMatchType === "playoffs" || validMatchType === "casual") {
      setMatchType(validMatchType);
    }
    setCourtId(match.court_id);
    setOtherLocation(match.other_location || "");
    setEventId(match.event_id);
    setRoundNumber(match.round_number || "");
    setEventCourtNumber(match.event_court_number);

    // Set players
    const team1Players = participants.filter(p => p.team === 1);
    const team2Players = participants.filter(p => p.team === 2);
    
    if (team1Players[0]) setTeam1Player1(team1Players[0].player_id);
    if (team1Players[1]) setTeam1Player2(team1Players[1].player_id);
    if (team2Players[0]) setTeam2Player1(team2Players[0].player_id);
    if (team2Players[1]) setTeam2Player2(team2Players[1].player_id);

    setOriginalData({
      ...match,
      participants: participants.map(p => p.player_id),
    });

    setLoading(false);
  };

  const loadCourtsAndEvents = async () => {
    const { data: courtsData } = await supabase
      .from("courts")
      .select("id, name")
      .order("name");
    
    const { data: eventsData } = await supabase
      .from("events")
      .select("id, name")
      .order("event_date", { ascending: false });

    const { data: playersData } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, current_rating")
      .order("display_name");

    setCourts(courtsData || []);
    setEvents(eventsData || []);
    setPlayers(playersData || []);
  };

  const loadEditHistory = async () => {
    const { data } = await supabase
      .from("match_edits")
      .select(`
        *,
        profiles!editor_id(display_name, full_name)
      `)
      .eq("match_id", matchId)
      .order("edited_at", { ascending: false })
      .limit(5);

    setEditHistory(data || []);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Validate input
      const validationResult = matchEditSchema.safeParse({
        match_date: matchDate,
        team1_score: team1Score,
        team2_score: team2Score,
        team1_player1_id: team1Player1,
        team1_player2_id: team1Player2,
        team2_player1_id: team2Player1,
        team2_player2_id: team2Player2,
        match_type: matchType,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setSaving(false);
        return;
      }

      // Check for duplicate players
      const playerIds = [team1Player1, team1Player2, team2Player1, team2Player2];
      const uniquePlayerIds = new Set(playerIds);
      if (uniquePlayerIds.size !== 4) {
        toast.error("All four players must be different");
        setSaving(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setSaving(false);
        return;
      }

      // Determine if significant changes were made that require verification reset
      const participantsChanged = 
        !originalData.participants.includes(team1Player1) ||
        !originalData.participants.includes(team1Player2) ||
        !originalData.participants.includes(team2Player1) ||
        !originalData.participants.includes(team2Player2);
      
      const scoreChanged = 
        originalData.team1_score !== team1Score ||
        originalData.team2_score !== team2Score;

      const shouldResetVerification = participantsChanged || scoreChanged;

      // Build changes object for audit
      const changes: any = {};
      if (originalData.match_date !== matchDate) changes.match_date = { from: originalData.match_date, to: matchDate };
      if (originalData.team1_score !== team1Score) changes.team1_score = { from: originalData.team1_score, to: team1Score };
      if (originalData.team2_score !== team2Score) changes.team2_score = { from: originalData.team2_score, to: team2Score };
      if (originalData.match_type !== matchType) changes.match_type = { from: originalData.match_type, to: matchType };
      if (participantsChanged) changes.participants = { changed: true };

      // Update match
      const updateData: any = {
        match_date: matchDate,
        team1_score: team1Score,
        team2_score: team2Score,
        match_type: matchType,
        court_id: courtId === "other" ? null : courtId,
        other_location: courtId === "other" ? otherLocation : null,
        event_id: eventId || null,
        round_number: roundNumber || null,
        event_court_number: eventCourtNumber,
      };

      if (shouldResetVerification) {
        updateData.verified_by = [];
      }

      const { error: updateError } = await supabase
        .from("matches")
        .update(updateData)
        .eq("id", matchId);

      if (updateError) throw updateError;

      // Update participants if changed
      if (participantsChanged) {
        // Delete old participants and wait for completion
        const { error: deleteError } = await supabase
          .from("match_participants")
          .delete()
          .eq("match_id", matchId);

        if (deleteError) throw deleteError;

        // Insert new participants
        const newParticipants = [
          { match_id: matchId, player_id: team1Player1, team: 1 },
          { match_id: matchId, player_id: team1Player2, team: 1 },
          { match_id: matchId, player_id: team2Player1, team: 2 },
          { match_id: matchId, player_id: team2Player2, team: 2 },
        ];

        const { error: participantsError } = await supabase
          .from("match_participants")
          .insert(newParticipants);

        if (participantsError) throw participantsError;
      }

      // Log edit to audit trail
      if (Object.keys(changes).length > 0) {
        await supabase
          .from("match_edits")
          .insert({
            match_id: matchId,
            editor_id: user.id,
            changes,
            reason: shouldResetVerification ? "Verification cleared due to edit" : null,
          });
      }

      // Trigger rating recalculation
      await supabase.rpc("recalculate_all_ratings_authenticated");

      toast.success(shouldResetVerification 
        ? "Match updated. Verification cleared due to changes." 
        : "Match updated");
      
      onSaved();
    } catch (error: any) {
      console.error("Error saving match:", error);
      const userMessage = error.message?.includes('unique') || error.message?.includes('duplicate')
        ? "A match with this information already exists"
        : "Failed to save match. Please try again.";
      toast.error(userMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error("Please provide a reason for voiding");
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("matches")
        .update({
          voided: true,
          void_reason: voidReason,
          voided_by: user.id,
          voided_at: new Date().toISOString(),
        })
        .eq("id", matchId);

      if (error) throw error;

      // Log to audit trail
      await supabase
        .from("match_edits")
        .insert({
          match_id: matchId,
          editor_id: user.id,
          changes: { voided: { from: false, to: true } },
          reason: voidReason,
        });

      // Trigger rating recalculation
      await supabase.rpc("recalculate_all_ratings_authenticated");

      toast.success("Match voided");
      setVoidDialogOpen(false);
      onSaved();
    } catch (error: any) {
      console.error("Error voiding match:", error);
      toast.error("Failed to void match. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteReason.trim()) {
      toast.error("Please provide a reason for deletion");
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setSaving(false);
        return;
      }

      // Log deletion before removing
      await supabase
        .from("match_edits")
        .insert({
          match_id: matchId,
          editor_id: user.id,
          changes: { deleted: true },
          reason: deleteReason,
        });

      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchId);

      if (error) throw error;

      // Trigger rating recalculation
      await supabase.rpc("recalculate_all_ratings_authenticated");

      toast.success("Match deleted");
      setDeleteDialogOpen(false);
      onSaved();
    } catch (error: any) {
      console.error("Error deleting match:", error);
      toast.error("Failed to delete match. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto">
          <div className="flex justify-center items-center h-full">
            Loading...
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Edit Match</SheetTitle>
            <SheetDescription>
              Make changes to match details. Significant edits will reset verification status.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="match-date">Match Date</Label>
              <Input
                id="match-date"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
              />
            </div>

            {/* Match Type */}
            <div className="space-y-2">
              <Label htmlFor="match-type">Match Type</Label>
              <Select 
                value={matchType} 
                onValueChange={(v) => {
                  if (v === "ladder" || v === "league" || v === "playoffs" || v === "casual") {
                    setMatchType(v);
                  }
                }}
              >
                <SelectTrigger id="match-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ladder">Ladder</SelectItem>
                  <SelectItem value="league">League</SelectItem>
                  <SelectItem value="playoffs">Playoffs</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Venue */}
            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Select 
                value={courtId === null && otherLocation ? "other" : courtId || ""} 
                onValueChange={(v) => {
                  if (v === "other") {
                    setCourtId("other");
                  } else {
                    setCourtId(v);
                    setOtherLocation("");
                  }
                }}
              >
                <SelectTrigger id="venue">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">Other (custom location)</SelectItem>
                  {courts.map(court => (
                    <SelectItem key={court.id} value={court.id}>
                      {court.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {courtId === "other" && (
                <Input
                  placeholder="Enter location name"
                  value={otherLocation}
                  onChange={(e) => setOtherLocation(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {/* Event (optional) */}
            <div className="space-y-2">
              <Label htmlFor="event">Event (optional)</Label>
              <Select value={eventId || "none"} onValueChange={(v) => setEventId(v === "none" ? null : v)}>
                <SelectTrigger id="event">
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event</SelectItem>
                  {events.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eventId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="round">Round Number</Label>
                  <Input
                    id="round"
                    placeholder="e.g., 1, QF, SF"
                    value={roundNumber}
                    onChange={(e) => setRoundNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="court-num">Court Number</Label>
                  <Input
                    id="court-num"
                    type="number"
                    min="1"
                    value={eventCourtNumber || ""}
                    onChange={(e) => setEventCourtNumber(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
              </>
            )}

            {/* Players */}
            <div className="space-y-4">
              <h3 className="font-semibold">Team 1</h3>
              <div className="space-y-2">
                <Label>Player 1</Label>
                <PlayerSelector
                  value={team1Player1}
                  onValueChange={setTeam1Player1}
                  placeholder="Search for player..."
                />
              </div>
              <div className="space-y-2">
                <Label>Player 2</Label>
                <PlayerSelector
                  value={team1Player2}
                  onValueChange={setTeam1Player2}
                  placeholder="Search for player..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Team 2</h3>
              <div className="space-y-2">
                <Label>Player 1</Label>
                <PlayerSelector
                  value={team2Player1}
                  onValueChange={setTeam2Player1}
                  placeholder="Search for player..."
                />
              </div>
              <div className="space-y-2">
                <Label>Player 2</Label>
                <PlayerSelector
                  value={team2Player2}
                  onValueChange={setTeam2Player2}
                  placeholder="Search for player..."
                />
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="team1-score">Team 1 Score</Label>
                <Input
                  id="team1-score"
                  type="number"
                  min="0"
                  value={team1Score}
                  onChange={(e) => setTeam1Score(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team2-score">Team 2 Score</Label>
                <Input
                  id="team2-score"
                  type="number"
                  min="0"
                  value={team2Score}
                  onChange={(e) => setTeam2Score(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Edit History */}
            {editHistory.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Recent Edits</h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {editHistory.map((edit) => (
                    <div key={edit.id} className="border-l-2 border-muted pl-2">
                      <div>
                        {edit.profiles?.display_name || edit.profiles?.full_name} • {new Date(edit.edited_at).toLocaleDateString()}
                      </div>
                      {edit.reason && <div className="italic">{edit.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => setVoidDialogOpen(true)}
                disabled={saving}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Void
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={saving}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Void Confirmation Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this match?</AlertDialogTitle>
            <AlertDialogDescription>
              Voiding will keep the record visible but remove it from ratings and leaderboards.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for voiding (required)"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={!voidReason.trim()}>
              Void Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the match and all associated data.
              Ratings will be recalculated. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for deletion (required)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={!deleteReason.trim()}
              className="bg-destructive text-destructive-foreground"
            >
              Delete Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
