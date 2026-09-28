export const RESERVED_VENUE_HOSTS = new Set(['www', 'app', 'api', 'auth', 'admin', 'mail', 'notify', 'support', 'staging', 'dev', 'preview', 'status', 'help', 'account', 'accounts', 'billing', 'payment', 'payments', 'login', 'signup', 'cdn', 'assets', 'static', 'docs', 'blog', 'email', 'smtp', 'ftp', 'ns1', 'ns2', 'autodiscover', 'pulse', 'venues', 'community']);
export const venueAddressUrl = (slug: string) => `https://${slug}.pulsepb.com`;
export const suggestedVenueAddress = (slug: string) => slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
export function venueAddressError(slug: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) return 'Use 3–63 letters, numbers or hyphens. Start and end with a letter or number.';
  if (RESERVED_VENUE_HOSTS.has(slug)) return 'That name is reserved by PULSE. Try your venue name or add your city.';
  return null;
}
export type AddressStatus = 'requested' | 'provisioning' | 'action_required' | 'connected' | 'error';
export const ADDRESS_STATUS: Record<AddressStatus, { label: string; message: string }> = {
  requested: { label: 'Request received', message: 'Your name is reserved and setup is queued automatically. You can keep sharing your current venue link while we connect your address.' },
  provisioning: { label: 'Getting ready', message: 'PULSE is setting up your secure address and checking progress automatically. DNS and HTTPS can take up to 24 hours.' },
  action_required: { label: 'PULSE is finishing setup', message: 'Your address needs a little more setup from PULSE. Your name is reserved, and your current venue link is still available.' },
  error: { label: 'PULSE is checking setup', message: 'We couldn’t confirm the connection yet. PULSE will retry automatically and can review any setup issue. In the meantime, use your current venue link.' },
  connected: { label: 'Address connected', message: 'Your PULSE address is connected. Visitors can explore your public venue page and create a free account when they’re ready to join in.' },
};
