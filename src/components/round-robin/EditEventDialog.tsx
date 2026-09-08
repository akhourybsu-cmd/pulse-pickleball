import { useEffect, useState } from "react";
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
import { Save, Info, Star, Grid3x3, ArrowRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveSettingsModal, ModalActions } from "./ResponsiveSettingsModal";
import { NumericStepper } from "./NumericStepper";

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
  max_players?: number | null;
  registration_mode?: string;
  registration_deadline?: string | null;
}

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  onSave: (updates: Partial<Event>) => Promise<void>;
  /** Kept for compatibility with existing callers; roster-sensitive schedule
   *  settings now live exclusively in Courts & Games. */
  playerCount?: number;
  onOpenSchedule?: () => void;
}

type SectionKey = "basics" | "rating";

const SECTIONS: { key: SectionKey; label: string; icon: typeof Info }[] = [
  { key: "basics", label: "Basics", icon: Info },
  { key: "rating", label: "Rating", icon: Star },
];

export function EditEventDialog({
  open,
  onOpenChange,
  event,
  onSave,
  playerCount = 4,
  onOpenSchedule,
}: EditEventDialogProps) {
  const normalizedMaxPlayers = Math.max(playerCount, event.max_players ?? 4);
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date);
  const [startTime, setStartTime] = useState(event.start_time || "09:00");
  const [notes, setNotes] = useState(event.notes || "");
  const [ratingEligible, setRatingEligible] = useState(event.rating_eligible);
  const [ratingType, setRatingType] = useState<"ladder" | "league" | "playoffs" | "casual">(event.rating_type);
  const [maxPlayers, setMaxPlayers] = useState(normalizedMaxPlayers);
  const [registrationDeadline, setRegistrationDeadline] = useState(
    event.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);
  /** Mobile only: one section at a time, so the sheet never becomes a
   *  never-ending scroll. Desktop keeps every section stacked. */
  const [section, setSection] = useState<SectionKey>("basics");

  useEffect(() => {
    if (!open) return;
    setName(event.name);
    setDate(event.date);
    setStartTime(event.start_time || "09:00");
    setNotes(event.notes || "");
    setRatingEligible(event.rating_eligible);
    setRatingType(event.rating_type);
    setMaxPlayers(normalizedMaxPlayers);
    setRegistrationDeadline(
      event.registration_deadline
        ? new Date(event.registration_deadline).toISOString().slice(0, 16)
        : "",
    );
    setSection("basics");
  }, [event, normalizedMaxPlayers, open]);

  const hasChanges = 
    name !== event.name ||
    date !== event.date ||
    startTime !== (event.start_time || "09:00") ||
    notes !== (event.notes || "") ||
    ratingEligible !== event.rating_eligible ||
    ratingType !== event.rating_type ||
    (event.registration_mode === "open_registration" && maxPlayers !== normalizedMaxPlayers) ||
    (event.registration_mode === 'open_registration' && registrationDeadline !== (event.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : ""));

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
      if (
        event.registration_mode === "open_registration" &&
        maxPlayers !== normalizedMaxPlayers
      ) {
        updates.max_players = maxPlayers;
      }
      if (event.registration_mode === 'open_registration' && registrationDeadline) {
        const newDeadline = new Date(registrationDeadline).toISOString();
        const oldDeadline = event.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : "";
        if (registrationDeadline !== oldDeadline) {
          updates.registration_deadline = newDeadline;
        }
      }
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

      {event.registration_mode === "open_registration" && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
          <NumericStepper
            value={maxPlayers}
            onChange={setMaxPlayers}
            min={Math.max(4, playerCount)}
            max={100}
            icon={Users}
            label="Registration capacity"
            suffix={`${playerCount} currently on the roster`}
          />
          <div className="space-y-1.5">
            <Label htmlFor="registration-deadline">Registration deadline</Label>
            <Input
              id="registration-deadline"
              type="datetime-local"
              className="h-11"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Capacity controls future sign-ups only. Actual roster changes are handled from Manage players and automatically rebalance the schedule.
            </p>
          </div>
        </div>
      )}

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

  return (
    <ResponsiveSettingsModal
      open={open}
      onOpenChange={onOpenChange}
      title="Event settings"
      description="Update event details and rating rules without disturbing the schedule."
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
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/60 p-1">
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
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.055] p-3.5 sm:mt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-background/70 text-primary">
            <Grid3x3 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Need to change the rotation?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Courts and games are managed together so one save can safely rebuild every affected round.
            </p>
            {onOpenSchedule && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenSchedule();
                }}
                className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Open Courts & games
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
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
