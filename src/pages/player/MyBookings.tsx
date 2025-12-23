import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, MapPin, X, Search } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { usePlayerBookings } from '@/hooks/usePlayerBookings';

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
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending Confirmation</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const BookingCard = ({ booking }: { booking: typeof bookings[0] }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="font-medium">{booking.venue?.name || 'Venue'}</h4>
            <p className="text-sm text-muted-foreground">
              {booking.court?.name || 'Court'} (Court {booking.court?.court_number})
            </p>
          </div>
          {getStatusBadge(booking.status)}
        </div>

        <div className="text-sm text-muted-foreground space-y-1 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(booking.start_time), 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>
              {format(new Date(booking.start_time), 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}
            </span>
          </div>
          {booking.venue?.address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              <span>{booking.venue.address}, {booking.venue.city}, {booking.venue.state}</span>
            </div>
          )}
        </div>

        {booking.total_price && (
          <p className="text-sm font-medium mb-3">${booking.total_price.toFixed(2)}</p>
        )}

        {booking.status === 'pending' || booking.status === 'confirmed' ? (
          isFuture(new Date(booking.start_time)) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => cancelBooking(booking.id)}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel Reservation
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" />
          My Court Reservations
        </h1>
        <p className="text-muted-foreground">View and manage your upcoming court time</p>
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
            <TabsTrigger value="upcoming">Upcoming ({upcomingBookings.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastBookings.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelledBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingBookings.length > 0 ? (
              upcomingBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No upcoming reservations</h3>
                <p className="text-muted-foreground mb-4">
                  Ready to hit the courts? Find a venue and book your next session.
                </p>
                <Button onClick={() => navigate('/player/venues')}>
                  <Search className="h-4 w-4 mr-2" />
                  Find a Venue
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastBookings.length > 0 ? (
              pastBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No past reservations yet</p>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledBookings.length > 0 ? (
              cancelledBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No cancelled reservations</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}