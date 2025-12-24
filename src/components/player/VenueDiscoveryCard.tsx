import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronRight } from 'lucide-react';
import { PublicVenue } from '@/hooks/usePublicVenues';
import { FavoriteButton } from './FavoriteButton';
import pickleballPalaceLogo from '@/assets/pickleball-palace-logo.png';

interface VenueDiscoveryCardProps {
  venue: PublicVenue;
  onSelect: (venueId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => Promise<boolean>;
}

// Helper to determine if a hex color is dark
function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

export function VenueDiscoveryCard({ venue, onSelect, isFavorite, onToggleFavorite }: VenueDiscoveryCardProps) {
  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';
  const logoSrc = venue.logo_url || pickleballPalaceLogo;
  
  const isDarkTheme = isColorDark(secondaryColor);

  return (
    <Card 
      className="hover:shadow-lg transition-all cursor-pointer group overflow-hidden border-0 relative"
      onClick={() => onSelect(venue.id)}
      style={{
        backgroundColor: secondaryColor,
      }}
    >
      {/* Favorite button in corner */}
      {onToggleFavorite && (
        <div className="absolute top-2 right-2 z-10">
          <FavoriteButton
            isFavorite={isFavorite || false}
            onToggle={onToggleFavorite}
          />
        </div>
      )}
      
      {/* Logo-centric layout - unified background, no inner box */}
      <div className="flex flex-col items-center px-5 pt-4 pb-5">
        {/* Large centered logo - 45% bigger, dominant focal point */}
        <div className="w-full flex items-center justify-center mb-3">
          <img 
            src={logoSrc} 
            alt={venue.name} 
            className="h-36 max-w-[340px] object-contain"
            onError={(e) => {
              // Fallback to local asset if URL fails to load
              e.currentTarget.src = pickleballPalaceLogo;
            }}
          />
        </div>

        {/* Location info */}
        {(venue.city || venue.address) && (
          <div 
            className="flex items-center gap-1.5 text-xs mb-3"
            style={{ color: isDarkTheme ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}
          >
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {venue.city && venue.state ? `${venue.city}, ${venue.state}` : venue.address}
            </span>
          </div>
        )}
        
        {/* CTA Button with primary color */}
        <Button 
          size="sm" 
          className="w-full font-medium"
          style={{ 
            backgroundColor: primaryColor,
            color: isColorDark(primaryColor) ? '#FFFFFF' : '#1A1A1A'
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(venue.id);
          }}
        >
          View Courts & Events
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
