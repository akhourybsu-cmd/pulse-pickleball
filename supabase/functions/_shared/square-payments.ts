import { checked, env, db } from "./payment-runtime.ts";
import {
  assertSquareOrder,
  assertSquarePayment,
  squareCheckoutRequest,
  squareConfiguration,
  squareRequest,
  type SquareConfig,
} from "./square-api.ts";

export function requireSquareConfig() {
  const config = squareConfiguration(env);
  if (!config)
    throw new Error(
      "PULSE must finish Square application setup before this connection can be used.",
    );
  return config;
}
export async function squareConnection(
  store: ReturnType<typeof db>,
  id: string,
  config = requireSquareConfig(),
) {
  let data = checked(
    await store.rpc("venue_processor_credentials", { p_id: id }),
  );
  if (
    data.connection.provider !== "square" ||
    data.connection.livemode !== config.live
  )
    throw new Error("Square payment environment does not match.");
  if (
    new Date(data.connection.token_expires_at).getTime() <
    Date.now() + 24 * 3600_000
  ) {
    const token = await squareRequest(config, null, "/oauth2/token", {
      client_id: config.applicationId,
      client_secret: config.applicationSecret,
      grant_type: "refresh_token",
      refresh_token: data.credentials.refresh_token,
    });
    if (
      !token.access_token ||
      !token.refresh_token ||
      token.merchant_id !== data.connection.merchant_id ||
      !Number.isFinite(Date.parse(token.expires_at))
    )
      throw new Error("Square could not refresh this merchant connection.");
    checked(
      await store.rpc("venue_processor_refresh_token", {
        p_id: id,
        p_version: data.connection.version,
        p_credentials: JSON.stringify({
          access_token: token.access_token,
          refresh_token: token.refresh_token,
        }),
        p_expires: token.expires_at,
      }),
    );
    data = checked(
      await store.rpc("venue_processor_credentials", { p_id: id }),
    );
  }
  return {
    config,
    connection: data.connection,
    token: data.credentials.access_token as string,
  };
}
export async function squareLocations(
  store: ReturnType<typeof db>,
  id: string,
) {
  const { config, token } = await squareConnection(store, id);
  const data = await squareRequest(config, token, "/v2/locations");
  return (data.locations || [])
    .filter(
      (l: any) =>
        l.status === "ACTIVE" &&
        l.currency === "USD" &&
        l.capabilities?.includes("CREDIT_CARD_PROCESSING"),
    )
    .map((l: any) => ({
      id: l.id,
      name: l.name,
      country: l.country,
      currency: l.currency,
    }));
}
export async function verifySquareForNewPayment(
  store: ReturnType<typeof db>,
  id: string,
) {
  const context = await squareConnection(store, id);
  const c = context.connection;
  if (
    !c.livemode ||
    c.status !== "connected" ||
    env("PULSE_PAYMENTS_MODE") !== "live" ||
    env("PULSE_PAYMENTS_PAUSED") === "true"
  )
    throw new Error("New Square collections are not available.");
  checked(
    await store.rpc("venue_processor_owner", {
      p_venue: c.venue_id,
      p_actor: c.connected_by,
    }),
  );
  const result = await squareRequest(
    context.config,
    context.token,
    `/v2/locations/${encodeURIComponent(c.location_id)}`,
  );
  const l = result.location;
  if (
    l?.id !== c.location_id ||
    l.merchant_id !== c.merchant_id ||
    l.status !== "ACTIVE" ||
    l.currency !== "USD" ||
    !l.capabilities?.includes("CREDIT_CARD_PROCESSING")
  )
    throw new Error("This Square location cannot accept USD card payments.");
  return context;
}
export async function startSquareCheckout(
  store: ReturnType<typeof db>,
  order: any,
  recovery = false,
) {
  if (order.status !== "pending" || order.provider !== "square")
    throw new Error("This payment is no longer awaiting checkout.");
  const context = recovery
    ? await squareConnection(store, order.processor_connection_id)
    : await verifySquareForNewPayment(store, order.processor_connection_id);
  if (
    context.connection.venue_id !== order.venue_id ||
    context.connection.livemode !== order.livemode
  )
    throw new Error("Payment connection does not match this venue.");
  if (order.checkout_session_id)
    return {
      url: order.processor_checkout_url,
      order_id: order.id,
      provider: "square",
    };
  const sale = checked(
    await store
      .from("venue_sales")
      .select("receipt_token")
      .eq("id", order.venue_sale_id)
      .single(),
  );
  // Immutable payload and idempotency key recover a lost response without charging twice.
  const result = await squareRequest(
    context.config,
    context.token,
    "/v2/online-checkout/payment-links",
    squareCheckoutRequest(
      order,
      context.connection.location_id,
      `https://pulsepb.com/venue-payment/${sale.receipt_token}`,
    ),
  );
  const link = result.payment_link;
  if (
    !link?.id ||
    !link.order_id ||
    !/^https:\/\/(square\.link|checkout\.square\.site)\//.test(link.url || "")
  )
    throw new Error("Square did not confirm a secure checkout link.");
  checked(
    await store
      .from("payment_orders")
      .update({
        checkout_session_id: link.id,
        processor_order_id: link.order_id,
        processor_checkout_url: link.url,
      })
      .eq("id", order.id)
      .eq("provider", "square"),
  );
  return { url: link.url, order_id: order.id, provider: "square" };
}
export async function reconcileSquareOrder(
  store: ReturnType<typeof db>,
  order: any,
  cancel = false,
) {
  if (order.provider !== "square") throw new Error("Choose a Square payment.");
  const context = await squareConnection(store, order.processor_connection_id);
  const { config, token, connection: c } = context;
  if (c.venue_id !== order.venue_id || c.livemode !== order.livemode)
    throw new Error("Payment destination does not match.");
  if (!order.processor_order_id && order.status === "pending") {
    await startSquareCheckout(store, order, true);
    order = checked(
      await store
        .from("payment_orders")
        .select("*")
        .eq("id", order.id)
        .single(),
    );
  }
  if (!order.processor_order_id) return order;
  let remote = (
    await squareRequest(
      config,
      token,
      `/v2/orders/${encodeURIComponent(order.processor_order_id)}`,
    )
  ).order;
  assertSquareOrder(order, remote, c.location_id);
  if (
    (cancel || Date.parse(order.expires_at) < Date.now()) &&
    order.status === "pending" &&
    !["COMPLETED", "CANCELED"].includes(remote.state)
  ) {
    await squareRequest(
      config,
      token,
      `/v2/online-checkout/payment-links/${encodeURIComponent(order.checkout_session_id)}`,
      undefined,
      "DELETE",
    );
    remote = (
      await squareRequest(
        config,
        token,
        `/v2/orders/${encodeURIComponent(order.processor_order_id)}`,
      )
    ).order;
    assertSquareOrder(order, remote, c.location_id);
  }
  if (remote.state === "CANCELED" && order.status === "pending") {
    // A timer or deleted local link is never sufficient to release inventory.
    if (remote.tenders?.some((t: any) => t.payment_id))
      throw new Error(
        "This canceled checkout has payment activity. Venue review is required.",
      );
    return checked(
      await store.rpc("payment_apply_result", {
        p_order: order.id,
        p_account: order.account_id,
        p_live: order.livemode,
        p_session: order.checkout_session_id,
        p_status: "expired",
        p_amount: order.amount_cents,
        p_currency: order.currency,
        p_intent: null,
        p_customer: null,
      }),
    );
  }
  const ids = [
    ...new Set<string>(
      (remote.tenders || []).map((t: any) => t.payment_id).filter(Boolean),
    ),
  ];
  if (ids.length !== 1) {
    if (ids.length > 1)
      throw new Error("Multiple payments require venue review.");
    return order;
  }
  const payment = (
    await squareRequest(
      config,
      token,
      `/v2/payments/${encodeURIComponent(ids[0])}`,
    )
  ).payment;
  assertSquarePayment(order, payment, c.location_id);
  if (order.status === "pending")
    order = checked(
      await store.rpc("payment_apply_result", {
        p_order: order.id,
        p_account: order.account_id,
        p_live: order.livemode,
        p_session: order.checkout_session_id,
        p_status: "paid",
        p_amount: order.amount_cents,
        p_currency: order.currency,
        p_intent: payment.id,
        p_customer: null,
      }),
    );
  if (order.payment_intent_id !== payment.id)
    throw new Error("Square payment reference changed.");
  const version = checked(
    await store.rpc("payment_begin_refund_sync", {
      p_account: order.account_id,
      p_live: order.livemode,
      p_intent: payment.id,
    }),
  );
  if (version != null) {
    // Fetch again after obtaining a snapshot version, including every refund ID.
    const fresh = (
      await squareRequest(
        config,
        token,
        `/v2/payments/${encodeURIComponent(payment.id)}`,
      )
    ).payment;
    assertSquarePayment(order, fresh, c.location_id);
    const attempts = [];
    for (const id of fresh.refund_ids || []) {
      const refund = (
        await squareRequest(
          config,
          token,
          `/v2/refunds/${encodeURIComponent(id)}`,
        )
      ).refund;
      if (
        refund.payment_id !== payment.id ||
        refund.location_id !== c.location_id ||
        refund.amount_money?.currency !== "USD"
      )
        throw new Error("Refund destination mismatch.");
      const status = (
        {
          COMPLETED: "succeeded",
          PENDING: "pending",
          REJECTED: "failed",
          FAILED: "failed",
        } as Record<string, string>
      )[refund.status];
      if (!status) throw new Error("Unknown Square refund status.");
      // Namespaced lossless ID encoding satisfies the existing refund ledger contract.
      const encoded = Array.from(new TextEncoder().encode(refund.id))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      attempts.push({
        id: `re_${encoded}`,
        amount: refund.amount_money.amount,
        status,
      });
    }
    let disputed = false,
      cursor: string | undefined;
    const cursors = new Set<string>();
    do {
      const params = new URLSearchParams({ location_id: c.location_id });
      if (cursor) params.set("cursor", cursor);
      const page = await squareRequest(config, token, `/v2/disputes?${params}`);
      disputed = (page.disputes || []).some(
        (d: any) =>
          d.location_id === c.location_id &&
          d.disputed_payment?.payment_id === payment.id,
      );
      cursor = page.cursor;
      if (cursor && cursors.has(cursor))
        throw new Error("Square dispute history could not be fully verified.");
      if (cursor) cursors.add(cursor);
    } while (cursor && !disputed);
    const applied = checked(
      await store.rpc("payment_apply_refund_snapshot", {
        p_account: order.account_id,
        p_live: order.livemode,
        p_intent: payment.id,
        p_version: version,
        p_amount: order.amount_cents,
        p_attempts: attempts,
        p_disputed: disputed,
      }),
    );
    if (!applied)
      throw new Error("A newer payment check is in progress. Refresh again.");
  }
  return checked(
    await store.from("payment_orders").select("*").eq("id", order.id).single(),
  );
}
export async function refundSquareOrder(
  store: ReturnType<typeof db>,
  order: any,
  amount: number,
  request: string,
) {
  order = await reconcileSquareOrder(store, order);
  if (
    !["paid", "partially_refunded"].includes(order.status) ||
    order.refund_state === "pending" ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > order.amount_cents - order.refunded_cents
  )
    throw new Error(
      "Review the settled payment and remaining refundable amount.",
    );
  const { config, token } = await squareConnection(
    store,
    order.processor_connection_id,
  );
  await squareRequest(config, token, "/v2/refunds", {
    idempotency_key: request,
    payment_id: order.payment_intent_id,
    amount_money: { amount, currency: "USD" },
    reason: "Venue refund",
  });
  return reconcileSquareOrder(store, order);
}
