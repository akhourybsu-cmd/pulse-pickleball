// Firebase Hosting v1beta1 customDomains. No user-supplied endpoints or credentials.
export class HostingSetupError extends Error {}
export interface DnsRecord { domainName: string; type: string; rdata: string; requiredAction: string }
interface DnsUpdates { desired?: { records?: DnsRecord[] }[] }
export interface HostingDomain {
  hostState?: string;
  ownershipState?: string;
  deleteTime?: string;
  redirectTarget?: string;
  issues?: { message?: string }[];
  requiredDnsUpdates?: DnsUpdates;
  cert?: { state?: string; issues?: { message?: string }[]; verification?: { dns?: DnsUpdates } };
}
export function hostingResult(domain: HostingDomain) {
  const dns = [...(domain.requiredDnsUpdates?.desired ?? []), ...(domain.cert?.verification?.dns?.desired ?? [])]
    .flatMap(set => set.records ?? []).filter(record => ['ADD', 'REMOVE'].includes(record.requiredAction));
  const records = [...new Map(dns.map(record => [JSON.stringify(record), record])).values()];
  const issues = [...(domain.issues ?? []), ...(domain.cert?.issues ?? [])].map(issue => issue.message).filter(Boolean);
  if (domain.deleteTime) issues.push('This hosting address was deleted. Restore it in Firebase before checking again.');
  if (domain.redirectTarget) issues.push('Remove the Firebase domain redirect so the venue entry link can open the correct page.');
  const connected = domain.hostState === 'HOST_ACTIVE' && domain.ownershipState === 'OWNERSHIP_ACTIVE'
    && domain.cert?.state === 'CERT_ACTIVE' && !issues.length && !records.length;
  return {
    status: connected ? 'connected' as const : issues.length || records.length ? 'action_required' as const : 'provisioning' as const,
    provider_details: { host: domain.hostState, ownership: domain.ownershipState, certificate: domain.cert?.state, dns: records, issues },
  };
}

const project = 'pulse-pickleball-c60e1';
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const encodeText = (text: string) => encode(new TextEncoder().encode(text));

async function accessToken(rawAccount: string, fetcher: typeof fetch): Promise<string> {
  let account: { project_id?: string; client_email?: string; private_key?: string };
  try { account = JSON.parse(rawAccount); }
  catch { throw new HostingSetupError('The platform hosting service account is not valid JSON. Check the Edge Function secret.'); }
  if (!account) throw new HostingSetupError('The platform hosting service account is missing.');
  if (account.project_id !== project || !account.client_email || !account.private_key) throw new HostingSetupError('Use a Firebase Hosting service account for the production PULSE project.');
  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  let key: CryptoKey;
  try { key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']); }
  catch { throw new HostingSetupError('The platform hosting private key is invalid. Replace the service account secret.'); }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encodeText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${encodeText(JSON.stringify({
    iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.hosting',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${encode(new Uint8Array(signature))}` }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new HostingSetupError('Firebase authentication failed. Check the platform hosting service account.');
  const data = await response.json();
  if (typeof data.access_token !== 'string') throw new HostingSetupError('Firebase authentication did not return an access token.');
  return data.access_token;
}

export async function syncHostingDomain(slug: string, token: string, fetcher: typeof fetch = fetch) {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) throw new HostingSetupError('Invalid venue address.');
  const parent = `https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${project}/customDomains`;
  const domain = `${slug}.pulsepb.com`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const read = () => fetcher(`${parent}/${domain}`, { headers, signal: AbortSignal.timeout(10_000) });
  let response = await read();
  if (response.status === 404) {
    const creation = await fetcher(`${parent}?customDomainId=${domain}`, {
      method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(10_000),
    });
    if (!creation.ok && creation.status !== 409) throw new HostingSetupError(`Firebase could not create this address (HTTP ${creation.status}). Check permissions and hosting limits.`);
    if (creation.ok) {
      const operation = await creation.json();
      if (operation.error) throw new HostingSetupError('Firebase could not finish creating this address. Review the domain in Firebase and try again.');
    }
    response = await read();
    // Creation is asynchronous. Never label an accepted operation as connected.
    if (response.status === 404) return hostingResult({});
  }
  if (!response.ok) throw new HostingSetupError(`Firebase could not check this address (HTTP ${response.status}). Try again after reviewing hosting access.`);
  return hostingResult(await response.json());
}

export async function connectFirebaseAddress(slug: string, rawAccount: string | undefined, fetcher: typeof fetch = fetch) {
  if (!rawAccount) throw new HostingSetupError('Platform setup needed: configure FIREBASE_HOSTING_SERVICE_ACCOUNT_JSON in the venue-integrations Edge Function secrets.');
  return syncHostingDomain(slug, await accessToken(rawAccount, fetcher), fetcher);
}
