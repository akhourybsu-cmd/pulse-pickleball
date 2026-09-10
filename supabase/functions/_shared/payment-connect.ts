import { appOrigin, checked, options, owner, type Runtime } from './payment-runtime.ts';

export function accountSnapshot(account: any) {
  return {
    charges_enabled: account.charges_enabled === true,
    payouts_enabled: account.payouts_enabled === true,
    details_submitted: account.details_submitted === true,
    card_payments_active: account.capabilities?.card_payments === 'active',
    disabled_reason: account.requirements?.disabled_reason || null,
    requirements_due: account.requirements?.currently_due ?? [],
    requirements_pending: account.requirements?.pending_verification ?? [],
    requirements_deadline: account.requirements?.current_deadline ? new Date(account.requirements.current_deadline * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}
export function assertIndependentAccount(account: any, platform: string) {
  if (!account || account.deleted || account.id === platform || !/^acct_[A-Za-z0-9]+$/.test(account.id)) throw new Error('Choose the venue’s own Stripe business account, not the PULSE account.');
  // Preserve the venue-controlled account model; do not silently assume liability.
  if (account.controller?.stripe_dashboard?.type !== 'full' || account.controller?.losses?.payments !== 'stripe' || account.controller?.fees?.payer !== 'account') throw new Error('This account needs a financial setup review. Venue payments require a venue-controlled Stripe account.');
}
export async function refreshVenueAccount(r: Runtime, mapping: any) {
  if (mapping.disconnected_at) throw new Error('Reconnect this venue’s Stripe account before accepting new payments.');
  const account = await r.stripe.accounts.retrieve(mapping.account_id);
  assertIndependentAccount(account, r.platform);
  const snapshot = accountSnapshot(account);
  checked(await r.store.from('venue_payment_accounts').update(snapshot).eq('venue_id', mapping.venue_id).eq('livemode', r.livemode).eq('account_id', mapping.account_id));
  return { ...mapping, ...snapshot };
}
export async function requireRentalAccount(r: Runtime, venueId: string) {
  const venue = checked(await r.store.from('venues').select('id,owner_id,verification_approved_at').eq('id', venueId).single());
  const mapping = checked(await r.store.from('venue_payment_accounts').select('*').eq('venue_id', venueId).eq('livemode', r.livemode).maybeSingle());
  if (!mapping || !venue || mapping.connected_by !== venue.owner_id || checked(await r.store.rpc('payment_venue_owner_eligible', { p_venue: venueId, p_owner: venue.owner_id, p_live: r.livemode })) !== true) throw new Error('The venue must complete financial ownership verification before taking payments.');
  const fresh = await refreshVenueAccount(r, mapping);
  if (!fresh.charges_enabled || !fresh.payouts_enabled || !fresh.card_payments_active || fresh.disabled_reason) throw new Error('The venue must finish its Stripe payment and payout requirements. No payment has been taken.');
  return fresh;
}
export async function stateHash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
}
export const connectReturnUrl = () => `${appOrigin()}/player/payments`;
export async function connectExisting(r: Runtime, userId: string, venueId: string, clientId: string) {
  await owner(r.store, userId, venueId);
  if (!/^ca_[A-Za-z0-9]+$/.test(clientId)) throw new Error('Connecting an existing Stripe account is not configured yet. Contact PULSE before creating a duplicate account.');
  const state = `${venueId}.${crypto.randomUUID()}.${crypto.randomUUID()}`;
  checked(await r.store.from('venue_payment_oauth_states').insert({ state_hash: await stateHash(state), venue_id: venueId, owner_id: userId, livemode: r.livemode }));
  const url = new URL('https://connect.stripe.com/oauth/authorize');
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, scope: 'read_write', redirect_uri: connectReturnUrl(), state }).toString();
  return { url: url.href };
}
export async function completeExisting(r: Runtime, userId: string, venueId: string, state: unknown, code: unknown) {
  if (typeof state !== 'string' || state.length > 200 || typeof code !== 'string' || !/^ac_[A-Za-z0-9]+$/.test(code) || code.length > 500) throw new Error('Invalid Stripe return. Start the connection again from this venue.');
  await owner(r.store, userId, venueId);
  const claimed = checked(await r.store.from('venue_payment_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('state_hash', await stateHash(state)).eq('venue_id', venueId).eq('owner_id', userId).eq('livemode', r.livemode).is('consumed_at', null).gt('expires_at', new Date().toISOString()).select('venue_id').maybeSingle());
  if (!claimed) throw new Error('This Stripe connection link expired or was already used. Start again from the venue payment page.');
  // Codes are one-time. Never log or retain the code, access token or refresh token.
  const result = await r.stripe.oauth.token({ grant_type: 'authorization_code', code, redirect_uri: connectReturnUrl() });
  if (result.livemode !== r.livemode || result.scope !== 'read_write' || !result.stripe_user_id) throw new Error('Stripe returned an unexpected account or payment environment.');
  const account = await r.stripe.accounts.retrieve(result.stripe_user_id);
  assertIndependentAccount(account, r.platform);
  const mapping = checked(await r.store.rpc('payment_link_venue_account', { p_venue: venueId, p_owner: userId, p_live: r.livemode, p_account: account.id }));
  await refreshVenueAccount(r, mapping);
  return { connected: true };
}

/** A portal configuration belongs to the merchant, never to the whole app. */
export async function merchantPortal(r: Runtime, account: string, customerId: string) {
  const list = await r.stripe.billingPortal.configurations.list({ active: true, limit: 100 }, options(r, account));
  let configuration = list.data.find((item: { metadata?: Record<string, string> | null }) => item.metadata?.pulse_portal === 'v1');
  if (!configuration) configuration = await r.stripe.billingPortal.configurations.create({
    business_profile: { headline: account === r.platform ? 'PULSE Pickleball billing' : 'Manage your venue payments' },
    features: { payment_method_update: { enabled: true }, invoice_history: { enabled: true }, subscription_cancel: { enabled: account === r.platform, mode: 'at_period_end' }, subscription_update: { enabled: false }, customer_update: { enabled: false } },
    metadata: { pulse_portal: 'v1' },
  }, options(r, account, `pulse-portal:v1:${r.livemode}:${account}`));
  return r.stripe.billingPortal.sessions.create({ customer: customerId, configuration: configuration.id, return_url: connectReturnUrl() }, options(r, account));
}
