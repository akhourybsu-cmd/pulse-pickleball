import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  open_play: "Open Play",
  league: "League",
  clinic: "Clinic",
  private: "Private Rental",
  tournament: "Tournament",
  social: "Social Event",
};

const SKILL_LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner (2.0-2.5)",
  intermediate: "Intermediate (2.5-3.5)",
  advanced: "Advanced (3.5-4.0)",
  expert: "Expert (4.0+)",
  all: "All Levels",
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
      .from("calendar_event_registrations")
      .select(`
        *,
        event:calendar_events(*),
        user:profiles(email, display_name, full_name)
      `)
      .eq("id", registrationId)
      .single();

    if (regError) throw regError;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const event = registration.event;
    const user = registration.user;

    // Format date
    const eventDate = new Date(event.start_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Format time
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const startTime = formatTime(event.start_time);
    const endTime = formatTime(event.end_time);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Registration Confirmation</title>
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
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">Event Registration Confirmed</p>
                  </td>
                </tr>

                <!-- Confirmation Message -->
                <tr>
                  <td style="padding: 30px 30px 20px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      Hi ${user.display_name || user.full_name || 'there'},
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      You're all set! Your registration for <strong>${event.title}</strong> has been confirmed.
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
                                <strong>Event Type:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Date:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${eventDate}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Time:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${startTime} - ${endTime}
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
                            ${event.skill_level ? `
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Skill Level:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${SKILL_LEVEL_LABELS[event.skill_level] || event.skill_level}
                              </td>
                            </tr>
                            ` : ''}
                            ${event.instructor ? `
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Instructor:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                ${event.instructor}
                              </td>
                            </tr>
                            ` : ''}
                            ${event.price ? `
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #666666; vertical-align: top;">
                                <strong>Price:</strong>
                              </td>
                              <td style="padding: 8px 0; font-size: 14px; color: #333333;">
                                $${event.price.toFixed(2)}
                              </td>
                            </tr>
                            ` : ''}
                          </table>

                          ${event.description ? `
                          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                            <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                              ${event.description}
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
                        <strong>Important:</strong> Please arrive 10-15 minutes early for check-in. If you need to cancel, please do so at least 24 hours in advance.
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
        subject: `Registration Confirmed: ${event.title}`,
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
    return new Response(JSON.stringify({ error: "Failed to send confirmation email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
