import { Building2, User } from 'lucide-react';
import { useMode } from '@/contexts/ModeContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

export function ModeSwitcher() {
  const { mode, setMode, hasVenueAccess, venueAccess, currentVenueId, setCurrentVenueId } = useMode();
  const navigate = useNavigate();

  const handleModeSwitch = (newMode: 'player' | 'venue') => {
    setMode(newMode);
    if (newMode === 'player') {
      navigate('/player/dashboard');
    } else {
      navigate('/venue');
    }
  };

  const currentVenue = venueAccess.find(v => v.venue_id === currentVenueId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {mode === 'player' ? (
            <>
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Player</span>
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline truncate max-w-[100px]">
                {currentVenue?.venue_name || 'Venue'}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => handleModeSwitch('player')}
          className={mode === 'player' ? 'bg-muted' : ''}
        >
          <User className="mr-2 h-4 w-4" />
          Player Mode
        </DropdownMenuItem>
        
        {hasVenueAccess ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Your Venues
            </DropdownMenuLabel>
            {venueAccess.map((venue) => (
              <DropdownMenuItem
                key={venue.venue_id}
                onClick={() => {
                  setCurrentVenueId(venue.venue_id);
                  handleModeSwitch('venue');
                }}
                className={mode === 'venue' && currentVenueId === venue.venue_id ? 'bg-muted' : ''}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="truncate">{venue.venue_name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{venue.role}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => navigate('/venue/onboarding')}
              className="text-muted-foreground"
            >
              <Building2 className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>Register a Venue</span>
                <span className="text-xs">Become a venue operator</span>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
