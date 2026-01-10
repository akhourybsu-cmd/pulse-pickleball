import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product IDs for venue tiers (configure in Stripe Dashboard)
const TIER_PRODUCTS: Record<string, string> = {
  [Deno.env.get("STRIPE_PLUS_PRODUCT_ID") || "prod_plus_placeholder"]: "plus",
  [Deno.env.get("STRIPE_PRO_PRODUCT_ID") || "prod_pro_placeholder"]: "pro",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-VENUE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { venueId } = await req.json();
    if (!venueId) throw new Error("venueId is required");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find subscriptions with this venue_id in metadata
    const subscriptions = await stripe.subscriptions.search({
      query: `status:'active' AND metadata['venue_id']:'${venueId}'`,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription found for venue");
      
      // Update venue_subscriptions to free tier
      await supabaseClient
        .from("venue_subscriptions")
        .upsert({
          venue_id: venueId,
          tier: "free",
          status: "active",
          stripe_subscription_id: null,
          current_period_start: null,
          current_period_end: null,
        }, { onConflict: "venue_id" });

      return new Response(JSON.stringify({
        subscribed: false,
        tier: "free",
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const productId = subscription.items.data[0]?.price?.product as string;
    const tier = TIER_PRODUCTS[productId] || subscription.metadata.tier || "plus";
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const subscriptionStart = new Date(subscription.current_period_start * 1000).toISOString();

    logStep("Active subscription found", {
      subscriptionId: subscription.id,
      tier,
      endDate: subscriptionEnd,
    });

    // Update venue_subscriptions table
    const { error: updateError } = await supabaseClient
      .from("venue_subscriptions")
      .upsert({
        venue_id: venueId,
        tier: tier,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        current_period_start: subscriptionStart,
        current_period_end: subscriptionEnd,
        cancel_at_period_end: subscription.cancel_at_period_end,
        status: subscription.status,
      }, { onConflict: "venue_id" });

    if (updateError) {
      logStep("Error updating venue subscription", { error: updateError.message });
    }

    return new Response(JSON.stringify({
      subscribed: true,
      tier: tier,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
    }), {
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
