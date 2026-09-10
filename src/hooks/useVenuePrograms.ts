import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from './useAuthState';
import type { GroupEvent, GroupRsvpStatus } from './useGroupEvents';
import { isConfirmedVenueRsvp } from '@/lib/venues/experience';
import { PROGRAM_FORMATS, programPhase, withConfirmedProgramRsvp } from '@/lib/venues/programExperience';

export async function fetchUpcomingVenuePrograms(venueId: string) {
  const { data, error } = await supabase.from('group_events')
    .select('id,title,description,start_time').eq('venue_id', venueId)
    .is('parent_event_id', null).in('event_format', [...PROGRAM_FORMATS])
    .gte('start_time', new Date().toISOString()).order('start_time').limit(3);
  if (error) throw error;
  return data ?? [];
}

export async function fetchVenueProgram(venueId: string, eventId: string, viewerId: string) {
  const { data, error } = await supabase.from('group_events').select('*')
    .eq('venue_id', venueId).eq('id', eventId).is('parent_event_id', null)
    .in('event_format', [...PROGRAM_FORMATS]).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This program is no longer available. It may have been removed or your access may have changed.');
  const [rsvps, membership] = await Promise.all([
    supabase.from('group_event_rsvps').select('user_id,status').eq('event_id', eventId),
    supabase.from('group_members').select('status').eq('group_id', data.group_id).eq('user_id', viewerId).maybeSingle(),
  ]);
  if (rsvps.error) throw rsvps.error;
  if (membership.error) throw membership.error;
  const counts = { going: 0, maybe: 0, not_going: 0, waitlist: 0 };
  let viewerRsvp: GroupRsvpStatus | null = null;
  for (const row of rsvps.data ?? []) {
    if (!isConfirmedVenueRsvp(row.status)) continue;
    counts[row.status] += 1;
    if (row.user_id === viewerId) viewerRsvp = row.status;
  }
  return { event: { ...data, rsvps: counts, user_rsvp: viewerRsvp } as GroupEvent, canRsvp: membership.data?.status === 'active' };
}

export function useVenuePrograms(venueId: string | null | undefined, selectedId: string | null) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const upcoming = useQuery({
    queryKey: ['venue-upcoming-programs', venueId, user?.id], enabled: !!venueId && !!user,
    queryFn: () => fetchUpcomingVenuePrograms(venueId!), staleTime: 30_000, refetchInterval: 60_000,
  });
  const detailKey = ['venue-program', venueId, selectedId, user?.id];
  const detail = useQuery({
    queryKey: detailKey, enabled: !!venueId && !!selectedId && !!user,
    queryFn: () => fetchVenueProgram(venueId!, selectedId!, user!.id),
    staleTime: 0, refetchInterval: saving ? false : 30_000, refetchOnWindowFocus: !saving,
  });
  const updateRsvp = async (eventId: string, status: 'going' | 'maybe' | 'not_going') => {
    if (lock.current) throw new Error('Your previous response is still being confirmed.');
    if (eventId !== selectedId || !detail.data?.canRsvp || detail.isError) throw new Error('Registration access could not be confirmed. Reload the program.');
    if (programPhase(detail.data.event) === 'ended') throw new Error('This program has ended. Registration is closed.');
    lock.current = true; setSaving(true);
    try {
      const { data, error } = await supabase.rpc('set_group_event_rsvp', { p_event_id: eventId, p_status: status });
      if (error) throw error;
      if (!isConfirmedVenueRsvp(data)) throw new Error('Registration was not confirmed. Please try again.');
      await client.cancelQueries({ queryKey: detailKey });
      client.setQueryData<typeof detail.data>(detailKey, previous => previous ? { ...previous, event: withConfirmedProgramRsvp(previous.event, data) } : previous);
      void client.invalidateQueries({ queryKey: detailKey });
      void client.invalidateQueries({ queryKey: ['venue-day', venueId] });
      void client.invalidateQueries({ queryKey: ['group-events', detail.data.event.group_id] });
      return data;
    } finally { lock.current = false; setSaving(false); }
  };
  return { upcoming, detail, updateRsvp };
}
