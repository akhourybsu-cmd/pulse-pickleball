// Creates a one-time Stripe Checkout session for a single league slot.
//
// Env vars required:
//   STRIPE_SECRET_KEY               — server-side Stripe secret
//   STRIPE_LEAGUE_SLOT_PRICE_ID     — price ID for a single league slot
//                                     (one-time payment mode)
//
// On success, Stripe redirects the browser back to
// `${origin}/player/leagues?league_slot=success&session_id={CHECKOUT_SESSION_ID}`.
// The client then calls `verify-league-slot-purchase` with that
// session_id to grant the slot idempotently.
//
// Mirrors the pattern used by `subscription-checkout` (venue tier).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const s = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[LEAGUE-CHECKOUT] ${step}${s}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const priceId = Deno.env.get("STRIPE_LEAGUE_SLOT_PRICE_ID");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!priceId) throw new Error("STRIPE_LEAGUE_SLOT_PRICE_ID not configured");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    // Authenticate the caller using their JWT.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");
    log("Authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Reuse an existing customer keyed by email so purchase history
    // consolidates in Stripe.
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      // One-time payment — a single slot per session.
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Redirect back to the player leagues page with the session id
      // template so the verify function can look it up.
      success_url:
        `${origin}/player/leagues?league_slot=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        `${origin}/player/leagues?league_slot=canceled`,
      metadata: {
        user_id: user.id,
        purpose: "league_slot",
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          purpose: "league_slot",
        },
      },
    });

    log("Session created", { sessionId: session.id });
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
