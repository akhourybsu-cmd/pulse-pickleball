import { useMode } from '@/contexts/ModeContext';
import { useVenueEvents } from '@/hooks/useVenueEvents';
import { CreateEventDialog } from '@/components/venue/CreateEventDialog';
import { EventCard } from '@/components/venue/EventCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

export default function VenueEvents() {
  const { currentVenueId } = useMode();
  const { events, loading, createEvent, deleteEvent, togglePublish } = useVenueEvents(currentVenueId);

  if (!currentVenueId) {
    return <div className="p-6 text-center text-muted-foreground">No venue selected</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground">Create and manage venue events</p>
        </div>
        <CreateEventDialog onCreateEvent={createEvent} />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground text-sm">Create your first event to attract players</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onTogglePublish={togglePublish}
              onDelete={deleteEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
