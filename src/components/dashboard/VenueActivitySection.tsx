import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, ChevronRight, Building2, Search } from 'lucide-react';
import { usePlayerVenueActivity } from '@/hooks/usePlayerVenueActivity';
import { getVenueLogoSrc, getVenueLogoFallback } from '@/lib/venueBranding';

export function VenueActivitySection() {
  const navigate = useNavigate();
  const { venues, loading } = usePlayerVenueActivity();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasVenues = venues.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Venues You've Visited
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-7"
            onClick={() => navigate('/player/venues')}
          >
            <Search className="w-3 h-3 mr-1" />
            Browse All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Venues You've Visited - Historical analytics only */}
        {hasVenues && (
          <div className="space-y-2">
            {venues.slice(0, 3).map(venue => (
              <div 
                key={venue.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => navigate('/player/venues', { state: { openVenueId: venue.id } })}
              >
                {venue.logo_url ? (
                  <img 
                    src={getVenueLogoSrc(venue.logo_url, venue.name)} 
                    alt={venue.name} 
                    className="h-10 w-10 rounded-lg object-cover" 
                    onError={(e) => {
                      e.currentTarget.src = getVenueLogoFallback();
                    }}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{venue.name}</p>
                  {venue.city && venue.state && (
                    <p className="text-xs text-muted-foreground">{venue.city}, {venue.state}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {venue.bookingsCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{venue.bookingsCount} bookings</Badge>
                  )}
                  {venue.eventsCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{venue.eventsCount} events</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State - Find Venues CTA */}
        {!hasVenues && (
          <div className="text-center py-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Discover venues to book courts and register for events
            </p>
            <Button onClick={() => navigate('/player/venues')}>
              <Search className="w-4 h-4 mr-2" />
              Find Venues
            </Button>
          </div>
        )}

        {/* View All Link */}
        {hasVenues && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/player/venues')}
          >
            View All Venues
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
