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
        captain:captain_user_id(email, display_name)
      `)
      .eq("id", registrationId)
      .single();

    if (regError) throw regError;

    // Fetch customization for policies and contact info
    const { data: customization } = await supabase
      .from("tournament_customization")
      .select("refund_policy, weather_policy, conduct_policy, liability_policy, extra_notes, organizer_contact_name, organizer_contact_email, organizer_phone, organizer_preferred_contact")
      .eq("event_id", registration.event.id)
      .single();

    // Compile policy text for email and storage
    const policyBlocks = [];
    if (customization?.refund_policy) {
      policyBlocks.push(`<strong>Refund Policy:</strong> ${customization.refund_policy}`);
    }
    if (customization?.weather_policy) {
      policyBlocks.push(`<strong>Weather / Cancellation:</strong> ${customization.weather_policy}`);
    }
    if (customization?.conduct_policy) {
      policyBlocks.push(`<strong>Player Conduct & Sportsmanship:</strong> ${customization.conduct_policy}`);
    }
    if (customization?.liability_policy) {
      policyBlocks.push(`<strong>Liability & Waiver:</strong> ${customization.liability_policy}`);
    }
    if (customization?.extra_notes) {
      policyBlocks.push(`<strong>Additional Notes:</strong> ${customization.extra_notes}`);
    }

    const policyHtml = policyBlocks.length > 0
      ? `<hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
         <h2>Tournament Policies You Agreed To</h2>
         <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #333;">
           ${policyBlocks.map(block => `<p style="margin: 8px 0;">${block}</p>`).join('')}
         </div>
         <p style="font-size: 12px; color: #666; margin-top: 10px;">
           Policies accepted on: ${new Date().toLocaleString()}
         </p>`
      : '';

    // Store policy snapshot in registration
    if (policyBlocks.length > 0) {
      await supabase
        .from("tournament_registrations")
        .update({
          additional_info: {
            ...registration.additional_info,
            policy_accepted: policyBlocks.join('\n\n'),
            policy_timestamp: new Date().toISOString()
          }
        })
        .eq("id", registrationId);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    // Create contact section for email
    const contactHtml = (customization?.organizer_contact_name || customization?.organizer_contact_email || customization?.organizer_phone)
      ? `<hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
         <h2>Questions?</h2>
         <p>Contact your tournament organizer:</p>
         <p><strong>${customization.organizer_contact_name || 'Tournament Organizer'}</strong></p>
         ${customization.organizer_contact_email ? `<p>Email: <a href="mailto:${customization.organizer_contact_email}">${customization.organizer_contact_email}</a></p>` : ''}
         ${customization.organizer_phone ? `<p>Phone: ${customization.organizer_phone}</p>` : ''}
         ${customization.organizer_preferred_contact ? `<p style="font-size: 12px; color: #666;">Preferred contact: ${customization.organizer_preferred_contact === 'email' ? 'Email' : customization.organizer_preferred_contact === 'phone' ? 'Phone' : 'Either'}</p>` : ''}`
      : '';

    const emailHtml = `
      <h1>Tournament Registration Confirmation</h1>
      <p>Thank you for registering for ${registration.event.name}!</p>
      <h2>Registration Details</h2>
      <p><strong>Team:</strong> ${registration.team_name}</p>
      <p><strong>Division:</strong> ${registration.division.name}</p>
      <p><strong>Status:</strong> Pending approval</p>
      <p>We'll notify you once the tournament director reviews your registration.</p>
      ${policyHtml}
      ${contactHtml}
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "PULSE <support@pulsepb.com>",
        to: [registration.captain.email],
        subject: `Registration Confirmed: ${registration.event.name}`,
        html: emailHtml,
      }),
    });

    await supabase.from("tournament_registration_notifications").insert({
      registration_id: registrationId,
      notification_type: "confirmation",
      to_email: registration.captain.email,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
