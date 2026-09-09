import { assertCheckoutMatches } from "./payment-contracts.ts";
import {
  appOrigin,
  checked,
  customer,
  options,
  type Runtime,
} from "./payment-runtime.ts";

export const objectId = (value: any): string | null =>
  typeof value === "string" ? value : value?.id ?? null;
export async function recoverCheckout(r: Runtime, order: any) {
  if (order.checkout_session_id || order.status !== "pending") return order;
  if (order.customer_id) {
    // A Stripe response may have been lost after creation. Search only this
    // user's scoped customer, including all pages, before considering release.
    let recovered: any = null;
    for await (const session of r.stripe.checkout.sessions.list(
      {
        customer: order.customer_id,
        created: {
          gte: Math.floor(new Date(order.created_at).getTime() / 1000) - 60,
        },
        limit: 100,
      },
      options(r, order.account_id)
    )) {
      if (session.metadata?.pulse_order_id === order.id) {
        recovered = session;
        break;
      }
    }
    if (recovered) {
      assertCheckoutMatches(order, recovered);
      return checked(
        await r.store
          .from("payment_orders")
          .update({ checkout_session_id: recovered.id })
          .eq("id", order.id)
          .select()
          .single()
      );
    }
  }
  // At this point no session exists and its immutable expires_at is in the
  // past. Stripe will reject any delayed creation with that expiration.
  if (new Date(order.expires_at).getTime() + 5 * 60_000 < Date.now())
    return checked(
      await r.store.rpc("payment_apply_result", {
        p_order: order.id,
        p_account: order.account_id,
        p_live: order.livemode,
        p_session: null,
        p_status: "expired",
        p_amount: order.amount_cents,
        p_currency: order.currency,
        p_intent: null,
        p_customer: order.customer_id,
        p_subscription: null,
        p_paid_through: null,
      })
    );
  return order;
}
export async function startCheckout(
  r: Runtime,
  order: any,
  user: { id: string; email?: string }
) {
  if (order.status !== "pending")
    throw new Error(
      "This checkout is already finished. Check your purchase history."
    );
  if (order.checkout_session_id) {
    const session = await r.stripe.checkout.sessions.retrieve(
      order.checkout_session_id,
      {},
      options(r, order.account_id)
    );
    if (session.status !== "open" || !session.url)
      throw new Error(
        "This checkout has ended. Refresh your purchase history."
      );
    return { url: session.url, order_id: order.id };
  }
  // Fixed order expiration and Stripe idempotency make network retries safe.
  if (new Date(order.expires_at).getTime() < Date.now() + 30 * 60_000)
    throw new Error(
      "Checkout preparation expired. Cancel this attempt in purchase history and try again."
    );
  const customerId = await customer(
    r,
    user,
    order.account_id,
    order.merchant_name
  );
  checked(
    await r.store
      .from("payment_orders")
      .update({ customer_id: customerId })
      .eq("id", order.id)
  );
  const recurring = order.billing_cadence === "monthly";
  const session = await r.stripe.checkout.sessions.create(
    {
      customer: customerId,
      mode: recurring ? "subscription" : "payment",
      payment_method_types: ["card"],
      client_reference_id: order.id,
      metadata: {
        pulse_order_id: order.id,
        pulse_user_id: order.buyer_id,
        purpose: order.kind,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency,
            unit_amount: order.amount_cents,
            product_data: {
              name: order.description,
              description: `Sold by ${order.merchant_name}. ${
                order.kind === "court_rental"
                  ? `${order.start_time} to ${order.end_time}. `
                  : ""
              }Prices include applicable taxes.`,
            },
            ...(recurring ? { recurring: { interval: "month" as const } } : {}),
          },
        },
      ],
      ...(recurring
        ? { subscription_data: { metadata: { pulse_order_id: order.id } } }
        : {
            payment_intent_data: { metadata: { pulse_order_id: order.id } },
            saved_payment_method_options: {
              payment_method_save: "enabled" as const,
            },
            submit_type: "pay" as const,
          }),
      custom_text: {
        submit: {
          message: `${
            r.livemode
              ? ""
              : "TEST ONLY — no real booking or add-on is granted. "
          }You are paying ${order.merchant_name}${
            recurring ? " $10 every month until canceled" : " for this purchase"
          }. ${
            order.kind === "court_rental"
              ? "Your reservation is confirmed only after successful payment."
              : ""
          }`,
        },
      },
      expires_at: Math.floor(new Date(order.expires_at).getTime() / 1000),
      success_url: `${appOrigin()}/player/payments?order=${
        order.id
      }&checkout=returned`,
      cancel_url: `${appOrigin()}/player/payments?order=${
        order.id
      }&checkout=cancel`,
      // No transfer_data or application_fee_amount: rentals are direct charges
      // on the venue's account; module charges stay on PULSE's account.
    },
    options(r, order.account_id, `checkout:${order.id}`)
  );
  checked(
    await r.store
      .from("payment_orders")
      .update({ checkout_session_id: session.id })
      .eq("id", order.id)
  );
  return { url: session.url, order_id: order.id };
}

export async function reconcileOrder(
  r: Runtime,
  order: any,
  sessionId?: string
) {
  if (!sessionId) order = await recoverCheckout(r, order);
  const reference = sessionId || order.checkout_session_id;
  if (!reference) return order;
  const session = await r.stripe.checkout.sessions.retrieve(
    reference,
    {},
    options(r, order.account_id)
  );
  assertCheckoutMatches(order, session);
  if (
    session.status !== "expired" &&
    !(session.status === "complete" && session.payment_status === "paid")
  )
    return order;
  let intent = objectId(session.payment_intent);
  let paidThrough: string | null = null;
  let subscription: any = null;
  const subscriptionId = objectId(session.subscription);
  if (session.payment_status === "paid" && subscriptionId) {
    subscription = await r.stripe.subscriptions.retrieve(
      subscriptionId,
      {},
      options(r, order.account_id)
    );
    const invoice = await r.stripe.invoices.retrieve(
      objectId(session.invoice)!,
      { expand: ["payments"] },
      options(r, order.account_id)
    );
    if (
      invoice.status !== "paid" ||
      invoice.amount_paid !== order.amount_cents ||
      invoice.currency !== order.currency
    )
      throw new Error("The subscription invoice is not fully paid.");
    intent = objectId(
      invoice.payments?.data.find(
        (p: { status: string }) => p.status === "paid"
      )?.payment?.payment_intent
    );
    // The current subscription period might be months later (or unpaid).
    // Grant only the period on THIS successfully paid invoice.
    paidThrough = new Date(
      invoice.lines.data[0].period.end * 1000
    ).toISOString();
  }
  if (session.payment_status === "paid") {
    if (!intent)
      throw new Error(
        "The successful payment reference is not available yet. Please retry."
      );
    const payment = await r.stripe.paymentIntents.retrieve(
      intent,
      {},
      options(r, order.account_id)
    );
    if (
      payment.status !== "succeeded" ||
      payment.amount_received !== order.amount_cents ||
      payment.currency !== order.currency
    )
      throw new Error("Payment has not settled successfully.");
  }
  const result = checked(
    await r.store.rpc("payment_apply_result", {
      p_order: order.id,
      p_account: order.account_id,
      p_live: order.livemode,
      p_session: session.id,
      p_status: session.status === "expired" ? "expired" : "paid",
      p_amount: session.amount_total,
      p_currency: session.currency,
      p_intent: intent,
      p_customer: objectId(session.customer),
      p_subscription: subscriptionId,
      p_paid_through: paidThrough,
    })
  );
  if (subscription)
    checked(
      await r.store
        .from("payment_subscriptions")
        .update({
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq("subscription_id", subscription.id)
        .eq("account_id", order.account_id)
        .eq("livemode", order.livemode)
    );
  return result;
}
