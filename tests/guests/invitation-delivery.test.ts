import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGuestInvite, type GuestInvitation, type GuestInviteDependencies } from '../../supabase/functions/send-guest-invite/handler';
import { MfaAccessError } from '../../supabase/functions/_shared/mfa';

const id = '70000000-0000-4000-8000-000000000030';
const invitation: GuestInvitation = {
  id, token: 'server-generated-token', invited_email: 'guest@example.test', status: 'pending',
  expires_at: '2099-10-03T00:00:00Z', email_queued_at: null,
};
let deps: GuestInviteDependencies;
const request = (body: unknown = { inviteId: id }) => new Request('https://local.test/send-guest-invite', {
  method: 'POST', headers: { Authorization: 'Bearer caller-token' }, body: JSON.stringify(body),
});
beforeEach(() => {
  deps = {
    authenticate: vi.fn().mockResolvedValue({ verified: true, userId: 'owner', method: 'none' }),
    findAuthorizedInvite: vi.fn().mockResolvedValue(invitation), reserve: vi.fn().mockResolvedValue(true),
    markQueued: vi.fn().mockResolvedValue(undefined), enqueue: vi.fn().mockResolvedValue({ success: true, queued: true }),
  };
});
describe('guest invitation mail boundary', () => {
  it('uses only the authorized saved recipient and canonical link, ignoring client overrides', async () => {
    const response = await handleGuestInvite(request({ inviteId: id, recipientEmail: 'attacker@example.test', claimUrl: 'https://evil.test' }), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, queued: true });
    expect(deps.enqueue).toHaveBeenCalledWith({ templateName: 'guest-claim-invite', recipientEmail: 'guest@example.test',
      idempotencyKey: `guest-claim-${id}`, templateData: { claimUrl: 'https://pulsepb.com/claim-guest/server-generated-token' } });
  });
  it.each([401, 403])('does not read invites or send mail without verified access (%i)', async (status) => {
    vi.mocked(deps.authenticate).mockRejectedValue(new MfaAccessError(status, 'not_authorized'));
    expect((await handleGuestInvite(request(), deps)).status).toBe(status);
    expect(deps.findAuthorizedInvite).not.toHaveBeenCalled(); expect(deps.enqueue).not.toHaveBeenCalled();
  });
  it('honors invitation RLS when another organizer requests delivery', async () => {
    vi.mocked(deps.findAuthorizedInvite).mockResolvedValue(null);
    expect((await handleGuestInvite(request(), deps)).status).toBe(404);
    expect(deps.reserve).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'revoked' }, { status: 'accepted' }, { status: 'awaiting_approval' },
    { expires_at: '2000-01-01T00:00:00Z' }, { invited_email: null },
  ])('refuses inactive or non-email invitations: %j', async (changes) => {
    vi.mocked(deps.findAuthorizedInvite).mockResolvedValue({ ...invitation, ...changes });
    expect((await handleGuestInvite(request(), deps)).status).toBe(409);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
  it('reports suppression and queue failures instead of claiming success', async () => {
    vi.mocked(deps.enqueue).mockResolvedValue({ success: false, reason: 'email_suppressed' });
    const response = await handleGuestInvite(request(), deps);
    expect(response.status).toBe(422); expect(await response.json()).toMatchObject({ error: 'email_suppressed' });
    expect(deps.markQueued).not.toHaveBeenCalled();
    vi.mocked(deps.enqueue).mockRejectedValue(new Error('transport failed'));
    expect((await handleGuestInvite(request(), deps)).status).toBe(503);
  });
  it('deduplicates delivery retries and rate limits overlapping attempts', async () => {
    vi.mocked(deps.findAuthorizedInvite).mockResolvedValue({ ...invitation, email_queued_at: new Date().toISOString() });
    expect((await handleGuestInvite(request(), deps)).status).toBe(200);
    expect(deps.enqueue).not.toHaveBeenCalled();
    vi.mocked(deps.findAuthorizedInvite).mockResolvedValue(invitation);
    vi.mocked(deps.reserve).mockResolvedValue(false);
    expect((await handleGuestInvite(request(), deps)).status).toBe(429);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
  it('validates method and request before fetching recipients', async () => {
    expect((await handleGuestInvite(new Request('https://local.test'), deps)).status).toBe(405);
    expect((await handleGuestInvite(request(null), deps)).status).toBe(400);
    expect((await handleGuestInvite(request({ inviteId: 'bad' }), deps)).status).toBe(400);
    expect(deps.findAuthorizedInvite).not.toHaveBeenCalled();
  });
});
