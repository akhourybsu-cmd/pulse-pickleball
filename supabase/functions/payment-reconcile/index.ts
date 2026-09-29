import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { checked, env, runtime, db } from "../_shared/payment-runtime.ts";
import { reconcileOrder } from "../_shared/payment-checkout.ts";
import { reconcileRefundPayment } from "../_shared/payment-refunds.ts";
import { billingMode } from "../_shared/payment-contracts.ts";
import { authorizePaymentRecovery } from "../_shared/payment-recovery-auth.ts";
import { reconcileSquareOrder } from '../_shared/square-payments.ts';

// Invoke every five minutes from a server-side scheduler. It is NOT a public
// user action and cannot accept a user's JWT in place of this distinct secret.
serve(async (req) => {
  const authorized = await authorizePaymentRecovery(
    req,
    env("PULSE_PAYMENT_RECONCILE_SECRET"),
    async (secret) => {
      const result = await db().rpc("is_valid_scheduled_task_secret", {
        p_secret: secret,
      });
      return !result.error && result.data === true;
    }
  );
  if (!authorized) return new Response("Unauthorized", { status: 401 });
  try {
    const squareStore = db();
    checked(await squareStore.from('venue_processor_oauth_states').delete().lt('expires_at',new Date(Date.now()-24*3600_000).toISOString()));
    const squareOrders = checked(await squareStore.from('payment_orders').select('*').eq('provider','square').in('status',['pending','paid','partially_refunded','refunded']).order('processor_checked_at',{ascending:true,nullsFirst:true}).limit(50)) || [];
    let squareFailed = 0;
    for (const order of squareOrders) {
      try {
        await reconcileSquareOrder(squareStore, order);
      } catch { squareFailed++; }
      finally { checked(await squareStore.from('payment_orders').update({processor_checked_at:new Date().toISOString()}).eq('id',order.id)); }
    }
    if (billingMode(env).mode === "off")
      return new Response(
        JSON.stringify({ disabled: true, checked: squareOrders.length, failed: squareFailed }),
        {
          status: squareFailed ? 500 : 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    const r = await runtime();
    const orders =
      checked(
        await r.store
          .from("payment_orders")
          .select("*")
          .eq("livemode", r.livemode)
          .eq("status", "pending")
          .eq('provider','stripe')
          .order("created_at")
          .limit(100)
      ) || [];
    let failed = squareFailed;
    for (const order of orders) {
      try {
        await reconcileOrder(r, order);
      } catch {
        failed++;
      }
    }
    // Rotate across settled orders too: a missed failure event can follow an
    // approved refund. Oldest-started first avoids starving older payments.
    const refunds =
      checked(
        await r.store
          .from("payment_orders")
          .select("account_id,livemode,payment_intent_id")
          .eq("livemode", r.livemode)
          .eq('provider','stripe')
          .in("status", ["paid", "partially_refunded", "refunded"])
          .not("payment_intent_id", "is", null)
          .order("refund_sync_started_at", {
            ascending: true,
            nullsFirst: true,
          })
          .limit(100)
      ) || [];
    for (let offset = 0; offset < refunds.length; offset += 5) {
      await Promise.all(
        refunds.slice(offset, offset + 5).map(async (order) => {
          try {
            if (!order.payment_intent_id)
              throw new Error("Missing refund payment reference");
            await reconcileRefundPayment(
              r,
              order.account_id,
              order.payment_intent_id
            );
          } catch {
            failed++;
          }
        })
      );
    }
    checked(
      await r.store
        .from("venue_payment_oauth_states")
        .delete()
        .lt("expires_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    );
    return new Response(
      JSON.stringify({
        checked: orders.length + squareOrders.length,
        refunds_checked: refunds.length,
        failed,
      }),
      {
        status: failed ? 500 : 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return new Response("Reconciliation unavailable", { status: 500 });
  }
});
