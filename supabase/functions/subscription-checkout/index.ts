import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Price IDs for venue subscription tiers (configure in Stripe Dashboard)
const TIER_PRICES: Record<string, string> = {
  plus: Deno.env.get("STRIPE_PLUS_PRICE_ID") || "price_plus_placeholder",
  pro: Deno.env.get("STRIPE_PRO_PRICE_ID") || "price_pro_placeholder",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SUBSCRIPTION-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Get request body
    const { venueId, tier } = await req.json();
    if (!venueId || !tier) {
      throw new Error("venueId and tier are required");
    }
    logStep("Request params", { venueId, tier });

    // Validate tier
    if (!TIER_PRICES[tier]) {
      throw new Error(`Invalid tier: ${tier}. Valid tiers: ${Object.keys(TIER_PRICES).join(", ")}`);
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Verify user has access to venue
    const { data: venueAccess, error: venueError } = await supabaseClient
      .from("venue_staff")
      .select("role")
      .eq("venue_id", venueId)
      .eq("user_id", user.id)
      .single();

    if (venueError || !venueAccess) {
      throw new Error("User does not have access to this venue");
    }
    logStep("Venue access verified", { role: venueAccess.role });

    // Get venue details
    const { data: venue, error: venueDetailError } = await supabaseClient
      .from("venues")
      .select("name")
      .eq("id", venueId)
      .single();

    if (venueDetailError) throw new Error("Could not fetch venue details");

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: TIER_PRICES[tier],
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/venue/${venueId}/settings?subscription=success`,
      cancel_url: `${origin}/venue/${venueId}/settings?subscription=canceled`,
      metadata: {
        venue_id: venueId,
        tier: tier,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          venue_id: venueId,
          tier: tier,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

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
