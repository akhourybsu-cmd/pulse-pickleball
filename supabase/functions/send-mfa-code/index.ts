import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mfaEmailHandler } from '../_shared/mfa-handlers.ts';
import { readCallerMfa } from '../_shared/mfa.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(mfaEmailHandler('send', {
  read: readCallerMfa,
  rpc: (name, args) => admin.rpc(name, args),
  deliver: async (email, challengeId) => {
    const key = Deno.env.get('RESEND_API_KEY');
    if (!key) throw new Error('email_unavailable');
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `mfa-${challengeId}` },
      signal: AbortSignal.timeout(10_000), body: JSON.stringify(email),
    });
    if (!sent.ok) throw new Error('delivery_failed');
  },
}));
