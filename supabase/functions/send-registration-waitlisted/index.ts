// Sends waitlisted notification using the branded transactional template.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://pulsepb.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
        captain:captain_user_id(email, display_name, full_name),
        partner:partner_user_id(email, display_name, full_name)
      `)
      .eq("id", registrationId)
      .single();

    if (regError || !registration) throw regError ?? new Error("Registration not found");

    const eventUrl = registration.event?.id
      ? `${SITE_URL}/tournament/${registration.event.id}`
      : SITE_URL;

    const sendTo = async (
      email: string,
      role: "captain" | "partner",
      displayName?: string
    ) => {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "registration-waitlisted",
          recipientEmail: email,
          idempotencyKey: `reg-waitlisted-${registrationId}-${role}`,
          templateData: {
            playerName: displayName?.split(" ")[0] || "Player",
            eventName: registration.event?.name,
            eventUrl,
          },
        },
      });
    };

    if (registration.captain?.email) {
      await sendTo(
        registration.captain.email,
        "captain",
        registration.captain.display_name || registration.captain.full_name
      );
    }
    if (registration.partner?.email) {
      await sendTo(
        registration.partner.email,
        "partner",
        registration.partner.display_name || registration.partner.full_name
      );
    }

    await supabase.from("tournament_registration_notifications").insert([
      {
        registration_id: registrationId,
        notification_type: "waitlisted",
        to_email: registration.captain?.email,
      },
      ...(registration.partner?.email
        ? [
            {
              registration_id: registrationId,
              notification_type: "waitlisted",
              to_email: registration.partner.email,
            },
          ]
        : []),
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending waitlist email:", error);
    return new Response(JSON.stringify({ error: "Failed to send waitlist notification" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
