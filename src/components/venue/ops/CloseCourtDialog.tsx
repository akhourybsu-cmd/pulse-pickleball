import { useEffect, useRef, useState } from 'react';
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
import { closureWindow, defaultClosureTimes } from '@/lib/venues/closures';
import { getErrorCode, getErrorMessage } from '@/lib/getErrorMessage';

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
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const submitting = useRef(false);
  const activeCourts = courts.filter(c => c.is_active !== false);

  useEffect(() => {
    if (!open) { initialized.current = false; return; }
    if (initialized.current || !dayStart || !dayEnd || !activeCourts.length) return;
    initialized.current = true;
    setCourtId(court?.is_active !== false && court ? court.id : activeCourts[0].id);
    setReason(REASONS[0]);
    setError(null);
    const defaults = defaultClosureTimes(dayStart, dayEnd, new Date());
    setFromTime(defaults?.from ?? '');
    setToTime(defaults?.to ?? '');
    // Polling/realtime can replace court and Date objects. Initialize once per
    // opening so a background refresh never destroys an in-progress draft.
  }, [open, court, courts, dayStart, dayEnd]);

  const validation = closureWindow(dayStart, dayEnd, fromTime, toTime, new Date());

  const submit = async () => {
    if (submitting.current || !activeCourts.some(c => c.id === courtId)) return;
    const window = closureWindow(dayStart, dayEnd, fromTime, toTime, new Date());
    if (window.error) { setError(window.error); return; }
    const { start, end } = window;
    submitting.current = true;
    setError(null);
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = auth.user?.id;
      if (!userId) {
        throw new Error('Sign in again before closing a court.');
      }

      const { data, error } = await supabase.from('group_events').insert({
        group_id: groupId,
        venue_id: venueId,
        venue_court_id: courtId,
        title: reason,
        event_format: 'maintenance',
        location_type: 'venue',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        created_by: userId,
      }).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('The closure was not confirmed. Refresh the schedule before trying again.');

      toast({
        title: 'Court closed',
        description: `${reason} · ${formatSlotTime(start)}–${formatSlotTime(end)}`,
      });
      onClosed();
      onOpenChange(false);
    } catch (cause) {
      setError(getErrorCode(cause) === '23P01'
        ? 'This court already has activity in that window. Review the affected sessions before closing it; no bookings were changed.'
        : getErrorMessage(cause, 'Could not close the court. Your draft has been kept.'));
    } finally { submitting.current = false; setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-sans">Close a court</DialogTitle>
          <DialogDescription>
            Block time for maintenance or other work. Closures cannot overlap existing bookings and do not cancel them.
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={saving} className="min-w-0 space-y-4">
          {dayStart && dayEnd && <p className="rounded-xl bg-muted/40 p-3 text-sm leading-6">{dayStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {formatSlotTime(dayStart)}–{formatSlotTime(dayEnd)}</p>}
          <div className="space-y-2">
            <Label htmlFor="close-court">Court</Label>
            <Select disabled={saving} value={courtId} onValueChange={setCourtId}>
              <SelectTrigger id="close-court" className="h-11">
                <SelectValue placeholder="Pick a court" />
              </SelectTrigger>
              <SelectContent>
                {activeCourts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? `Court ${c.court_number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="close-reason">Reason</Label>
            <Select disabled={saving} value={reason} onValueChange={setReason}>
              <SelectTrigger id="close-reason" className="h-11">
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
            <div className="min-w-0 space-y-2">
              <Label htmlFor="close-from">From</Label>
              <Input
                id="close-from"
                type="time"
                className="h-11 min-w-0 px-2"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="close-to">Until</Label>
              <Input
                id="close-to"
                type="time"
                className="h-11 min-w-0 px-2"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
              />
            </div>
          </div>
          {toTime === '00:00' && <p className="text-xs text-muted-foreground">Until midnight · end of this day</p>}
        </fieldset>
        {(error || validation.error || !activeCourts.length) && <p role="alert" className="text-sm text-destructive">{error || (!activeCourts.length ? 'No active courts are available to close.' : validation.error)}</p>}

        <DialogFooter className="gap-2">
          <Button className="min-h-11" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-11" onClick={submit} disabled={saving || !!validation.error || !activeCourts.some(c => c.id === courtId)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Close court
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
