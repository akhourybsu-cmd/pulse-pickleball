import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { checked, env, options, runtime } from "../_shared/payment-runtime.ts";
import { objectId, reconcileOrder } from "../_shared/payment-checkout.ts";

serve(async (req) => {
  if (req.method !== "POST")
    return new Response("POST required", { status: 405 });
  try {
    const r = await runtime();
    const raw = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });
    let event;
    for (const [secret, connected] of [
      [env("PULSE_STRIPE_WEBHOOK_SECRET"), false],
      [env("PULSE_STRIPE_CONNECT_WEBHOOK_SECRET"), true],
    ] as const) {
      if (!secret) continue;
      try {
        const candidate = await r.stripe.webhooks.constructEventAsync(
          raw,
          signature,
          secret
        );
        if (!!candidate.account === connected) {
          event = candidate;
          break;
        }
      } catch {
        /* Try only the separately configured platform/Connect signing secrets. */
      }
    }
    if (!event || event.livemode !== r.livemode)
      return new Response("Invalid signature or payment mode", { status: 400 });
    const account = event.account || r.platform;
    if (
      event.account &&
      !checked(
        await r.store
          .from("venue_payment_accounts")
          .select("venue_id")
          .eq("account_id", account)
          .eq("livemode", r.livemode)
          .maybeSingle()
      )
    )
      return new Response("Unknown connected account", { status: 400 });
    const seen = checked(
      await r.store
        .from("payment_webhook_events")
        .select("event_id")
        .eq("account_id", account)
        .eq("livemode", r.livemode)
        .eq("event_id", event.id)
        .maybeSingle()
    );
    if (seen) return new Response("Already processed");
    const payload = event.data.object as any;
    if (event.type.startsWith("checkout.session.")) {
      const orderId = payload.metadata?.pulse_order_id;
      if (orderId) {
        const order = checked(
          await r.store
            .from("payment_orders")
            .select("*")
            .eq("id", orderId)
            .eq("account_id", account)
            .eq("livemode", r.livemode)
            .single()
        );
        await reconcileOrder(r, order, payload.id);
      }
    } else if (event.type === "account.updated") {
      const current = await r.stripe.accounts.retrieve(account);
      checked(
        await r.store
          .from("venue_payment_accounts")
          .update({
            charges_enabled: current.charges_enabled,
            payouts_enabled: current.payouts_enabled,
            details_submitted: current.details_submitted,
            disabled_reason: current.requirements?.disabled_reason || null,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", account)
          .eq("livemode", r.livemode)
      );
    } else if (event.type === "invoice.paid") {
      const invoice = await r.stripe.invoices.retrieve(
        payload.id,
        { expand: ["payments"] },
        options(r, account)
      );
      const subscriptionId = objectId(
        invoice.parent?.subscription_details?.subscription
      );
      if (subscriptionId && invoice.billing_reason === "subscription_cycle") {
        const sub = await r.stripe.subscriptions.retrieve(
          subscriptionId,
          {},
          options(r, account)
        );
        const source = sub.metadata.pulse_order_id;
        if (source) {
          const order = checked(
            await r.store
              .from("payment_orders")
              .select("*")
              .eq("id", source)
              .eq("account_id", account)
              .eq("livemode", r.livemode)
              .single()
          );
          await reconcileOrder(r, order); // Recover initial fulfillment before a late renewal delivery.
          const intentId = objectId(
            invoice.payments?.data.find(
              (p: { status: string }) => p.status === "paid"
            )?.payment?.payment_intent
          );
          if (invoice.status !== "paid" || !intentId)
            throw new Error("Invoice is not settled");
          const intent = await r.stripe.paymentIntents.retrieve(
            intentId,
            {},
            options(r, account)
          );
          if (
            intent.status !== "succeeded" ||
            intent.currency !== "usd" ||
            intent.amount_received !== 1000
          )
            throw new Error("Invoice payment mismatch");
          checked(
            await r.store.rpc("payment_record_renewal", {
              p_subscription: subscriptionId,
              p_invoice: invoice.id,
              p_amount: invoice.amount_paid,
              p_currency: invoice.currency,
              p_intent: intentId,
              p_customer: objectId(invoice.customer),
              p_through: new Date(
                invoice.lines.data[0].period.end * 1000
              ).toISOString(),
            })
          );
        }
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const sub = await r.stripe.subscriptions.retrieve(
        payload.id,
        {},
        options(r, account)
      );
      checked(
        await r.store
          .from("payment_subscriptions")
          .update({
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("subscription_id", sub.id)
          .eq("account_id", account)
          .eq("livemode", r.livemode)
      );
      // An updated subscription is NOT evidence of payment. Only paid invoices
      // extend access; cancellations retain only the already-paid-through period.
    } else if (
      event.type === "charge.refunded" ||
      event.type.startsWith("charge.dispute.")
    ) {
      const chargeId =
        event.type === "charge.refunded"
          ? payload.id
          : objectId(payload.charge);
      const charge = await r.stripe.charges.retrieve(
        chargeId!,
        {},
        options(r, account)
      );
      const intentId = objectId(charge.payment_intent);
      if (intentId) {
        // Refund events can arrive before checkout fulfillment. Recover it first.
        const orderId = charge.metadata?.pulse_order_id;
        if (orderId) {
          const order = checked(
            await r.store
              .from("payment_orders")
              .select("*")
              .eq("id", orderId)
              .eq("account_id", account)
              .eq("livemode", r.livemode)
              .maybeSingle()
          );
          if (order?.status === "pending") await reconcileOrder(r, order);
        }
        checked(
          await r.store.rpc("payment_record_charge", {
            p_account: account,
            p_live: r.livemode,
            p_intent: intentId,
            p_refunded: charge.amount_refunded,
            p_disputed: charge.disputed,
          })
        );
      }
    }
    // Operations above are individually transactional/idempotent. Mark only
    // after success; a crash before this insert is safe to replay.
    checked(
      await r.store
        .from("payment_webhook_events")
        .upsert(
          {
            account_id: account,
            livemode: r.livemode,
            event_id: event.id,
            event_type: event.type,
          },
          { onConflict: "account_id,livemode,event_id", ignoreDuplicates: true }
        )
    );
    return new Response("Processed");
  } catch {
    // Stripe retries non-2xx responses. Never acknowledge a failed fulfillment.
    return new Response("Payment reconciliation failed; retry required", {
      status: 500,
    });
  }
});
