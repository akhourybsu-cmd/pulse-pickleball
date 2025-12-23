import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Calendar, ClipboardList, Heart } from 'lucide-react';
import { usePublicVenues } from '@/hooks/usePublicVenues';
import { usePlayerBookings } from '@/hooks/usePlayerBookings';
import { useEventRegistration } from '@/hooks/useEventRegistration';
import { useFavoriteVenues } from '@/hooks/useFavoriteVenues';
import { VenueDiscoveryCard } from '@/components/player/VenueDiscoveryCard';
import { VenueDetailSheet } from '@/components/player/VenueDetailSheet';

export default function VenueDiscovery() {
  const navigate = useNavigate();
  const location = useLocation();
  const { venues, loading } = usePublicVenues();
  const { createBooking } = usePlayerBookings();
  const { registerForEvent, isRegistered } = useEventRegistration();
  const { favorites, isFavorite, toggleFavorite, loading: favoritesLoading } = useFavoriteVenues();
  const [search, setSearch] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // Handle deep linking from dashboard
  useEffect(() => {
    const state = location.state as { openVenueId?: string } | null;
    if (state?.openVenueId) {
      setSelectedVenueId(state.openVenueId);
      // Clear the state to prevent re-opening on navigation
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const filteredVenues = venues.filter(venue =>
    venue.name.toLowerCase().includes(search.toLowerCase()) ||
    venue.city?.toLowerCase().includes(search.toLowerCase()) ||
    venue.state?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort favorites to the top
  const sortedVenues = [...filteredVenues].sort((a, b) => {
    const aFav = isFavorite(a.id);
    const bFav = isFavorite(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const favoriteVenues = sortedVenues.filter(v => isFavorite(v.id));
  const otherVenues = sortedVenues.filter(v => !isFavorite(v.id));

  return (
    <div className="p-4 sm:p-6 pt-6">
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

      {loading || favoritesLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredVenues.length > 0 ? (
        <div className="space-y-6">
          {/* Favorite Venues Section */}
          {favoriteVenues.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                Favorite Venues
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {favoriteVenues.map(venue => (
                  <VenueDiscoveryCard
                    key={venue.id}
                    venue={venue}
                    onSelect={setSelectedVenueId}
                    isFavorite={true}
                    onToggleFavorite={() => toggleFavorite(venue.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Other Venues */}
          {otherVenues.length > 0 && (
            <div>
              {favoriteVenues.length > 0 && (
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  All Venues
                </h2>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherVenues.map(venue => (
                  <VenueDiscoveryCard
                    key={venue.id}
                    venue={venue}
                    onSelect={setSelectedVenueId}
                    isFavorite={false}
                    onToggleFavorite={() => toggleFavorite(venue.id)}
                  />
                ))}
              </div>
            </div>
          )}
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