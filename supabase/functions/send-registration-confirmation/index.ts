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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const emailHtml = `
      <h1>Tournament Registration Confirmation</h1>
      <p>Thank you for registering for ${registration.event.name}!</p>
      <h2>Registration Details</h2>
      <p><strong>Team:</strong> ${registration.team_name}</p>
      <p><strong>Division:</strong> ${registration.division.name}</p>
      <p><strong>Status:</strong> Pending approval</p>
      <p>We'll notify you once the tournament director reviews your registration.</p>
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
