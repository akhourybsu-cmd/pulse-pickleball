import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { fetchCanonicalRoundRobinSchedule } from "@/lib/roundRobin/fetchScheduleRows";

export async function fetchRoundRobinKioskSnapshot(supabase: SupabaseClient<Database>, eventId: string, signal: AbortSignal) {
  const [eventResult, schedule, namesResult] = await Promise.all([
    supabase.from('round_robin_events')
      .select('id,name,date,location,organizer_id,num_courts,num_rounds,current_round,status')
      .eq('id', eventId).abortSignal(signal).maybeSingle(),
    fetchCanonicalRoundRobinSchedule(supabase, eventId, signal),
    supabase.rpc('rr_kiosk_participant_names', { _event_id: eventId }).abortSignal(signal),
  ]);
  if (eventResult.error) throw eventResult.error;
  // A draft/voided/deleted event is not public. Clear any earlier broadcast.
  if (!eventResult.data) return null;
  if (namesResult.error) throw namesResult.error;
  const profiles = new Map(namesResult.data.filter(row => !row.is_guest).map(row => [row.participant_id, { full_name: row.name, display_name: row.name }]));
  const guests = new Map(namesResult.data.filter(row => row.is_guest).map(row => [row.participant_id, { display_name: row.name }]));
  const hydrated = schedule.map(row => ({
    ...row,
    a1_profile: row.a1_player_id ? profiles.get(row.a1_player_id) : null,
    a2_profile: row.a2_player_id ? profiles.get(row.a2_player_id) : null,
    b1_profile: row.b1_player_id ? profiles.get(row.b1_player_id) : null,
    b2_profile: row.b2_player_id ? profiles.get(row.b2_player_id) : null,
    a1_guest: row.a1_guest_id ? guests.get(row.a1_guest_id) : null,
    a2_guest: row.a2_guest_id ? guests.get(row.a2_guest_id) : null,
    b1_guest: row.b1_guest_id ? guests.get(row.b1_guest_id) : null,
    b2_guest: row.b2_guest_id ? guests.get(row.b2_guest_id) : null,
  }));
  const round = eventResult.data.current_round || 1;
  return {
    event: eventResult.data,
    schedule: hydrated,
    current: hydrated.filter(row => row.round_no === round && !row.is_bye),
    next: hydrated.filter(row => row.round_no === round + 1 && !row.is_bye && !row.abandoned),
  };
}
