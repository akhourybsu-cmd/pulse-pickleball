import { supabase } from '@/integrations/supabase/client';

const messages: Record<string, string> = {
  not_authorized: 'You no longer have permission to manage this guest.',
  not_authenticated: 'Please sign in to continue.',
  guest_unavailable: 'This guest was archived or already linked to an account.',
  invalid_email: 'Enter a valid email address.',
  invite_limit: 'Too many invitations were created recently. Please try again in an hour.',
  expired: 'This invitation expired. Ask the organizer for a new one.',
  already_linked: 'This guest is already linked to another account.',
  claim_in_review: 'This invitation already has a claim awaiting organizer approval.',
  duplicate_participation: 'These records occupy separate places in the same event or match. Contact the organizer to resolve the duplicate first.',
  active_event_merge: 'Finish the guests’ scheduled round robins before merging them. Their current seats will stay unchanged.',
  linked_guest_merge: 'Claimed profiles cannot be merged as guests.',
  venue_customer_conflict: 'These guests have separate venue customer records. Resolve those with the venue before merging.',
  not_pending: 'This invitation is no longer awaiting action. Refresh to see its latest status.',
  invite_revoked: 'This invitation was revoked. Ask the organizer for a new one.',
};

export function guestErrorMessage(error: unknown, fallback = 'Could not complete this guest action. Please try again.'): string {
  const raw = typeof error === 'string' ? error : error instanceof Error ? error.message
    : error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return messages[raw] ?? fallback;
}

export function requireGuestResult<T extends { ok?: boolean; error?: string }>(data: unknown, error?: { message: string } | null): T {
  if (error) throw new Error(guestErrorMessage(error));
  const result = data as T | null;
  if (!result?.ok) throw new Error(guestErrorMessage(result?.error));
  return result;
}

/** Read all permitted guests in stable pages; never silently truncate at 100. */
export async function fetchSavedGuests(userId: string, groupId?: string | null, includeArchived = false) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from('guest_players')
      .select('id, display_name, email, phone, linked_user_id, created_at, group_id, gender, archived_at')
      .order('display_name').order('id').range(offset, offset + 499);
    query = groupId ? query.or(`created_by.eq.${userId},group_id.eq.${groupId}`) : query.eq('created_by', userId);
    if (!includeArchived) query = query.is('archived_at', null).is('linked_user_id', null);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

export async function sendGuestInvitation(inviteId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-guest-invite', { body: { inviteId } });
  if (error || !data?.success || !data?.queued) {
    throw new Error('Email could not be queued. You can copy the link, or retry the email in two minutes.');
  }
}
