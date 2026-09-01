import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Clock } from 'lucide-react';
import { formatSlotTime, type Court } from '@/lib/venues/availability';

/**
 * Hold a court.
 *
 * A reservation is written as a `group_events` row with `event_format` of
 * 'reservation' and a `venue_court_id`, so it is the same object as every other
 * session: it can carry RSVPs, it shows up in Pulse, and it can be turned into
 * a round robin whose results count.
 */

interface BookCourtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  venueId: string;
  court: Court | null;
  start: Date | null;
  /** Slot length, used to seed the duration picker. */
  slotMinutes: number;
  /** Latest end the venue allows, so a booking can't run past closing. */
  dayEnd: Date | null;
  onBooked: () => void;
}

export function BookCourtDialog({
  open,
  onOpenChange,
  groupId,
  venueId,
  court,
  start,
  slotMinutes,
  dayEnd,
  onBooked,
}: BookCourtDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(slotMinutes);

  useEffect(() => {
    if (open) {
      setTitle('');
      setMinutes(slotMinutes);
    }
  }, [open, slotMinutes]);

  // Only offer durations that actually fit before closing — a picker that
  // lets you choose 2 hours at 9pm and then fails on save is worse than one
  // that never offers it.
  const maxMinutes =
    start && dayEnd ? Math.max(slotMinutes, (dayEnd.getTime() - start.getTime()) / 60000) : 240;
  const durations = [30, 60, 90, 120, 180].filter(
    (m) => m >= Math.min(30, slotMinutes) && m <= maxMinutes,
  );
  const options = durations.length > 0 ? durations : [slotMinutes];

  const end = start ? new Date(start.getTime() + minutes * 60000) : null;

  const submit = async () => {
    if (!court || !start || !end) return;

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('group_events').insert({
      group_id: groupId,
      venue_id: venueId,
      venue_court_id: court.id,
      title: title.trim() || `Court ${court.court_number ?? ''}`.trim(),
      event_format: 'reservation',
      location_type: 'venue',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      created_by: userId,
    });

    setSaving(false);

    if (error) {
      // 23P01 is the exclusion constraint: somebody took this court for an
      // overlapping time between the grid rendering and this insert. That is a
      // normal race, not a fault, so it gets a plain explanation and a refresh
      // rather than a raw Postgres message.
      if (error.code === '23P01') {
        toast({
          title: 'Just taken',
          description: 'Someone booked this court for that time. Pick another slot.',
          variant: 'destructive',
        });
        onBooked();
        onOpenChange(false);
        return;
      }
      toast({
        title: 'Could not book',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Court booked',
      description: `${court.name ?? `Court ${court.court_number}`} · ${formatSlotTime(
        start,
      )}–${formatSlotTime(end)}`,
    });
    onBooked();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Book {court?.name ?? `Court ${court?.court_number ?? ''}`}</DialogTitle>
          <DialogDescription>
            {start && end ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                {' · '}
                {formatSlotTime(start)}–{formatSlotTime(end)}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="booking-duration">Duration</Label>
            <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
              <SelectTrigger id="booking-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m < 60
                      ? `${m} min`
                      : m % 60 === 0
                        ? `${m / 60} hour${m === 60 ? '' : 's'}`
                        : `${Math.floor(m / 60)}h ${m % 60}m`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-title">What for? (optional)</Label>
            <Input
              id="booking-title"
              placeholder="Doubles with the Tuesday crew"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Named bookings show on the court grid, so members know what's on.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !court || !start}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Book court
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
