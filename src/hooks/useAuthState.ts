import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PlayerState = Database['public']['Enums']['player_state'];

interface Profile {
  id: string;
  player_state: PlayerState | null;
  tutorial_completed: boolean | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isOnboarding: boolean;
  isActive: boolean;
}

export function useAuthState(): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    isAuthenticated: false,
    isOnboarding: false,
    isActive: false,
  });

  const fetchState = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, player_state, tutorial_completed, full_name, avatar_url')
          .eq('id', user.id)
          .single();

        const playerState = profile?.player_state as PlayerState | null;
        
        setState({
          user,
          profile: profile as Profile | null,
          loading: false,
          isAuthenticated: true,
          isOnboarding: playerState === 'onboarding' || !profile?.tutorial_completed,
          isActive: playerState === 'active',
        });
      } else {
        setState({
          user: null,
          profile: null,
          loading: false,
          isAuthenticated: false,
          isOnboarding: false,
          isActive: false,
        });
      }
    } catch (error) {
      console.error('Error fetching auth state:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchState();
    });

    return () => subscription.unsubscribe();
  }, [fetchState]);

  return { ...state, refresh: fetchState };
}
