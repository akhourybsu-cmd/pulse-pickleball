import { pathToFileURL } from 'node:url';

const webhookUrl = 'https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1/payment-webhook';
export const requiredEvents = {
  platform: ['checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'invoice.paid', 'customer.subscription.updated', 'customer.subscription.deleted', 'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed', 'charge.dispute.created', 'charge.dispute.closed'],
  connect: ['account.updated', 'account.application.deauthorized', 'checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed', 'charge.dispute.created', 'charge.dispute.closed'],
};

/** Read-only preflight. Never creates accounts, destinations, products or charges. */
export async function checkStripeReadiness(env = process.env, request = fetch) {
  const issues = [];
  const manual = [
    'Confirm separate platform and connected-account event sources in Stripe, then deliver signed sandbox events to both. Endpoint listing cannot verify signing secrets or source scope.',
    'Register https://pulsepb.com/player/payments as the Connect OAuth redirect URI for the matching environment.',
    'Verify the five-minute recovery job actually returns HTTP 200 and failed: 0; a scheduled SQL invocation alone does not prove HTTP success.',
    'Complete the two-venue sandbox acceptance checks in docs/payments/stripe-launch.md before enabling live payments.',
  ];
  const mode = env.PULSE_PAYMENTS_MODE || 'off';
  const live = mode === 'live';
  const key = env.PULSE_STRIPE_SECRET_KEY || '';
  if (!['test', 'live'].includes(mode)) issues.push('Set the intended test/live environment; payments are currently off or invalid.');
  if (!key.startsWith(live ? 'sk_live_' : 'sk_test_')) issues.push('The server Stripe secret key must match the selected environment.');
  if (!/^acct_[A-Za-z0-9]+$/.test(env.PULSE_STRIPE_ACCOUNT_ID || '')) issues.push('Set the verified PULSE Stripe account ID.');
  if (!/^ca_[A-Za-z0-9]+$/.test(env.PULSE_STRIPE_CONNECT_CLIENT_ID || '')) issues.push('Configure the Connect client ID for existing venue accounts.');
  for (const name of ['PULSE_STRIPE_WEBHOOK_SECRET', 'PULSE_STRIPE_CONNECT_WEBHOOK_SECRET']) if (!(env[name] || '').startsWith('whsec_')) issues.push(`Configure ${name}.`);
  if (env.PULSE_STRIPE_WEBHOOK_SECRET === env.PULSE_STRIPE_CONNECT_WEBHOOK_SECRET) issues.push('Platform and Connect destinations must use separate signing secrets.');
  if ((env.PULSE_PAYMENT_RECONCILE_SECRET || '').length < 32) issues.push('Configure a distinct recovery secret of at least 32 random characters.');
  if (!live && !(env.PULSE_PAYMENT_TEST_USER_IDS || '').trim()) issues.push('Choose approved sandbox user IDs.');
  if (live && env.PULSE_PAYMENTS_LIVE_APPROVED !== 'true') issues.push('Live charging still needs explicit approval.');
  if (env.PULSE_PAYMENTS_PAUSED === 'true') issues.push('New payment checkouts are intentionally paused.');
  if (env.PULSE_MODULE_BILLING && env.PULSE_MODULE_BILLING !== 'monthly') issues.push('PULSE features must remain $10 USD per month.');
  let accountVerified = false;
  // Never send an invalid or missing key; never print raw API errors or bodies.
  if (['test', 'live'].includes(mode) && key.startsWith(live ? 'sk_live_' : 'sk_test_')) {
    const read = async path => {
      const response = await request(`https://api.stripe.com/v1/${path}`, { method: 'GET', headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': '2025-08-27.basil' }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Stripe read failed');
      return response.json();
    };
    try {
      const account = await read('account');
      accountVerified = account.id === env.PULSE_STRIPE_ACCOUNT_ID;
      if (!accountVerified) issues.push('This Stripe key belongs to a different platform account. Stop before configuring venues.');
      else {
        const listing = await read('webhook_endpoints?limit=100');
        const endpoints = (listing.data || []).filter(item => item.url === webhookUrl && item.status === 'enabled' && item.livemode === live);
        if (endpoints.length < 2) issues.push('Two enabled payment notification destinations were not found at the expected Supabase URL. Inspect Stripe Workbench; newer event destinations may need manual verification.');
        for (const [scope, events] of Object.entries(requiredEvents)) {
          if (!endpoints.some(endpoint => events.every(event => endpoint.enabled_events?.includes(event) || endpoint.enabled_events?.includes('*')))) issues.push(`Verify all required ${scope} payment events at the expected notification URL.`);
        }
        if (listing.has_more) manual.push('Endpoint listing exceeded 100 records; inspect the remaining Stripe destinations manually.');
      }
    } catch { issues.push('Stripe could not be inspected. Check network access and server-key permissions securely.'); }
  }
  return { mode, accountVerified, automatedChecksPass: issues.length === 0, liveLaunchApproved: false, issues, manual };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkStripeReadiness();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.automatedChecksPass ? 0 : 1;
}
