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
import {
  DAY_NAMES,
  SLOT_CHOICES,
  defaultVenueHours,
  formatTime,
  parseTime,
  parseVenueHours,
  serializeVenueHours,
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
  const [hours, setHours] = useState<VenueHours>(defaultVenueHours);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('venues')
        .select('hours_of_operation')
        .eq('id', venueId)
        .single();

      if (cancelled) return;
      if (error) {
        toast({ title: 'Error loading hours', description: error.message, variant: 'destructive' });
      } else {
        setHours(parseVenueHours(data?.hours_of_operation));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [venueId, toast]);

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
    // A day whose close is not after its open cannot hold a slot, so it is
    // rejected here rather than silently normalised into an empty grid.
    const broken = hours.days.findIndex((d) => d !== null && d.closeMinutes <= d.openMinutes);
    if (broken !== -1) {
      toast({
        title: `Check ${DAY_NAMES[broken]}`,
        description: 'Closing time has to be after opening time.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('venues')
      .update({ hours_of_operation: serializeVenueHours(hours) as never })
      .eq('id', venueId);
    setSaving(false);

    if (error) {
      toast({ title: 'Could not save hours', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Hours updated' });
  };

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Opening Hours</CardTitle>
        <CardDescription>
          When courts can be booked, and how long a booking block is.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="slot-length">Booking block</Label>
          <Select
            value={String(hours.slotMinutes)}
            onValueChange={(v) => setHours((h) => ({ ...h, slotMinutes: Number(v) }))}
          >
            <SelectTrigger id="slot-length" className="sm:w-[200px]">
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
                  'flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2',
                  !open && 'bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'w-10 shrink-0 text-sm font-semibold',
                    !open && 'text-muted-foreground',
                  )}
                >
                  {DAY_NAMES[i]}
                </span>

                <Switch
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
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      className="h-9 w-[110px]"
                      value={formatTime(day.openMinutes)}
                      aria-label={`${DAY_NAMES[i]} opening time`}
                      onChange={(e) => {
                        const parsed = parseTime(e.target.value);
                        if (parsed !== null) setDay(i, { ...day, openMinutes: parsed });
                      }}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      className="h-9 w-[110px]"
                      value={formatTime(day.closeMinutes)}
                      aria-label={`${DAY_NAMES[i]} closing time`}
                      onChange={(e) => {
                        const parsed = parseTime(e.target.value);
                        if (parsed !== null) setDay(i, { ...day, closeMinutes: parsed });
                      }}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Closed</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={applyToAll}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Apply to every open day
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save hours
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
