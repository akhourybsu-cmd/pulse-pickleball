import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type AuthProfile = Pick<
  ProfileRow,
  | 'id'
  | 'player_state'
  | 'tutorial_completed'
  | 'full_name'
  | 'display_name'
  | 'first_name'
  | 'last_name'
  | 'name_locked'
  | 'avatar_url'
  | 'current_rating'
  | 'week_start_rating'
  | 'total_matches'
  | 'wins'
  | 'losses'
  | 'total_points_for'
  | 'total_points_against'
  | 'avg_opponent_rating'
  | 'state'
  | 'town'
>;

const AUTH_PROFILE_COLUMNS = [
  'id',
  'player_state',
  'tutorial_completed',
  'full_name',
  'display_name',
  'first_name',
  'last_name',
  'name_locked',
  'avatar_url',
  'current_rating',
  'week_start_rating',
  'total_matches',
  'wins',
  'losses',
  'total_points_for',
  'total_points_against',
  'avg_opponent_rating',
  'state',
  'town',
].join(',');

interface AuthState {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isOnboarding: boolean;
  isActive: boolean;
}

type AuthStateValue = AuthState & { refresh: () => Promise<void> };

const AuthStateContext = createContext<AuthStateValue | null>(null);

const SIGNED_OUT_STATE: AuthState = {
  user: null,
  profile: null,
  loading: false,
  isAuthenticated: false,
  isOnboarding: false,
  isActive: false,
};

/**
 * One app-wide auth bootstrap.
 *
 * Previously every useAuthState consumer performed its own
 * getSession -> getUser -> profile chain, then repeated it when Supabase
 * emitted INITIAL_SESSION. Besides producing loader flashes, that made a cold
 * player-dashboard refresh wait on several duplicate network round trips.
 * The provider keeps one listener and one profile request for the whole app.
 */
export function AuthStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    isAuthenticated: false,
    isOnboarding: false,
    isActive: false,
  });
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadSession = useCallback(async (session: Session | null, showLoader: boolean) => {
    const requestId = ++requestIdRef.current;

    if (!session?.user) {
      if (mountedRef.current) setState(SIGNED_OUT_STATE);
      return;
    }

    const user = session.user;
    if (showLoader && mountedRef.current) {
      setState((current) => ({
        ...current,
        user,
        loading: true,
        isAuthenticated: true,
      }));
    }

    try {
      // The profile request itself is authenticated and RLS-protected, so an
      // additional network getUser() validation adds latency without adding a
      // security boundary. Server policies remain authoritative.
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(AUTH_PROFILE_COLUMNS)
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      const authProfile = profile as unknown as AuthProfile;

      setState({
        user,
        profile: authProfile,
        loading: false,
        isAuthenticated: true,
        isOnboarding: authProfile.player_state === 'onboarding' || !authProfile.tutorial_completed,
        isActive: authProfile.player_state === 'active',
      });
    } catch (error) {
      console.error('Error fetching auth state:', error);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setState({
        user,
        profile: null,
        loading: false,
        isAuthenticated: true,
        isOnboarding: false,
        isActive: false,
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error reading auth session:', error);
      if (mountedRef.current) setState(SIGNED_OUT_STATE);
      return;
    }
    await loadSession(session, true);
  }, [loadSession]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // refresh() already owns initial hydration. Processing INITIAL_SESSION
      // here as well was the source of the duplicate cold-start request.
      if (event === 'INITIAL_SESSION') return;

      // Supabase recommends deferring client work from inside this callback.
      setTimeout(() => {
        void loadSession(session, event === 'SIGNED_IN' || event === 'SIGNED_OUT');
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      subscription.unsubscribe();
    };
  }, [loadSession, refresh]);

  return createElement(
    AuthStateContext.Provider,
    { value: { ...state, refresh } },
    children,
  );
}

export function useAuthState(): AuthStateValue {
  const value = useContext(AuthStateContext);
  if (!value) {
    throw new Error('useAuthState must be used within AuthStateProvider');
  }
  return value;
}
