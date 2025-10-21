import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { MultiPlayerCombobox } from "@/components/MultiPlayerCombobox";
import { BackToDashboard } from "@/components/BackToDashboard";

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
}

interface Court {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
}

export default function CreateRoundRobin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Profile[]>([]);
  const [numCourts, setNumCourts] = useState("2");
  const [numRounds, setNumRounds] = useState("4");
  const [ratingEligible, setRatingEligible] = useState(true);
  const [ratingType, setRatingType] = useState<"ladder" | "league" | "playoffs" | "casual">("league");

  useEffect(() => {
    fetchCourts();
  }, []);

  const fetchCourts = async () => {
    const { data } = await supabase.from("courts").select("*").order("name");
    if (data) setCourts(data);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Event name is required");
      return;
    }

    if (selectedPlayers.length < 4) {
      toast.error("At least 4 players are required");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Create event
      const { data: event, error: eventError } = await supabase
        .from("round_robin_events")
        .insert({
          name: name.trim(),
          location: location.trim() || null,
          notes: notes.trim() || null,
          organizer_id: user.id,
          num_courts: parseInt(numCourts),
          num_rounds: parseInt(numRounds),
          rating_eligible: ratingEligible,
          rating_type: ratingType,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Add players
      const playerInserts = selectedPlayers.map((p) => ({
        event_id: event.id,
        player_id: p.id,
      }));

      const { error: playersError } = await supabase
        .from("round_robin_players")
        .insert(playerInserts);

      if (playersError) throw playersError;

      toast.success("Event created successfully!");
      navigate(`/round-robin/${event.id}`);
    } catch (error: any) {
      toast.error("Failed to create event");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const canCreate = name.trim() && selectedPlayers.length >= 4 && parseInt(numCourts) >= 1 && parseInt(numRounds) >= 1;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <BackToDashboard />
            <h1 className="text-2xl font-bold">Create Round Robin</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Set up your doubles round robin tournament</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Friday Night Round Robin"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {new Date().toLocaleDateString()} (Today, locked)
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select a court" />
                </SelectTrigger>
                <SelectContent>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={court.name}>
                      {court.name} - {court.city}, {court.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional information about the event..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Players * (Minimum 4)</Label>
              <MultiPlayerCombobox
                selectedPlayers={selectedPlayers}
                onPlayersChange={setSelectedPlayers}
              />
              <p className="text-sm text-muted-foreground">
                {selectedPlayers.length} {selectedPlayers.length === 1 ? "player" : "players"} selected
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="courts">Number of Courts *</Label>
                <Input
                  id="courts"
                  type="number"
                  min="1"
                  value={numCourts}
                  onChange={(e) => setNumCourts(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rounds">Number of Rounds *</Label>
                <Input
                  id="rounds"
                  type="number"
                  min="1"
                  value={numRounds}
                  onChange={(e) => setNumRounds(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="rating-eligible">Rating Eligible</Label>
                  <p className="text-sm text-muted-foreground">
                    Include results in PULSE ratings
                  </p>
                </div>
                <Switch
                  id="rating-eligible"
                  checked={ratingEligible}
                  onCheckedChange={setRatingEligible}
                />
              </div>

              {ratingEligible && (
                <div className="space-y-2">
                  <Label htmlFor="rating-type">Rating Type</Label>
                  <Select value={ratingType} onValueChange={(v: any) => setRatingType(v)}>
                    <SelectTrigger id="rating-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="league">League</SelectItem>
                      <SelectItem value="ladder">Ladder</SelectItem>
                      <SelectItem value="playoffs">Playoffs</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button
              onClick={handleCreate}
              disabled={!canCreate || loading}
              className="w-full"
            >
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
