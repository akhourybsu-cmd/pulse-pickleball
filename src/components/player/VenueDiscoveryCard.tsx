import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronRight } from 'lucide-react';
import { PublicVenue } from '@/hooks/usePublicVenues';

interface VenueDiscoveryCardProps {
  venue: PublicVenue;
  onSelect: (venueId: string) => void;
}

export function VenueDiscoveryCard({ venue, onSelect }: VenueDiscoveryCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => onSelect(venue.id)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {venue.logo_url ? (
              <img src={venue.logo_url} alt={venue.name} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg group-hover:text-primary transition-colors">{venue.name}</CardTitle>
              {venue.city && venue.state && (
                <p className="text-sm text-muted-foreground">{venue.city}, {venue.state}</p>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        {venue.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{venue.description}</p>
        )}
        
        {venue.address && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{venue.address}</span>
          </div>
        )}
        
        <Button variant="default" size="sm" className="w-full" onClick={(e) => {
          e.stopPropagation();
          onSelect(venue.id);
        }}>
          View Courts & Events
        </Button>
      </CardContent>
    </Card>
  );
}