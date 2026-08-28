import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RecentPlayPartner {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  handle: string | null;
  reason: string;
  last_played_at: string | null;
}

export type RecentStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/**
 * People the signed-in player has recently shared a match or round robin with
 * and is not already connected to. Ordered most-recent first by the
 * `recent_play_partners` SECURITY DEFINER RPC.
 *
 * Degrades to `unavailable` (never throws) if the RPC isn't deployed yet, so
 * the surrounding Connect menu keeps working.
 */
export function useRecentPlayPartners(active: boolean, limit = 24) {
  const [players, setPlayers] = useState<RecentPlayPartner[]>([]);
  const [status, setStatus] = useState<RecentStatus>('idle');

  const run = useCallback(async () => {
    setStatus('loading');
    try {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>)('recent_play_partners', {
        _limit: limit,
      });
      if (error) {
        console.warn('recent_play_partners failed', error);
        setPlayers([]);
        setStatus('unavailable');
        return;
      }
      setPlayers((data ?? []) as RecentPlayPartner[]);
      setStatus('ready');
    } catch (e) {
      console.warn('useRecentPlayPartners error', e);
      setPlayers([]);
      setStatus('unavailable');
    }
  }, [limit]);

  useEffect(() => {
    if (active) run();
  }, [active, run]);

  return { players, status, refetch: run };
}
