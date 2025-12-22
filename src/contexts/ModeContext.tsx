import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppMode = 'player' | 'venue';

interface VenueAccess {
  venue_id: string;
  venue_name: string;
  role: 'owner' | 'manager' | 'staff';
}

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  venueAccess: VenueAccess[];
  currentVenueId: string | null;
  setCurrentVenueId: (id: string | null) => void;
  hasVenueAccess: boolean;
  isLoading: boolean;
  refreshVenueAccess: () => Promise<void>;
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

  const refreshVenueAccess = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setVenueAccess([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('get_user_venues', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error fetching venue access:', error);
        setVenueAccess([]);
      } else {
        setVenueAccess(data || []);
        
        // If user has venue access but no current venue selected, select the first one
        if (data && data.length > 0 && !currentVenueId) {
          setCurrentVenueId(data[0].venue_id);
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

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        venueAccess,
        currentVenueId,
        setCurrentVenueId,
        hasVenueAccess,
        isLoading,
        refreshVenueAccess,
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
