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
import { Loader2 } from 'lucide-react';
import { formatSlotTime, type Court } from '@/lib/venues/availability';

/**
 * Take a court out of play.
 *
 * A closure is written as a `group_events` row with `event_format` of
 * 'maintenance', so it occupies the court exactly the way a booking does — the
 * grid stops offering it and the double-booking constraint protects it — while
 * never appearing on Play as something to join.
 */

interface CloseCourtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  venueId: string;
  court: Court | null;
  courts: Court[];
  /** Bounds of the day being viewed, so a closure can't run past closing. */
  dayStart: Date | null;
  dayEnd: Date | null;
  onClosed: () => void;
}

const REASONS = ['Maintenance', 'Resurfacing', 'Private event', 'Weather', 'Staff shortage'];

export function CloseCourtDialog({
  open,
  onOpenChange,
  groupId,
  venueId,
  court,
  courts,
  dayStart,
  dayEnd,
  onClosed,
}: CloseCourtDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [courtId, setCourtId] = useState<string>('');
  const [reason, setReason] = useState(REASONS[0]);
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');

  useEffect(() => {
    if (!open) return;
    setCourtId(court?.id ?? courts[0]?.id ?? '');
    setReason(REASONS[0]);

    // Default to the rest of the day from the next whole hour — the shape a
    // closure almost always takes when something has just gone wrong.
    const start = dayStart ? new Date(dayStart) : new Date();
    const now = new Date();
    const from = now > start ? now : start;
    from.setMinutes(0, 0, 0);
    if (from < now) from.setHours(from.getHours() + 1);

    setFromTime(toLocalTimeValue(from));
    setToTime(dayEnd ? toLocalTimeValue(dayEnd) : '22:00');
  }, [open, court, courts, dayStart, dayEnd]);

  const submit = async () => {
    if (!courtId || !dayStart) return;

    const start = fromLocalTimeValue(dayStart, fromTime);
    const end = fromLocalTimeValue(dayStart, toTime);

    if (!start || !end || end <= start) {
      toast({
        title: 'Check the times',
        description: 'The end of a closure has to be after its start.',
        variant: 'destructive',
      });
      return;
    }

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
      venue_court_id: courtId,
      title: reason,
      event_format: 'maintenance',
      location_type: 'venue',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      created_by: userId,
    });

    setSaving(false);

    if (error) {
      // The court already has something on it for part of that window. Closing
      // over a booking would strand whoever holds it, so this refuses rather
      // than silently displacing them.
      if (error.code === '23P01') {
        toast({
          title: 'Something is already on that court',
          description:
            'Cancel the sessions in that window first, then close the court.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Could not close court', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Court closed',
      description: `${reason} · ${formatSlotTime(start)}–${formatSlotTime(end)}`,
    });
    onClosed();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Close a court</DialogTitle>
          <DialogDescription>
            The court stops being bookable for this window. Existing bookings are not
            affected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="close-court">Court</Label>
            <Select value={courtId} onValueChange={setCourtId}>
              <SelectTrigger id="close-court">
                <SelectValue placeholder="Pick a court" />
              </SelectTrigger>
              <SelectContent>
                {courts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? `Court ${c.court_number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="close-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="close-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Shown on the court grid, so members can see why it's unavailable.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="close-from">From</Label>
              <Input
                id="close-from"
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-to">Until</Label>
              <Input
                id="close-to"
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !courtId}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Close court
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Date → "HH:MM" for a native time input, in local time. */
function toLocalTimeValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * "HH:MM" back onto a given day, in local time.
 *
 * Built by setting local hours on the day rather than by parsing a combined
 * string, so a closure on a daylight-saving day lands on the wall-clock time
 * the operator typed.
 */
function fromLocalTimeValue(day: Date, value: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;

  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(hours * 60 + minutes);
  return d;
}
