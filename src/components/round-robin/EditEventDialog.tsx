import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Save, Info, Star, CalendarClock, Grid3x3, Gamepad2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumericStepper } from "./NumericStepper";
import { ResponsiveSettingsModal, ModalActions } from "./ResponsiveSettingsModal";

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

type SectionKey = "basics" | "rating" | "schedule";

const SECTIONS: { key: SectionKey; label: string; icon: typeof Info }[] = [
  { key: "basics", label: "Basics", icon: Info },
  { key: "rating", label: "Rating", icon: Star },
  { key: "schedule", label: "Schedule", icon: CalendarClock },
];

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
  /** Mobile only: one section at a time, so the sheet never becomes a
   *  never-ending scroll. Desktop keeps every section stacked. */
  const [section, setSection] = useState<SectionKey>("basics");

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

  /* Section visibility: on mobile only the picked section renders; at sm+ the
     `sm:block` override brings every section back into one scroll. */
  const show = (key: SectionKey) => (section === key ? "block" : "hidden sm:block");

  const basics = (
    <section className={cn("space-y-3", show("basics"))}>
      <SectionHeading>Basics</SectionHeading>
      <div className="space-y-1.5">
        <Label htmlFor="name">Event name</Label>
        <Input
          id="name"
          className="h-11"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Event name"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            className="h-11"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="time">Start time</Label>
          <Input
            id="time"
            type="time"
            className="h-11"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes or instructions"
          rows={3}
        />
      </div>
    </section>
  );

  const rating = (
    <section className={cn("space-y-3 sm:pt-4 sm:border-t sm:border-border/60", show("rating"))}>
      <SectionHeading>Rating</SectionHeading>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="space-y-0.5 min-w-0">
          <Label className="text-sm font-semibold">Rating eligible</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Future matches only — past scores aren't affected
          </p>
        </div>
        <Switch checked={ratingEligible} onCheckedChange={setRatingEligible} />
      </div>

      {ratingEligible && (
        <div className="space-y-1.5">
          <Label htmlFor="rating-type">Match type</Label>
          <Select
            value={ratingType}
            onValueChange={(value) => setRatingType(value as "ladder" | "league" | "playoffs" | "casual")}
          >
            <SelectTrigger id="rating-type" className="h-11">
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
    </section>
  );

  const schedule = (
    <section className={cn("space-y-3 sm:pt-4 sm:border-t sm:border-border/60", show("schedule"))}>
      <SectionHeading>Schedule</SectionHeading>

      <NumericStepper
        value={numCourts}
        onChange={setNumCourts}
        min={1}
        max={20}
        icon={Grid3x3}
        label="Courts available"
        suffix="Simultaneous matches per round"
      />
      <NumericStepper
        value={gamesPerPlayer}
        onChange={setGamesPerPlayer}
        min={1}
        max={20}
        icon={Gamepad2}
        label="Games per player"
        suffix="Total matches each player gets"
      />

      {event.registration_mode === 'open_registration' && (
        <>
          <NumericStepper
            value={maxPlayers}
            onChange={setMaxPlayers}
            min={4}
            max={100}
            icon={Users}
            label="Number of players"
            suffix="Registration cap"
          />

          <div className="space-y-1.5">
            <Label htmlFor="registration-deadline">Registration deadline</Label>
            <Input
              id="registration-deadline"
              type="datetime-local"
              className="h-11"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-[11px] text-muted-foreground">
              Players can register until this date and time
            </p>
          </div>
        </>
      )}

      {/* Schedule preview — same visual language as CourtsRoundsDialog. */}
      <div
        className="rounded-xl border border-primary/20 p-3.5"
        style={{ backgroundColor: "hsl(var(--primary) / 0.05)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-primary uppercase tracking-[0.14em]">
              Schedule preview
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {event.registration_mode === 'open_registration' ? maxPlayers : (playerCount || 8)} players ·{" "}
              {numCourts} {numCourts === 1 ? 'court' : 'courts'} ·{" "}
              {gamesPerPlayer} {gamesPerPlayer === 1 ? 'game' : 'games'}
            </div>
            {calculatedRounds !== event.num_rounds && (
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Rounds will change from {event.num_rounds} to {calculatedRounds}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl font-bold text-primary tabular-nums leading-none">
              {calculatedRounds}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {calculatedRounds === 1 ? 'round' : 'rounds'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <ResponsiveSettingsModal
      open={open}
      onOpenChange={onOpenChange}
      title="Event settings"
      description="Changes to rating settings only apply to future, unscored matches."
      footer={
        <ModalActions>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : hasChanges ? "Save changes" : "No changes"}
          </Button>
        </ModalActions>
      }
    >
      {/* Mobile section switcher — keeps each screen to a thumb's worth of
          scrolling instead of one long form. Hidden at sm+. */}
      <div className="sm:hidden sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border/60 mb-3">
        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                aria-current={isActive}
                className={cn(
                  "h-10 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground active:bg-background/60",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 sm:space-y-5 pb-2">
        {basics}
        {rating}
        {schedule}
      </div>
    </ResponsiveSettingsModal>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}
