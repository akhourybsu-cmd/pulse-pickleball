import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORMAT_LABELS: Record<string, string> = {
  open: "Open Play",
  gender_based: "Gender-Based",
  skill_based: "Skill-Based",
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

    // Fetch registration with event and user details
    const { data: registration, error: regError } = await supabase
      .from("round_robin_players")
      .select(`
        *,
        event:round_robin_events(*),
        player:profiles(email, display_name, full_name)
      `)
      .eq("id", registrationId)
      .single();

    if (regError) throw regError;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const event = registration.event;
    const user = registration.player;

    // Format date
    const eventDate = new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Round Robin Registration Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #9b87f5 0%, #7E69AB 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">PULSE Pickleball</h1>
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">Round Robin Registration Confirmed</p>
                  </td>
                </tr>

                <!-- Confirmation Message -->
                <tr>
                  <td style="padding: 30px 30px 20px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      Hi ${user.display_name || user.full_name || 'there'},
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      You're all set! Your registration for <strong>${event.name}</strong> has been confirmed.
                    </p>
                  </td>
                </tr>

                <!-- Event Details Card -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                      <tr>
                        <td style="padding: 25px;">
                          <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #333333; font-weight: 600;">Event Details</h2>
                          
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; width: 140px; vertical-align: top;">
                                <strong>Date:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${eventDate}
                              </td>
                            </tr>
                            ${event.location ? `
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Location:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${event.location}
                              </td>
                            </tr>
                            ` : ''}
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Format:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${FORMAT_LABELS[event.format] || event.format}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Courts:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${event.num_courts} court${event.num_courts !== 1 ? 's' : ''}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Rounds:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${event.num_rounds} round${event.num_rounds !== 1 ? 's' : ''}
                              </td>
                            </tr>
                            ${event.games_per_player ? `
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Games Per Player:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${event.games_per_player}
                              </td>
                            </tr>
                            ` : ''}
                            ${event.rating_eligible ? `
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Rating Impact:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                This event is rating-eligible
                              </td>
                            </tr>
                            ` : ''}
                          </table>

                          ${event.notes ? `
                          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                            <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                              <strong>Notes:</strong><br>
                              ${event.notes}
                            </p>
                          </div>
                          ` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 30px 30px 30px; text-align: center;">
                    <a href="https://pulsepb.com" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #9b87f5 0%, #7E69AB 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(155, 135, 245, 0.3);">
                      Explore PULSE
                    </a>
                  </td>
                </tr>

                <!-- Important Info -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                        <strong>Important:</strong> Please arrive on time for player check-in. Match schedules will be available on event day.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                      Questions? Reply to this email or visit our website.
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #999999;">
                      © ${new Date().getFullYear()} PULSE Pickleball. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "PULSE <support@pulsepb.com>",
        to: [user.email],
        subject: `Round Robin Registration Confirmed: ${event.name}`,
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailData);
      throw new Error(`Failed to send email: ${emailData.message || 'Unknown error'}`);
    }

    console.log("Confirmation email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending confirmation email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
