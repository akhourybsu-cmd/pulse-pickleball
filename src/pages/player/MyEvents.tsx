import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, MapPin, X, Trophy } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { useEventRegistration } from '@/hooks/useEventRegistration';

export default function MyEvents() {
  const { registrations, loading, cancelRegistration } = useEventRegistration();

  const upcomingRegistrations = registrations.filter(r => 
    r.event && isFuture(new Date(r.event.start_time)) && r.status !== 'cancelled'
  );
  const pastRegistrations = registrations.filter(r => 
    r.event && (isPast(new Date(r.event.end_time)) || r.status === 'attended')
  );
  const cancelledRegistrations = registrations.filter(r => r.status === 'cancelled');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return <Badge className="bg-green-500">Registered</Badge>;
      case 'waitlisted':
        return <Badge variant="secondary">Waitlisted</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'attended':
        return <Badge variant="outline">Attended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const RegistrationCard = ({ registration }: { registration: typeof registrations[0] }) => {
    const event = registration.event;
    if (!event) return null;

    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-medium">{event.title}</h4>
              <p className="text-sm text-muted-foreground">{event.venue?.name || 'Venue'}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {getStatusBadge(registration.status)}
              <Badge variant="outline" className="text-xs">{event.event_type}</Badge>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-1 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(event.start_time), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>
                {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
              </span>
            </div>
            {event.venue?.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                <span>{event.venue.address}</span>
              </div>
            )}
          </div>

          {event.price && event.price > 0 && (
            <p className="text-sm font-medium mb-3">${event.price}</p>
          )}

          {(registration.status === 'registered' || registration.status === 'waitlisted') && 
            isFuture(new Date(event.start_time)) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => cancelRegistration(registration.id)}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel Registration
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          My Events
        </h1>
        <p className="text-muted-foreground">View and manage your event registrations</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="mb-4">
            <TabsTrigger value="upcoming">Upcoming ({upcomingRegistrations.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastRegistrations.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelledRegistrations.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingRegistrations.length > 0 ? (
              upcomingRegistrations.map(reg => (
                <RegistrationCard key={reg.id} registration={reg} />
              ))
            ) : (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No upcoming events</h3>
                <p className="text-muted-foreground">Discover venues and register for events</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastRegistrations.length > 0 ? (
              pastRegistrations.map(reg => (
                <RegistrationCard key={reg.id} registration={reg} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No past events</p>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledRegistrations.length > 0 ? (
              cancelledRegistrations.map(reg => (
                <RegistrationCard key={reg.id} registration={reg} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No cancelled registrations</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
