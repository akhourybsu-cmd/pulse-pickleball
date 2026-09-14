import { supabase } from '@/integrations/supabase/client';
import type { VenueModuleAccess, VenueModuleKey } from '@/lib/venues/venueApplications';

export interface PlatformAction { id: string; venue_id: string | null; action: string; note: string; created_at: string; before_state?: unknown; after_state?: unknown }
export interface PlatformOverview { account_email: string; pending_requests: number; needs_info: number; venues: number; unverified_venues: number; recent_actions: PlatformAction[] }
export interface PlatformVenue {
  id: string; name: string; city: string | null; state: string | null; owner_id: string | null;
  owner_name: string; owner_email: string | null; group_id: string | null; is_active: boolean; is_published: boolean;
  verification_approved_at: string | null; verification_approved_by: string | null; private_sample: boolean;
  modules: (VenueModuleAccess & { updated_at: string })[]; booking: boolean; facility: boolean;
}
export const VENUE_FEATURES: { key: VenueModuleKey; title: string; detail: string }[] = [
  { key: 'court_booking', title: 'Court booking', detail: 'Court reservations and rental checkout tools.' },
  { key: 'facility_tools', title: 'Facility tools', detail: 'Court scheduling, programs, holds and closures.' },
];
export const tierLabel = (booking: boolean, facility: boolean) => booking && facility ? 'Both features' : booking ? 'Court booking' : facility ? 'Facility tools' : 'Free community';
export const actionLabel = (action: string) => ({
  superadmin_configured: 'Superadmin configured', venue_access_changed: 'Venue access updated',
  venue_request_approved: 'Venue approved', venue_request_needs_info: 'Information requested', venue_request_rejected: 'Venue request declined',
}[action] ?? action.replace(/_/g, ' '));
export function accessChangeError(venue: PlatformVenue, modules: VenueModuleKey[], note: string, expires: string, now = Date.now()): string | null {
  if (venue.private_sample) return 'Private sample features stay included.';
  if (note.trim().length < 20 || note.trim().length > 2000) return 'Add a reason between 20 and 2,000 characters.';
  if (expires && (!Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= now)) return 'Choose a future expiry.';
  for (const feature of VENUE_FEATURES) {
    const row = venue.modules.find(r => r.module_key === feature.key);
    const active = !!row?.enabled && (!row.expires_at || Date.parse(row.expires_at) > now);
    if (row?.source === 'subscription' && modules.includes(feature.key) !== active) return 'Subscription-managed access must be changed through the owner’s Stripe billing.';
    if (modules.includes(feature.key) && row?.source !== 'subscription' && (!venue.verification_approved_at || !venue.verification_approved_by)) return 'Approve ownership before granting features.';
  }
  return null;
}
// Privileged data stays behind server-checked RPCs; no service key is used by the browser.
const adminDb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await adminDb.rpc(name, args); if (error) throw error; return data as T;
}
export const getPlatformOverview = () => rpc<PlatformOverview>('platform_admin_overview');
export const getPlatformVenues = (search: string, filter: string, page: number) =>
  rpc<{ total: number; rows: PlatformVenue[] }>('platform_admin_venues', { p_search: search, p_filter: filter, p_page: page });
export const saveVenueAccess = (venue: PlatformVenue, modules: VenueModuleKey[], expires: string, note: string) =>
  rpc('platform_set_venue_access', { p_venue: venue.id, p_modules: modules, p_expires: expires ? new Date(expires).toISOString() : null, p_note: note.trim(), p_expected: venue.modules });
export async function getPlatformActivity(page = 0, venueId?: string) {
  let query = adminDb.from('platform_admin_audit').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 25, page * 25 + 24);
  if (venueId) query = query.eq('venue_id', venueId);
  const { data, error } = await query; if (error) throw error; return (data ?? []) as PlatformAction[];
}

