// Sends calendar/booking confirmation via branded transactional template.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://pulsepb.com";

const EVENT_TYPE_LABELS: Record<string, string> = {
  open_play: "Open Play",
  league: "League",
  clinic: "Clinic",
  private: "Private Rental",
  tournament: "Tournament",
  social: "Social Event",
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
      .from("calendar_event_registrations")
      .select(`
        *,
        event:calendar_events(*),
        user:profiles(email, display_name, full_name)
      `)
      .eq("id", registrationId)
      .single();

    if (regError || !registration) throw regError ?? new Error("Registration not found");

    const event = registration.event;
    const user = registration.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "User has no email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventDate = event?.start_date
      ? new Date(event.start_date).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : undefined;

    const formatTime = (time?: string) => {
      if (!time) return "";
      const [h, m] = time.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      const hour12 = h % 12 || 12;
      return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
    };

    const dateLine = [
      eventDate,
      event?.start_time
        ? `${formatTime(event.start_time)}${event.end_time ? ` – ${formatTime(event.end_time)}` : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const notesParts: string[] = [];
    if (event?.event_type) notesParts.push(EVENT_TYPE_LABELS[event.event_type] || event.event_type);
    if (event?.instructor) notesParts.push(`Instructor: ${event.instructor}`);
    if (event?.price) notesParts.push(`$${Number(event.price).toFixed(2)}`);

    const { error: invokeError } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "calendar-event-confirmation",
          recipientEmail: user.email,
          idempotencyKey: `calendar-confirmation-${registrationId}`,
          templateData: {
            playerName: user.display_name || user.full_name?.split(" ")[0] || "Player",
            eventTitle: event?.title,
            eventDate: dateLine || undefined,
            eventLocation: event?.location,
            notes: notesParts.join(" · ") || event?.description || undefined,
            eventUrl: SITE_URL,
          },
        },
      }
    );

    if (invokeError) throw invokeError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending calendar confirmation:", error);
    return new Response(JSON.stringify({ error: "Failed to send confirmation email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
