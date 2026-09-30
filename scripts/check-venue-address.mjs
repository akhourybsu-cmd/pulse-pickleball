import { pathToFileURL } from 'node:url';
import { PRODUCTION_SUPABASE_PROJECT } from '../src/lib/backendPolicy.mjs';

export function venueAddressStatusQuery(venueId) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(venueId || '')) throw new Error('A venue UUID is required.');
  // Selected setup states only: no credentials, DNS proof values, owner IDs or
  // notification contents may leave the database in workflow logs.
  return `SELECT jsonb_build_object(
    'status', c.status, 'checked_at', c.checked_at, 'check_after', c.check_after,
    'host', c.provider_details->>'host', 'ownership', c.provider_details->>'ownership',
    'certificate', c.provider_details->>'certificate', 'dns_automation', c.provider_details->>'dns_automation',
    'pending_dns_records', jsonb_array_length(coalesce(c.provider_details->'dns','[]'::jsonb)),
    'provider_issue_count', jsonb_array_length(coalesce(c.provider_details->'issues','[]'::jsonb)),
    'public_ready', public.get_public_community(NULL,v.slug) IS NOT NULL,
    'public_url', CASE WHEN public.get_public_community(NULL,v.slug) IS NOT NULL THEN 'https://'||c.slug||'.pulsepb.com' END,
    'live_confirmation_count', (SELECT count(*) FROM public.user_notifications n WHERE n.notification_type='venue_address_live' AND n.metadata->>'venue_id'=v.id::text)
  ) AS address FROM public.venue_address_connections c JOIN public.venues v ON v.id=c.venue_id WHERE v.id='${venueId}'::uuid;`;
}

export async function checkVenueAddress(env = process.env, request = fetch) {
  if (env.SUPABASE_PROJECT_REF !== PRODUCTION_SUPABASE_PROJECT || !env.SUPABASE_ACCESS_TOKEN?.startsWith('sbp_')) throw new Error('Approved production project and deployment credential are required.');
  const response = await request(`https://api.supabase.com/v1/projects/${PRODUCTION_SUPABASE_PROJECT}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: venueAddressStatusQuery(env.VENUE_ID), read_only: true }), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Venue address status check failed (HTTP ${response.status}).`);
  return (await response.json())[0]?.address ?? { status: 'not_requested' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await checkVenueAddress())); }
  catch { console.error('Venue address status could not be checked.'); process.exitCode = 1; }
}
