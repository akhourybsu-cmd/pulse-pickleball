import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentLaunchIssues } from '../../supabase/functions/_shared/payment-contracts';
import { privatePaymentTestAllowed } from '../../supabase/functions/_shared/payment-private-sandbox';
import { stripeReturnVenue, venuePaymentReadiness, type VenuePaymentSetup } from '../../src/lib/venues/paymentReadiness';

vi.mock('../../supabase/functions/_shared/payment-runtime.ts', () => ({
  appOrigin: () => 'https://pulsepb.com',
  checked: (result: any) => { if (result.error) throw result.error; return result.data; },
  options: (r: any, account: string, key?: string) => ({ ...(account === r.platform ? {} : { stripeAccount: account }), ...(key ? { idempotencyKey: key } : {}) }),
  owner: vi.fn(async () => ({ id: 'venue-a' })),
}));
import { accountSnapshot, assertIndependentAccount, completeExisting, connectExisting, merchantPortal, newVenueAccountParameters, stateHash } from '../../supabase/functions/_shared/payment-connect';
import { recordSettledCharge, settledRefundAmount } from '../../supabase/functions/_shared/payment-refunds';

const envValues = () => ({ PULSE_PAYMENTS_MODE: 'test', PULSE_STRIPE_SECRET_KEY: 'sk_test_sample', PULSE_STRIPE_ACCOUNT_ID: 'acct_platform', PULSE_STRIPE_WEBHOOK_SECRET: 'whsec_platform', PULSE_STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect', PULSE_PAYMENT_RECONCILE_SECRET: 'r'.repeat(32), PULSE_PAYMENT_TEST_USER_IDS: 'tester' });
describe('launch checks', () => {
  it('requires independent notification secrets, recovery and approved testers without revealing credentials', () => {
    const values: Record<string, string> = envValues();
    expect(paymentLaunchIssues(key => values[key])).toEqual([]);
    for (const key of ['PULSE_STRIPE_SECRET_KEY', 'PULSE_STRIPE_WEBHOOK_SECRET', 'PULSE_STRIPE_CONNECT_WEBHOOK_SECRET', 'PULSE_PAYMENT_RECONCILE_SECRET', 'PULSE_PAYMENT_TEST_USER_IDS']) {
      const copy = { ...values, [key]: '' };
      expect(paymentLaunchIssues(name => copy[name]).length).toBeGreaterThan(0);
    }
    values.PULSE_STRIPE_CONNECT_WEBHOOK_SECRET = values.PULSE_STRIPE_WEBHOOK_SECRET;
    expect(paymentLaunchIssues(key => values[key]).join(' ')).toContain('separate');
    expect(JSON.stringify(paymentLaunchIssues(key => values[key]))).not.toContain('whsec_');
  });
  it('requires explicit live approval and supports pausing new checkouts', () => {
    const values: Record<string, string> = { ...envValues(), PULSE_PAYMENTS_MODE: 'live', PULSE_STRIPE_SECRET_KEY: 'sk_live_example' };
    expect(paymentLaunchIssues(key => values[key])).toHaveLength(1);
    values.PULSE_PAYMENTS_LIVE_APPROVED = 'true';
    expect(paymentLaunchIssues(key => values[key])).toEqual([]);
    values.PULSE_PAYMENTS_PAUSED = 'true';
    expect(paymentLaunchIssues(key => values[key]).join(' ')).toContain('paused');
  });
});

const setup = (): VenuePaymentSetup => ({ mode: 'live', ready: true, venue: { name: 'Venue A', verification_approved_at: '2026-09-01' }, account: { account_id: 'acct_a', charges_enabled: true, payouts_enabled: true, card_payments_active: true }, booking_enabled: true, courts: [{ id: 'court-a', name: 'Court 1', hourly_rate: 20 }], settings: { accepting_payments: false, cancellation_policy: 'Cancel 24 hours before play for a full refund.', support_email: 'venue@example.com', timezone: 'America/New_York', tax_inclusive_acknowledged: true } });
describe('per-venue readiness', () => {
  it('allows only an explicitly approved, allowlisted owner to test a private sample', () => {
    const sample = { owner_id: 'owner', test_payments_enabled: true };
    expect(privatePaymentTestAllowed(sample, 'owner', 'owner', 'test', 'other, owner')).toBe(true);
    for (const mode of ['off', 'live', 'unknown']) expect(privatePaymentTestAllowed(sample, 'owner', 'owner', mode, 'owner')).toBe(false);
    expect(privatePaymentTestAllowed(sample, 'owner', 'other', 'test', 'other,owner')).toBe(false);
    expect(privatePaymentTestAllowed(sample, 'new-owner', 'new-owner', 'test', 'new-owner')).toBe(false);
    expect(privatePaymentTestAllowed(sample, 'owner', 'owner', 'test', '')).toBe(false);
    expect(privatePaymentTestAllowed({ ...sample, test_payments_enabled: false }, 'owner', 'owner', 'test', 'owner')).toBe(false);
    expect(privatePaymentTestAllowed(null, 'owner', 'owner', 'test', 'owner')).toBe(false);
  });
  it('labels sample approval separately from verification and cannot enable live collections', () => {
    const data = setup(); data.mode = 'test'; data.venue.verification_approved_at = null; data.venue.payment_test_sandbox = true;
    expect(venuePaymentReadiness(data).steps.find(step => step.id === 'owner')).toMatchObject({ complete: true, title: 'Approved private test venue' });
    expect(venuePaymentReadiness(data).canEnable).toBe(false);
    data.mode = 'live'; expect(venuePaymentReadiness(data).canEnable).toBe(false);
  });
  it('never treats sandbox, missing status, ownership transfers or disconnected accounts as live ready', () => {
    expect(venuePaymentReadiness(setup()).canEnable).toBe(true);
    for (const patch of [{ mode: 'test' as const }, { ready: undefined }, { transferred: true }, { account: null }, { booking_enabled: false }, { settings: null }, { courts: [] }]) {
      expect(venuePaymentReadiness({ ...setup(), ...patch }).canEnable).toBe(false);
    }
    for (const patch of [{ card_payments_active: false }, { charges_enabled: false }, { payouts_enabled: false }, { disconnected_at: 'today' }, { disabled_reason: 'requirements' }]) {
      const data = setup(); data.account = { ...data.account!, ...patch };
      expect(venuePaymentReadiness(data).canEnable).toBe(false);
    }
  });
  it('requires valid saved prices and policy; zero and inactive courts cannot enable collections', () => {
    for (const rate of [0, 0.5]) { const data = setup(); data.courts[0].hourly_rate = rate; expect(venuePaymentReadiness(data).canEnable).toBe(false); }
    const data = setup(); data.courts[0].is_active = false;
    expect(venuePaymentReadiness(data).canEnable).toBe(false);
  });
  it('uses only a UUID routing hint from OAuth; it does not treat a state as authority', () => {
    expect(stripeReturnVenue('10000000-0000-4000-8000-000000000001.random.random')).toBe('10000000-0000-4000-8000-000000000001');
    for (const value of [null, 'https://evil.example', '../../admin', 'acct_123']) expect(stripeReturnVenue(value)).toBeNull();
  });
});

const fullAccount = () => ({ id: 'acct_a', charges_enabled: true, payouts_enabled: true, details_submitted: true, capabilities: { card_payments: 'active' }, controller: { stripe_dashboard: { type: 'full' }, losses: { payments: 'stripe' }, fees: { payer: 'account' } } });
function mockRuntime(claimed: any = { venue_id: 'venue-a' }) {
  const filters: any[] = [];
  const chain: any = { then: (resolve: any) => Promise.resolve({ data: null }).then(resolve) };
  for (const method of ['update', 'eq', 'is', 'gt', 'select']) chain[method] = vi.fn((...args) => { filters.push([method, ...args]); return chain; });
  chain.maybeSingle = vi.fn(async () => ({ data: claimed }));
  chain.insert = vi.fn(async () => ({ data: null }));
  const r: any = { platform: 'acct_platform', livemode: false, store: { from: vi.fn(() => chain), rpc: vi.fn(async () => ({ data: { venue_id: 'venue-a', account_id: 'acct_a' } })) }, stripe: { oauth: { token: vi.fn(async () => ({ livemode: false, scope: 'read_write', stripe_user_id: 'acct_a' })) }, accounts: { retrieve: vi.fn(async () => fullAccount()) } } };
  return { r, chain, filters };
}
describe('Stripe connection safeguards', () => {
  beforeEach(() => vi.clearAllMocks());
  it('requests Stripe’s paired card/transfer capabilities while keeping the account venue-controlled', () => {
    const params = newVenueAccountParameters({ id: 'venue-a', name: 'Palace Test' }, { id: 'owner-a', email: 'owner@example.com' });
    expect(params.capabilities).toEqual({ card_payments: { requested: true }, transfers: { requested: true } });
    expect(params.controller).toEqual({ fees: { payer: 'account' }, losses: { payments: 'stripe' }, stripe_dashboard: { type: 'full' }, requirement_collection: 'stripe' });
    expect(params.metadata).toEqual({ pulse_venue_id: 'venue-a', pulse_owner_id: 'owner-a' });
  });
  it('snapshots capability status and requirement names, not bank or identity values', () => {
    const snapshot = accountSnapshot({ ...fullAccount(), bank_account: 'sensitive', requirements: { currently_due: ['business_profile.url'], pending_verification: ['individual.verification.document'], current_deadline: 1 } });
    expect(snapshot.card_payments_active).toBe(true);
    expect(snapshot.requirements_deadline).toBe('1970-01-01T00:00:01.000Z');
    expect(JSON.stringify(snapshot)).not.toContain('sensitive');
    expect(accountSnapshot({}).card_payments_active).toBe(false);
  });
  it('rejects PULSE, deleted and platform-controlled accounts', () => {
    expect(() => assertIndependentAccount(fullAccount(), 'acct_platform')).not.toThrow();
    for (const account of [null, { ...fullAccount(), id: 'acct_platform' }, { ...fullAccount(), deleted: true }, { ...fullAccount(), controller: {} }]) expect(() => assertIndependentAccount(account, 'acct_platform')).toThrow();
  });
  it('stores only a state hash tied to the owner, venue and environment', async () => {
    const { r, chain } = mockRuntime();
    const result = await connectExisting(r, 'owner-a', 'venue-a', 'ca_sample');
    const url = new URL(result.url); const state = url.searchParams.get('state')!;
    expect(url.origin).toBe('https://connect.stripe.com');
    expect(url.searchParams.get('redirect_uri')).toBe('https://pulsepb.com/player/payments');
    expect(chain.insert).toHaveBeenCalledWith({ state_hash: await stateHash(state), owner_id: 'owner-a', venue_id: 'venue-a', livemode: false });
    expect(JSON.stringify(chain.insert.mock.calls)).not.toContain(state);
  });
  it('consumes state with all bindings before exchanging the one-time code', async () => {
    const { r, filters } = mockRuntime();
    await expect(completeExisting(r, 'owner-a', 'venue-a', 'state', 'ac_valid')).resolves.toEqual({ connected: true });
    for (const filter of [['eq', 'venue_id', 'venue-a'], ['eq', 'owner_id', 'owner-a'], ['eq', 'livemode', false], ['is', 'consumed_at', null]]) expect(filters).toContainEqual(filter);
    expect(filters.some(f => f[0] === 'gt' && f[1] === 'expires_at')).toBe(true);
    expect(r.store.rpc).toHaveBeenCalledWith('payment_link_venue_account', { p_venue: 'venue-a', p_owner: 'owner-a', p_live: false, p_account: 'acct_a' });
  });
  it('does not exchange an expired, reused or wrong-owner state', async () => {
    const { r } = mockRuntime(null);
    await expect(completeExisting(r, 'owner-a', 'venue-a', 'state', 'ac_valid')).rejects.toThrow('expired');
    expect(r.stripe.oauth.token).not.toHaveBeenCalled();
  });
  it('rejects wrong-mode and read-only OAuth results before linking', async () => {
    for (const result of [{ livemode: true, scope: 'read_write', stripe_user_id: 'acct_a' }, { livemode: false, scope: 'read_only', stripe_user_id: 'acct_a' }]) {
      const { r } = mockRuntime(); r.stripe.oauth.token.mockResolvedValue(result);
      await expect(completeExisting(r, 'owner-a', 'venue-a', 'state', 'ac_valid')).rejects.toThrow('unexpected');
      expect(r.store.rpc).not.toHaveBeenCalled();
    }
  });
});

describe('merchant-scoped billing portals', () => {
  it.each(['acct_platform', 'acct_a', 'acct_b'])('creates and opens the configuration in %s only', async account => {
    const configurations = { list: vi.fn(async () => ({ data: [] })), create: vi.fn(async () => ({ id: 'bpc_sample' })) };
    const sessions = { create: vi.fn(async () => ({ url: 'https://billing.stripe.com/p/session' })) };
    const r: any = { platform: 'acct_platform', livemode: false, stripe: { billingPortal: { configurations, sessions } } };
    await merchantPortal(r, account, 'cus_account_scoped');
    const scope = account === r.platform ? {} : { stripeAccount: account };
    expect(configurations.list).toHaveBeenCalledWith({ active: true, limit: 100 }, scope);
    expect(configurations.create.mock.calls[0][1]).toMatchObject(scope);
    expect(configurations.create.mock.calls[0][0].features.subscription_cancel.enabled).toBe(account === r.platform);
    expect(sessions.create).toHaveBeenCalledWith({ customer: 'cus_account_scoped', configuration: 'bpc_sample', return_url: 'https://pulsepb.com/player/payments' }, scope);
  });
});

describe('settled refunds', () => {
  it('counts only succeeded refunds and retrieves every page in the original venue account', async () => {
    const list = vi.fn(() => ({ async *[Symbol.asyncIterator]() { for (const [status, amount] of [['succeeded', 200], ['pending', 600], ['failed', 500], ['canceled', 100], ['succeeded', 300]]) yield { status, amount }; } }));
    const r: any = { platform: 'acct_platform', livemode: true, stripe: { refunds: { list } }, store: { rpc: vi.fn(async () => ({ data: null })) } };
    await recordSettledCharge(r, 'acct_a', { id: 'ch_a', amount: 1000, payment_intent: 'pi_a', disputed: false, amount_refunded: 1000 });
    expect(list).toHaveBeenCalledWith({ charge: 'ch_a', limit: 100 }, { stripeAccount: 'acct_a' });
    expect(r.store.rpc).toHaveBeenCalledWith('payment_record_charge', { p_account: 'acct_a', p_live: true, p_intent: 'pi_a', p_refunded: 500, p_disputed: false });
  });
  it('rejects impossible totals instead of marking a booking refunded', async () => {
    const r: any = { platform: 'acct_platform', stripe: { refunds: { list: () => ({ async *[Symbol.asyncIterator]() { yield { status: 'succeeded', amount: 1500 }; } }) } } };
    await expect(settledRefundAmount(r, 'acct_a', { id: 'ch_a', amount: 1000 })).rejects.toThrow('review');
  });
});
