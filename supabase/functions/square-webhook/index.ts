import { checked, db, env } from "../_shared/payment-runtime.ts";
import {
  squareConfiguration,
  validSquareSignature,
} from "../_shared/square-api.ts";
import { reconcileSquareOrder } from "../_shared/square-payments.ts";
Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return new Response("POST required", { status: 405 });
  const config = squareConfiguration(env);
  if (!config) return new Response("Integration unavailable", { status: 503 });
  const raw = await req.text();
  if (
    raw.length > 1_000_000 ||
    !(await validSquareSignature(
      config.webhookKey,
      config.webhookUrl,
      raw,
      req.headers.get("x-square-hmacsha256-signature"),
    ))
  )
    return new Response("Invalid signature", { status: 401 });
  try {
    const event = JSON.parse(raw);
    if (typeof event.merchant_id !== "string")
      return new Response("Invalid event", { status: 400 });
    const store = db();
    const connections =
      checked(
        await store
          .from("venue_processor_connections")
          .select("id")
          .eq("provider", "square")
          .eq("merchant_id", event.merchant_id)
          .eq("livemode", config.live),
      ) || [];
    if (!connections.length) return new Response("No matching venue");
    const ids = connections.map((c: any) => c.id);
    if (event.type === "oauth.authorization.revoked") {
      checked(
        await store
          .from("venue_processor_connections")
          .update({
            status: "needs_attention",
            updated_at: new Date().toISOString(),
          })
          .in("id", ids),
      );
      return new Response("Connection needs attention");
    }
    const object = event.data?.object || {};
    const remoteOrder =
      object.payment?.order_id || object.order_updated?.order_id;
    const payment =
      object.refund?.payment_id || object.dispute?.disputed_payment?.payment_id;
    if (!remoteOrder && !payment)
      return new Response("Event does not affect a tracked payment");
    let query = store
      .from("payment_orders")
      .select("*")
      .eq("provider", "square")
      .in("processor_connection_id", ids);
    query = remoteOrder
      ? query.eq("processor_order_id", remoteOrder)
      : query.eq("payment_intent_id", payment);
    const orders = checked(await query) || [];
    for (const order of orders) await reconcileSquareOrder(store, order);
    return new Response("Verified");
  } catch {
    return new Response("Payment verification needs retry", { status: 500 });
  }
});
