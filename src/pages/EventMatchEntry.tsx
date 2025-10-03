import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronLeft, Trophy } from "lucide-react";
import { PlayerCombobox } from "@/components/PlayerCombobox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  current_rating: number;
}

interface Event {
  id: string;
  name: string;
  organizer_id: string;
  num_courts: number | null;
  points_to: number;
  rating_type: string;
  rating_eligible: boolean;
}

const EventMatchEntry = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Form fields
  const [roundNumber, setRoundNumber] = useState("");
  const [courtNumber, setCourtNumber] = useState("1");
  const [team1Player1, setTeam1Player1] = useState("");
  const [team1Player2, setTeam1Player2] = useState("");
  const [team2Player1, setTeam2Player1] = useState("");
  const [team2Player2, setTeam2Player2] = useState("");
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [ratingEligible, setRatingEligible] = useState(true);
  const [ratingType, setRatingType] = useState("ladder");
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      if (!eventId) {
        navigate("/events");
        return;
      }

      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError || !eventData) {
        toast.error("Event not found");
        navigate("/events");
        return;
      }

      // Check if user is organizer
      if (eventData.organizer_id !== session.user.id) {
        toast.error("Only the event organizer can add matches");
        navigate(`/events/${eventId}`);
        return;
      }

      setEvent(eventData);
      setRatingEligible(eventData.rating_eligible);
      setRatingType(eventData.rating_type);

      // Fetch players
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, current_rating")
        .order("full_name");

      if (profilesData) {
        setPlayers(profilesData);
      }
    };

    fetchData();
  }, [eventId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId || !event) {
      toast.error("Invalid session");
      return;
    }

    // Validation
    const selectedPlayers = [team1Player1, team1Player2, team2Player1, team2Player2];
    const uniquePlayers = new Set(selectedPlayers);

    if (selectedPlayers.some(p => !p)) {
      toast.error("Please select all 4 players");
      return;
    }

    if (uniquePlayers.size !== 4) {
      toast.error("All players must be unique");
      return;
    }

    const score1 = parseInt(team1Score);
    const score2 = parseInt(team2Score);

    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
      toast.error("Please enter valid scores");
      return;
    }

    if (score1 === score2) {
      toast.error("Scores cannot be tied");
      return;
    }

    setSubmitting(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      
      // Create match
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
          created_by: userId,
          event_id: eventId,
          round_number: roundNumber || null,
          event_court_number: parseInt(courtNumber) || null,
          match_date: today,
          match_type: ratingType,
          team1_score: score1,
          team2_score: score2,
          status: "approved", // Event matches are auto-approved
        })
        .select()
        .single();

      if (matchError) {
        console.error("Match creation error:", matchError);
        toast.error("Failed to create match");
        return;
      }

      // Create participants
      const participants = [
        { match_id: match.id, player_id: team1Player1, team: 1 },
        { match_id: match.id, player_id: team1Player2, team: 1 },
        { match_id: match.id, player_id: team2Player1, team: 2 },
        { match_id: match.id, player_id: team2Player2, team: 2 },
      ];

      const { error: participantsError } = await supabase
        .from("match_participants")
        .insert(participants);

      if (participantsError) {
        console.error("Participants error:", participantsError);
        toast.error("Failed to add participants");
        return;
      }

      // Recalculate ratings if eligible
      if (ratingEligible) {
        await supabase.rpc("recalculate_all_ratings");
      }

      toast.success("Match recorded successfully!");
      
      // Reset form for quick entry
      setRoundNumber("");
      setTeam1Player1("");
      setTeam1Player2("");
      setTeam2Player1("");
      setTeam2Player2("");
      setTeam1Score("");
      setTeam2Score("");
      
      // Auto-increment court number
      const nextCourt = (parseInt(courtNumber) % (event.num_courts || 10)) + 1;
      setCourtNumber(nextCourt.toString());
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Failed to create match");
    } finally {
      setSubmitting(false);
    }
  };

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(`/events/${eventId}`)}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Event
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Add Match</h1>
          <p className="text-muted-foreground">{event.name}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Match Details
              </CardTitle>
              <CardDescription>
                Record match results for this event
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Round and Court */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="round">Round Number</Label>
                  <Input
                    id="round"
                    value={roundNumber}
                    onChange={(e) => setRoundNumber(e.target.value)}
                    placeholder="e.g., 1, 2, A, B"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="court">Court Number *</Label>
                  <Input
                    id="court"
                    type="number"
                    min="1"
                    value={courtNumber}
                    onChange={(e) => setCourtNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Team 1 */}
              <div className="space-y-3">
                <h3 className="font-semibold">Team 1</h3>
                <div className="space-y-2">
                  <Label>Player 1 *</Label>
                  <PlayerCombobox
                    players={players}
                    value={team1Player1}
                    onValueChange={setTeam1Player1}
                    placeholder="Select player 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Player 2 *</Label>
                  <PlayerCombobox
                    players={players}
                    value={team1Player2}
                    onValueChange={setTeam1Player2}
                    placeholder="Select player 2"
                  />
                </div>
              </div>

              {/* Team 2 */}
              <div className="space-y-3">
                <h3 className="font-semibold">Team 2</h3>
                <div className="space-y-2">
                  <Label>Player 1 *</Label>
                  <PlayerCombobox
                    players={players}
                    value={team2Player1}
                    onValueChange={setTeam2Player1}
                    placeholder="Select player 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Player 2 *</Label>
                  <PlayerCombobox
                    players={players}
                    value={team2Player2}
                    onValueChange={setTeam2Player2}
                    placeholder="Select player 2"
                  />
                </div>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="score1">Team 1 Score *</Label>
                  <Input
                    id="score1"
                    type="number"
                    min="0"
                    value={team1Score}
                    onChange={(e) => setTeam1Score(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="score2">Team 2 Score *</Label>
                  <Input
                    id="score2"
                    type="number"
                    min="0"
                    value={team2Score}
                    onChange={(e) => setTeam2Score(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Rating Settings */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="ratingEligible">Rating Eligible</Label>
                    <p className="text-sm text-muted-foreground">
                      Count this match toward PULSE ratings
                    </p>
                  </div>
                  <Switch
                    id="ratingEligible"
                    checked={ratingEligible}
                    onCheckedChange={setRatingEligible}
                  />
                </div>

                {ratingEligible && (
                  <div className="space-y-2">
                    <Label htmlFor="ratingType">Rating Type</Label>
                    <Select value={ratingType} onValueChange={setRatingType}>
                      <SelectTrigger id="ratingType">
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
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Recording..." : "Record Match"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default EventMatchEntry;
