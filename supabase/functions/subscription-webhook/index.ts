import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Map Stripe product IDs to tier names
const TIER_PRODUCTS: Record<string, string> = {
  [Deno.env.get("STRIPE_PLUS_PRODUCT_ID") || ""]: "plus",
  [Deno.env.get("STRIPE_PRO_PRODUCT_ID") || ""]: "pro",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SUBSCRIPTION-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logStep("Webhook signature verification failed", { error: errorMessage });
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // For development/testing without signature verification
      event = JSON.parse(body);
      logStep("Processing without signature verification (dev mode)");
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabaseAdmin, subscription, logStep);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancellation(supabaseAdmin, subscription, logStep);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabaseAdmin, invoice, logStep);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabaseAdmin, stripe, session, logStep);
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// deno-lint-ignore no-explicit-any
async function handleSubscriptionChange(
  supabaseClient: any,
  subscription: Stripe.Subscription,
  logStep: (step: string, details?: Record<string, unknown>) => void
) {
  const venueId = subscription.metadata?.venue_id;
  if (!venueId) {
    logStep("No venue_id in subscription metadata, skipping");
    return;
  }

  // Determine tier from product
  const productId = subscription.items.data[0]?.price?.product as string;
  const tier = TIER_PRODUCTS[productId] || "free";

  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const status = subscription.status;

  logStep("Updating subscription", { 
    venueId, 
    tier, 
    status, 
    cancelAtPeriodEnd,
    periodEnd 
  });

  const supabase = supabaseClient;

  // Check if subscription record exists
  const { data: existing } = await supabase
    .from("venue_subscriptions")
    .select("id")
    .eq("venue_id", venueId)
    .single();

  if (existing) {
    // Update existing subscription
    const { error } = await supabase
      .from("venue_subscriptions")
      .update({
        tier: status === "active" ? tier : "free",
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("venue_id", venueId);

    if (error) {
      logStep("Error updating subscription", { error: error.message });
      throw error;
    }
  } else {
    // Create new subscription record
    const { error } = await supabase
      .from("venue_subscriptions")
      .insert({
        venue_id: venueId,
        tier: status === "active" ? tier : "free",
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
      });

    if (error) {
      logStep("Error creating subscription", { error: error.message });
      throw error;
    }
  }

  logStep("Subscription updated successfully", { venueId, tier });
}

// deno-lint-ignore no-explicit-any
async function handleSubscriptionCancellation(
  supabaseClient: any,
  subscription: Stripe.Subscription,
  logStep: (step: string, details?: Record<string, unknown>) => void
) {
  const venueId = subscription.metadata?.venue_id;
  if (!venueId) {
    logStep("No venue_id in subscription metadata, skipping cancellation");
    return;
  }

  logStep("Processing subscription cancellation", { venueId });

  const { error } = await supabaseClient
    .from("venue_subscriptions")
    .update({
      tier: "free",
      stripe_subscription_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("venue_id", venueId);

  if (error) {
    logStep("Error cancelling subscription", { error: error.message });
    throw error;
  }

  logStep("Subscription cancelled, reverted to free tier", { venueId });
}

// deno-lint-ignore no-explicit-any
async function handlePaymentFailed(
  supabaseClient: any,
  invoice: Stripe.Invoice,
  logStep: (step: string, details?: Record<string, unknown>) => void
) {
  const customerId = invoice.customer as string;
  logStep("Payment failed", { customerId, invoiceId: invoice.id });

  // Find venue by stripe customer ID
  const supabase = supabaseClient;
  const { data: subscription } = await supabase
    .from("venue_subscriptions")
    .select("venue_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (subscription) {
    logStep("Payment failed for venue", { venueId: subscription.venue_id });
    // Could add notification logic here
  }
}

// deno-lint-ignore no-explicit-any
async function handleCheckoutCompleted(
  supabaseClient: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  logStep: (step: string, details?: Record<string, unknown>) => void
) {
  if (session.mode !== "subscription") {
    logStep("Not a subscription checkout, skipping");
    return;
  }

  const venueId = session.metadata?.venue_id;
  const tier = session.metadata?.tier;

  if (!venueId) {
    logStep("No venue_id in checkout metadata");
    return;
  }

  logStep("Checkout completed", { venueId, tier, subscriptionId: session.subscription });

  // The subscription.created event will handle the actual update,
  // but we can do immediate update here too for faster UI response
  if (session.subscription) {
    const subscriptionData = await stripe.subscriptions.retrieve(session.subscription as string);
    await handleSubscriptionChange(supabaseClient, subscriptionData, logStep);
  }
}
