import { useState } from 'react';
import { Calendar, Clock, MapPin, Users, Check, HelpCircle, X, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupEmptyState } from './GroupEmptyState';
import { EventWizardContainer } from './event-wizard/EventWizardContainer';
import { useGroupEvents } from '@/hooks/useGroupEvents';

interface GroupScheduleProps {
  groupId: string;
  isAdmin: boolean;
  currentUserId: string | null;
}

export function GroupSchedule({ groupId, isAdmin, currentUserId }: GroupScheduleProps) {
  const { events, loading, deleteEvent, updateRsvp } = useGroupEvents(groupId);
  const [wizardOpen, setWizardOpen] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Event Wizard or Button */}
      {wizardOpen ? (
        <EventWizardContainer
          groupId={groupId}
          onClose={() => setWizardOpen(false)}
          onSuccess={() => setWizardOpen(false)}
        />
      ) : (
        <Button onClick={() => setWizardOpen(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      )}

      {/* Events List */}
      {events.length === 0 && !wizardOpen ? (
        <GroupEmptyState
          icon={Calendar}
          title="No upcoming events"
          description="Schedule a session, round robin, or open play for your group."
          actions={[
            { label: 'Create Event', onClick: () => setWizardOpen(true), icon: Plus },
          ]}
          size="sm"
        />
      ) : (
        events.map((event) => {
          const startDate = new Date(event.start_time);
          const endDate = event.end_time ? new Date(event.end_time) : null;
          const isCreator = currentUserId === event.created_by;
          const totalGoing = event.rsvps?.going || 0;
          const isFull = event.capacity ? totalGoing >= event.capacity : false;

          return (
            <Card key={event.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(startDate, 'EEE, MMM d')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(startDate, 'h:mm a')}
                        {endDate && ` - ${format(endDate, 'h:mm a')}`}
                      </div>
                    </div>
                  </div>
                  {(isCreator || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteEvent(event.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pb-3 space-y-3">
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}

                {event.custom_location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {event.custom_location}
                  </div>
                )}

                {/* RSVP Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{totalGoing}</span>
                    {event.capacity && (
                      <span className="text-muted-foreground">/ {event.capacity}</span>
                    )}
                    <span className="text-muted-foreground">going</span>
                  </div>
                  {event.rsvps?.maybe ? (
                    <div className="text-muted-foreground">
                      {event.rsvps.maybe} maybe
                    </div>
                  ) : null}
                  {isFull && (
                    <Badge variant="secondary">Full</Badge>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-0">
                <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                  <Button
                    variant={event.user_rsvp === 'going' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1 px-2 sm:px-3"
                    onClick={() => updateRsvp(event.id, 'going')}
                    disabled={isFull && event.user_rsvp !== 'going'}
                  >
                    <Check className="h-4 w-4" />
                    <span className="hidden sm:inline">Going</span>
                  </Button>
                  <Button
                    variant={event.user_rsvp === 'maybe' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1 px-2 sm:px-3"
                    onClick={() => updateRsvp(event.id, 'maybe')}
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Maybe</span>
                  </Button>
                  <Button
                    variant={event.user_rsvp === 'not_going' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1 px-2 sm:px-3"
                    onClick={() => updateRsvp(event.id, 'not_going')}
                  >
                    <X className="h-4 w-4" />
                    <span className="hidden sm:inline">Can't Go</span>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })
      )}
    </div>
  );
}
