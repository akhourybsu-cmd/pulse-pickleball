import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const { from, invoke } = vi.hoisted(() => ({ from: vi.fn(), invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from, functions: { invoke } } }));
import { fetchSavedGuests, requireGuestResult, sendGuestInvitation } from '@/lib/guests';
import { clearPostAuthRedirect, consumePostAuthRedirect, stashPostAuthRedirect } from '@/lib/authRedirect';
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

it('loads guests beyond the old 100-row limit and scopes every page to the current account', async () => {
  const pages = [Array.from({ length: 500 }, (_, i) => ({ id: `guest-${i}` })), [{ id: 'guest-501' }]];
  const queries = pages.map(data => {
    const chain = Object.assign(Promise.resolve({ data, error: null }), {
      select: vi.fn(), order: vi.fn(), range: vi.fn(), eq: vi.fn(), is: vi.fn(),
    });
    for (const key of ['select', 'order', 'range', 'eq', 'is'] as const) chain[key].mockReturnValue(chain);
    return chain;
  });
  queries.forEach(q => from.mockReturnValueOnce(q));
  expect(await fetchSavedGuests('owner')).toHaveLength(501);
  queries.forEach(q => {
    expect(q.eq).toHaveBeenCalledWith('created_by', 'owner');
    expect(q.is).toHaveBeenCalledWith('archived_at', null);
    expect(q.is).toHaveBeenCalledWith('linked_user_id', null);
  });
  expect(queries[1].range).toHaveBeenCalledWith(500, 999);
});
it('does not mistake a rejected database result for a successful merge', () => {
  expect(() => requireGuestResult({ ok: false, error: 'active_event_merge' })).toThrow('Finish the guests');
  expect(() => requireGuestResult(null)).toThrow();
  expect(() => requireGuestResult({ ok: true }, { message: 'failed' })).toThrow();
});
it('handles resolved function errors and suppression rather than reporting an email as sent', async () => {
  for (const response of [{ error: new Error('401'), data: null }, { data: { success: false, reason: 'email_suppressed' }, error: null }, { data: {}, error: null }]) {
    invoke.mockResolvedValueOnce(response);
    await expect(sendGuestInvitation('invite')).rejects.toThrow('Email could not be queued');
  }
  invoke.mockResolvedValueOnce({ data: { success: true, queued: true }, error: null });
  await expect(sendGuestInvitation('invite')).resolves.toBeUndefined();
  expect(invoke).toHaveBeenLastCalledWith('send-guest-invite', { body: { inviteId: 'invite' } });
});
it('preserves guest claiming through competing login callbacks and a new confirmation tab', () => {
  const memory = () => { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }; };
  vi.stubGlobal('sessionStorage', memory()); vi.stubGlobal('localStorage', memory());
  const target = '/claim-guest/a-valid_guest-token';
  stashPostAuthRedirect(target);
  expect(consumePostAuthRedirect()).toBe(target);
  vi.stubGlobal('sessionStorage', memory());
  expect(consumePostAuthRedirect()).toBe(target);
  clearPostAuthRedirect(target);
  expect(consumePostAuthRedirect()).toBe('/player/dashboard');
});
