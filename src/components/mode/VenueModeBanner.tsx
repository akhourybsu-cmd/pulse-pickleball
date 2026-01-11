import { Building2, ArrowRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useMode } from '@/contexts/ModeContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VenueModeBannerProps {
  className?: string;
}

/**
 * VenueModeBanner - Displays a slim, contextual banner on player routes
 * when the user is in venue mode, suggesting they switch to player mode.
 */
export function VenueModeBanner({ className }: VenueModeBannerProps) {
  const { mode, currentVenue, setMode } = useMode();
  const location = useLocation();

  // Only show on player routes when in venue mode
  if (mode !== 'venue') return null;
  if (!location.pathname.startsWith('/player')) return null;

  return (
    <div
      className={cn(
        'bg-amber-500/10 border-b border-amber-500/20 px-4 py-2',
        'flex items-center justify-between gap-4',
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
        <Building2 className="h-4 w-4 flex-shrink-0" />
        <span className="line-clamp-1">
          You're viewing as <strong className="font-medium">{currentVenue?.venue_name}</strong> — Switch to Player to record matches
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode('player')}
        className="flex-shrink-0 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:text-amber-800 dark:hover:text-amber-200 gap-1"
      >
        Switch to Player
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
