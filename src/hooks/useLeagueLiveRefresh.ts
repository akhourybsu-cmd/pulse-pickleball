import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Coalesce scoring bursts; refresh on focus/reconnect even without Realtime. */
export function useLeagueLiveRefresh(leagueId: string | undefined, refresh: () => void) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!leagueId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), 350);
    };
    const channel = supabase.channel(`league-operations:${leagueId}:${crypto.randomUUID()}`);
    for (const table of ['league_members', 'league_matches', 'league_seasons', 'league_sessions', 'league_teams', 'league_substitutes']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `league_id=eq.${leagueId}` }, update);
    }
    channel.subscribe();
    const fallback = setInterval(update, 60_000);
    window.addEventListener('online', update);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer); clearInterval(fallback);
      window.removeEventListener('online', update);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
      void supabase.removeChannel(channel);
    };
  }, [leagueId]);
}
