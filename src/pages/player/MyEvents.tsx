import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, X, Trophy, Search } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMyEventRegistrations, RegistrationStatus } from '@/hooks/useEventRegistrations';
import { cn } from '@/lib/utils';

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
    const styles: Record<RegistrationStatus, string> = {
      confirmed: 'bg-primary/10 text-primary border-primary/20',
      pending: 'bg-muted text-muted-foreground',
      waitlisted: 'bg-amber-500/10 text-amber-600 border-amber-200',
      cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
      checked_in: 'bg-primary/10 text-primary border-primary/20',
      no_show: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    const labels: Record<RegistrationStatus, string> = {
      confirmed: 'Confirmed',
      pending: 'Pending',
      waitlisted: 'Waitlist',
      cancelled: 'Cancelled',
      checked_in: 'Checked In',
      no_show: 'No Show',
    };
    return (
      <Badge variant="outline" className={cn('text-xs', styles[status])}>
        {labels[status]}
      </Badge>
    );
  };

  const RegistrationCard = ({ registration }: { registration: EventRegistration }) => {
    const event = registration.event;
    if (!event) return null;

    const eventDate = new Date(event.start_time);
    const isUpcoming = isFuture(eventDate);

    return (
      <div className="card-premium p-4">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate tracking-tight">{event.title}</h4>
            <p className="text-xs text-muted-foreground capitalize">{event.event_type.replace('_', ' ')}</p>
          </div>
          {getStatusBadge(registration.status)}
        </div>

        <div className="text-xs text-muted-foreground space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground/70" />
            <span>{format(eventDate, 'EEE, MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground/70" />
            <span>
              {format(eventDate, 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
            </span>
          </div>
        </div>

        {isUpcoming && (registration.status === 'confirmed' || registration.status === 'waitlisted' || registration.status === 'pending') && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/5 btn-premium"
            onClick={() => cancelRegistration.mutate(registration.id)}
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="page-title">My Events</h1>
        <p className="page-subtitle mt-0.5">Your registrations and upcoming events</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="h-9 mb-4 bg-muted/40 p-0.5 rounded-lg">
            <TabsTrigger value="upcoming" className="text-xs font-medium rounded-md data-[state=active]:shadow-sm">
              Upcoming ({upcomingRegistrations.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="text-xs font-medium rounded-md data-[state=active]:shadow-sm">
              Past ({pastRegistrations.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs font-medium rounded-md data-[state=active]:shadow-sm">
              Cancelled ({cancelledRegistrations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3 mt-0">
            {upcomingRegistrations.length > 0 ? (
              upcomingRegistrations.map(reg => (
                <RegistrationCard key={reg.id} registration={reg} />
              ))
            ) : (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <h3 className="text-base font-medium mb-1">No upcoming events</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Browse events to find something near you
                </p>
                <Button size="sm" onClick={() => navigate('/player/find')}>
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Find Events
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3 mt-0">
            {pastRegistrations.length > 0 ? (
              pastRegistrations.map(reg => (
                <RegistrationCard key={reg.id} registration={reg} />
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">No past events</p>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-3 mt-0">
            {cancelledRegistrations.length > 0 ? (
              cancelledRegistrations.map(reg => (
                <RegistrationCard key={reg.id} registration={reg} />
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">No cancelled registrations</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
