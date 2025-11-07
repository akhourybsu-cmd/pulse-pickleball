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

    // Format event date
    const eventDate = new Date(registration.event.start_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const arrivalInstructions = `
      <h3>Event Details</h3>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Location:</strong> ${registration.event.location || 'TBD'}</p>
      <p><strong>Division:</strong> ${registration.division.name}</p>
      
      <h3>What to Bring</h3>
      <ul>
        <li>Water and towels</li>
        <li>Your paddle and balls</li>
        <li>Arrive 15 minutes early for check-in</li>
      </ul>
      
      <p><strong>Important:</strong> If you can no longer attend, please reply to this email as soon as possible so we can offer your spot to another team.</p>
    `;

    const emailHtml = `
      <h1>Registration Approved! 🎉</h1>
      <p>Great news! Your registration for <strong>${registration.event.name}</strong> has been approved.</p>
      
      <h2>Team Details</h2>
      <p><strong>Team Name:</strong> ${registration.team_name}</p>
      <p><strong>Division:</strong> ${registration.division.name}</p>
      <p><strong>Captain:</strong> ${registration.captain.display_name || registration.captain.full_name}</p>
      ${registration.partner ? `<p><strong>Partner:</strong> ${registration.partner.display_name || registration.partner.full_name}</p>` : '<p><strong>Partner:</strong> TBD</p>'}
      
      ${arrivalInstructions}
      
      <p>We're looking forward to seeing you there!</p>
      <p>Best regards,<br>The Tournament Team</p>
    `;

    // Send to captain
    const captainEmail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "PULSE <support@pulsepb.com>",
        to: [registration.captain.email],
        subject: `Registration Approved: ${registration.event.name}`,
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
          subject: `Registration Approved: ${registration.event.name}`,
          html: emailHtml,
        }),
      });
    }

    // Log notifications
    await supabase.from("tournament_registration_notifications").insert([
      {
        registration_id: registrationId,
        notification_type: "approved",
        to_email: registration.captain.email,
      },
      ...(registration.partner ? [{
        registration_id: registrationId,
        notification_type: "approved",
        to_email: registration.partner.email,
      }] : [])
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending approval email:", error);
    return new Response(JSON.stringify({ error: "Failed to send approval notification" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
