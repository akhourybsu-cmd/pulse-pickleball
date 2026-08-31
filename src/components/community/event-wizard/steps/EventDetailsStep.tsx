import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MapPin, Users, ListOrdered, LayoutGrid, Repeat2 } from 'lucide-react';
import type { EventFormat } from '../types';

interface EventDetailsStepProps {
  eventType: EventFormat | null;
  location: string;
  capacity: number | null;
  waitlistEnabled: boolean;
  waitlistLimit: number | null;
  rrCourts: number | null;
  rrGamesPerPlayer: number | null;
  onLocationChange: (location: string) => void;
  onCapacityChange: (capacity: number | null) => void;
  onWaitlistEnabledChange: (enabled: boolean) => void;
  onWaitlistLimitChange: (limit: number | null) => void;
  onRrCourtsChange: (courts: number | null) => void;
  onRrGamesChange: (games: number | null) => void;
}

function FieldGroup({
  icon: Icon,
  label,
  hint,
  children,
}: {
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

export function EventDetailsStep({
  eventType,
  location,
  capacity,
  waitlistEnabled,
  waitlistLimit,
  rrCourts,
  rrGamesPerPlayer,
  onLocationChange,
  onCapacityChange,
  onWaitlistEnabledChange,
  onWaitlistLimitChange,
  onRrCourtsChange,
  onRrGamesChange,
}: EventDetailsStepProps) {
  const isRoundRobin = eventType === 'round_robin';

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        All optional — capacity unlocks the waitlist.
      </p>

      <FieldGroup icon={MapPin} label="Location">
        <Input
          className="h-11 rounded-lg"
          placeholder="Court, venue or address"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
        />
      </FieldGroup>

      {isRoundRobin && (
        <div className="grid grid-cols-2 gap-2">
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
        hint="Leave empty for unlimited spots."
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
                ? 'Overflow RSVPs join a queue and are promoted automatically when a spot frees up.'
                : 'Set a capacity above to use the waitlist.'}
            </p>
          </div>
          <Switch
            checked={waitlistEnabled}
            disabled={!capacity}
            onCheckedChange={onWaitlistEnabledChange}
          />
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
              onChange={(e) =>
                onWaitlistLimitChange(e.target.value ? parseInt(e.target.value, 10) : null)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
