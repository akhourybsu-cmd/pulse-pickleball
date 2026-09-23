import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mfaEmailHandler } from '../_shared/mfa-handlers.ts';
import { readCallerMfa } from '../_shared/mfa.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(mfaEmailHandler('verify', {
  read: readCallerMfa,
  rpc: (name, args) => admin.rpc(name, args),
  deliver: async () => { throw new Error('Verification never sends email'); },
}));
