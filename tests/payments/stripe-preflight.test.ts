import { describe, expect, it, vi } from 'vitest';
import { checkStripeReadiness, requiredEvents } from '../../scripts/check-stripe-readiness.mjs';
const config = () => ({ PULSE_PAYMENTS_MODE: 'test', PULSE_STRIPE_SECRET_KEY: 'sk_test_secret', PULSE_STRIPE_ACCOUNT_ID: 'acct_platform', PULSE_STRIPE_CONNECT_CLIENT_ID: 'ca_client', PULSE_STRIPE_WEBHOOK_SECRET: 'whsec_platform', PULSE_STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect', PULSE_PAYMENT_RECONCILE_SECRET: 's'.repeat(32), PULSE_PAYMENT_TEST_USER_IDS: 'tester' });
const response = (body: any) => ({ ok: true, json: async () => body });
describe('read-only Stripe preflight', () => {
  it('does not make a request without a valid configuration', async () => {
    const request = vi.fn(); const report = await checkStripeReadiness({}, request);
    expect(request).not.toHaveBeenCalled(); expect(report.automatedChecksPass).toBe(false);
  });
  it('uses only GET and reports manual checks even when automated checks pass', async () => {
    const request = vi.fn().mockResolvedValueOnce(response({ id: 'acct_platform' })).mockResolvedValueOnce(response({ data: Object.values(requiredEvents).map(enabled_events => ({ enabled_events, status: 'enabled', livemode: false, url: 'https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1/payment-webhook' })) }));
    const report = await checkStripeReadiness(config(), request);
    expect(report.automatedChecksPass).toBe(true); expect(report.liveLaunchApproved).toBe(false);
    expect(report.manual.length).toBeGreaterThan(0);
    for (const call of request.mock.calls) expect(call[1].method).toBe('GET');
    for (const secret of Object.values(config()).filter(value => value.startsWith('sk_') || value.startsWith('whsec_'))) expect(JSON.stringify(report)).not.toContain(secret);
  });
  it('stops on the wrong account and does not expose remote error details', async () => {
    const request = vi.fn().mockResolvedValue(response({ id: 'acct_wrong' }));
    const report = await checkStripeReadiness(config(), request);
    expect(request).toHaveBeenCalledTimes(1); expect(report.accountVerified).toBe(false);
    const failed = await checkStripeReadiness(config(), vi.fn().mockRejectedValue(new Error('secret payload')));
    expect(JSON.stringify(failed)).not.toContain('secret payload');
  });
});
