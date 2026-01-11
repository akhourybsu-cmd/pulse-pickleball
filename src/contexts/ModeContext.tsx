import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppMode = 'player' | 'venue';

export type VenueActivationState = 'claimed' | 'pending' | 'active' | 'suspended';

export type VenueRole = 'owner' | 'manager' | 'organizer' | 'staff';

export interface VenueAccess {
  venue_id: string;
  venue_name: string;
  role: VenueRole;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  activation_state: VenueActivationState | null;
  is_published: boolean;
}

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  venueAccess: VenueAccess[];
  currentVenueId: string | null;
  setCurrentVenueId: (id: string | null) => void;
  activeVenueRole: VenueRole | null;
  hasVenueAccess: boolean;
  isLoading: boolean;
  refreshVenueAccess: () => Promise<void>;
  currentVenue: VenueAccess | undefined;
  setActiveVenue: (venueId: string | null) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

const MODE_STORAGE_KEY = 'pulse-app-mode';
const VENUE_STORAGE_KEY = 'pulse-current-venue';

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return (stored === 'venue' ? 'venue' : 'player') as AppMode;
  });
  const [venueAccess, setVenueAccess] = useState<VenueAccess[]>([]);
  const [currentVenueId, setCurrentVenueIdState] = useState<string | null>(() => {
    return localStorage.getItem(VENUE_STORAGE_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem(MODE_STORAGE_KEY, newMode);
  }, []);

  const setCurrentVenueId = useCallback((id: string | null) => {
    setCurrentVenueIdState(id);
    if (id) {
      localStorage.setItem(VENUE_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(VENUE_STORAGE_KEY);
    }
  }, []);

  // Combined helper: sets venue ID and switches to venue mode
  const setActiveVenue = useCallback((venueId: string | null) => {
    if (venueId) {
      setCurrentVenueId(venueId);
      setMode('venue');
    } else {
      setMode('player');
    }
  }, [setCurrentVenueId, setMode]);

  const refreshVenueAccess = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setVenueAccess([]);
        setIsLoading(false);
        return;
      }

      // Get basic venue access from RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_venues', {
        _user_id: user.id
      });

      if (rpcError) {
        console.error('Error fetching venue access:', rpcError);
        setVenueAccess([]);
        setIsLoading(false);
        return;
      }

      if (!rpcData || rpcData.length === 0) {
        setVenueAccess([]);
        setIsLoading(false);
        return;
      }

      // Fetch full venue details including branding and activation state
      const venueIds = rpcData.map((v: any) => v.venue_id);
      const { data: venueDetails, error: venueError } = await supabase
        .from('venues')
        .select('id, name, logo_url, primary_color, secondary_color, activation_state, is_published')
        .in('id', venueIds);

      if (venueError) {
        console.error('Error fetching venue details:', venueError);
        // Fallback to basic data without branding
        const basicAccess = rpcData.map((v: any) => ({
          venue_id: v.venue_id,
          venue_name: v.venue_name,
          role: v.role as VenueRole,
          logo_url: null,
          primary_color: null,
          secondary_color: null,
          activation_state: null,
          is_published: false
        }));
        setVenueAccess(basicAccess);
      } else {
        // Merge RPC data with venue details
        const enrichedAccess = rpcData.map((v: any) => {
          const details = venueDetails?.find((vd) => vd.id === v.venue_id);
          return {
            venue_id: v.venue_id,
            venue_name: v.venue_name,
            role: v.role as VenueRole,
            logo_url: details?.logo_url || null,
            primary_color: details?.primary_color || null,
            secondary_color: details?.secondary_color || null,
            activation_state: (details?.activation_state as VenueActivationState) || null,
            is_published: details?.is_published ?? false
          };
        });
        setVenueAccess(enrichedAccess);
        
        // Validate currentVenueId - if it no longer exists in access list, clear it
        if (currentVenueId && !enrichedAccess.some(v => v.venue_id === currentVenueId)) {
          if (enrichedAccess.length > 0) {
            setCurrentVenueId(enrichedAccess[0].venue_id);
          } else {
            setCurrentVenueId(null);
          }
        } else if (enrichedAccess.length > 0 && !currentVenueId) {
          // If user has venue access but no current venue selected, select the first one
          setCurrentVenueId(enrichedAccess[0].venue_id);
        }
      }
    } catch (err) {
      console.error('Error in refreshVenueAccess:', err);
      setVenueAccess([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentVenueId, setCurrentVenueId]);

  useEffect(() => {
    refreshVenueAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshVenueAccess();
    });

    return () => subscription.unsubscribe();
  }, [refreshVenueAccess]);

  // If mode is venue but user has no venue access, switch to player mode
  useEffect(() => {
    if (!isLoading && mode === 'venue' && venueAccess.length === 0) {
      setMode('player');
    }
  }, [isLoading, mode, venueAccess.length, setMode]);

  const hasVenueAccess = venueAccess.length > 0;
  const currentVenue = venueAccess.find(v => v.venue_id === currentVenueId);
  const activeVenueRole = currentVenue?.role ?? null;

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        venueAccess,
        currentVenueId,
        setCurrentVenueId,
        activeVenueRole,
        hasVenueAccess,
        isLoading,
        refreshVenueAccess,
        currentVenue,
        setActiveVenue,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
