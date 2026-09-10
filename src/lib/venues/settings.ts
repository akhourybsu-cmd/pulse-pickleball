import { supabase } from '@/integrations/supabase/client';
import type { QueryClient } from '@tanstack/react-query';
import { serializeVenueHours, validateVenueHours, type VenueHours } from './hours';

export interface VenueCourtSettings {
  id: string;
  name: string | null;
  court_number: number | null;
  surface_type: string | null;
  is_active: boolean | null;
  is_premium: boolean | null;
}

export async function fetchVenueCourts(venueId: string): Promise<VenueCourtSettings[]> {
  const { data, error } = await supabase.from('venue_courts')
    .select('id, name, court_number, surface_type, is_active, is_premium')
    .eq('venue_id', venueId).order('court_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** A successful HTTP response may still mean RLS updated no rows. */
function requireChangedRow(data: { id: string } | null, error: unknown) {
  if (error) throw error;
  if (!data) throw new Error('Nothing was changed. Your access may have changed; reload and try again.');
}

export async function saveVenueHours(venueId: string, hours: VenueHours) {
  const validation = validateVenueHours(hours);
  if (validation) throw new Error(validation);
  const { data, error } = await supabase.from('venues')
    .update({ hours_of_operation: serializeVenueHours(hours) as never })
    .eq('id', venueId).select('id').maybeSingle();
  requireChangedRow(data, error);
}

export async function updateVenueCourt(venueId: string, courtId: string, values: Partial<Pick<VenueCourtSettings, 'name' | 'surface_type' | 'is_active' | 'is_premium'>>) {
  const { data, error } = await supabase.from('venue_courts').update(values)
    .eq('venue_id', venueId).eq('id', courtId).select('id').maybeSingle();
  requireChangedRow(data, error);
}

export async function removeVenueCourt(venueId: string, courtId: string) {
  // Keep courts with history: deleting detaches reservations from their court.
  // Server policies/constraints remain the final authority for concurrent writes.
  const { count, error: historyError } = await supabase.from('group_events')
    .select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('venue_court_id', courtId);
  if (historyError) throw historyError;
  if (count == null) throw new Error('Booking history could not be checked. Try again.');
  if (count > 0) throw new Error('This court has scheduled activity or booking history. Turn off Available instead to preserve its records.');
  const { data, error } = await supabase.from('venue_courts').delete()
    .eq('venue_id', venueId).eq('id', courtId).select('id').maybeSingle();
  requireChangedRow(data, error);
}

/** Settings affect the community, player calendar, operations, and admin summary. */
export async function refreshVenueSettings(client: QueryClient, venueId: string) {
  await Promise.all([
    ['venue-courts-settings', venueId], ['venue-day', venueId],
    ['venue-admin-counts', venueId], ['group-detail'],
  ].map(queryKey => client.invalidateQueries({ queryKey })));
}
