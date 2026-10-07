// Isolated browser fixture: no network requests, live accounts or real emails.
import { useSyncExternalStore } from 'react';
const params = new URLSearchParams(window.location.search);
let user: { id: string; email: string } | null = params.has('claim') ? null : { id: 'owner', email: 'owner@example.test' };
const listeners = new Set<() => void>();
export const signIn = () => { user = { id: 'player', email: 'player@example.test' }; listeners.forEach(f => f()); };
export function useAuthState() { return { user: useSyncExternalStore(f => { listeners.add(f); return () => listeners.delete(f); }, () => user), loading: false, isAuthenticated: !!user }; }
const profiles = [{ id: 'p-jamie', full_name: 'Jamie Chen', display_name: 'Jamie Chen', gender: 'female', current_rating: 3.42 }, { id: 'p-devon', full_name: 'Devon Miller', display_name: 'Devon Miller', gender: 'male', current_rating: 3.58 }];
export const useFriends = () => ({ friends: profiles.map(profile => ({ profile })), loading: false });
export const useGroupMembers = () => ({ members: profiles.map(profile => ({ profile })), loading: false });
export const useRecentCoPlayers = () => ({ data: profiles, isLoading: false });
type Row = Record<string, any>;
const guests: Row[] = [
  { id: 'guest-alex', display_name: 'Alex Rivera', created_by: 'owner', gender: 'female', email: 'alex@example.test' },
  { id: 'guest-jordan', display_name: 'Jordan Brooks', created_by: 'owner', gender: 'male' },
].map(g => ({ archived_at: null, linked_user_id: null, created_at: '2026-10-01T12:00:00Z', group_id: null, phone: null, email: null, ...g }));
const invites: Row[] = [];
const tables: Record<string, Row[]> = { guest_players: guests, guest_claim_invites: invites, profiles_public: profiles };
function from(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let mutation: { op: string; payload: Row | Row[] } | null = null;
  let single = false; let range: [number, number] | null = null;
  const execute = async () => {
    await new Promise(r => setTimeout(r, mutation && params.has('slow') ? 4000 : 120));
    let rows = tables[table] ?? [];
    if (mutation?.op === 'insert') {
      const inserted = (Array.isArray(mutation.payload) ? mutation.payload : [mutation.payload]).map(p => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), archived_at: null, linked_user_id: null, ...p }));
      rows.push(...inserted); rows = inserted;
    } else rows = rows.filter(r => filters.every(f => f(r)));
    if (mutation?.op === 'update') rows.forEach(r => Object.assign(r, mutation!.payload));
    if (range) rows = rows.slice(range[0], range[1] + 1);
    return { data: single ? rows[0] ?? null : rows.map(r => ({ ...r })), error: null };
  };
  const query: any = {
    select: () => query, order: () => query,
    eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return query; },
    is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return query; },
    in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return query; },
    gt: (k: string, v: string) => { filters.push(r => r[k] > v); return query; },
    or: () => query, range: (a: number, b: number) => { range = [a, b]; return query; },
    insert: (payload: Row | Row[]) => { mutation = { op: 'insert', payload }; return query; },
    update: (payload: Row) => { mutation = { op: 'update', payload }; return query; },
    single: () => { single = true; return query; },
    then: (yes: any, no: any) => execute().then(yes, no),
  };
  return query;
}
let emailFailed = false;
export const supabase = {
  from,
  auth: { getUser: async () => ({ data: { user }, error: null }), signOut: async () => { user = null; listeners.forEach(f => f()); return { error: null }; } },
  functions: { invoke: async (_name: string, { body }: { body: { inviteId: string } }) => {
    if (!emailFailed) { emailFailed = true; return { data: null, error: new Error('Simulated mail outage') }; }
    const invite = invites.find(i => i.id === body.inviteId); if (invite) invite.email_queued_at = new Date().toISOString();
    return { data: { success: true, queued: true }, error: null };
  } },
  rpc: async (name: string, args: Row) => {
    await new Promise(r => setTimeout(r, 150));
    if (name === 'archive_guest_player') { const g = guests.find(g => g.id === args._guest_id)!; g.archived_at = args._archived ? new Date().toISOString() : null; return { data: { ok: true }, error: null }; }
    if (name === 'create_guest_claim_invite') {
      const row = { id: args._request_id, guest_player_id: args._guest_id, token: 'local-test-token', invited_email: args._email, status: 'pending', created_at: new Date().toISOString(), expires_at: '2099-10-03T12:00:00Z', email_queued_at: null };
      invites.push(row); return { data: { ok: true, invite_id: row.id, token: row.token }, error: null };
    }
    if (name === 'revoke_guest_claim_invite') { invites.find(i => i.id === args._invite_id)!.status = 'revoked'; return { data: { ok: true }, error: null }; }
    if (name === 'get_claim_invite') return { data: [{ guest_display_name: 'Alex Rivera', invited_email: 'player@example.test', status: 'pending', expires_at: '2099-10-03T12:00:00Z', is_linked: false }], error: null };
    if (name === 'claim_guest_profile') return { data: { ok: true, status: 'linked' }, error: null };
    return { data: { ok: false, error: 'active_event_merge' }, error: null };
  },
};
