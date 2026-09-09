import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { checked, env, runtime } from "../_shared/payment-runtime.ts";
import { reconcileOrder } from "../_shared/payment-checkout.ts";

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
    return new Response(JSON.stringify({ checked: orders.length, failed }), {
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
