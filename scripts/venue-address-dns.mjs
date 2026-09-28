// GoDaddy v3 adds individual records, never replaces a zone or an existing RRset.
// https://developer.godaddy.com/en/docs/references/rest/domains/v3/records
const endpoint = 'https://api.godaddy.com/v3/domains/zones/pulsepb.com/dns-records';
export class DnsSetupError extends Error {}
const normalized = value => value.toLowerCase().replace(/\.$/, '');
const sameData = (type, a, b) => type === 'CNAME' ? normalized(a) === normalized(b) : a === b;

export function managedRecord(slug, record) {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) return null;
  const host = `${slug}.pulsepb.com`;
  const name = normalized(record.domainName ?? '');
  if (![host, `_acme-challenge.${host}`].includes(name) || record.requiredAction !== 'ADD'
    || !['A', 'AAAA', 'CNAME', 'TXT'].includes(record.type)
    || typeof record.rdata !== 'string' || !record.rdata || record.rdata.length > 2048) return null;
  const data = record.type === 'TXT' && /^"[^"\\]*"$/.test(record.rdata) ? record.rdata.slice(1, -1) : record.rdata;
  return { name: name.slice(0, -'.pulsepb.com'.length), type: record.type, data, ttl: 600 };
}

export async function applyVenueDns(slug, records, token, fetcher = fetch) {
  if (!records.length) return { state: 'not_needed', issues: [] };
  if (!token) return { state: 'needs_credentials', issues: ['Connect GoDaddy DNS once: add the GODADDY_DNS_TOKEN repository secret with DNS access to pulsepb.com. Automatic hosting checks will continue.'] };
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const call = async (url, options = {}) => {
    const response = await fetcher(url, { ...options, headers, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new DnsSetupError(`GoDaddy DNS request failed (HTTP ${response.status}). Check DNS access and token expiry.`);
    return response;
  };
  const issues = [];
  for (const record of records) {
    const desired = managedRecord(slug, record);
    if (!desired) { issues.push('A DNS change needs administrator review. Only additions for this venue and its certificate challenge are automated.'); continue; }
    // Read ALL types at this exact host to detect CNAME and routing conflicts.
    const response = await call(`${endpoint}?name=${encodeURIComponent(desired.name)}&pageSize=100&totalRequired=true`);
    const page = await response.json();
    if (!Array.isArray(page.items) || page.items.length >= 100 || page.totalPages > 1
      || page.items.some(item => item.name !== desired.name || typeof item.data !== 'string')) {
      throw new DnsSetupError('GoDaddy returned an incomplete DNS record list. Review this host before adding records.');
    }
    const existing = page.items;
    if (existing.some(item => item.type === desired.type && sameData(desired.type, item.data, desired.data))) continue;
    if (existing.some(item => item.type === 'CNAME' || desired.type === 'CNAME'
      || (['A','AAAA'].includes(desired.type) && ['A','AAAA'].includes(item.type)
        && !records.some(candidate => {
          const other = managedRecord(slug, candidate);
          return other && other.name === desired.name && other.type === item.type && other.data === item.data;
        })))) {
      issues.push(`Existing DNS at ${desired.name}.pulsepb.com needs review before routing can change.`); continue;
    }
    await call(endpoint, { method: 'POST', body: JSON.stringify(desired) });
  }
  return { state: issues.length ? 'needs_review' : 'awaiting_propagation', issues: [...new Set(issues)] };
}
