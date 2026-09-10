import { supabase } from '@/integrations/supabase/client';
import { PROGRAM_FORMATS } from './programExperience';

export interface VenueAdminCounts {
  courts: number;
  staff: number;
  upcoming: number;
  posts: number;
  members?: number;
  pendingMembers?: number;
  contactReady?: boolean;
}

export async function fetchVenueAdminCounts(venueId: string, groupId: string, canManageCommunity: boolean): Promise<VenueAdminCounts> {
  const counts = { count: 'exact' as const, head: true };
  const [results, profile] = await Promise.all([Promise.all([
    supabase.from('venue_courts').select('id', counts).eq('venue_id', venueId).neq('is_active', false),
    supabase.from('venue_staff_public').select('user_id', counts).eq('venue_id', venueId),
    // A venue can host another community's programs; count the facility, not only its own group.
    supabase.from('group_events').select('id', counts).eq('venue_id', venueId)
      .is('parent_event_id', null).in('event_format', [...PROGRAM_FORMATS]).gte('start_time', new Date().toISOString()),
    supabase.from('group_posts').select('id', counts).eq('group_id', groupId),
    supabase.from('group_members').select('id', counts).eq('group_id', groupId).eq('status', 'active'),
    canManageCommunity ? supabase.from('group_members').select('id', counts).eq('group_id', groupId).eq('status', 'pending') : Promise.resolve({ count: 0, error: null }),
  ]), supabase.from('venues').select('phone,email,website_url').eq('id', venueId).maybeSingle()]);
  if (profile.error) throw profile.error;
  if (!profile.data) throw new Error('Venue details were not confirmed. Try again.');
  for (const result of results) {
    if (result.error) throw result.error;
    if (result.count == null) throw new Error('Venue totals were not confirmed. Try again.');
  }
  const [courts, staff, upcoming, posts, members, pendingMembers] = results.map(result => result.count!);
  return { courts, staff, upcoming, posts, members, pendingMembers, contactReady: !!(profile.data.phone?.trim() || profile.data.email?.trim() || profile.data.website_url?.trim()) };
}

export type VenueNextStep = { id: string; title: string; description: string; action: 'members' | 'verify' | 'profile' | 'facility' | 'play'; label: string };
export function venueNextSteps({ counts, verified, isOwner, canManageCommunity, facilityEnabled, contactReady, privateSample }: {
  counts?: VenueAdminCounts; verified: boolean; isOwner: boolean; canManageCommunity: boolean;
  facilityEnabled: boolean; contactReady: boolean; privateSample: boolean;
}): VenueNextStep[] {
  const steps: VenueNextStep[] = [];
  if (canManageCommunity && (counts?.pendingMembers ?? 0) > 0) steps.push({ id: 'members', title: `${counts!.pendingMembers} join request${counts!.pendingMembers === 1 ? '' : 's'} to review`, description: 'Welcome new players or resolve requests from the member list.', action: 'members', label: 'Review requests' });
  if (!privateSample && isOwner && !verified) steps.push({ id: 'verify', title: 'Verify venue ownership', description: 'Review your request or submit evidence for a free ownership check. This does not start a subscription.', action: 'verify', label: 'Review verification' });
  if (!privateSample && !contactReady) steps.push({ id: 'contact', title: 'Add a way to reach your venue', description: 'Give players a phone number, email address, or website in your venue profile.', action: 'profile', label: 'Edit contact details' });
  if (facilityEnabled && counts?.courts === 0) steps.push({ id: 'courts', title: 'Set up your bookable courts', description: 'Add or activate courts and review your hours before opening the schedule to players.', action: 'facility', label: 'Set up courts' });
  if (canManageCommunity && counts?.upcoming === 0) steps.push({ id: 'programs', title: 'Plan your next session', description: 'Your upcoming venue schedule is empty. Open the calendar to organize community play.', action: 'play', label: 'Open programs' });
  return steps;
}
