import { supabase } from '@/integrations/supabase/client';

export interface VenueApplicationDetails {
  name: string; description: string; address: string; city: string; state: string;
  website: string; contact_name: string; contact_email: string; contact_phone: string;
  evidence: string; authorized: boolean;
  visibility: 'public' | 'unlisted' | 'private';
  join_method: 'open' | 'request_to_join' | 'invite_only';
}
export interface VenueApplication {
  id: string; applicant_id: string; venue_id: string | null; group_id: string | null;
  details: VenueApplicationDetails;
  status: 'pending' | 'needs_info' | 'approved' | 'rejected' | 'withdrawn';
  review_note: string | null; reviewed_at: string | null; created_at: string;
}
export const APPLICATION_STATUS: Record<VenueApplication['status'], string> = {
  pending: 'Under review', needs_info: 'More information needed', approved: 'Approved', rejected: 'Not approved', withdrawn: 'Withdrawn',
};
export const EMPTY_VENUE_APPLICATION: VenueApplicationDetails = {
  name: '', description: '', address: '', city: '', state: '', website: '', contact_name: '', contact_email: '', contact_phone: '',
  evidence: '', authorized: false, visibility: 'public', join_method: 'open',
};
export function applicationError(d: VenueApplicationDetails): string | null {
  for (const key of ['name','address','city','state','contact_name','contact_email','contact_phone'] as const) {
    if (!d[key].trim()) return `Please enter ${key.replace(/_/g, ' ')}.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact_email)) return 'Enter a valid contact email.';
  try { const url = new URL(d.website); if (url.protocol !== 'https:' || !url.hostname.includes('.')) throw new Error(); }
  catch { return 'Add an HTTPS business website or public business listing.'; }
  if (d.evidence.trim().length < 30) return 'Explain your connection to the venue and how PULSE can independently verify it (at least 30 characters).';
  if (!d.authorized) return 'Confirm that you are authorized to represent this venue.';
  return null;
}

// Isolate the new migration boundary until the next full generated-schema refresh.
// No service credentials or privileged write client is used in the browser.
const venueDb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
export async function listVenueApplications(userId?: string, status?: string, page = 0, venueId?: string | null): Promise<VenueApplication[]> {
  let query = venueDb.from('venue_applications').select('*').order('created_at', { ascending: status === 'pending' }).range(page * 50, page * 50 + 49);
  if (userId) query = query.eq('applicant_id', userId);
  if (status) query = query.eq('status', status);
  if (venueId) query = query.eq('venue_id', venueId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
export async function submitVenueApplication(details: VenueApplicationDetails, applicationId?: string, venueId?: string | null) {
  const { data, error } = await venueDb.rpc('submit_venue_application', { p_details: details, p_application_id: applicationId ?? null, p_venue_id: venueId ?? null });
  if (error) throw error;
  return data as string;
}
export async function reviewVenueApplication(id: string, decision: string, note: string, checked: boolean) {
  const { error } = await venueDb.rpc('review_venue_application', { p_application_id: id, p_decision: decision, p_note: note, p_ownership_checked: checked });
  if (error) throw error;
}
export async function withdrawVenueApplication(id: string) {
  const { error } = await venueDb.rpc('withdraw_venue_application', { p_application_id: id });
  if (error) throw error;
}
export type VenueModuleKey = 'court_booking' | 'facility_tools';
export interface VenueModuleAccess { module_key: VenueModuleKey; source: string; enabled: boolean; expires_at: string | null }
export async function listVenueModules(venueId: string): Promise<VenueModuleAccess[]> {
  const { data, error } = await venueDb.from('venue_module_access').select('module_key,source,enabled,expires_at').eq('venue_id', venueId);
  if (error) throw error;
  return data ?? [];
}
export function hasVenueModule(rows: VenueModuleAccess[], key: VenueModuleKey, now = Date.now()): boolean {
  return rows.some(row => row.module_key === key && row.enabled && (!row.expires_at || Date.parse(row.expires_at) > now));
}
