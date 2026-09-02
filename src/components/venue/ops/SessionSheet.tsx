import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Clock, LayoutGrid, Loader2, Trash2, Users } from 'lucide-react';
import { formatSlotTime, type Court } from '@/lib/venues/availability';
import { isBlock, isReservationSession } from '@/lib/venues/ops';
import type { VenueDaySession } from '@/hooks/useVenueDay';

/**
 * What's on a court, and what staff can do about it.
 *
 * Cancelling is behind a confirmation because it is destructive and, for a
 * reservation, it is destructive to somebody else's plans — the player who
 * booked it does not get a say from here.
 */

interface SessionSheetProps {
  session: VenueDaySession | null;
  court: Court | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function SessionSheet({
  session,
  court,
  open,
  onOpenChange,
  onChanged,
}: SessionSheetProps) {
  const { toast } = useToast();
  const [working, setWorking] = useState(false);

  if (!session) return null;

  const blocked = isBlock(session);
  const reservation = isReservationSession(session);
  const programHold = session.event_format === 'program_hold' && !!session.parent_event_id;
  const start = new Date(session.start_time);
  const end = session.end_time ? new Date(session.end_time) : null;

  const cancel = async () => {
    setWorking(true);
    // A multi-court program is represented by one public parent plus a small
    // hold on every selected court. Cancelling from any court removes the
    // parent; cascading releases every court and avoids half-cancelled events.
    const targetId = programHold ? session.parent_event_id! : session.id;
    const { error } = await supabase.from('group_events').delete().eq('id', targetId);
    setWorking(false);

    if (error) {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: blocked ? 'Court reopened' : 'Session cancelled',
      description: blocked
        ? 'The court is bookable again for that window.'
        : 'The slot is free again.',
    });
    onChanged();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {session.title || (blocked ? 'Closed' : 'Booked')}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatSlotTime(start)}
                  {end ? `–${formatSlotTime(end)}` : ''}
                </span>
                {court && (
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {court.name ?? `Court ${court.court_number}`}
                  </span>
                )}
                {session.capacity != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {session.capacity} spots
                  </span>
                )}
              </SheetDescription>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {blocked ? 'Closure' : reservation ? 'Reservation' : 'Programming'}
            </Badge>
          </div>
        </SheetHeader>

        {session.description && (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
            {session.description}
          </p>
        )}

        <div className="mt-5 flex justify-end pb-[env(safe-area-inset-bottom)]">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={working}>
                {working ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {blocked ? 'Reopen court' : 'Cancel session'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {blocked ? 'Reopen this court?' : 'Cancel this session?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {blocked
                    ? 'The court becomes bookable again for that window.'
                    : reservation
                      ? "This frees the court. Whoever booked it isn't asked first, so tell them."
                      : programHold
                        ? 'This cancels the full program, releases every court assigned to it, and removes all registrations.'
                        : 'This removes the session and frees the court. Anyone signed up loses their place.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  onClick={cancel}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {blocked ? 'Reopen' : 'Cancel session'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
