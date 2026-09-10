import { supabase } from '@/integrations/supabase/client';

export interface ProgramWindow { start: Date; end: Date }
interface CourtOccupancy { venue_court_id: string | null; start_time: string; end_time: string | null }

/** Include temporary checkout holds as well as confirmed court allocations. */
export async function fetchProgramAvailability(venueId: string, windows: ProgramWindow[]): Promise<CourtOccupancy[]> {
  if (!windows.length) return [];
  const [sessions, ...holds] = await Promise.all([
    supabase.from('group_events').select('venue_court_id, start_time, end_time')
      .eq('venue_id', venueId).not('venue_court_id', 'is', null)
      .lt('start_time', windows[windows.length - 1].end.toISOString())
      .gt('end_time', windows[0].start.toISOString()),
    // The RPC deliberately permits at most two days per read. Asking for a
    // whole weekly series at once silently returns no holds, so read each
    // occurrence's same-day window instead.
    ...windows.map(({ start, end }) => (supabase as any).rpc('venue_checkout_holds', {
      p_venue: venueId, p_from: start.toISOString(), p_to: end.toISOString(),
    })),
  ]);
  for (const result of [sessions, ...holds]) if (result.error) throw result.error;
  return [sessions, ...holds].flatMap(result => result.data ?? []) as CourtOccupancy[];
}
