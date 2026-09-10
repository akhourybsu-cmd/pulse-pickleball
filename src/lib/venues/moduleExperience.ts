import { hasVenueModule, type VenueModuleAccess, type VenueModuleKey } from './venueApplications';

/** Metadata describes access, not a promise about a customer's next invoice. */
export function venueModulePresentation(rows: VenueModuleAccess[], key: VenueModuleKey, now = Date.now()) {
  const active = hasVenueModule(rows, key, now);
  const grant = rows.find(row => row.module_key === key && row.enabled && (!row.expires_at || Date.parse(row.expires_at) > now));
  const ended = rows.some(row => row.module_key === key && row.enabled && !!row.expires_at && Date.parse(row.expires_at) <= now);
  const through = active && grant?.expires_at ? new Date(grant.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  return {
    active,
    subscribed: active && grant?.source === 'subscription',
    label: active ? grant?.source === 'subscription' ? 'Paid access' : 'Included' : ended ? 'Access ended' : 'Optional upgrade',
    accessThrough: through,
  };
}

/** Update visible entitlement state at expiry, even if the cached rows do not change. */
export function nextVenueAccessChange(rows: VenueModuleAccess[], now = Date.now()): number | null {
  const next = rows.filter(row => row.enabled && row.expires_at).map(row => Date.parse(row.expires_at!)).filter(time => Number.isFinite(time) && time > now).sort((a, b) => a - b)[0];
  return next == null ? null : Math.min(2_147_483_647, Math.max(1, next - now + 1));
}
