import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Calendar, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePublicVenues } from '@/hooks/usePublicVenues';
import { usePlayerBookings } from '@/hooks/usePlayerBookings';
import { useEventRegistration } from '@/hooks/useEventRegistration';
import { VenueDiscoveryCard } from '@/components/player/VenueDiscoveryCard';
import { VenueDetailSheet } from '@/components/player/VenueDetailSheet';

export default function VenueDiscovery() {
  const navigate = useNavigate();
  const { venues, loading } = usePublicVenues();
  const { createBooking } = usePlayerBookings();
  const { registerForEvent, isRegistered } = useEventRegistration();
  const [search, setSearch] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  const filteredVenues = venues.filter(venue =>
    venue.name.toLowerCase().includes(search.toLowerCase()) ||
    venue.city?.toLowerCase().includes(search.toLowerCase()) ||
    venue.state?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header with quick access links */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          Find a Place to Play
        </h1>
        <p className="text-muted-foreground">
          Discover courts, clinics, and tournaments near you
        </p>
        
        {/* Quick access buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/player/my-bookings')}
            className="gap-1.5"
          >
            <ClipboardList className="h-4 w-4" />
            My Reservations
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/player/my-events')}
            className="gap-1.5"
          >
            <Calendar className="h-4 w-4" />
            My Registrations
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by venue name, city, or state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredVenues.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVenues.map(venue => (
            <VenueDiscoveryCard
              key={venue.id}
              venue={venue}
              onSelect={setSelectedVenueId}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No venues found</h3>
          <p className="text-muted-foreground mb-4">
            {search ? 'Try adjusting your search' : 'Venues will appear here once they register with Pulse'}
          </p>
        </div>
      )}

      <VenueDetailSheet
        venueId={selectedVenueId}
        onClose={() => setSelectedVenueId(null)}
        onBook={createBooking}
        onRegisterEvent={registerForEvent}
        isEventRegistered={isRegistered}
      />
    </div>
  );
}