import { useMode } from '@/contexts/ModeContext';
import { useVenueBookings } from '@/hooks/useVenueBookings';
import { useVenueCourts } from '@/hooks/useVenueCourts';
import { CreateBookingDialog } from '@/components/venue/CreateBookingDialog';
import { BookingCard } from '@/components/venue/BookingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function VenueBookings() {
  const { currentVenueId } = useMode();
  const { bookings, loading, updateBooking, cancelBooking, createBooking } = useVenueBookings(currentVenueId);
  const { courts } = useVenueCourts(currentVenueId);

  if (!currentVenueId) {
    return <div className="p-6 text-center text-muted-foreground">No venue selected</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">View and manage court reservations</p>
        </div>
        <CreateBookingDialog courts={courts} onCreateBooking={createBooking} />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No bookings yet</h3>
            <p className="text-muted-foreground text-sm">Create your first booking to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onUpdateStatus={(id, status) => updateBooking(id, { status })}
              onCancel={cancelBooking}
            />
          ))}
        </div>
      )}
    </div>
  );
}
