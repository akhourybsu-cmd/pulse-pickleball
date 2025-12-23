import { useState } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useVenueBookings } from '@/hooks/useVenueBookings';
import { useVenueCourts } from '@/hooks/useVenueCourts';
import { CreateBookingDialog } from '@/components/venue/CreateBookingDialog';
import { BookingCard } from '@/components/venue/BookingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { isToday, isFuture, isPast } from 'date-fns';

export default function VenueBookings() {
  const { currentVenueId } = useMode();
  const { bookings, loading, updateBooking, cancelBooking, createBooking } = useVenueBookings(currentVenueId);
  const { courts } = useVenueCourts(currentVenueId);
  const [activeTab, setActiveTab] = useState('upcoming');

  if (!currentVenueId) {
    return <div className="p-6 text-center text-muted-foreground">No venue selected</div>;
  }

  const upcomingBookings = bookings.filter(b => 
    (isFuture(new Date(b.start_time)) || isToday(new Date(b.start_time))) && 
    b.status !== 'cancelled' && b.status !== 'completed'
  );
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');
  const allBookings = bookings;

  const getFilteredBookings = () => {
    switch (activeTab) {
      case 'upcoming': return upcomingBookings;
      case 'completed': return completedBookings;
      case 'cancelled': return cancelledBookings;
      default: return allBookings;
    }
  };

  const filteredBookings = getFilteredBookings();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">View and manage court reservations</p>
        </div>
        <CreateBookingDialog courts={courts} onCreateBooking={createBooking} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Upcoming ({upcomingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Completed ({completedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-1.5">
            <XCircle className="h-4 w-4" />
            Cancelled ({cancelledBookings.length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({allBookings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : filteredBookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No bookings</h3>
                <p className="text-muted-foreground text-sm">
                  {activeTab === 'upcoming' 
                    ? 'No upcoming bookings. Create one to get started.' 
                    : `No ${activeTab} bookings found.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onUpdateStatus={(id, status) => updateBooking(id, { status })}
                  onCancel={cancelBooking}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
