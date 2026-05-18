import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Calendar, ClipboardList, Heart, MapPin } from 'lucide-react';
import { usePublicVenues } from '@/hooks/usePublicVenues';
import { useFavoriteVenues } from '@/hooks/useFavoriteVenues';
import { VenueDiscoveryCard } from '@/components/player/VenueDiscoveryCard';
import { VenueDetailSheet } from '@/components/player/VenueDetailSheet';
import { NoVenuesEmptyState, NoSearchResultsEmptyState } from '@/components/empty-states';

interface VenueDiscoveryProps {
  hideHeader?: boolean;
}

export default function VenueDiscovery({ hideHeader = false }: VenueDiscoveryProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { venues, loading } = usePublicVenues();
  const { isFavorite, toggleFavorite, loading: favoritesLoading } = useFavoriteVenues();
  const [search, setSearch] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // When embedded in the Play Hub, the "no venues" empty-state should suggest
  // switching to the Events tab — not "Register a Venue" (organizer action).
  const switchToEventsTab = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('tab');
    setSearchParams(params, { replace: true });
  };

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

  const renderContent = () => {
    if (loading || favoritesLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      );
    }

    if (filteredVenues.length === 0 && search) {
      return (
        <NoSearchResultsEmptyState
          searchTerm={search}
          onClear={() => setSearch('')}
        />
      );
    }

    if (filteredVenues.length === 0) {
      // When embedded in the Play Hub, give the player a useful next step
      // (browse events) instead of the default organizer-facing CTA.
      if (hideHeader) {
        return (
          <div className="text-center py-12 sm:py-16 rounded-xl border border-border/40 bg-card">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-5 h-5 text-muted-foreground/70" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">No venues listed yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Places to play will appear here as they join PULSE. Browse events to see what's scheduled now.
            </p>
            <Button size="sm" onClick={switchToEventsTab}>
              Browse events
            </Button>
          </div>
        );
      }
      return <NoVenuesEmptyState />;
    }

    return (
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
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header - Premium Polish (suppressed in embedded mode) */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="page-title">Find a Place to Play</h1>
            <p className="page-subtitle mt-0.5">Browse venues, courts, and the events they host</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/player/my-bookings')}
              className="gap-1.5 h-8 text-xs btn-premium"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">My </span>Reservations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/player/my-events')}
              className="gap-1.5 h-8 text-xs btn-premium"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">My </span>Registrations
            </Button>
          </div>
        </div>
      )}

      {/* Search - Premium Polish */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input
          placeholder="Search by venue name, city, or state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 input-premium"
        />
      </div>

      {renderContent()}

      {/* VENUE DETAIL SHEET - NOW PREVIEW ONLY, NO TRANSACTIONS */}
      <VenueDetailSheet
        venueId={selectedVenueId}
        onClose={() => setSelectedVenueId(null)}
      />
    </div>
  );
}
