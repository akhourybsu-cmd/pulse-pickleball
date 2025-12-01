import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Event {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  notes: string | null;
  rating_eligible: boolean;
  rating_type: "ladder" | "league" | "playoffs" | "casual";
  num_courts: number;
  num_rounds: number;
  games_per_player?: number;
  max_players?: number;
  registration_mode?: string;
  registration_deadline?: string | null;
}

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  onSave: (updates: Partial<Event>) => Promise<void>;
  playerCount?: number; // Current player count for display
}

export function EditEventDialog({ open, onOpenChange, event, onSave, playerCount }: EditEventDialogProps) {
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date);
  const [startTime, setStartTime] = useState(event.start_time || "09:00");
  const [notes, setNotes] = useState(event.notes || "");
  const [ratingEligible, setRatingEligible] = useState(event.rating_eligible);
  const [ratingType, setRatingType] = useState<"ladder" | "league" | "playoffs" | "casual">(event.rating_type);
  const [numCourts, setNumCourts] = useState(event.num_courts);
  const [gamesPerPlayer, setGamesPerPlayer] = useState(event.games_per_player || 3);
  const [maxPlayers, setMaxPlayers] = useState(event.max_players || playerCount || 8);
  const [registrationDeadline, setRegistrationDeadline] = useState(
    event.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);

  // Calculate rounds automatically based on players, courts, and games
  const calculateRounds = (players: number, courts: number, games: number) => {
    const totalSlots = players * games;
    const capacity = courts * 4;
    return Math.ceil(totalSlots / capacity);
  };

  const calculatedRounds = calculateRounds(
    event.registration_mode === 'open_registration' ? maxPlayers : (playerCount || 8),
    numCourts,
    gamesPerPlayer
  );

  const hasChanges = 
    name !== event.name ||
    date !== event.date ||
    startTime !== (event.start_time || "09:00") ||
    notes !== (event.notes || "") ||
    ratingEligible !== event.rating_eligible ||
    ratingType !== event.rating_type ||
    numCourts !== event.num_courts ||
    gamesPerPlayer !== (event.games_per_player || 3) ||
    (event.registration_mode === 'open_registration' && maxPlayers !== event.max_players) ||
    (event.registration_mode === 'open_registration' && registrationDeadline !== (event.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : "")) ||
    calculatedRounds !== event.num_rounds;

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    try {
      const updates: Partial<Event> = {};
      if (name !== event.name) updates.name = name;
      if (date !== event.date) updates.date = date;
      if (startTime !== (event.start_time || "09:00")) updates.start_time = startTime;
      if (notes !== (event.notes || "")) updates.notes = notes || null;
      if (ratingEligible !== event.rating_eligible) updates.rating_eligible = ratingEligible;
      if (ratingType !== event.rating_type) updates.rating_type = ratingType;
      if (numCourts !== event.num_courts) updates.num_courts = numCourts;
      if (gamesPerPlayer !== (event.games_per_player || 3)) updates.games_per_player = gamesPerPlayer;
      if (event.registration_mode === 'open_registration' && maxPlayers !== event.max_players) {
        updates.max_players = maxPlayers;
      }
      if (event.registration_mode === 'open_registration' && registrationDeadline) {
        const newDeadline = new Date(registrationDeadline).toISOString();
        const oldDeadline = event.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : "";
        if (registrationDeadline !== oldDeadline) {
          updates.registration_deadline = newDeadline;
        }
      }
      if (calculatedRounds !== event.num_rounds) updates.num_rounds = calculatedRounds;

      await onSave(updates);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Event Settings</DialogTitle>
          <DialogDescription>
            Changes to rating settings will only apply to future, unscored matches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 px-1">
          <div className="space-y-2">
            <Label htmlFor="name">Event Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Event name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Event Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Start Time</Label>
              <Input
                id="time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or instructions"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Rating Eligible</Label>
              <p className="text-sm text-muted-foreground">
                Affects future matches only
              </p>
            </div>
            <Switch
              checked={ratingEligible}
              onCheckedChange={setRatingEligible}
            />
          </div>

          {ratingEligible && (
            <div className="space-y-2">
              <Label htmlFor="rating-type">Match Type</Label>
              <Select 
                value={ratingType} 
                onValueChange={(value) => setRatingType(value as "ladder" | "league" | "playoffs" | "casual")}
              >
                <SelectTrigger id="rating-type">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="courts">Number of Courts</Label>
              <Input
                id="courts"
                type="number"
                min="1"
                max="20"
                value={numCourts}
                onChange={(e) => setNumCourts(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="games-per-player">Games per Player</Label>
              <Input
                id="games-per-player"
                type="number"
                min="1"
                max="20"
                value={gamesPerPlayer}
                onChange={(e) => setGamesPerPlayer(parseInt(e.target.value) || 3)}
              />
            </div>
          </div>

          {event.registration_mode === 'open_registration' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="max-players">Number of Players</Label>
                <Input
                  id="max-players"
                  type="number"
                  min="4"
                  max="100"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 8)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registration-deadline">Registration Deadline</Label>
                <Input
                  id="registration-deadline"
                  type="datetime-local"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-muted-foreground">
                  Players can register until this date and time
                </p>
              </div>
            </>
          )}

          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="text-sm font-medium">Auto-calculated Schedule</p>
            <p className="text-xs text-muted-foreground">
              {event.registration_mode === 'open_registration' ? maxPlayers : playerCount || 8} players × {gamesPerPlayer} games ÷ ({numCourts} courts × 4 slots) = <span className="font-semibold">{calculatedRounds} rounds</span>
            </p>
            {calculatedRounds !== event.num_rounds && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Rounds will update from {event.num_rounds} to {calculatedRounds}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
