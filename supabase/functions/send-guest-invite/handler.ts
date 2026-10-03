import { MfaAccessError, type MfaStatus } from '../_shared/mfa.ts';

export interface GuestInvitation {
  id: string;
  token: string;
  invited_email: string | null;
  status: string;
  expires_at: string;
  email_queued_at: string | null;
}
export interface GuestInviteDependencies {
  authenticate(req: Request): Promise<MfaStatus>;
  // Must use the caller's JWT and invitation row security, never service role.
  findAuthorizedInvite(req: Request, id: string): Promise<GuestInvitation | null>;
  reserve(id: string): Promise<boolean>;
  markQueued(id: string): Promise<void>;
  enqueue(body: Record<string, unknown>): Promise<{ success?: boolean; queued?: boolean; reason?: string }>;
}
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });

export async function handleGuestInvite(req: Request, deps: GuestInviteDependencies): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  try {
    const caller = await deps.authenticate(req);
    if (!caller.userId || !caller.verified) return reply(403, { error: 'mfa_required' });
    let body: { inviteId?: string };
    try { body = await req.json(); } catch { return reply(400, { error: 'invalid_request' }); }
    if (!body || typeof body.inviteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.inviteId)) {
      return reply(400, { error: 'invalid_invite' });
    }
    const invite = await deps.findAuthorizedInvite(req, body.inviteId);
    if (!invite) return reply(404, { error: 'invite_unavailable' });
    if (invite.status !== 'pending' || Date.parse(invite.expires_at) <= Date.now() || !invite.invited_email) {
      return reply(409, { error: 'invite_not_sendable' });
    }
    if (invite.email_queued_at) return reply(200, { success: true, queued: true });
    if (!await deps.reserve(invite.id)) return reply(429, { error: 'send_in_progress' });
    const result = await deps.enqueue({
      templateName: 'guest-claim-invite', recipientEmail: invite.invited_email,
      idempotencyKey: `guest-claim-${invite.id}`,
      templateData: { claimUrl: `https://pulsepb.com/claim-guest/${invite.token}` },
    });
    if (!result.success || !result.queued) {
      return reply(422, { error: result.reason === 'email_suppressed' ? 'email_suppressed' : 'email_not_queued' });
    }
    await deps.markQueued(invite.id);
    return reply(200, { success: true, queued: true });
  } catch (error) {
    if (error instanceof MfaAccessError) return reply(error.status, { error: error.code });
    return reply(503, { error: 'email_unavailable' });
  }
}
