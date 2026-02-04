import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe Price IDs
const TOURNAMENT_LICENSE_PRICE_ID = "price_1SnVNRG2WbAqAcDMhZRFEB3p";
const ADDITIONAL_DIVISION_PRICE_ID = "price_1SnVOjG2WbAqAcDMQgC4Z1fj";
const INCLUDED_DIVISIONS = 3;

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-TOURNAMENT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { tournament_id } = await req.json();
    if (!tournament_id) throw new Error("tournament_id is required");
    logStep("Tournament ID received", { tournament_id });

    // Fetch tournament and verify ownership
    const { data: tournament, error: tournamentError } = await supabaseClient
      .from("tournaments_events")
      .select("id, name, created_by, divisions_count, payment_status")
      .eq("id", tournament_id)
      .single();

    if (tournamentError || !tournament) {
      throw new Error("Tournament not found");
    }

    if (tournament.created_by !== user.id) {
      throw new Error("You do not own this tournament");
    }

    if (tournament.payment_status === "paid") {
      throw new Error("Tournament is already paid");
    }

    logStep("Tournament verified", { 
      name: tournament.name, 
      payment_status: tournament.payment_status 
    });

    // FREE ACCESS: Bypass payment for specific admin account
    const FREE_ACCESS_EMAILS = ["akhourybsu@gmail.com"];
    if (FREE_ACCESS_EMAILS.includes(user.email?.toLowerCase() || "")) {
      logStep("Free access granted", { email: user.email });

      // Count actual divisions
      const { count: divisionsCount } = await supabaseClient
        .from("tournaments_divisions")
        .select("*", { count: "exact", head: true })
        .eq("event_id", tournament_id);

      // Mark tournament as paid directly
      const { error: updateError } = await supabaseClient
        .from("tournaments_events")
        .update({
          payment_status: "paid",
          paid_divisions_count: Math.max(divisionsCount || 0, 3),
        })
        .eq("id", tournament_id);

      if (updateError) {
        throw new Error("Failed to activate tournament");
      }

      logStep("Tournament activated for free", { tournament_id });

      return new Response(JSON.stringify({ free: true, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Count actual divisions from tournaments_divisions table
    const { count: actualDivisionsCount, error: countError } = await supabaseClient
      .from("tournaments_divisions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", tournament_id);

    if (countError) {
      logStep("Error counting divisions", { error: countError.message });
      throw new Error("Failed to count divisions");
    }

    const divisionsCount = actualDivisionsCount || 0;
    logStep("Divisions count from table", { divisionsCount });

    if (divisionsCount === 0) {
      throw new Error("Please add at least one division before checkout");
    }

    const extraDivisions = Math.max(0, divisionsCount - INCLUDED_DIVISIONS);
    logStep("Pricing calculated", { divisionsCount, extraDivisions });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: TOURNAMENT_LICENSE_PRICE_ID,
        quantity: 1,
      },
    ];

    if (extraDivisions > 0) {
      lineItems.push({
        price: ADDITIONAL_DIVISION_PRICE_ID,
        quantity: extraDivisions,
      });
    }

    logStep("Line items prepared", { lineItems: lineItems.length });

    const origin = req.headers.get("origin") || "https://lovable.dev";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/tournaments/${tournament_id}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/tournaments/${tournament_id}/payment-cancelled`,
      metadata: {
        tournament_id: tournament_id,
        owner_user_id: user.id,
        divisions_count: divisionsCount.toString(),
        extra_divisions: extraDivisions.toString(),
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Update tournament with pending status
    const { error: updateError } = await supabaseClient
      .from("tournaments_events")
      .update({
        payment_status: "pending",
        stripe_checkout_session_id: session.id,
      })
      .eq("id", tournament_id);

    if (updateError) {
      logStep("Warning: Failed to update tournament status", { error: updateError.message });
    } else {
      logStep("Tournament status updated to pending");
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
