import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { checked, env, runtime, options } from "../_shared/payment-runtime.ts";
import { reconcileOrder } from "../_shared/payment-checkout.ts";
import { recordSettledCharge } from '../_shared/payment-refunds.ts';
import { billingMode } from '../_shared/payment-contracts.ts';

// Invoke every five minutes from a server-side scheduler. It is NOT a public
// user action and cannot accept a user's JWT in place of this distinct secret.
serve(async (req) => {
  const secret = env("PULSE_PAYMENT_RECONCILE_SECRET");
  if (
    req.method !== "POST" ||
    !secret ||
    secret.length < 32 ||
    req.headers.get("x-payment-reconcile-secret") !== secret
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    if (billingMode(env).mode === 'off') return new Response(JSON.stringify({ disabled: true, checked: 0, failed: 0 }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    const r = await runtime();
    const orders =
      checked(
        await r.store
          .from("payment_orders")
          .select("*")
          .eq("livemode", r.livemode)
          .eq("status", "pending")
          .order("created_at")
          .limit(100)
      ) || [];
    let failed = 0;
    for (const order of orders) {
      try {
        await reconcileOrder(r, order);
      } catch {
        failed++;
      }
    }
    const refunds = checked(await r.store.from('payment_cancellation_requests').select('payment_orders!inner(account_id,livemode,payment_intent_id)').eq('status', 'refund_pending').eq('payment_orders.livemode', r.livemode).limit(100)) || [];
    for (const request of refunds) {
      try {
        const order = request.payment_orders as any;
        if (!order.payment_intent_id) throw new Error('Missing refund payment reference');
        const intent = await r.stripe.paymentIntents.retrieve(order.payment_intent_id, { expand: ['latest_charge'] }, options(r, order.account_id));
        if (!intent.latest_charge || typeof intent.latest_charge === 'string') throw new Error('Charge not available');
        await recordSettledCharge(r, order.account_id, intent.latest_charge);
      } catch { failed++; }
    }
    checked(await r.store.from('venue_payment_oauth_states').delete().lt('expires_at', new Date(Date.now() - 24 * 3600_000).toISOString()));
    return new Response(JSON.stringify({ checked: orders.length, refunds_checked: refunds.length, failed }), {
      status: failed ? 500 : 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Reconciliation unavailable", { status: 500 });
  }
});
