import { checked, options, type Runtime } from "./payment-runtime.ts";
import { requireRentalAccount } from "./payment-connect.ts";
import { reconcileOrder, startCheckout } from "./payment-checkout.ts";
import { reconcileRefundPayment } from "./payment-refunds.ts";
import { uuid } from "./payment-contracts.ts";

/** Called only after the payments handler authenticates the caller and verifies MFA. */
export async function desk(
  r: Runtime,
  userId: string,
  venueId: string,
  ownerOnly = false
) {
  const venue = checked(
    await r.store
      .from("venues")
      .select("id,owner_id")
      .eq("id", venueId)
      .single()
  );
  if (venue.owner_id === userId) return;
  if (ownerOnly) throw new Error("Only the venue owner can refund payments.");
  const roles =
    checked(
      await r.store
        .from("venue_staff")
        .select("role,is_active,status")
        .eq("venue_id", venueId)
        .eq("user_id", userId)
    ) || [];
  const facility = checked(
    await r.store.rpc("venue_has_module", {
      p_venue_id: venueId,
      p_module: "facility_tools",
    })
  );
  if (
    !roles.some(
      (s: any) =>
        s.is_active !== false &&
        (!s.status || s.status === "active") &&
        (["owner", "manager"].includes(s.role) ||
          (s.role === "staff" && facility))
    )
  )
    throw new Error("Venue desk access required.");
}
export async function venueDeskPayment(
  r: Runtime,
  user: { id: string; email?: string },
  body: any
) {
  if (body.action === "venue_membership_cancel") {
    if (
      typeof body.subscription_id !== "string" ||
      !/^sub_[A-Za-z0-9]+$/.test(body.subscription_id) ||
      body.confirm_cancel !== true
    )
      throw new Error("Confirm the membership renewal cancellation.");
    const sub = checked(
      await r.store
        .from("payment_subscriptions")
        .select("*")
        .eq("subscription_id", body.subscription_id)
        .single()
    );
    await desk(r, user.id, sub.venue_id, true);
    const order = checked(
      await r.store
        .from("payment_orders")
        .select("*")
        .eq("id", sub.order_id)
        .single()
    );
    const sale = checked(
      await r.store
        .from("venue_sales")
        .select("id,product_kind,venue_id")
        .eq("id", order.venue_sale_id)
        .single()
    );
    if (
      sub.livemode !== r.livemode ||
      order.kind !== "venue_sale" ||
      sale.product_kind !== "membership" ||
      sale.venue_id !== sub.venue_id
    )
      throw new Error("Choose a venue membership in this payment environment.");
    const current = await r.stripe.subscriptions.retrieve(
      sub.subscription_id,
      {},
      options(r, sub.account_id)
    );
    if (current.livemode !== sub.livemode || current.id !== sub.subscription_id)
      throw new Error("Membership billing does not match this venue.");
    const canceled = ["canceled", "incomplete_expired"].includes(
      current.status
    );
    const result =
      canceled || current.cancel_at_period_end
        ? current
        : await r.stripe.subscriptions.update(
            sub.subscription_id,
            { cancel_at_period_end: true },
            options(
              r,
              sub.account_id,
              `venue-renewal-cancel:${sub.subscription_id}:${uuid(
                body.request_key
              )}`
            )
          );
    checked(
      await r.store
        .from("payment_subscriptions")
        .update({
          status: result.status,
          cancel_at_period_end: result.cancel_at_period_end,
          cancel_requested_by: user.id,
          cancel_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("subscription_id", sub.subscription_id)
        .eq("account_id", sub.account_id)
        .eq("livemode", sub.livemode)
    );
    return { canceled: true };
  }
  if (body.action === "venue_appointment_checkout") {
    const appointment = checked(
      await r.store
        .from("venue_appointments")
        .select("id,venue_id")
        .eq("id", uuid(body.appointment_id))
        .single()
    );
    await desk(r, user.id, appointment.venue_id);
    if (
      body.accept_terms !== true ||
      !Number.isInteger(body.amount_cents) ||
      !Number.isInteger(body.version)
    )
      throw new Error("Review the booking quote and payment amount first.");
    await requireRentalAccount(r, appointment.venue_id);
    const order = checked(
      await r.store.rpc("payment_reserve_venue_appointment", {
        p_actor: user.id,
        p_id: appointment.id,
        p_expected: body.version,
        p_amount: body.amount_cents,
        p_request: uuid(body.request_key),
        p_live: r.livemode,
      })
    );
    return startDeskCheckout(r, order);
  }
  if (body.action === "venue_walkin_checkout") {
    const customer = checked(
      await r.store
        .from("venue_customers")
        .select("id,venue_id")
        .eq("id", uuid(body.customer_id))
        .single()
    );
    await desk(r, user.id, customer.venue_id);
    if (body.accept_terms !== true || !Number.isInteger(body.amount_cents))
      throw new Error("Review the visit total and venue policy first.");
    await requireRentalAccount(r, customer.venue_id);
    const order = checked(
      await r.store.rpc("payment_reserve_venue_walkin", {
        p_actor: user.id,
        p_customer: customer.id,
        p_event: body.event_id ? uuid(body.event_id) : null,
        p_court: body.court_id ? uuid(body.court_id) : null,
        p_start: body.start_time || null,
        p_end: body.end_time || null,
        p_expected: body.amount_cents,
        p_request: uuid(body.request_key),
        p_live: r.livemode,
      })
    );
    return startDeskCheckout(r, order);
  }
  if (body.action === "venue_sale_checkout") {
    const customer = checked(
      await r.store
        .from("venue_customers")
        .select("id,venue_id,user_id")
        .eq("id", uuid(body.customer_id))
        .single()
    );
    await desk(r, user.id, customer.venue_id);
    if (
      body.accept_terms !== true ||
      !Number.isInteger(body.amount_cents) ||
      !Number.isInteger(body.quantity)
    )
      throw new Error("Review the sale total and venue policy first.");
    await requireRentalAccount(r, customer.venue_id);
    const order = checked(
      await r.store.rpc("payment_reserve_venue_sale", {
        p_actor: user.id,
        p_customer: customer.id,
        p_product: uuid(body.product_id),
        p_quantity: body.quantity,
        p_expected: body.amount_cents,
        p_request: uuid(body.request_key),
        p_live: r.livemode,
      })
    );
    return startDeskCheckout(r, order);
  }
  const sale = checked(
    await r.store
      .from("venue_sales")
      .select("*")
      .eq("id", uuid(body.sale_id))
      .single()
  );
  await desk(r, user.id, sale.venue_id, body.action === "venue_sale_refund");
  if (sale.method !== "stripe" || !sale.payment_order_id)
    throw new Error("Choose a card purchase. Record cash refunds separately.");
  const order = checked(
    await r.store
      .from("payment_orders")
      .select("*")
      .eq("id", sale.payment_order_id)
      .single()
  );
  if (order.livemode !== r.livemode)
    throw new Error("Payment environment does not match this purchase.");
  if (body.action === "venue_sale_resume") return startDeskCheckout(r, order);
  if (body.action === "venue_sale_cancel" && order.status === "pending") {
    const recovered = await reconcileOrder(r, order);
    if (recovered.status === "pending" && recovered.checkout_session_id) {
      const session = await r.stripe.checkout.sessions.retrieve(
        recovered.checkout_session_id,
        {},
        options(r, order.account_id)
      );
      if (session.status === "open")
        await r.stripe.checkout.sessions.expire(
          session.id,
          {},
          options(r, order.account_id, `desk-expire:${order.id}`)
        );
    } else if (recovered.status === "pending")
      throw new Error(
        "Payment preparation is still being recovered. Retry after the checkout expires."
      );
  }
  if (body.action === "venue_sale_refund") {
    if (
      !order.payment_intent_id ||
      !["paid", "partially_refunded"].includes(order.status)
    )
      throw new Error("Only a settled card purchase can be refunded.");
    if (order.refund_state === "pending")
      throw new Error(
        "A refund is already processing. Refresh payment status before starting another."
      );
    if (body.confirm_refund !== true)
      throw new Error("Confirm the refund before proceeding.");
    const amount = body.amount_cents;
    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > order.amount_cents - order.refunded_cents
    )
      throw new Error("Enter a valid remaining refund amount.");
    await r.stripe.refunds.create(
      {
        payment_intent: order.payment_intent_id,
        amount,
        reason: "requested_by_customer",
        metadata: { pulse_order_id: order.id },
      },
      options(
        r,
        order.account_id,
        `desk-refund:${order.id}:${uuid(body.request_key)}`
      )
    );
  }
  const result = await reconcileOrder(r, order);
  if (result.payment_intent_id)
    await reconcileRefundPayment(r, order.account_id, result.payment_intent_id);
  return { order: result };
}
async function startDeskCheckout(r: Runtime, order: any) {
  let buyer: { id: string; email?: string } = { id: order.buyer_id || "" };
  if (order.buyer_id) {
    const result = await r.store.auth.admin.getUserById(order.buyer_id);
    if (result.error || !result.data.user)
      throw new Error("Player account unavailable.");
    buyer = { id: result.data.user.id, email: result.data.user.email };
  }
  return startCheckout(r, order, buyer);
}
