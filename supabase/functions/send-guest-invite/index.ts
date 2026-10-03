import { createClient } from 'npm:@supabase/supabase-js@2';
import { readCallerMfa } from '../_shared/mfa.ts';
import { handleGuestInvite } from './handler.ts';

Deno.serve((req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  return handleGuestInvite(req, {
    authenticate: readCallerMfa,
    findAuthorizedInvite: async (request, id) => {
      const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: request.headers.get('authorization')! } },
        auth: { persistSession: false },
      });
      const { data, error } = await caller.from('guest_claim_invites')
        .select('id, token, invited_email, status, expires_at, email_queued_at').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    reserve: async (id) => {
      const { data, error } = await admin.from('guest_claim_invites')
        .update({ email_attempted_at: new Date().toISOString() }).eq('id', id)
        .eq('status', 'pending').gt('expires_at', new Date().toISOString()).is('email_queued_at', null)
        .or(`email_attempted_at.is.null,email_attempted_at.lt.${new Date(Date.now() - 120_000).toISOString()}`)
        .select('id');
      if (error) throw error;
      return !!data?.length;
    },
    markQueued: async (id) => {
      const { error } = await admin.from('guest_claim_invites').update({ email_queued_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    enqueue: async (body) => {
      const response = await fetch(`${url}/functions/v1/send-transactional-email`, {
        method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error('email_enqueue_failed');
      return await response.json();
    },
  });
});
