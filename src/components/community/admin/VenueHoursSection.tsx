import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { VenueLoadState } from '@/components/venue/VenueLoadState';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { refreshVenueSettings, saveVenueHours } from '@/lib/venues/settings';
import {
  DAY_NAMES,
  SLOT_CHOICES,
  defaultVenueHours,
  timeInputValue,
  closingTimeMinutes,
  parseTime,
  parseVenueHours,
  validateVenueHours,
  type VenueHours,
} from '@/lib/venues/hours';

/**
 * Opening hours and slot length.
 *
 * The booking grid used to be hardcoded to 06:00–22:00 in one-hour blocks,
 * which is wrong for most facilities — indoor clubs run late, parks close at
 * dusk, plenty of venues shut one day a week, and half-hour bookings are
 * common. All of it now comes from here.
 */
export function VenueHoursSection({ venueId }: { venueId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<VenueHours>(defaultVenueHours);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { data, error } = await supabase
          .from('venues')
          .select('hours_of_operation')
          .eq('id', venueId)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Venue not available');
        if (!cancelled) setHours(parseVenueHours(data.hours_of_operation));
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [venueId, attempt]);

  const setDay = useCallback((index: number, next: VenueHours['days'][number]) => {
    setHours((h) => ({ ...h, days: h.days.map((d, i) => (i === index ? next : d)) }));
  }, []);

  /** Copy the first open day across the week — the usual shape of a schedule. */
  const applyToAll = () => {
    const template = hours.days.find((d) => d !== null);
    if (!template) return;
    setHours((h) => ({ ...h, days: h.days.map((d) => (d === null ? null : { ...template })) }));
    toast({ title: 'Applied to every open day' });
  };

  const save = async () => {
    if (saving || loading || loadError) return;
    const validation = validateVenueHours(hours);
    if (validation) { setSaveError(validation); return; }
    setSaveError(null);
    setSaving(true);
    try {
      await saveVenueHours(venueId, hours);
      await refreshVenueSettings(queryClient, venueId);
      toast({ title: 'Hours updated' });
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Could not save hours. Your changes are still here.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  if (loadError) return <VenueLoadState title="Opening hours couldn’t load" description="Your saved hours have not been changed. Load them before editing." onRetry={() => setAttempt(a => a + 1)} />;

  return <VenueHoursEditor hours={hours} setHours={setHours} setDay={setDay} saving={saving} error={saveError} onCopy={applyToAll} onSave={save} />;
}

/** Shared presentation for the real settings form and responsive previews. */
export function VenueHoursEditor({ hours, setHours, setDay, saving, error, onCopy, onSave }: {
  hours: VenueHours;
  setHours: React.Dispatch<React.SetStateAction<VenueHours>>;
  setDay: (index: number, day: VenueHours['days'][number]) => void;
  saving: boolean;
  error: string | null;
  onCopy: () => void;
  onSave: () => void;
}) {

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="font-sans text-base">Opening hours</CardTitle>
        <CardDescription>
          When courts can be booked, and how long a booking block is.
        </CardDescription>
      </CardHeader>
      <CardContent><fieldset disabled={saving} className="min-w-0 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="slot-length">Booking block</Label>
          <Select
            disabled={saving}
            value={String(hours.slotMinutes)}
            onValueChange={(v) => setHours((h) => ({ ...h, slotMinutes: Number(v) }))}
          >
            <SelectTrigger id="slot-length" className="min-h-11 sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOT_CHOICES.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m < 60 ? `${m} minutes` : m === 60 ? '1 hour' : `${m / 60} hours`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Players can still hold several blocks in a row for a longer booking.
          </p>
        </div>

        <div className="space-y-2">
          {hours.days.map((day, i) => {
            const open = day !== null;
            return (
              <div
                key={DAY_NAMES[i]}
                className={cn(
                  'grid min-w-0 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[40px_auto_minmax(0,1fr)]',
                  !open && 'bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'text-sm font-semibold',
                    !open && 'text-muted-foreground',
                  )}
                >
                  {DAY_NAMES[i]}
                </span>

                <Switch
                  disabled={saving}
                  checked={open}
                  onCheckedChange={(v) =>
                    setDay(
                      i,
                      v
                        ? (hours.days.find((d) => d !== null) ?? {
                            openMinutes: 6 * 60,
                            closeMinutes: 22 * 60,
                          })
                        : null,
                    )
                  }
                  aria-label={`${DAY_NAMES[i]} open`}
                />

                {open ? (
                  <div className="col-span-2 grid min-w-0 grid-cols-2 items-start gap-3 sm:col-span-1">
                    <label className="min-w-0 space-y-1 text-xs text-muted-foreground">Opens
                    <Input
                      type="time"
                      className="h-11 min-w-0 w-full max-w-full px-2 text-sm text-foreground"
                      value={timeInputValue(day.openMinutes)}
                      aria-label={`${DAY_NAMES[i]} opening time`}
                      onChange={(e) => {
                        const parsed = parseTime(e.target.value);
                        if (parsed !== null) setDay(i, { ...day, openMinutes: parsed });
                      }}
                    />
                    </label>
                    <label className="min-w-0 space-y-1 text-xs text-muted-foreground">Closes
                    <Input
                      type="time"
                      className="h-11 min-w-0 w-full max-w-full px-2 text-sm text-foreground"
                      value={timeInputValue(day.closeMinutes)}
                      aria-label={`${DAY_NAMES[i]} closing time`}
                      onChange={(e) => {
                        const parsed = closingTimeMinutes(e.target.value);
                        if (parsed !== null) setDay(i, { ...day, closeMinutes: parsed });
                      }}
                    />
                    {day.closeMinutes === 1440 && <span className="block text-[11px]">Midnight · end of day</span>}
                    </label>
                  </div>
                ) : (
                  <span className="col-span-2 text-sm text-muted-foreground sm:col-span-1">Closed</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">Existing reservations stay unchanged. Review affected bookings before shortening hours or closing a day. Only complete booking blocks appear in the player calendar.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCopy} disabled={saving || !hours.days.some(Boolean)} className="min-h-11 w-full whitespace-normal sm:w-auto">
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Apply to every open day
          </Button>
          <Button onClick={onSave} disabled={saving} className="min-h-11 w-full sm:w-auto">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save hours
          </Button>
        </div>
      </fieldset></CardContent>
    </Card>
  );
}
