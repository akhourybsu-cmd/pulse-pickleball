import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NearbyPlayer {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  handle: string | null;
  location_name: string | null;
  distance_km: number;
  reason: string;
}

export type NearbyStatus =
  | 'idle'         // not fetched yet
  | 'loading'
  | 'ready'        // fetched (players may be empty)
  | 'not_enabled'  // caller hasn't opted in / set a location
  | 'unavailable'; // RPC not deployed or errored

/**
 * Distance-ranked friend discovery (opt-in, reciprocal). Reads the caller's own
 * discoverability + coordinates first so the UI can show the right prompt, then
 * calls the SECURITY DEFINER `discover_players_nearby` RPC (which itself gates
 * on the caller being discoverable).
 *
 * Degrades gracefully: if the RPC isn't deployed yet the status becomes
 * `unavailable` rather than throwing, so the surrounding menu never breaks.
 */
export function useNearbyPlayers(active: boolean, radiusKm = 40) {
  const [players, setPlayers] = useState<NearbyPlayer[]>([]);
  const [status, setStatus] = useState<NearbyStatus>('idle');
  const [selfLocationName, setSelfLocationName] = useState<string | null>(null);

  const run = useCallback(async () => {
    setStatus('loading');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('not_enabled');
        return;
      }

      const { data: me, error: meErr } = await supabase
        .from('profiles')
        .select('discoverable_by_location, location_lat, location_name')
        .eq('id', user.id)
        .maybeSingle();

      // Column missing (migration not deployed) surfaces as an error here.
      if (meErr) {
        setStatus('unavailable');
        return;
      }

      const meRow = me as { discoverable_by_location?: boolean; location_lat?: number | null; location_name?: string | null } | null;
      setSelfLocationName(meRow?.location_name ?? null);

      if (!meRow?.discoverable_by_location || meRow?.location_lat == null) {
        setStatus('not_enabled');
        setPlayers([]);
        return;
      }

      // Cast: this RPC + the new profile columns aren't in the generated
      // Supabase types until they're regenerated post-deploy.
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>)('discover_players_nearby', {
        _radius_km: radiusKm,
        _limit: 30,
      });
      if (error) {
        console.warn('discover_players_nearby failed', error);
        setStatus('unavailable');
        setPlayers([]);
        return;
      }
      setPlayers((data ?? []) as NearbyPlayer[]);
      setStatus('ready');
    } catch (e) {
      console.warn('useNearbyPlayers error', e);
      setStatus('unavailable');
      setPlayers([]);
    }
  }, [radiusKm]);

  useEffect(() => {
    if (active) run();
  }, [active, run]);

  return { players, status, selfLocationName, refetch: run };
}
