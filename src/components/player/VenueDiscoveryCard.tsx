import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronRight } from 'lucide-react';
import { PublicVenue } from '@/hooks/usePublicVenues';
import { FavoriteButton } from './FavoriteButton';
import { useFavoriteVenues } from '@/hooks/useFavoriteVenues';
import pickleballPalaceLogo from '@/assets/pickleball-palace-logo.png';

interface VenueDiscoveryCardProps {
  venue: PublicVenue;
  onSelect: (venueId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => Promise<boolean>;
}

export function VenueDiscoveryCard({ venue, onSelect, isFavorite, onToggleFavorite }: VenueDiscoveryCardProps) {
  const primaryColor = venue.primary_color || '#FF6B35';
  const logoSrc = venue.logo_url || pickleballPalaceLogo;

  return (
    <Card 
      className="hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
      onClick={() => onSelect(venue.id)}
      style={{
        borderColor: `${primaryColor}30`,
      }}
    >
      {/* Branded header strip */}
      <div 
        className="h-2 w-full"
        style={{ backgroundColor: primaryColor }}
      />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-14 w-14 rounded-lg flex items-center justify-center p-1.5 overflow-hidden"
              style={{ backgroundColor: `${primaryColor}10` }}
            >
              <img 
                src={logoSrc} 
                alt={venue.name} 
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <CardTitle 
                className="text-lg transition-colors"
                style={{ color: primaryColor }}
              >
                {venue.name}
              </CardTitle>
              {venue.city && venue.state && (
                <p className="text-sm text-muted-foreground">{venue.city}, {venue.state}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onToggleFavorite && (
              <FavoriteButton
                isFavorite={isFavorite || false}
                onToggle={onToggleFavorite}
              />
            )}
            <ChevronRight 
              className="h-5 w-5 transition-colors" 
              style={{ color: primaryColor }}
            />
          </div>
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
        
        <Button 
          size="sm" 
          className="w-full text-white"
          style={{ backgroundColor: primaryColor }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(venue.id);
          }}
        >
          View Courts & Events
        </Button>
      </CardContent>
    </Card>
  );
}