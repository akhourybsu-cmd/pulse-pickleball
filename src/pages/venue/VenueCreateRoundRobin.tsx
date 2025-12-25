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
import { ArrowLeft, Calendar, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import { MultiPlayerCombobox } from "@/components/MultiPlayerCombobox";
import { useMode } from "@/contexts/ModeContext";
import { useVenueCourts } from "@/hooks/useVenueCourts";
import { getVenueLogoSrc, getVenueLogoFallback } from "@/lib/venueBranding";

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  gender?: string | null;
}

export default function VenueCreateRoundRobin() {
  const navigate = useNavigate();
  const { currentVenue } = useMode();
  const { courts: venueCourts } = useVenueCourts(currentVenue?.venue_id || "");
  
  const [loading, setLoading] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<"immediate" | "open_registration">("immediate");
  const [name, setName] = useState("");
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

  // Venue logo
  const logoSrc = getVenueLogoSrc(currentVenue?.logo_url, currentVenue?.venue_name);
  
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
    
    const maxPossibleMatches = Math.floor(P / 4);
    const matchesPerRound = Math.min(C, maxPossibleMatches);
    const onCourtPerRound = 4 * matchesPerRound;
    const gamesPerRoundPerPlayer = onCourtPerRound / P;
    const rounds = Math.ceil(G / gamesPerRoundPerPlayer);
    const totalSlots = P * G;
    const capacity = onCourtPerRound;
    
    let fairnessWarning = null;
    if (matchesPerRound < C) {
      fairnessWarning = `Only ${matchesPerRound} of ${C} courts will be used`;
    } else if (P % 4 !== 0) {
      fairnessWarning = "Players will rotate sit-outs fairly";
    }
    
    return { rounds, totalSlots, capacity, fairnessWarning };
  };
  
  const metrics = calculateScheduleMetrics();

  // Set default courts from venue
  useEffect(() => {
    if (venueCourts.length > 0) {
      setNumCourts(Math.min(venueCourts.length, 4).toString());
    }
  }, [venueCourts]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Event name is required");
      return;
    }

    if (!currentVenue?.venue_id) {
      toast.error("No venue selected");
      return;
    }

    // Validate based on mode
    if (registrationMode === 'immediate') {
      if (selectedPlayers.length < 4) {
        toast.error("At least 4 players are required");
        return;
      }
    } else {
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

      // Create event with venue_id
      const eventData: any = {
        name: name.trim(),
        location: currentVenue.venue_id, // Store venue_id as location for compatibility
        notes: notes.trim() || null,
        organizer_id: user.id,
        venue_id: currentVenue.venue_id, // Set venue_id
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
        ? 'Round robin created!'
        : isPublished 
          ? 'Event created and published!'
          : 'Event created in draft mode.';
      
      toast.success(successMessage);
      navigate(`/venue/round-robins/${event.id}`);
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
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/venue/round-robins")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <img 
            src={logoSrc} 
            alt={currentVenue?.venue_name || "Venue"} 
            className="h-10 w-auto"
            onError={(e) => {
              e.currentTarget.src = getVenueLogoFallback();
            }}
          />
          <div>
            <h1 className="text-xl font-bold">Create Round Robin</h1>
            <p className="text-sm text-muted-foreground">{currentVenue?.venue_name}</p>
          </div>
        </div>
      </div>

      {/* Venue Location Banner */}
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-primary" />
            <span>Location: <strong>{currentVenue?.venue_name}</strong></span>
            <span className="text-muted-foreground">(preset)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Round Robin Details</CardTitle>
          <CardDescription>Create a round robin tournament for your venue</CardDescription>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-players">Max Players *</Label>
                <Input
                  id="max-players"
                  type="number"
                  min="4"
                  max="100"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 4)}
                />
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
            <div className="space-y-2">
              <Label>Date</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {new Date().toLocaleDateString()} (Today)
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information..."
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
          </div>

          {/* Player Selection - Only for Immediate Mode */}
          {registrationMode === 'immediate' && (
            <div className="space-y-2">
              <Label>Players *</Label>
              <MultiPlayerCombobox
                selectedPlayers={selectedPlayers}
                onPlayersChange={setSelectedPlayers}
                genderFilter={format === "male" ? "male" : format === "female" ? "female" : undefined}
              />
              <p className="text-sm text-muted-foreground">
                {selectedPlayers.length} players selected (minimum 4)
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="courts">Number of Courts *</Label>
              <Select value={numCourts} onValueChange={setNumCourts}>
                <SelectTrigger id="courts">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} {n === 1 ? "court" : "courts"}
                      {venueCourts[n - 1] && ` (${venueCourts[n - 1].name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="games">Games per Player *</Label>
              <Select value={gamesPerPlayer} onValueChange={setGamesPerPlayer}>
                <SelectTrigger id="games">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} games
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schedule Preview */}
          {registrationMode === 'immediate' && selectedPlayers.length >= 4 && metrics.rounds > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="text-sm space-y-1">
                  <p><strong>Schedule Preview:</strong></p>
                  <p>{metrics.rounds} rounds • {selectedPlayers.length} players • {numCourts} courts</p>
                  {metrics.fairnessWarning && (
                    <p className="text-amber-600 dark:text-amber-400 text-xs">
                      ⚠ {metrics.fairnessWarning}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="rating"
                checked={ratingEligible}
                onCheckedChange={setRatingEligible}
              />
              <Label htmlFor="rating" className="cursor-pointer">
                Rating eligible (affects player ratings)
              </Label>
            </div>

            {ratingEligible && (
              <div className="space-y-2">
                <Label htmlFor="rating-type">Rating Type</Label>
                <Select value={ratingType} onValueChange={(v: any) => setRatingType(v)}>
                  <SelectTrigger id="rating-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="league">League (standard)</SelectItem>
                    <SelectItem value="ladder">Ladder</SelectItem>
                    <SelectItem value="playoffs">Playoffs (higher stakes)</SelectItem>
                    <SelectItem value="casual">Casual (lower impact)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/venue/round-robins")}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleCreate} 
              disabled={!canCreate || loading}
            >
              {loading ? "Creating..." : "Create Round Robin"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
