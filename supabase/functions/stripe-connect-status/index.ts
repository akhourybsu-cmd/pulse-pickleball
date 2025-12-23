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

    const { venue_id } = await req.json();

    if (!venue_id) {
      throw new Error("Venue ID is required");
    }

    const { data: venue, error: venueError } = await supabaseClient
      .from("venues")
      .select("stripe_account_id")
      .eq("id", venue_id)
      .single();

    if (venueError || !venue || !venue.stripe_account_id) {
      return new Response(
        JSON.stringify({ 
          connected: false,
          charges_enabled: false,
          payouts_enabled: false,
          onboarding_complete: false
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(venue.stripe_account_id);

    const status = {
      connected: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      onboarding_complete: account.details_submitted,
      requirements: account.requirements,
    };

    // Update venue with latest status
    await supabaseClient
      .from("venues")
      .update({
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_onboarding_complete: account.details_submitted,
      })
      .eq("id", venue_id);

    return new Response(
      JSON.stringify(status),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Stripe Connect status error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
