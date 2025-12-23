import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      venue_id,
      booking_id,
      amount, // in cents
      description,
      customer_email,
      customer_name,
      success_url,
      cancel_url,
      metadata = {}
    } = await req.json();

    if (!venue_id || !amount) {
      throw new Error("Venue ID and amount are required");
    }

    // Get venue with Stripe account
    const { data: venue, error: venueError } = await supabaseClient
      .from("venues")
      .select("id, name, stripe_account_id, stripe_charges_enabled, platform_fee_percent")
      .eq("id", venue_id)
      .single();

    if (venueError || !venue) {
      throw new Error("Venue not found");
    }

    if (!venue.stripe_account_id || !venue.stripe_charges_enabled) {
      throw new Error("Venue has not completed Stripe onboarding");
    }

    // Calculate platform fee
    const platformFeePercent = venue.platform_fee_percent || 10;
    const platformFee = Math.round(amount * (platformFeePercent / 100));

    // Create Checkout Session with destination charge
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: description || `Booking at ${venue.name}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: success_url || `${req.headers.get("origin")}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.headers.get("origin")}/booking/cancel`,
      customer_email: customer_email,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: venue.stripe_account_id,
        },
        metadata: {
          venue_id,
          booking_id: booking_id || "",
          customer_name: customer_name || "",
          ...metadata,
        },
      },
      metadata: {
        venue_id,
        booking_id: booking_id || "",
        platform_fee: platformFee.toString(),
      },
    });

    return new Response(
      JSON.stringify({ 
        session_id: session.id,
        url: session.url,
        platform_fee: platformFee,
        venue_receives: amount - platformFee,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Create venue checkout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
