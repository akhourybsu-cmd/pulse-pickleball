import { checked, db } from "./payment-runtime.ts";
import { uuid } from "./payment-contracts.ts";
import { desk } from "./payment-venue-desk.ts";
import {
  reconcileSquareOrder,
  refundSquareOrder,
  startSquareCheckout,
  verifySquareForNewPayment,
} from "./square-payments.ts";

/** Returns undefined for the existing Stripe path. Never guesses from browser data. */
export async function squarePaymentAction(
  store: ReturnType<typeof db>,
  user: { id: string },
  body: any,
) {
  const starts = [
    "venue_sale_checkout",
    "venue_walkin_checkout",
    "venue_appointment_checkout",
  ];
  if (starts.includes(body.action)) {
    const source =
      body.action === "venue_appointment_checkout"
        ? checked(
            await store
              .from("venue_appointments")
              .select("venue_id")
              .eq("id", uuid(body.appointment_id))
              .single(),
          )
        : checked(
            await store
              .from("venue_customers")
              .select("venue_id")
              .eq("id", uuid(body.customer_id))
              .single(),
          );
    await desk({ store } as any, user.id, source.venue_id);
    const choice = checked(
      await store
        .from("venue_processor_preferences")
        .select("desk_provider")
        .eq("venue_id", source.venue_id)
        .maybeSingle(),
    );
    if (choice?.desk_provider !== "square") return undefined;
    if (body.action === "venue_sale_checkout") {
      const product = checked(
        await store
          .from("venue_products")
          .select("billing_cadence")
          .eq("id", uuid(body.product_id))
          .eq("venue_id", source.venue_id)
          .single(),
      );
      if (product.billing_cadence === "monthly") return undefined;
    }
    if (body.accept_terms !== true || !Number.isInteger(body.amount_cents))
      throw new Error(
        "Review the total and venue policy before creating checkout.",
      );
    const connection = checked(
      await store
        .from("venue_processor_connections")
        .select("id")
        .eq("venue_id", source.venue_id)
        .eq("provider", "square")
        .eq("livemode", true)
        .single(),
    );
    await verifySquareForNewPayment(store, connection.id);
    const common = {
      p_actor: user.id,
      p_request: uuid(body.request_key),
      p_live: true,
    };
    let order;
    if (body.action === "venue_sale_checkout")
      order = checked(
        await store.rpc("payment_reserve_venue_sale", {
          ...common,
          p_customer: uuid(body.customer_id),
          p_product: uuid(body.product_id),
          p_quantity: body.quantity,
          p_expected: body.amount_cents,
        }),
      );
    else if (body.action === "venue_walkin_checkout")
      order = checked(
        await store.rpc("payment_reserve_venue_walkin", {
          ...common,
          p_customer: uuid(body.customer_id),
          p_event: body.event_id ? uuid(body.event_id) : null,
          p_court: body.court_id ? uuid(body.court_id) : null,
          p_start: body.start_time || null,
          p_end: body.end_time || null,
          p_expected: body.amount_cents,
        }),
      );
    else
      order = checked(
        await store.rpc("payment_reserve_venue_appointment", {
          ...common,
          p_id: uuid(body.appointment_id),
          p_expected: body.version,
          p_amount: body.amount_cents,
        }),
      );
    // An idempotent retry may refer to an older Stripe order after switching defaults.
    if (order.provider !== "square") return undefined;
    return startSquareCheckout(store, order);
  }
  const saleActions = [
    "venue_sale_resume",
    "venue_sale_cancel",
    "venue_sale_reconcile",
    "venue_sale_refund",
  ];
  const buyerActions = ["resume", "reconcile", "cancel_checkout", "receipt"];
  if (!saleActions.includes(body.action) && !buyerActions.includes(body.action))
    return undefined;
  let order;
  if (saleActions.includes(body.action)) {
    const sale = checked(
      await store
        .from("venue_sales")
        .select("venue_id,payment_order_id")
        .eq("id", uuid(body.sale_id))
        .single(),
    );
    await desk(
      { store } as any,
      user.id,
      sale.venue_id,
      body.action === "venue_sale_refund",
    );
    if (!sale.payment_order_id) return undefined;
    order = checked(
      await store
        .from("payment_orders")
        .select("*")
        .eq("id", sale.payment_order_id)
        .single(),
    );
  } else
    order = checked(
      await store
        .from("payment_orders")
        .select("*")
        .eq("id", uuid(body.order_id))
        .eq("buyer_id", user.id)
        .single(),
    );
  if (order.provider !== "square") return undefined;
  if (body.action === "venue_sale_refund") {
    if (body.confirm_refund !== true)
      throw new Error("Confirm the amount to refund.");
    const venue = checked(
      await store
        .from("venues")
        .select("owner_id")
        .eq("id", order.venue_id)
        .single(),
    );
    const c = checked(
      await store
        .from("venue_processor_connections")
        .select("connected_by")
        .eq("id", order.processor_connection_id)
        .single(),
    );
    if (c.connected_by !== venue.owner_id)
      throw new Error(
        "Financial ownership review is required before refunding this payment.",
      );
    return {
      order: await refundSquareOrder(
        store,
        order,
        body.amount_cents,
        uuid(body.request_key),
      ),
    };
  }
  if (body.action === "receipt") {
    const sale = checked(
      await store
        .from("venue_sales")
        .select("receipt_token")
        .eq("id", order.venue_sale_id)
        .single(),
    );
    return { url: `https://pulsepb.com/venue-payment/${sale.receipt_token}` };
  }
  order = await reconcileSquareOrder(
    store,
    order,
    ["venue_sale_cancel", "cancel_checkout"].includes(body.action),
  );
  if (["venue_sale_resume", "resume"].includes(body.action))
    return startSquareCheckout(store, order);
  return { order };
}
