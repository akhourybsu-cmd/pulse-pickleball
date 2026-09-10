import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { formatMoney, openStripe, paymentApi, type CourtQuote, type PaymentConfig } from '@/lib/payments';
import { bookingDurationOptions, isBookingRangeValid } from '@/lib/venues/experience';
import { useAuthState } from '@/hooks/useAuthState';

/**
 * Hold a court.
 *
 * A reservation is written as a `group_events` row with `event_format` of
 * 'reservation' and a `venue_court_id`, so it is the same object as every other
 * session: it can carry RSVPs, it shows up in Pulse, and it can be turned into
 * a round robin whose results count.
 */

interface BookCourtDialogProps {
  timeZone?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  venueId: string;
  court: Court | null;
  start: Date | null;
  /** Slot length, used to seed the duration picker. */
  slotMinutes: number;
  /**
   * Length the viewer already chose by selecting a range on the grid. When set,
   * the dialog confirms that span instead of asking again — re-asking after
   * someone has just dragged out 4:00-6:00 is the kind of double work that
   * makes booking flows feel bureaucratic.
   */
  presetMinutes?: number | null;
  /** End of contiguous availability: closing time or the next occupied slot. */
  dayEnd: Date | null;
  onBooked: () => void;
}

export function BookCourtDialog({
  timeZone,
  open,
  onOpenChange,
  groupId,
  venueId,
  court,
  start,
  slotMinutes,
  presetMinutes,
  dayEnd,
  onBooked,
}: BookCourtDialogProps) {
  const { toast } = useToast();
  const { user } = useAuthState();
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const scope = `${venueId}:${court?.id}:${start?.toISOString()}:${user?.id}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(slotMinutes);
  const [accepted, setAccepted] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const paymentDetails = useQuery({
    queryKey: ['court-payment-details', court?.id, groupId, user?.id],
    queryFn: () => paymentApi<PaymentConfig & { paid: boolean; hourly_rate: number }>('booking_details', { court_id: court?.id, group_id: groupId }),
    enabled: open && !!court && !!user, staleTime: 0,
  });

  useEffect(() => {
    if (open) {
      setTitle('');
      setMinutes(presetMinutes && presetMinutes > 0 ? presetMinutes : slotMinutes);
      setAccepted(false);
      setRequestKey(crypto.randomUUID());
    }
    setCheckoutError(null);
  }, [open, slotMinutes, presetMinutes, scope]);

  const spanChosen = !!presetMinutes && presetMinutes > 0;

  // Never offer a duration past the next occupied slot or closing time.
  const maxMinutes =
    start && dayEnd ? Math.max(0, (dayEnd.getTime() - start.getTime()) / 60000) : 0;
  const options = bookingDurationOptions(slotMinutes, maxMinutes).filter(duration => !paymentDetails.data?.paid || (duration <= 240 && duration % 30 === 0));

  const end = start ? new Date(start.getTime() + minutes * 60000) : null;
  const validRange = court?.is_active !== false && isBookingRangeValid(start, minutes, dayEnd);
  const quote = useQuery({
    queryKey: ['court-quote', court?.id, groupId, start?.toISOString(), end?.toISOString(), user?.id],
    queryFn: () => paymentApi<CourtQuote>('quote', { court_id: court?.id, group_id: groupId, start_time: start?.toISOString(), end_time: end?.toISOString() }),
    enabled: open && !!court && validRange && !!paymentDetails.data?.paid, staleTime: 0, retry: false,
  });
  useEffect(() => { setAccepted(false); setRequestKey(crypto.randomUUID()); }, [minutes, start?.toISOString(), court?.id, quote.data?.amount_cents, quote.data?.policy]);

  const submit = async () => {
    if (lock.current || saving || !court || court.is_active === false || !start || !end || !isBookingRangeValid(start, minutes, dayEnd)) return;
    if (!paymentDetails.data || paymentDetails.isFetching || paymentDetails.isError) return;

    lock.current = true;
    setSaving(true);
    setCheckoutError(null);
    if (paymentDetails.data?.paid) {
      try {
        if (!quote.data || !accepted || quote.isError || quote.isFetching) throw new Error('Review the confirmed total and cancellation policy first.');
        const result = await paymentApi<{ url: string }>('court_checkout', { court_id: court.id, group_id: groupId,
          start_time: start.toISOString(), end_time: end.toISOString(), amount_cents: quote.data.amount_cents,
          policy: quote.data.policy, accept_terms: accepted, request_key: requestKey });
        if (currentScope.current !== scope) return;
        if (!result?.url) throw new Error('Checkout was not confirmed. Retry or check Payments & purchases before starting another booking.');
        openStripe(result.url);
      } catch (error) { if (currentScope.current === scope) { setCheckoutError((error as Error).message); toast({ title: 'Checkout not started', description: (error as Error).message, variant: 'destructive' }); } }
      finally { lock.current = false; setSaving(false); }
      return;
    }
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
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
          start, timeZone,
        )}–${formatSlotTime(end, timeZone)}`,
      });
      onBooked();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Could not book', description: error instanceof Error ? error.message : 'Please check your connection and try again.', variant: 'destructive' });
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl font-sans sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-sans">Book {court?.name ?? `Court ${court?.court_number ?? ''}`}</DialogTitle>
          <DialogDescription>
            {start && end ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', timeZone: timeZone || undefined })}
                {' · '}
                {formatSlotTime(start, timeZone)}–{formatSlotTime(end, timeZone)}{timeZone ? ' · Venue time' : ''}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!validRange && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">This time is no longer available for the selected duration. Choose a shorter duration, or return to the calendar for another time.</p>}
          <div className={cn('space-y-2', spanChosen && 'hidden')}>
            <Label htmlFor="booking-duration">Duration</Label>
            <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
              <SelectTrigger id="booking-duration" disabled={saving}>
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
            <Label htmlFor="booking-title">What for? (optional, free bookings only)</Label>
            <Input
              id="booking-title"
              placeholder="Doubles with the Tuesday crew"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              disabled={saving || paymentDetails.data?.paid}
            />
            <p className="text-xs text-muted-foreground">
              Named bookings show on the court grid, so members know what's on.
            </p>
          </div>
          {paymentDetails.isPending || paymentDetails.isFetching ? <p role="status" className="text-sm text-muted-foreground">Checking the booking price…</p> : paymentDetails.isError ? <div role="alert" className="rounded-xl border p-3 text-sm"><p>We couldn’t verify the booking price. Please retry before booking.</p><Button variant="link" onClick={() => paymentDetails.refetch()}>Retry</Button></div> : paymentDetails.data?.paid ? <div className="space-y-4">
            {quote.isPending || quote.isFetching ? <p role="status" className="text-sm">Preparing your price…</p> : quote.isError ? <div role="alert" className="rounded-xl border p-3 text-sm"><p>{quote.error.message}</p><Button variant="link" onClick={() => quote.refetch()}>Check again</Button></div> : quote.data && <>
              <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs font-medium text-muted-foreground">Paid to {quote.data.merchant_name}</p><div className="mt-2 flex items-end justify-between gap-3"><span className="text-sm">Court rental · {minutes} minutes</span><span className="text-2xl font-semibold tabular-nums">{formatMoney(quote.data.amount_cents)}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">USD · {formatMoney(Math.round(quote.data.hourly_rate * 100))}/hour. Includes any applicable taxes. No PULSE booking surcharge.</p></div>
              <div><p className="text-sm font-semibold">Cancellation & refund policy</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{quote.data.policy}</p><p className="mt-2 break-all text-xs text-muted-foreground">Questions: {quote.data.support_email}</p></div>
              <p className="rounded-xl bg-muted/30 p-3 text-sm leading-6">Venue time: {start?.toLocaleString([], { timeZone: quote.data.timezone, dateStyle: 'medium', timeStyle: 'short' })} – {end?.toLocaleTimeString([], { timeZone: quote.data.timezone, hour: 'numeric', minute: '2-digit' })} ({quote.data.timezone}). Confirm this local venue time before paying.</p>
              <label className="flex items-start gap-3 text-sm leading-6"><Checkbox disabled={saving} checked={accepted} onCheckedChange={value => setAccepted(value === true)} className="mt-1" /><span>I agree to pay {formatMoney(quote.data.amount_cents)} to {quote.data.merchant_name} and accept this cancellation policy.</span></label>
              <p className="text-xs leading-5 text-muted-foreground">Your court is held during secure checkout and confirmed only after successful payment. Returning without paying does not complete the booking.</p>
            </>}
          </div> : <p className="rounded-xl bg-muted/30 p-3 text-sm">Free reservation · No payment required</p>}
        </div>

        {paymentDetails.data?.paid && <p className="text-xs leading-5 text-muted-foreground">Paid reservations use 30-minute increments, up to four hours, with at least 35 minutes’ notice. A failed or paused checkout does not create a free booking.</p>}
        {checkoutError && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm">{checkoutError}</p>}
        <DialogFooter>
          <Button className="min-h-11" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-11" onClick={submit} disabled={saving || !court || !validRange || !paymentDetails.data || paymentDetails.isPending || paymentDetails.isFetching || paymentDetails.isError || (paymentDetails.data?.paid && (!accepted || !quote.data || quote.isFetching || quote.isError))}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {paymentDetails.data?.paid ? `Pay ${quote.data ? formatMoney(quote.data.amount_cents) : ''} & reserve` : 'Book free court'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
