import type { LeagueBrand } from "@/lib/leagues/branding";
import type { LeagueType } from "@/lib/leagues/types";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from './useAuthState';
import { VENUE_OCCASION_FORMATS, type VenueOccasion } from '@/lib/venues/events';

export async function fetchVenueOccasions(venueId: string, groupId: string): Promise<VenueOccasion[]> {
  const now = new Date().toISOString();
  const [programs, leagues] = await Promise.all([
    supabase.from('group_events').select('id,title,description,start_time,end_time,event_format,price_cents,currency,registration_paused')
      .eq('venue_id', venueId).is('parent_event_id', null).is('canceled_at',null).in('event_format', [...VENUE_OCCASION_FORMATS])
      .or(`end_time.gt.${now},start_time.gte.${now}`).order('start_time').limit(100),
    // RLS retains membership/private visibility rules; only this venue's linked leagues.
    supabase.from('leagues').select('id,name,description,branding,league_type').eq('community_id', groupId).eq('status', 'active').order('name'),
  ]);
  if (programs.error) throw programs.error;
  if (leagues.error) throw leagues.error;
  return [
    ...(programs.data ?? []).map(row => ({ id: 'program-' + row.id, programId: row.id, title: row.title, description: row.description,
      kind: row.event_format === 'round_robin' ? 'competition' as const : row.event_format === 'social' ? 'social' as const : 'special' as const,
      price_cents:row.price_cents,currency:row.currency,registration_paused:row.registration_paused,start: row.start_time, end: row.end_time })),
    ...(leagues.data ?? []).map(row => ({ id: 'league-' + row.id, leagueId: row.id, title: row.name, description: row.description,
      league_branding: row.branding as LeagueBrand, league_type: row.league_type as LeagueType,
      kind: 'leagues' as const, start: null, end: null })),
  ];
}

export function useVenueEvents(venueId?: string | null, groupId?: string, enabled = true) {
  const { user } = useAuthState();
  return useQuery({ queryKey: ['venue-occasions', venueId, groupId, user?.id], enabled: !!venueId && !!groupId && !!user && enabled,
    queryFn: () => fetchVenueOccasions(venueId!, groupId!), staleTime: 30_000, refetchInterval: enabled ? 60_000 : false });
}
