import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2023-10-16",
  });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // For testing without webhook secret
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  console.log("Received Stripe event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const venueId = session.metadata?.venue_id;
        const bookingId = session.metadata?.booking_id;
        const platformFee = parseInt(session.metadata?.platform_fee || "0");

        if (venueId && session.payment_intent) {
          // Record the payment
          await supabaseClient.from("venue_payments").insert({
            venue_id: venueId,
            booking_id: bookingId || null,
            stripe_payment_intent_id: session.payment_intent as string,
            amount_total: session.amount_total || 0,
            amount_platform_fee: platformFee,
            amount_venue: (session.amount_total || 0) - platformFee,
            currency: session.currency || "usd",
            status: "succeeded",
            customer_email: session.customer_email,
            metadata: session.metadata,
          });

          // Update booking status if exists
          if (bookingId) {
            await supabaseClient
              .from("venue_bookings")
              .update({ status: "confirmed", payment_status: "paid" })
              .eq("id", bookingId);
          }
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const venueId = account.metadata?.venue_id;

        if (venueId) {
          await supabaseClient
            .from("venues")
            .update({
              stripe_charges_enabled: account.charges_enabled,
              stripe_payouts_enabled: account.payouts_enabled,
              stripe_onboarding_complete: account.details_submitted,
            })
            .eq("id", venueId);
        } else {
          // Find venue by stripe account ID
          await supabaseClient
            .from("venues")
            .update({
              stripe_charges_enabled: account.charges_enabled,
              stripe_payouts_enabled: account.payouts_enabled,
              stripe_onboarding_complete: account.details_submitted,
            })
            .eq("stripe_account_id", account.id);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update payment record status
        await supabaseClient
          .from("venue_payments")
          .update({ status: "succeeded" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        await supabaseClient
          .from("venue_payments")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        
        // Update payment record with transfer ID
        if (transfer.source_transaction) {
          await supabaseClient
            .from("venue_payments")
            .update({ stripe_transfer_id: transfer.id })
            .eq("stripe_payment_intent_id", transfer.source_transaction);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook handler error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
