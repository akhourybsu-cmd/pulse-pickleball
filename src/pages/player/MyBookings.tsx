import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CalendarX2, Clock, LayoutGrid, Loader2, MapPin, Ticket, Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useMyBookings } from '@/hooks/useMyBookings';
import { formatDayLabel, groupByDay, type BookingEntry } from '@/lib/venues/bookings';
import { formatSlotTime } from '@/lib/venues/availability';

/**
 * Everything the player has booked.
 *
 * Court holds and event sign-ups appear on one list, because a player does not
 * think of them as different things — both are "I am playing at this time", and
 * separating them is how people end up double-booked.
 *
 * Grouped by day rather than shown as a flat list: the useful question is
 * "what have I got on Saturday", not "what is my 14th booking".
 */
export default function MyBookings() {
  const navigate = useNavigate();
  const { upcoming, past, loading, refresh } = useMyBookings();

  return (
    <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 pb-3 pt-[calc(0.6rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1 h-9 w-9 shrink-0 rounded-full"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-lg font-bold leading-tight">My Bookings</h1>
        </div>
      </header>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-card p-1">
          <TabsTrigger
            value="upcoming"
            className="gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Upcoming
            {upcoming.length > 0 && (
              <span className="tabular-nums opacity-80">{upcoming.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-md px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            History
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          <TabsContent value="upcoming" className="mt-0">
            {loading ? (
              <BookingSkeleton />
            ) : upcoming.length === 0 ? (
              <EmptyUpcoming onFind={() => navigate('/player/community')} />
            ) : (
              <BookingList entries={upcoming} onChanged={refresh} cancellable />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {loading ? (
              <BookingSkeleton />
            ) : past.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
                <CalendarX2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-semibold">Nothing yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sessions you've played will show up here.
                </p>
              </div>
            ) : (
              <BookingList entries={past} onChanged={refresh} />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function BookingSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
      ))}
    </div>
  );
}

function EmptyUpcoming({ onFind }: { onFind: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <Ticket className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm font-semibold">Nothing booked</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Book a court or join a session at one of your venues.
      </p>
      <Button size="sm" className="mt-4" onClick={onFind}>
        Find a venue
      </Button>
    </div>
  );
}

function BookingList({
  entries,
  onChanged,
  cancellable = false,
}: {
  entries: BookingEntry[];
  onChanged: () => void;
  cancellable?: boolean;
}) {
  const groups = groupByDay(entries);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.day.toISOString()} className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {formatDayLabel(group.day)}
          </h2>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <BookingCard
                key={entry.id}
                entry={entry}
                onChanged={onChanged}
                cancellable={cancellable}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BookingCard({
  entry,
  onChanged,
  cancellable,
}: {
  entry: BookingEntry;
  onChanged: () => void;
  cancellable: boolean;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [working, setWorking] = useState(false);

  const held = entry.kind === 'reservation';
  const waitlisted = entry.rsvpStatus === 'waitlist';

  const cancel = async () => {
    setWorking(true);

    // Cancelling means different things for the two kinds. Deleting a court you
    // hold frees it; for a session someone else is running you only withdraw
    // your own place, and deleting their event would be wildly wrong.
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;

    const { error } = held
      ? await supabase.from('group_events').delete().eq('id', entry.id)
      : await supabase
          .from('group_event_rsvps')
          .delete()
          .eq('event_id', entry.id)
          .eq('user_id', userId ?? '');

    setWorking(false);

    if (error) {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: held ? 'Booking cancelled' : 'Left session',
      description: held ? 'The court is free again.' : 'Your place has been given up.',
    });
    onChanged();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatSlotTime(entry.start)}
          {entry.end ? ` – ${formatSlotTime(entry.end)}` : ''}
        </span>

        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-[10px] font-bold uppercase tracking-[0.1em]',
            waitlisted && 'border-amber-500/40 text-amber-600 dark:text-amber-400',
          )}
        >
          {held ? 'Court held' : waitlisted ? 'Waitlist' : 'Going'}
        </Badge>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/player/community/group/${entry.groupId}`)}
        className="mt-1 block w-full truncate text-left text-base font-bold leading-tight hover:underline"
      >
        {entry.title}
      </button>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {entry.venueName && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{entry.venueName}</span>
          </span>
        )}
        {entry.courtName && (
          <span className="inline-flex items-center gap-1">
            <LayoutGrid className="h-3 w-3" />
            {entry.courtName}
          </span>
        )}
      </div>

      {cancellable && (
        <div className="mt-2.5 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" disabled={working}>
                {working ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {held ? 'Cancel booking' : 'Leave session'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {held ? 'Cancel this booking?' : 'Leave this session?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {held
                    ? 'The court goes back on the grid for anyone to take.'
                    : 'Your place is given up, and someone on the waitlist may take it.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  onClick={cancel}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {held ? 'Cancel booking' : 'Leave'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
