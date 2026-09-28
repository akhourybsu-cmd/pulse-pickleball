import { pathToFileURL } from 'node:url';
import { connectFirebaseAddress, HostingSetupError } from '../supabase/functions/venue-integrations/firebase.ts';
import { applyVenueDns, DnsSetupError } from './venue-address-dns.mjs';

export async function processAddressJobs({ claim, connect, dns, finish }) {
  const jobs = await claim();
  const counts = { processed: 0, connected: 0, provisioning: 0, action_required: 0, error: 0, persistence_errors: 0 };
  for (const job of jobs) {
    let result;
    try {
      result = await connect(job.slug);
      const changes = result.provider_details.dns ?? [];
      if (changes.length) {
        const applied = await dns(job.slug, changes);
        result.provider_details.dns_automation = applied.state;
        result.provider_details.issues = [...(result.provider_details.issues ?? []), ...applied.issues];
        if (applied.state === 'awaiting_propagation' && !result.provider_details.issues.length) result.status = 'provisioning';
      }
    } catch (error) {
      // Preserve Firebase's exact pending records when the DNS provider is unavailable.
      result = { status: 'error', provider_details: { ...result?.provider_details,
        issues: [error instanceof HostingSetupError || error instanceof DnsSetupError ? error.message : 'Address setup could not finish. The next automatic check will retry.'] } };
    }
    try { await finish(job, result); counts.processed++; counts[result.status]++; }
    catch { counts.persistence_errors++; }
  }
  return counts;
}

export function addressDatabase(accessToken, projectRef, fetcher = fetch) {
  if (!accessToken?.startsWith('sbp_') || projectRef !== 'rqfqwavhtfwwtmfjnxkx') throw new Error('Production address worker database credentials are not configured.');
  const sql = async query => {
    const response = await fetcher(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, read_only: false }), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Address queue database request failed (HTTP ${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Address queue returned an unexpected response.');
    return data;
  };
  // Encode provider data independently of PostgreSQL string-escape settings.
  const literal = value => `convert_from(decode('${Buffer.from(String(value)).toString('hex')}','hex'),'UTF8')`;
  const uuid = value => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid address lease.');
    return `${literal(value)}::uuid`;
  };
  return {
    claim: async () => (await sql('SELECT public.claim_venue_address_jobs(10) AS job')).map(row => row.job),
    finish: (job, result) => sql(`SELECT public.finish_venue_address_job(${uuid(job.venue_id)},${uuid(job.token)},${literal(result.status)},${literal(JSON.stringify(result.provider_details))}::jsonb)`),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const database = addressDatabase(process.env.SUPABASE_ACCESS_TOKEN, process.env.SUPABASE_PROJECT_REF);
    const counts = await processAddressJobs({ ...database,
      connect: slug => connectFirebaseAddress(slug, process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      dns: (slug, records) => applyVenueDns(slug, records, process.env.GODADDY_DNS_TOKEN),
    });
    // Logs contain aggregate results only. Domain names and provider details stay in the admin UI.
    console.log(JSON.stringify(counts));
    if (counts.persistence_errors || counts.error) process.exitCode = 1;
  } catch { console.error('Venue address worker failed. Check production credentials and the address queue migration.'); process.exitCode = 1; }
}
