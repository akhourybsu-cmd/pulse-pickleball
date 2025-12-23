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
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { venue_id, return_url, refresh_url } = await req.json();

    if (!venue_id) {
      throw new Error("Venue ID is required");
    }

    // Verify user owns this venue
    const { data: venue, error: venueError } = await supabaseClient
      .from("venues")
      .select("id, name, stripe_account_id, owner_id")
      .eq("id", venue_id)
      .single();

    if (venueError || !venue) {
      throw new Error("Venue not found");
    }

    if (venue.owner_id !== user.id) {
      throw new Error("Not authorized to manage this venue");
    }

    let accountId = venue.stripe_account_id;

    // Create Stripe Connect account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        metadata: {
          venue_id: venue_id,
          supabase_user_id: user.id,
        },
      });
      accountId = account.id;

      // Save account ID to venue
      await supabaseClient
        .from("venues")
        .update({ stripe_account_id: accountId })
        .eq("id", venue_id);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url || `${req.headers.get("origin")}/venue/settings?stripe=refresh`,
      return_url: return_url || `${req.headers.get("origin")}/venue/settings?stripe=success`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ url: accountLink.url, account_id: accountId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Stripe Connect onboard error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
