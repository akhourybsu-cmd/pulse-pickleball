import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Users, ListOrdered, MapPin, LayoutGrid, Repeat2 } from 'lucide-react';
import type { GroupEvent } from '@/hooks/useGroupEvents';

interface EventSettingsDialogProps {
  event: GroupEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: {
    capacity: number | null;
    waitlist_enabled: boolean;
    waitlist_limit: number | null;
    custom_location: string | null;
    rr_courts: number | null;
    rr_games_per_player: number | null;
  }) => Promise<unknown>;
}

/**
 * Admin-only editor for the capacity + waitlist rules of a single group event.
 * Kept deliberately narrow: date/title edits still happen by recreating.
 */
export function EventSettingsDialog({ event, open, onOpenChange, onSave }: EventSettingsDialogProps) {
  const [capacity, setCapacity] = useState<string>('');
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [waitlistLimit, setWaitlistLimit] = useState<string>('');
  const [location, setLocation] = useState('');
  const [courts, setCourts] = useState<string>('');
  const [games, setGames] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    setCapacity(event.capacity ? String(event.capacity) : '');
    setWaitlistEnabled(!!event.waitlist_enabled);
    setWaitlistLimit(event.waitlist_limit ? String(event.waitlist_limit) : '');
    setLocation(event.custom_location ?? '');
    setCourts(event.rr_courts ? String(event.rr_courts) : '');
    setGames(event.rr_games_per_player ? String(event.rr_games_per_player) : '');
  }, [event]);

  const capacityNum = capacity ? parseInt(capacity, 10) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        capacity: capacityNum,
        waitlist_enabled: capacityNum ? waitlistEnabled : false,
        waitlist_limit: capacityNum && waitlistEnabled && waitlistLimit ? parseInt(waitlistLimit, 10) : null,
        custom_location: location.trim() || null,
        rr_courts: courts ? parseInt(courts, 10) : null,
        rr_games_per_player: games ? parseInt(games, 10) : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isRoundRobin = event?.event_format === 'round_robin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="relative border-b border-border/60 px-4 pb-3 pt-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-10 -top-16 h-32 w-32 rounded-full bg-primary/20 blur-3xl"
          />
          <p className="relative text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
            Event settings
          </p>
          <h2 className="relative mt-0.5 truncate text-[17px] font-extrabold tracking-[-0.01em]">
            {event?.title ?? 'Event'}
          </h2>
        </div>

        <div className="max-h-[65vh] space-y-2.5 overflow-y-auto px-4 py-3">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
            <Label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary/80" /> Location
            </Label>
            <Input
              className="h-11 rounded-lg"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Court, venue or address"
            />
          </div>

          {isRoundRobin && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                <Label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <LayoutGrid className="h-3 w-3 text-primary/80" /> Courts
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="h-11 rounded-lg tabular-nums"
                  value={courts}
                  onChange={(e) => setCourts(e.target.value)}
                />
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                <Label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <Repeat2 className="h-3 w-3 text-primary/80" /> Games each
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="h-11 rounded-lg tabular-nums"
                  value={games}
                  onChange={(e) => setGames(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
            <Label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <Users className="h-3 w-3 text-primary/80" /> Capacity
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              className="h-11 rounded-lg tabular-nums"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Unlimited"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              Raising the cap immediately promotes anyone waiting.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <ListOrdered className="h-4 w-4 text-primary/80" /> Waitlist
                </Label>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {capacityNum
                    ? 'Overflow RSVPs queue up and are promoted automatically.'
                    : 'Set a capacity to enable the waitlist.'}
                </p>
              </div>
              <Switch
                checked={waitlistEnabled}
                disabled={!capacityNum}
                onCheckedChange={setWaitlistEnabled}
              />
            </div>
            {!!capacityNum && waitlistEnabled && (
              <div className="mt-3">
                <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Waitlist cap (optional)
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="h-11 rounded-lg tabular-nums"
                  value={waitlistLimit}
                  onChange={(e) => setWaitlistLimit(e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border/60 px-4 py-3">
          <Button variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-11 flex-1 font-bold" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
