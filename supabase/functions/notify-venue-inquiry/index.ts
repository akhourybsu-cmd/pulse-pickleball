import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InquiryNotification {
  inquiryId: string;
  venueName: string;
  contactName: string;
  email: string;
  city: string;
  state: string;
  venueType: string;
  primaryGoals: string[];
  currentSetup: string;
  timeline: string;
  eventVolume?: string;
  additionalNotes?: string;
  intent: "create_now" | "info_request";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: InquiryNotification = await req.json();

    // Log the inquiry for now (in production, this would send an email)
    console.log("=== New Venue Inquiry Notification ===");
    console.log(`Inquiry ID: ${payload.inquiryId}`);
    console.log(`Venue: ${payload.venueName}`);
    console.log(`Contact: ${payload.contactName} (${payload.email})`);
    console.log(`Location: ${payload.city}, ${payload.state}`);
    console.log(`Type: ${payload.venueType}`);
    console.log(`Goals: ${payload.primaryGoals.join(", ")}`);
    console.log(`Current Setup: ${payload.currentSetup}`);
    console.log(`Timeline: ${payload.timeline}`);
    console.log(`Event Volume: ${payload.eventVolume || "Not specified"}`);
    console.log(`Intent: ${payload.intent === "create_now" ? "Create Profile Now" : "Request More Info"}`);
    if (payload.additionalNotes) {
      console.log(`Notes: ${payload.additionalNotes}`);
    }
    console.log("=====================================");

    // TODO: In production, integrate with email service (e.g., Resend, SendGrid)
    // to send notification to Pulse admins
    // Example:
    // await sendEmail({
    //   to: "admin@pulsepickleball.com",
    //   subject: `New Venue Inquiry: ${payload.venueName}`,
    //   body: formatEmailBody(payload),
    // });

    return new Response(
      JSON.stringify({ success: true, message: "Notification logged" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
