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
  /** Set when the user is authenticated but we couldn't load/recover a
   *  profile row. UI can surface this so the user isn't stuck on a
   *  page that 500s every time it tries to read the profile. */
  profileRecoveryFailed: boolean;
}

/**
 * Last-resort fallback for the rare case where the auth.users row
 * exists but the profiles row doesn't (handle_new_user trigger
 * skipped/failed). Idempotent: upsert with ignoreDuplicates so a race
 * with the trigger is harmless.
 *
 * Returns the freshly fetched profile, or null if recovery failed.
 */
async function ensureProfileExists(user: User): Promise<Profile | null> {
  // The "Users can insert own profile" RLS policy (auth.uid() = id)
  // permits this self-insert.
  const fullName =
    (user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined;
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? null, full_name: fullName ?? 'Player' },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  if (upsertError) {
    console.error('[useAuthState] profile recovery upsert failed', upsertError);
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, player_state, tutorial_completed, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('[useAuthState] profile recovery refetch failed', error);
    return null;
  }
  return (data as Profile | null) ?? null;
}

export function useAuthState(): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    isAuthenticated: false,
    isOnboarding: false,
    isActive: false,
    profileRecoveryFailed: false,
  });

  const fetchState = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // maybeSingle so a missing row returns null instead of throwing
        // (the .single() path used to surface PGRST116 and bubble up to
        // the catch block, silently leaving the user in a half-loaded
        // state — see Phase 1.3 audit finding).
        const { data: initialProfile } = await supabase
          .from('profiles')
          .select('id, player_state, tutorial_completed, full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        let profile = (initialProfile as Profile | null) ?? null;
        let profileRecoveryFailed = false;

        if (!profile) {
          // Authed-but-profile-less recovery path. Idempotent: the
          // ensureProfileExists upsert ignores conflicts and never
          // duplicates a row.
          profile = await ensureProfileExists(user);
          if (!profile) {
            profileRecoveryFailed = true;
          }
        }

        const playerState = profile?.player_state as PlayerState | null;

        setState({
          user,
          profile,
          loading: false,
          isAuthenticated: true,
          isOnboarding: playerState === 'onboarding' || !profile?.tutorial_completed,
          isActive: playerState === 'active',
          profileRecoveryFailed,
        });
      } else {
        setState({
          user: null,
          profile: null,
          loading: false,
          isAuthenticated: false,
          isOnboarding: false,
          isActive: false,
          profileRecoveryFailed: false,
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
