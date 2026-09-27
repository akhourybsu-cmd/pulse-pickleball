import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireCallerMfa } from '../_shared/mfa.ts';
import { connectFirebaseAddress } from './firebase.ts';
import { createAddressHandler, headers } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createAddressHandler({
  async authorize(req) {
    const mfaDenial = await requireCallerMfa(req);
    if (mfaDenial) return mfaDenial;
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await caller.auth.getUser();
    if (error || !user || user.is_anonymous) return new Response(JSON.stringify({ error: 'Sign in to continue.' }), { status: 401, headers });
    const access = await caller.rpc('is_platform_superadmin');
    if (access.error || access.data !== true) return new Response(JSON.stringify({ error: 'PULSE administrator access required.' }), { status: 403, headers });
    return { actor: user.id };
  },
  async claim(venueId, actor) {
    const { data, error } = await service.rpc('begin_venue_address_check', { p_venue_id: venueId, p_actor: actor });
    if (error) throw error;
    return data;
  },
  connect: slug => connectFirebaseAddress(slug, Deno.env.get('FIREBASE_HOSTING_SERVICE_ACCOUNT_JSON')),
  async finish(venue, actor, token, result) {
    const { error } = await service.rpc('finish_venue_address_check', {
      p_venue_id: venue, p_actor: actor, p_token: token, p_status: result.status, p_details: result.provider_details,
    });
    if (error) throw error;
  },
}));
