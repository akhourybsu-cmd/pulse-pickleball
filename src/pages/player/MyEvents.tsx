import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, MapPin, X, Trophy, Search } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMyEventRegistrations, RegistrationStatus } from '@/hooks/useEventRegistrations';

interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  registered_at: string | null;
  event?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    event_type: string;
    venue_id: string | null;
    host_venue_id: string | null;
  } | null;
}

export default function MyEvents() {
  const navigate = useNavigate();
  const { registrations, isLoading, cancelRegistration } = useMyEventRegistrations();

  const typedRegistrations = registrations as EventRegistration[];

  const upcomingRegistrations = typedRegistrations.filter(r => 
    r.event && isFuture(new Date(r.event.start_time)) && r.status !== 'cancelled'
  );
  const pastRegistrations = typedRegistrations.filter(r => 
    r.event && isPast(new Date(r.event.end_time))
  );
  const cancelledRegistrations = typedRegistrations.filter(r => r.status === 'cancelled');

  const getStatusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'waitlisted':
        return <Badge variant="secondary">On Waitlist</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'checked_in':
        return <Badge variant="outline">Checked In</Badge>;
      case 'no_show':
        return <Badge variant="destructive">No Show</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const RegistrationCard = ({ registration }: { registration: EventRegistration }) => {
    const event = registration.event;
    if (!event) return null;

    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-medium">{event.title}</h4>
              <p className="text-sm text-muted-foreground">Event</p>
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
          </div>

          {(registration.status === 'confirmed' || registration.status === 'waitlisted' || registration.status === 'pending') && 
            isFuture(new Date(event.start_time)) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => cancelRegistration.mutate(registration.id)}
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Event Registrations</h1>
          <p className="text-muted-foreground">Your clinics, tournaments, and social play events</p>
        </div>
      </div>

      {isLoading ? (
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
                <p className="text-muted-foreground mb-4">
                  Looking for clinics, round robins, or tournaments? Browse venues to find events near you.
                </p>
                <Button onClick={() => navigate('/player/venues')}>
                  <Search className="h-4 w-4 mr-2" />
                  Browse Events
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastRegistrations.length > 0 ? (
              pastRegistrations.map(reg => (
                <RegistrationCard key={reg.id} registration={reg} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No past events yet</p>
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
