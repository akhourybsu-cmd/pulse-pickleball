import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[process-waitlist] Starting waitlist processing...");

    // Step 1: Find expired promotions (unclaimed within deadline)
    const { data: expiredPromotions, error: expiredError } = await supabase
      .from("event_registrations")
      .select("id, event_id, user_id")
      .eq("status", "confirmed")
      .not("promotion_deadline", "is", null)
      .lt("promotion_deadline", new Date().toISOString())
      .eq("auto_expired", false);

    if (expiredError) {
      console.error("[process-waitlist] Error finding expired promotions:", expiredError);
    } else if (expiredPromotions && expiredPromotions.length > 0) {
      console.log(`[process-waitlist] Found ${expiredPromotions.length} expired promotions`);

      for (const registration of expiredPromotions) {
        // Mark as expired
        await supabase
          .from("event_registrations")
          .update({
            status: "cancelled",
            auto_expired: true,
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", registration.id);

        // Promote next from waitlist
        const { data: promotedId } = await supabase.rpc("promote_from_waitlist", {
          p_event_id: registration.event_id,
        });

        if (promotedId) {
          console.log(`[process-waitlist] Promoted registration ${promotedId} for event ${registration.event_id}`);

          // Get promoted user info for notification
          const { data: promotedReg } = await supabase
            .from("event_registrations")
            .select("user_id, event_id")
            .eq("id", promotedId)
            .single();

          if (promotedReg) {
            // Get event details
            const { data: event } = await supabase
              .from("unified_events")
              .select("title")
              .eq("id", promotedReg.event_id)
              .single();

            // Create notification
            await supabase.from("user_notifications").insert({
              user_id: promotedReg.user_id,
              notification_type: "waitlist_promoted",
              category: "events",
              title: "You're In! 🎉",
              message: `A spot opened up for "${event?.title || "the event"}". Confirm your spot now!`,
              link: `/events/${promotedReg.event_id}`,
              priority: "high",
            });
          }
        }
      }
    }

    // Step 2: Auto-promote when events have capacity (for events with auto_promote enabled)
    const { data: eventsWithCapacity, error: capacityError } = await supabase
      .from("unified_events")
      .select(`
        id,
        title,
        max_participants,
        current_participants,
        waitlist_settings (
          auto_promote,
          promotion_window_hours,
          notify_on_promotion
        )
      `)
      .eq("waitlist_enabled", true)
      .not("max_participants", "is", null);

    if (capacityError) {
      console.error("[process-waitlist] Error finding events with capacity:", capacityError);
    } else if (eventsWithCapacity) {
      for (const event of eventsWithCapacity) {
        const settings = event.waitlist_settings?.[0];
        if (!settings?.auto_promote) continue;

        const availableSpots = (event.max_participants || 0) - (event.current_participants || 0);
        if (availableSpots <= 0) continue;

        // Get waitlisted registrations
        const { data: waitlisted } = await supabase
          .from("event_registrations")
          .select("id")
          .eq("event_id", event.id)
          .eq("status", "waitlisted")
          .eq("auto_expired", false)
          .order("waitlist_position", { ascending: true })
          .order("registered_at", { ascending: true })
          .limit(availableSpots);

        if (waitlisted && waitlisted.length > 0) {
          console.log(`[process-waitlist] Auto-promoting ${waitlisted.length} for event ${event.id}`);

          for (const reg of waitlisted) {
            await supabase.rpc("promote_from_waitlist", {
              p_event_id: event.id,
            });
          }
        }
      }
    }

    console.log("[process-waitlist] Completed successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Waitlist processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-waitlist] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
