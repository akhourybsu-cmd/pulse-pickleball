// Idempotent fulfillment of a league-slot purchase.
//
// Called by the client after Stripe redirects back to
// /player/leagues?league_slot=success&session_id=cs_test_...
//
// Flow:
//   1. Authenticate the caller (must be a real user).
//   2. Retrieve the Stripe session and verify payment_status === 'paid'
//      AND session.metadata.user_id === auth.uid() (prevents someone
//      from redeeming another user's session id).
//   3. Verify live mode, product purpose, configured price, quantity and currency.
//   4. Atomically record the purchase AND increment the profile via the
//      server-only payment_fulfill_league_slot RPC. Duplicate calls grant zero.
//
// Env vars:
//   STRIPE_SECRET_KEY               — same as checkout
//   SUPABASE_SERVICE_ROLE_KEY       — required to bypass RLS on the
//                                     ledger + profile writes
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const s = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-LEAGUE-SLOT] ${step}${s}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

    const { session_id: sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      throw new Error("session_id is required");
    }

    // Authenticate the caller via their user JWT.
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: userData } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");
    log("Authenticated", { userId: user.id });

    // Look up the Stripe session.
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      throw new Error(`Session payment_status is ${session.payment_status}, not paid`);
    }
    const metaUserId = session.metadata?.user_id;
    if (metaUserId !== user.id) {
      throw new Error("Session does not belong to the calling user");
    }
    const priceId = Deno.env.get('STRIPE_LEAGUE_SLOT_PRICE_ID');
    if (!priceId || session.metadata?.purpose !== 'league_slot' || session.mode !== 'payment' || !session.livemode) {
      throw new Error('Only a verified live league-slot purchase can grant a league slot');
    }
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
    if (items.has_more || items.data.length !== 1 || items.data[0].price?.id !== priceId || items.data[0].quantity !== 1
      || session.currency !== 'usd' || !session.amount_total || items.data[0].amount_total !== session.amount_total) {
      throw new Error('League purchase price verification failed');
    }
    log("Session verified", { sessionId, amount: session.amount_total });

    // Service-role client so we can bypass RLS on the ledger + profile.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRole,
      { auth: { persistSession: false } },
    );

    const { data: granted, error: rpcErr } = await admin.rpc('payment_fulfill_league_slot', {
      p_user: user.id, p_session: sessionId, p_customer: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
      p_amount: session.amount_total, p_currency: session.currency,
    });
    if (rpcErr) throw rpcErr;

    log("Slot granted", { userId: user.id });
    return new Response(
      JSON.stringify({ granted, alreadyFulfilled: granted === 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
