import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EventWizardContainer } from '@/components/community/event-wizard/EventWizardContainer';
import type { Court } from '@/lib/venues/availability';

interface VenueEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  venueId: string;
  venueName: string;
  courts: Court[];
  initialDate?: Date | null;
  initialStart?: Date | null;
  initialEnd?: Date | null;
  initialCourtIds?: string[];
  onCreated: () => void;
}

/**
 * One venue-native program creator shared by the public Play surface and the
 * operations calendar. Calendar entry points seed their date/time/courts;
 * venue-page entry points begin with a clean program. The underlying wizard
 * remains shared with communities, but venue mode adds operational fields.
 */
export function VenueEventDialog({
  open,
  onOpenChange,
  groupId,
  venueId,
  venueName,
  courts,
  initialDate,
  initialStart,
  initialEnd,
  initialCourtIds,
  onCreated,
}: VenueEventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bottom-0 left-0 top-auto max-h-[96dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-b-none rounded-t-[26px] border-border/80 p-0 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-h-[92dvh] sm:max-w-[900px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[26px] [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Create venue program</DialogTitle>
          <DialogDescription>
            Schedule courts, player level, capacity, and registration for a venue event.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <EventWizardContainer
            groupId={groupId}
            onClose={() => onOpenChange(false)}
            onSuccess={() => {
              onOpenChange(false);
              onCreated();
            }}
            venue={{
              id: venueId,
              name: venueName,
              courts: courts.filter((court) => court.is_active !== false),
              initialDate,
              initialStart,
              initialEnd,
              initialCourtIds,
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
