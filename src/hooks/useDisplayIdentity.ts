import { useMemo } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { 
  DisplayIdentity, 
  createPlayerIdentity, 
  createVenueIdentity 
} from '@/lib/displayIdentity';

interface UserProfile {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

/**
 * useDisplayIdentity - Hook to get current display identity based on mode
 * 
 * Returns the appropriate identity object (player or venue) depending on
 * the current app mode. Useful for displaying the current "active" identity
 * in headers, avatars, and other UI elements.
 */
export function useDisplayIdentity(userProfile: UserProfile | null): DisplayIdentity | null {
  const { mode, currentVenue } = useMode();

  return useMemo(() => {
    if (mode === 'venue' && currentVenue) {
      return createVenueIdentity(currentVenue);
    }

    if (userProfile) {
      return createPlayerIdentity(userProfile.id, userProfile);
    }

    return null;
  }, [mode, currentVenue, userProfile]);
}
