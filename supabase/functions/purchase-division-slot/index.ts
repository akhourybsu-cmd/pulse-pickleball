import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PURCHASE-DIVISION-SLOT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { tournament_id } = await req.json();
    if (!tournament_id) throw new Error("tournament_id is required");
    logStep("Request parsed", { tournament_id });

    // Fetch tournament and verify ownership
    const { data: tournament, error: tournamentError } = await supabaseClient
      .from("tournaments_events")
      .select("id, name, created_by, payment_status, paid_divisions_count")
      .eq("id", tournament_id)
      .single();

    if (tournamentError || !tournament) {
      logStep("Tournament not found", { error: tournamentError?.message });
      throw new Error("Tournament not found");
    }

    if (tournament.created_by !== user.id) {
      throw new Error("You are not authorized to manage this tournament");
    }

    if (tournament.payment_status !== "paid") {
      throw new Error("Tournament must be paid before purchasing additional divisions");
    }

    logStep("Tournament verified", {
      name: tournament.name,
      paid_divisions_count: tournament.paid_divisions_count,
    });

    // FREE ACCESS: Bypass payment for specific admin account
    const FREE_ACCESS_EMAILS = ["akhourybsu@gmail.com"];
    if (FREE_ACCESS_EMAILS.includes(user.email?.toLowerCase() || "")) {
      logStep("Free division slot granted", { email: user.email });

      // Increment paid_divisions_count directly
      const { error: updateError } = await supabaseClient
        .from("tournaments_events")
        .update({
          paid_divisions_count: (tournament.paid_divisions_count || 3) + 1,
        })
        .eq("id", tournament_id);

      if (updateError) {
        throw new Error("Failed to add division slot");
      }

      logStep("Division slot added for free", { tournament_id });

      return new Response(JSON.stringify({ free: true, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    }

    // Get origin for success/cancel URLs
    const origin = req.headers.get("origin") || "https://lovable.dev";

    // Create checkout session for additional division
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Additional Division Slot",
              description: `Extra division slot for ${tournament.name}`,
            },
            unit_amount: 900, // $9.00
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/tournaments/${tournament_id}?division_purchased=true`,
      cancel_url: `${origin}/tournaments/${tournament_id}?division_purchase_cancelled=true`,
      metadata: {
        tournament_id,
        user_id: user.id,
        purchase_type: "additional_division",
        current_paid_count: String(tournament.paid_divisions_count || 3),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

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