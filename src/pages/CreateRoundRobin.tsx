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
import logo from "@/assets/pulse-logo-new.png";

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
  const [gamesPerPlayer, setGamesPerPlayer] = useState("3");
  const [ratingEligible, setRatingEligible] = useState(true);
  const [ratingType, setRatingType] = useState<"ladder" | "league" | "playoffs" | "casual">("league");
  
  // Calculate metrics automatically
  const calculateScheduleMetrics = () => {
    const P = selectedPlayers.length;
    const C = parseInt(numCourts) || 0;
    const G = parseInt(gamesPerPlayer) || 0;
    
    if (P < 4 || C < 1 || G < 1) {
      return { rounds: 0, totalSlots: 0, capacity: 0, fairnessWarning: null };
    }
    
    const totalSlots = P * G;
    const capacity = C * 4;
    const rounds = Math.ceil(totalSlots / capacity);
    
    // Calculate fairness metrics
    const totalPartnerSlots = P * G; // Each game gives you 1 partner
    const uniquePartnersAvailable = P - 1; // Can't partner with yourself
    const repeatPartnersNeeded = Math.max(0, totalPartnerSlots - uniquePartnersAvailable * rounds);
    
    let fairnessWarning = null;
    if (repeatPartnersNeeded > 0) {
      fairnessWarning = `Some players may have ${Math.ceil(repeatPartnersNeeded / P)} repeat partners`;
    } else if (P % 4 !== 0) {
      fairnessWarning = "Players will rotate sit-outs fairly";
    }
    
    return { rounds, totalSlots, capacity, fairnessWarning };
  };
  
  const metrics = calculateScheduleMetrics();

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
          num_rounds: metrics.rounds,
          games_per_player: parseInt(gamesPerPlayer),
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

  const canCreate = name.trim() && selectedPlayers.length >= 4 && parseInt(numCourts) >= 1 && parseInt(gamesPerPlayer) >= 1 && metrics.rounds > 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-secondary border-b">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <BackToDashboard />
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold whitespace-nowrap">Round Robin by</h1>
              <img src={logo} alt="PULSE" className="h-8 sm:h-10 w-auto" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create Your Round Robin Schedule</CardTitle>
            <CardDescription>Answer three simple questions to generate a fair, balanced tournament</CardDescription>
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
              <Label>1. How many players are playing? *</Label>
              <MultiPlayerCombobox
                selectedPlayers={selectedPlayers}
                onPlayersChange={setSelectedPlayers}
              />
              <p className="text-sm text-muted-foreground">
                {selectedPlayers.length} {selectedPlayers.length === 1 ? "player" : "players"} selected (minimum 4)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="games">2. How many games per player? *</Label>
                <Select value={gamesPerPlayer} onValueChange={setGamesPerPlayer}>
                  <SelectTrigger id="games">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? "game" : "games"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="courts">3. How many courts are available? *</Label>
                <Input
                  id="courts"
                  type="number"
                  min="1"
                  max="20"
                  value={numCourts}
                  onChange={(e) => setNumCourts(e.target.value)}
                />
              </div>
            </div>

            {metrics.rounds > 0 && (
              <Card className="bg-muted/50 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Schedule Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rounds Required:</span>
                    <span className="font-semibold">{metrics.rounds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Games per Player:</span>
                    <span className="font-semibold">{gamesPerPlayer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Courts in Use:</span>
                    <span className="font-semibold">{numCourts}</span>
                  </div>
                  {metrics.fairnessWarning && (
                    <div className="pt-2 mt-2 border-t">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400 text-xs">⚠</span>
                        <span className="text-muted-foreground text-xs">{metrics.fairnessWarning}</span>
                      </div>
                    </div>
                  )}
                  {!metrics.fairnessWarning && (
                    <div className="pt-2 mt-2 border-t">
                      <div className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
                        <span className="text-muted-foreground text-xs">Optimal fairness - unique pairings possible</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
