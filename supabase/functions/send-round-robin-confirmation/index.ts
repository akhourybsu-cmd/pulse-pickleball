// Sends round-robin registration confirmation via branded transactional template.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://pulsepb.com";

const FORMAT_LABELS: Record<string, string> = {
  open: "Open Play",
  gender_based: "Gender-Based",
  skill_based: "Skill-Based",
};

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
      .from("round_robin_players")
      .select(`
        *,
        event:round_robin_events(*),
        player:profiles(email, display_name, full_name)
      `)
      .eq("id", registrationId)
      .single();

    if (regError || !registration) throw regError ?? new Error("Registration not found");

    const event = registration.event;
    const user = registration.player;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Player has no email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventDate = event?.date
      ? new Date(event.date).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : undefined;

    const formatParts: string[] = [];
    if (event?.format) formatParts.push(FORMAT_LABELS[event.format] || event.format);
    if (event?.num_rounds) formatParts.push(`${event.num_rounds} rounds`);
    if (event?.num_courts) formatParts.push(`${event.num_courts} court${event.num_courts !== 1 ? "s" : ""}`);

    const { error: invokeError } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "round-robin-confirmation",
          recipientEmail: user.email,
          idempotencyKey: `rr-confirmation-${registrationId}`,
          templateData: {
            playerName: user.display_name || user.full_name?.split(" ")[0] || "Player",
            eventName: event?.name,
            eventDate,
            eventLocation: event?.location,
            format: formatParts.join(" · "),
            eventUrl: event?.id ? `${SITE_URL}/round-robin/${event.id}` : SITE_URL,
          },
        },
      }
    );

    if (invokeError) throw invokeError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending round robin confirmation:", error);
    return new Response(JSON.stringify({ error: "Failed to send confirmation email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
