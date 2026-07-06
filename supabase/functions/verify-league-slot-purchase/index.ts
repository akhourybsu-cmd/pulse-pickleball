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
//   3. INSERT a row into league_slot_purchases keyed by the session
//      id. UNIQUE constraint on stripe_session_id makes it idempotent:
//      re-runs are a no-op.
//   4. Bump profiles.additional_league_slots on that user.
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
    log("Session verified", { sessionId, amount: session.amount_total });

    // Service-role client so we can bypass RLS on the ledger + profile.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRole,
      { auth: { persistSession: false } },
    );

    // Idempotent insert. If the row already exists we treat it as
    // already-fulfilled and return {granted: 0}.
    const { data: existing } = await admin
      .from("league_slot_purchases")
      .select("id, status")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (existing?.status === "paid") {
      log("Already fulfilled", { sessionId });
      return new Response(
        JSON.stringify({ granted: 0, alreadyFulfilled: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertErr } = await admin
      .from("league_slot_purchases")
      .upsert({
        user_id: user.id,
        stripe_session_id: sessionId,
        stripe_customer_id: typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null,
        amount_cents: session.amount_total ?? null,
        currency: session.currency ?? "usd",
        slots_granted: 1,
        status: "paid",
        fulfilled_at: new Date().toISOString(),
      }, { onConflict: "stripe_session_id" });
    if (insertErr) throw insertErr;

    // Atomic bump via the SECURITY DEFINER RPC (service-role gated).
    const { error: rpcErr } = await admin.rpc(
      "increment_league_slots",
      { p_user_id: user.id, p_delta: 1 },
    );
    if (rpcErr) throw rpcErr;

    log("Slot granted", { userId: user.id });
    return new Response(
      JSON.stringify({ granted: 1, alreadyFulfilled: false }),
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
