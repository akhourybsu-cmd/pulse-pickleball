// Run: deno test --no-lock tests/payments/stripe-sdk-options.deno.ts
// Actual deployed SDK parser; all HTTP is intercepted. No credentials/network.
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { stripeRequestOptions } from '../../supabase/functions/_shared/payment-stripe-options.ts';

for (const account of ['acct_platform', 'acct_palace']) {
  Deno.test(`SDK accepts scoped retrieve/list options for ${account}`, async () => {
    const requests: Request[] = [];
    const stripe = new Stripe('sk_test_fixture_not_a_credential', {
      apiVersion: '2025-08-27.basil',
      httpClient: Stripe.createFetchHttpClient(async (url: string | URL | Request, init?: RequestInit) => {
        requests.push(new Request(url, init));
        return new Response(JSON.stringify({ id: 'cs_test_fixture', object: 'checkout.session' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    });
    const options = stripeRequestOptions('acct_platform', account);
    const session = await stripe.checkout.sessions.retrieve('cs_test_fixture', {}, options);
    await stripe.invoices.retrieve('in_fixture', { expand: ['payments'] }, options);
    await stripe.subscriptions.retrieve('sub_fixture', {}, options);
    await stripe.paymentIntents.retrieve('pi_fixture', {}, options);
    await stripe.billingPortal.configurations.list({ active: true, limit: 100 }, options);
    if (session.id !== 'cs_test_fixture' || requests.length !== 5) throw new Error('SDK did not send all expected requests');
    for (const req of requests) {
      if (req.headers.get('Stripe-Version') !== '2025-08-27.basil') throw new Error('API version mismatch');
      if (req.headers.get('Stripe-Account') !== (account === 'acct_platform' ? null : account)) throw new Error('Merchant isolation mismatch');
    }
  });
}
