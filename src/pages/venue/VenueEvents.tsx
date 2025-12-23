import { useState } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useVenueEvents } from '@/hooks/useVenueEvents';
import { CreateEventDialog } from '@/components/venue/CreateEventDialog';
import { EventCard } from '@/components/venue/EventCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Calendar, Clock, Eye, EyeOff } from 'lucide-react';
import { isFuture, isPast } from 'date-fns';

export default function VenueEvents() {
  const { currentVenueId } = useMode();
  const { events, loading, createEvent, deleteEvent, togglePublish, updateEvent } = useVenueEvents(currentVenueId);
  const [activeTab, setActiveTab] = useState('upcoming');

  if (!currentVenueId) {
    return <div className="p-6 text-center text-muted-foreground">No venue selected</div>;
  }

  const upcomingEvents = events.filter(e => isFuture(new Date(e.start_time)));
  const pastEvents = events.filter(e => isPast(new Date(e.start_time)));
  const publishedEvents = events.filter(e => e.is_published);
  const draftEvents = events.filter(e => !e.is_published);

  const getFilteredEvents = () => {
    switch (activeTab) {
      case 'upcoming': return upcomingEvents;
      case 'past': return pastEvents;
      case 'published': return publishedEvents;
      case 'drafts': return draftEvents;
      default: return events;
    }
  };

  const filteredEvents = getFilteredEvents();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Events & Programs</h1>
          <p className="text-muted-foreground">Create clinics, socials, and tournaments to grow your player base</p>
        </div>
        <CreateEventDialog onCreateEvent={createEvent} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="upcoming" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Past ({pastEvents.length})
          </TabsTrigger>
          <TabsTrigger value="published" className="gap-1.5">
            <Eye className="h-4 w-4" />
            Published ({publishedEvents.length})
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-1.5">
            <EyeOff className="h-4 w-4" />
            Drafts ({draftEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No events yet</h3>
                <p className="text-muted-foreground text-sm">
                  {activeTab === 'upcoming' 
                    ? 'Create your first event to attract players and fill your courts.' 
                    : `No ${activeTab} events found.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onTogglePublish={togglePublish}
                  onDelete={deleteEvent}
                  onEdit={updateEvent}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
