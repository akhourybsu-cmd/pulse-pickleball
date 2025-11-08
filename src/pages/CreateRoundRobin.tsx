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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { MultiPlayerCombobox } from "@/components/MultiPlayerCombobox";
import { BackToDashboard } from "@/components/BackToDashboard";
import logo from "@/assets/pulse-logo-new.png";

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  gender?: string | null;
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
  const [registrationMode, setRegistrationMode] = useState<"immediate" | "open_registration">("immediate");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Profile[]>([]);
  const [numCourts, setNumCourts] = useState("2");
  const [gamesPerPlayer, setGamesPerPlayer] = useState("3");
  const [ratingEligible, setRatingEligible] = useState(true);
  const [ratingType, setRatingType] = useState<"ladder" | "league" | "playoffs" | "casual">("league");
  const [format, setFormat] = useState<"open" | "mixed" | "male" | "female">("open");
  
  // Future event fields
  const [eventDateTime, setEventDateTime] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [isPublished, setIsPublished] = useState(false);
  
  // Get gender counts
  const getGenderCounts = () => {
    const males = selectedPlayers.filter(p => p.gender === 'male').length;
    const females = selectedPlayers.filter(p => p.gender === 'female').length;
    return { males, females };
  };

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

    // Validate based on mode
    if (registrationMode === 'immediate') {
      if (selectedPlayers.length < 4) {
        toast.error("At least 4 players are required");
        return;
      }
    } else {
      // Future event validation
      if (!eventDateTime || !registrationDeadline) {
        toast.error("Event date and registration deadline are required");
        return;
      }
      if (maxPlayers < 4) {
        toast.error("Maximum players must be at least 4");
        return;
      }
      if (new Date(registrationDeadline) >= new Date(eventDateTime)) {
        toast.error("Registration deadline must be before event date");
        return;
      }
    }

    // Validate format requirements for immediate mode
    if (registrationMode === 'immediate') {
    const { males, females } = getGenderCounts();
    if (format === "mixed" && (males < 2 || females < 2)) {
      toast.error("Mixed format requires at least 2 male and 2 female players");
      return;
    }
    if (format === "male" && males < 4) {
      toast.error("Men's format requires at least 4 male players");
      return;
    }
    if (format === "female" && females < 4) {
      toast.error("Women's format requires at least 4 female players");
      return;
    }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Create event
      const eventData: any = {
        name: name.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        organizer_id: user.id,
        num_courts: parseInt(numCourts),
        games_per_player: parseInt(gamesPerPlayer),
        rating_eligible: ratingEligible,
        rating_type: ratingType,
        format: format,
        registration_mode: registrationMode,
      };

      if (registrationMode === 'immediate') {
        eventData.num_rounds = metrics.rounds;
        eventData.date = new Date().toISOString().split('T')[0];
      } else {
        eventData.date = new Date(eventDateTime).toISOString().split('T')[0];
        eventData.registration_deadline = new Date(registrationDeadline).toISOString();
        eventData.max_players = maxPlayers;
        eventData.is_published = isPublished;
        // Calculate rounds based on max players
        const C = parseInt(numCourts) || 0;
        const G = parseInt(gamesPerPlayer) || 0;
        const totalSlots = maxPlayers * G;
        const capacity = C * 4;
        eventData.num_rounds = Math.ceil(totalSlots / capacity);
      }

      const { data: event, error: eventError } = await supabase
        .from("round_robin_events")
        .insert(eventData)
        .select()
        .single();

      if (eventError) throw eventError;

      // Add players only for immediate mode
      if (registrationMode === 'immediate') {
        const playerInserts = selectedPlayers.map((p) => ({
          event_id: event.id,
          player_id: p.id,
          registration_status: 'confirmed',
        }));

        const { error: playersError } = await supabase
          .from("round_robin_players")
          .insert(playerInserts);

        if (playersError) throw playersError;
      }

      const successMessage = registrationMode === 'immediate' 
        ? 'Event created successfully!'
        : isPublished 
          ? 'Event created and published! Share the link for players to join.'
          : 'Event created in draft mode.';
      
      toast.success(successMessage);
      navigate(`/round-robin/${event.id}`);
    } catch (error: any) {
      toast.error("Failed to create event");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const canCreate = registrationMode === 'immediate'
    ? name.trim() && selectedPlayers.length >= 4 && parseInt(numCourts) >= 1 && parseInt(gamesPerPlayer) >= 1 && metrics.rounds > 0
    : name.trim() && eventDateTime && registrationDeadline && maxPlayers >= 4 && parseInt(numCourts) >= 1 && parseInt(gamesPerPlayer) >= 1;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-secondary border-b">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <BackToDashboard />
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold whitespace-nowrap text-white">Round Robin by</h1>
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

            {/* Registration Mode Selector */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <Label>Event Mode</Label>
              <RadioGroup value={registrationMode} onValueChange={(v: any) => setRegistrationMode(v)}>
                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="immediate" id="immediate" />
                  <Label htmlFor="immediate" className="font-normal cursor-pointer">
                    <div className="space-y-1">
                      <p className="font-medium">Immediate Event</p>
                      <p className="text-sm text-muted-foreground">
                        Add players now and start today
                      </p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="open_registration" id="open_registration" />
                  <Label htmlFor="open_registration" className="font-normal cursor-pointer">
                    <div className="space-y-1">
                      <p className="font-medium">Future Event with Registration</p>
                      <p className="text-sm text-muted-foreground">
                        Schedule event and let players sign up
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Conditional Fields Based on Mode */}
            {registrationMode === 'open_registration' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="event-datetime">Event Date & Time *</Label>
                  <Input
                    id="event-datetime"
                    type="datetime-local"
                    value={eventDateTime}
                    onChange={(e) => setEventDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-deadline">Registration Deadline *</Label>
                  <Input
                    id="reg-deadline"
                    type="datetime-local"
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                    max={eventDateTime}
                  />
                  <p className="text-sm text-muted-foreground">
                    Players can join until this time
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-players">Number of Players *</Label>
                  <Input
                    id="max-players"
                    type="number"
                    min="4"
                    max="100"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 4)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Expected players: {maxPlayers} → Will generate {(() => {
                      const C = parseInt(numCourts) || 0;
                      const G = parseInt(gamesPerPlayer) || 0;
                      const totalSlots = maxPlayers * G;
                      const capacity = C * 4;
                      return Math.ceil(totalSlots / capacity);
                    })()} rounds
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="publish"
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                  <Label htmlFor="publish" className="cursor-pointer">
                    Publish event for player registration
                  </Label>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date().toLocaleDateString()} (Today, locked)
                  </div>
                </div>
              </>
            )}

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
              <Label htmlFor="format">Format *</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open (no gender requirement)</SelectItem>
                  <SelectItem value="mixed">Mixed (1 male + 1 female per team)</SelectItem>
                  <SelectItem value="male">Men's (male only)</SelectItem>
                  <SelectItem value="female">Women's (female only)</SelectItem>
                </SelectContent>
              </Select>
              {format === "mixed" && (
                <p className="text-sm text-muted-foreground">
                  ℹ️ Mixed format makes teams of 1 male and 1 female. We recommend having an even number of male and female players.
                </p>
              )}
              {format !== "open" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ This event requires players to have their gender set in their profile.
                </p>
              )}
            </div>

            {/* Player Selection - Only for Immediate Mode */}
            {registrationMode === 'immediate' && (
              <div className="space-y-2">
                <Label>1. How many players are playing? *</Label>
                <MultiPlayerCombobox
                  selectedPlayers={selectedPlayers}
                  onPlayersChange={setSelectedPlayers}
                  genderFilter={format === "male" ? "male" : format === "female" ? "female" : undefined}
                />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {selectedPlayers.length} {selectedPlayers.length === 1 ? "player" : "players"} selected (minimum 4)
                  </p>
                  {format === "mixed" && (() => {
                    const { males, females } = getGenderCounts();
                    return (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>• Males selected: {males}</p>
                        <p>• Females selected: {females}</p>
                        <p>• Courts: {numCourts} → needs {parseInt(numCourts) * 2} males and {parseInt(numCourts) * 2} females per round</p>
                        {Math.abs(males - females) > 2 && males > 0 && females > 0 && (
                          <p className="text-amber-600 dark:text-amber-400">⚠ Schedule will include sit-out rotations to balance male/female counts</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="games">
                  {registrationMode === 'immediate' ? '2.' : ''} How many games per player? *
                </Label>
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
                <Label htmlFor="courts">
                  {registrationMode === 'immediate' ? '3.' : ''} How many courts are available? *
                </Label>
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

            {/* Schedule Summary - Only show for immediate mode with selected players */}
            {registrationMode === 'immediate' && metrics.rounds > 0 && (
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
