// Sends the registration-confirmation transactional email via the unified
// send-transactional-email pipeline (queued, branded, suppression-aware).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://pulsepb.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { registrationId } = await req.json();
    if (!registrationId) {
      return new Response(JSON.stringify({ error: "registrationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: registration, error: regError } = await supabase
      .from("tournament_registrations")
      .select(`
        *,
        event:tournaments_events(*),
        division:tournaments_divisions(*),
        captain:captain_user_id(email, display_name, full_name)
      `)
      .eq("id", registrationId)
      .single();

    if (regError || !registration) throw regError ?? new Error("Registration not found");

    const eventDate = registration.event?.start_date
      ? new Date(registration.event.start_date).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : undefined;

    const playerName =
      registration.captain?.display_name ||
      registration.captain?.full_name?.split(" ")[0] ||
      "Player";

    const { error: invokeError } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "registration-confirmation",
          recipientEmail: registration.captain?.email,
          idempotencyKey: `reg-confirmation-${registrationId}`,
          templateData: {
            playerName,
            eventName: registration.event?.name,
            eventDate,
            eventLocation: registration.event?.location,
            divisionName: registration.division?.name,
            teamName: registration.team_name,
            eventUrl: registration.event?.id
              ? `${SITE_URL}/tournament/${registration.event.id}`
              : SITE_URL,
          },
        },
      }
    );

    if (invokeError) throw invokeError;

    await supabase.from("tournament_registration_notifications").insert({
      registration_id: registrationId,
      notification_type: "confirmation",
      to_email: registration.captain?.email,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-registration-confirmation:", error);
    return new Response(JSON.stringify({ error: "Failed to send confirmation email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
