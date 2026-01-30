import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, MapPin, X, Search } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { usePlayerBookings } from '@/hooks/usePlayerBookings';
import { cn } from '@/lib/utils';

export default function MyBookings() {
  const navigate = useNavigate();
  const { bookings, loading, cancelBooking } = usePlayerBookings();

  const upcomingBookings = bookings.filter(b => 
    isFuture(new Date(b.start_time)) && b.status !== 'cancelled'
  );
  const pastBookings = bookings.filter(b => 
    isPast(new Date(b.end_time)) || b.status === 'completed'
  );
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      confirmed: 'bg-primary/10 text-primary border-primary/20',
      pending: 'bg-amber-500/10 text-amber-600 border-amber-200',
      cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
      completed: 'bg-muted text-muted-foreground',
    };
    const labels: Record<string, string> = {
      confirmed: 'Confirmed',
      pending: 'Pending',
      cancelled: 'Cancelled',
      completed: 'Completed',
    };
    return (
      <Badge variant="outline" className={cn('text-xs', styles[status] || 'bg-muted text-muted-foreground')}>
        {labels[status] || status}
      </Badge>
    );
  };

  const BookingCard = ({ booking }: { booking: typeof bookings[0] }) => {
    const bookingDate = new Date(booking.start_time);
    const isUpcoming = isFuture(bookingDate);

    return (
      <div className="p-4 rounded-xl bg-card border border-border/30 hover:border-border/50 transition-colors">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{booking.venue?.name || 'Venue'}</h4>
            <p className="text-xs text-muted-foreground">
              {booking.court?.name || 'Court'} (Court {booking.court?.court_number})
            </p>
          </div>
          {getStatusBadge(booking.status)}
        </div>

        <div className="text-xs text-muted-foreground space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            <span>{format(bookingDate, 'EEE, MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>
              {format(bookingDate, 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}
            </span>
          </div>
          {booking.venue?.address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{booking.venue.city}, {booking.venue.state}</span>
            </div>
          )}
        </div>

        {booking.total_price && (
          <p className="text-sm font-medium mb-3">${booking.total_price.toFixed(2)}</p>
        )}

        {isUpcoming && (booking.status === 'pending' || booking.status === 'confirmed') && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
            onClick={() => cancelBooking(booking.id)}
          >
            <X className="h-3 w-3 mr-1" />
            Cancel Reservation
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">My Bookings</h1>
        <p className="text-sm text-muted-foreground">Your court reservations</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="h-9 mb-4 bg-muted/30">
            <TabsTrigger value="upcoming" className="text-xs">
              Upcoming ({upcomingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="text-xs">
              Past ({pastBookings.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">
              Cancelled ({cancelledBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3 mt-0">
            {upcomingBookings.length > 0 ? (
              upcomingBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <h3 className="text-base font-medium mb-1">No upcoming reservations</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Find a venue and book your next session
                </p>
                <Button size="sm" onClick={() => navigate('/player/venues')}>
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Find a Venue
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3 mt-0">
            {pastBookings.length > 0 ? (
              pastBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">No past reservations</p>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-3 mt-0">
            {cancelledBookings.length > 0 ? (
              cancelledBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">No cancelled reservations</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
