import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Check,
  Gauge,
  LayoutGrid,
  ListOrdered,
  MapPin,
  Repeat2,
  Shuffle,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ROTATION_OPTIONS,
  type EventFormat,
  type RotationStyle,
  type VenueEventCourt,
} from '../types';

interface EventDetailsStepProps {
  eventType: EventFormat | null;
  location: string;
  capacity: number | null;
  waitlistEnabled: boolean;
  waitlistLimit: number | null;
  rrCourts: number | null;
  rrGamesPerPlayer: number | null;
  venueMode?: boolean;
  venueName?: string | null;
  courts?: VenueEventCourt[];
  selectedCourtIds?: string[];
  busyCourtIds?: ReadonlySet<string>;
  courtConflictsPending?: boolean;
  skillLevelMin?: number | null;
  skillLevelMax?: number | null;
  rotationStyle?: RotationStyle | null;
  onLocationChange: (location: string) => void;
  onCapacityChange: (capacity: number | null) => void;
  onWaitlistEnabledChange: (enabled: boolean) => void;
  onWaitlistLimitChange: (limit: number | null) => void;
  onRrCourtsChange: (courts: number | null) => void;
  onRrGamesChange: (games: number | null) => void;
  onSelectedCourtsChange?: (courtIds: string[]) => void;
  onSkillLevelMinChange?: (level: number | null) => void;
  onSkillLevelMaxChange?: (level: number | null) => void;
  onRotationStyleChange?: (style: RotationStyle | null) => void;
}

function FieldGroup({ icon: Icon, label, hint, children }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
      <Label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3 w-3 text-primary/80" />
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

const SKILL_LEVELS = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5];

export function EventDetailsStep({
  eventType,
  location,
  capacity,
  waitlistEnabled,
  waitlistLimit,
  rrCourts,
  rrGamesPerPlayer,
  venueMode = false,
  venueName,
  courts = [],
  selectedCourtIds = [],
  busyCourtIds = new Set<string>(),
  courtConflictsPending = false,
  skillLevelMin = null,
  skillLevelMax = null,
  rotationStyle = null,
  onLocationChange,
  onCapacityChange,
  onWaitlistEnabledChange,
  onWaitlistLimitChange,
  onRrCourtsChange,
  onRrGamesChange,
  onSelectedCourtsChange,
  onSkillLevelMinChange,
  onSkillLevelMaxChange,
  onRotationStyleChange,
}: EventDetailsStepProps) {
  const isRoundRobin = eventType === 'round_robin';
  const rotations = ROTATION_OPTIONS.filter((option) =>
    eventType ? option.formats.includes(eventType) : true,
  );

  const toggleCourt = (courtId: string) => {
    if (!onSelectedCourtsChange || busyCourtIds.has(courtId)) return;
    onSelectedCourtsChange(
      selectedCourtIds.includes(courtId)
        ? selectedCourtIds.filter((id) => id !== courtId)
        : [...selectedCourtIds, courtId],
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {venueMode
          ? 'Allocate courts, define the player fit, then set registration capacity.'
          : 'All optional — capacity unlocks the waitlist.'}
      </p>

      {venueMode ? (
        <FieldGroup
          icon={LayoutGrid}
          label="Courts"
          hint={
            selectedCourtIds.length > 0
              ? `${selectedCourtIds.length} court${selectedCourtIds.length === 1 ? '' : 's'} held for every occurrence.`
              : 'Choose at least one court. Busy courts cannot be selected.'
          }
        >
          {courts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
              No active courts are configured for this venue.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {courts.map((court) => {
                const selected = selectedCourtIds.includes(court.id);
                const busy = busyCourtIds.has(court.id);
                return (
                  <button
                    key={court.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={selected}
                    onClick={() => toggleCourt(court.id)}
                    className={cn(
                      'relative min-h-16 rounded-xl border px-3 py-2.5 text-left transition-all',
                      selected && 'border-primary/70 bg-primary/10 shadow-[0_8px_20px_-16px_hsl(var(--primary))]',
                      !selected && !busy && 'border-border/70 bg-background hover:border-primary/40',
                      busy && 'cursor-not-allowed border-border/50 bg-muted/50 opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-bold">
                        {court.name ?? `Court ${court.court_number}`}
                      </span>
                      {selected ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : busy ? (
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                      ) : null}
                    </div>
                    <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {busy ? 'Busy at this time' : court.surface_type || 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {courtConflictsPending && (
            <p className="mt-2 text-[11px] text-muted-foreground">Checking the court schedule…</p>
          )}
        </FieldGroup>
      ) : (
        <FieldGroup icon={MapPin} label="Location">
          <Input
            className="h-11 rounded-lg"
            placeholder="Court, venue or address"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
          />
        </FieldGroup>
      )}

      {venueMode && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FieldGroup icon={Gauge} label="Player level" hint="Leave both at Any for an all-level program.">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={skillLevelMin == null ? 'any' : String(skillLevelMin)}
                onValueChange={(value) => onSkillLevelMinChange?.(value === 'any' ? null : Number(value))}
              >
                <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Min" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any min</SelectItem>
                  {SKILL_LEVELS.map((level) => <SelectItem key={level} value={String(level)}>{level.toFixed(1)}+</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={skillLevelMax == null ? 'any' : String(skillLevelMax)}
                onValueChange={(value) => onSkillLevelMaxChange?.(value === 'any' ? null : Number(value))}
              >
                <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Max" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any max</SelectItem>
                  {SKILL_LEVELS.map((level) => <SelectItem key={level} value={String(level)}>Up to {level.toFixed(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {skillLevelMin != null && skillLevelMax != null && skillLevelMin > skillLevelMax && (
              <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                <AlertCircle className="h-3 w-3" />
                Maximum level must be at least the minimum.
              </p>
            )}
          </FieldGroup>

          {rotations.length > 0 && (
            <FieldGroup icon={Shuffle} label="Player rotation" hint="Shown to players before they register.">
              <Select
                value={rotationStyle ?? 'none'}
                onValueChange={(value) => onRotationStyleChange?.(value === 'none' ? null : value as RotationStyle)}
              >
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {rotations.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col items-start">
                        <span>{option.label}</span>
                        <span className="text-[11px] text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
          )}
        </div>
      )}

      {isRoundRobin && (
        <div className="grid grid-cols-2 gap-2">
          {!venueMode && (
            <FieldGroup icon={LayoutGrid} label="Courts">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                className="h-11 rounded-lg tabular-nums"
                placeholder="e.g. 4"
                value={rrCourts ?? ''}
                onChange={(e) => onRrCourtsChange(e.target.value ? parseInt(e.target.value, 10) : null)}
              />
            </FieldGroup>
          )}
          <FieldGroup icon={Repeat2} label="Games / player">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              className="h-11 rounded-lg tabular-nums"
              placeholder="e.g. 6"
              value={rrGamesPerPlayer ?? ''}
              onChange={(e) => onRrGamesChange(e.target.value ? parseInt(e.target.value, 10) : null)}
            />
          </FieldGroup>
        </div>
      )}

      <FieldGroup
        icon={Users}
        label="Capacity"
        hint={
          venueMode && selectedCourtIds.length
            ? `Suggested from ${selectedCourtIds.length} selected court${selectedCourtIds.length === 1 ? '' : 's'}; adjust for your format.`
            : 'Leave empty for unlimited spots.'
        }
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          className="h-11 rounded-lg tabular-nums"
          placeholder="Max players"
          value={capacity ?? ''}
          onChange={(e) => onCapacityChange(e.target.value ? parseInt(e.target.value, 10) : null)}
        />
      </FieldGroup>

      <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="flex items-center gap-1.5 text-sm font-semibold">
              <ListOrdered className="h-4 w-4 text-primary/80" />
              Waitlist
            </Label>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {capacity
                ? 'Overflow registrations join a queue and move in automatically when a spot opens.'
                : 'Set a capacity above to use the waitlist.'}
            </p>
          </div>
          <Switch checked={waitlistEnabled} disabled={!capacity} onCheckedChange={onWaitlistEnabledChange} />
        </div>

        {!!capacity && waitlistEnabled && (
          <div className="mt-3">
            <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Waitlist cap (optional)
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              className="h-11 rounded-lg tabular-nums"
              placeholder="Unlimited"
              value={waitlistLimit ?? ''}
              onChange={(e) => onWaitlistLimitChange(e.target.value ? parseInt(e.target.value, 10) : null)}
            />
          </div>
        )}
      </div>

      {venueMode && venueName && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          Published under {venueName}
        </p>
      )}
    </div>
  );
}
