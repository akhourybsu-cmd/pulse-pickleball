import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    if (regError) throw regError;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const eventDate = new Date(registration.event.start_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailHtml = `
      <h1>Registration Waitlisted</h1>
      <p>Thank you for your interest in <strong>${registration.event.name}</strong>.</p>
      
      <h2>Team Details</h2>
      <p><strong>Team Name:</strong> ${registration.team_name}</p>
      <p><strong>Division:</strong> ${registration.division.name}</p>
      <p><strong>Status:</strong> Waitlist</p>
      
      <h3>What This Means</h3>
      <p>The ${registration.division.name} division is currently at capacity. You've been placed on the waitlist and will be notified immediately if a spot opens up.</p>
      
      <p><strong>Event Date:</strong> ${eventDate}</p>
      <p><strong>Location:</strong> ${registration.event.location || 'TBD'}</p>
      
      <p>We'll contact you as soon as a spot becomes available. Please keep an eye on your email!</p>
      
      <p>If you have any questions, reply to this email.</p>
      
      <p>Best regards,<br>The Tournament Team</p>
    `;

    // Send to captain
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "PULSE <support@pulsepb.com>",
        to: [registration.captain.email],
        subject: `Waitlisted: ${registration.event.name}`,
        html: emailHtml,
      }),
    });

    // Send to partner if exists
    if (registration.partner) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "PULSE <support@pulsepb.com>",
          to: [registration.partner.email],
          subject: `Waitlisted: ${registration.event.name}`,
          html: emailHtml,
        }),
      });
    }

    // Log notifications
    await supabase.from("tournament_registration_notifications").insert([
      {
        registration_id: registrationId,
        notification_type: "waitlisted",
        to_email: registration.captain.email,
      },
      ...(registration.partner ? [{
        registration_id: registrationId,
        notification_type: "waitlisted",
        to_email: registration.partner.email,
      }] : [])
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending waitlist email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
