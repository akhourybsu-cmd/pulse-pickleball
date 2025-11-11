import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: PasswordResetRequest = await req.json();
    const { user, email_data } = payload;
    const { token_hash, redirect_to, email_action_type } = email_data;

    const resetLink = `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

    // Send email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    // Extract first name from user data if available
    const firstName = user.email.split('@')[0]; // Fallback to email username
    const supportEmail = 'support@pulsepb.com';
    const linkExpiresIn = '1 hour';
    
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Reset your Pulse Pickleball password</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .email-body { background-color: #0a0a0a !important; }
        .email-container { background-color: #1a1a1a !important; }
        .email-text { color: #e5e5e5 !important; }
        .email-text-muted { color: #a3a3a3 !important; }
        .email-footer { background-color: #0f0f0f !important; border-top-color: #2a2a2a !important; }
      }
    </style>
  </head>
  <body class="email-body" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', 'Arial', sans-serif; background-color: hsl(0, 0%, 98%); line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
      
      <!-- Logo -->
      <div style="text-align: center; padding: 32px 0 24px 0;">
        <img src="https://pulsepb.com/pulse-icon.jpg" alt="Pulse Pickleball" style="height: 80px; width: auto; max-width: 100%;" />
      </div>
      
      <!-- Main Container -->
      <div class="email-container" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
          <h1 class="email-text" style="color: hsl(195, 60%, 12%); margin: 0 0 24px 0; font-size: 24px; font-weight: 600; line-height: 1.3;">
            Reset Your Password
          </h1>
          
          <p class="email-text" style="color: hsl(195, 60%, 12%); margin: 0 0 24px 0; font-size: 16px;">
            Hi ${firstName},
          </p>
          
          <p class="email-text" style="color: hsl(195, 60%, 12%); margin: 0 0 32px 0; font-size: 16px;">
            We received a request to reset the password for your Pulse Pickleball account. Click the button below to create a new password.
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; 
                      padding: 16px 40px; 
                      background: #A9CF46; 
                      color: #000000; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: 600; 
                      font-size: 16px;
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
              Reset Password
            </a>
          </div>
          
          <!-- Alternative Link -->
          <div style="margin: 32px 0; padding: 20px; background: hsl(0, 0%, 96%); border-radius: 8px; border-left: 3px solid #A9CF46;">
            <p class="email-text-muted" style="color: hsl(195, 60%, 20%); margin: 0 0 12px 0; font-size: 14px; font-weight: 500;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 0; word-break: break-all;">
              <a href="${resetLink}" class="email-text-muted" style="color: hsl(195, 60%, 20%); font-size: 13px; text-decoration: underline;">
                ${resetLink}
              </a>
            </p>
          </div>
          
          <p class="email-text-muted" style="color: hsl(195, 60%, 20%); margin: 0 0 16px 0; font-size: 14px;">
            This link is single-use and expires in <strong>${linkExpiresIn}</strong>.
          </p>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid hsl(0, 0%, 90%);">
            <p class="email-text-muted" style="color: hsl(195, 60%, 20%); margin: 0; font-size: 14px;">
              Didn't request this? You can safely ignore this email—your password won't change. If you're concerned, please reach out and we'll help secure your account.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="email-footer" style="background: hsl(0, 0%, 96%); padding: 24px 32px; border-top: 1px solid hsl(0, 0%, 90%);">
          <p class="email-text" style="color: hsl(195, 60%, 12%); margin: 0 0 8px 0; font-size: 14px; font-weight: 500;">
            Thanks,<br>
            The Pulse Pickleball Team
          </p>
          <p class="email-text-muted" style="color: hsl(195, 60%, 20%); margin: 0; font-size: 13px;">
            <a href="mailto:${supportEmail}" style="color: #A9CF46; text-decoration: none;">${supportEmail}</a> • 
            <a href="https://pulsepb.com" style="color: #A9CF46; text-decoration: none;">PulsePB.com</a>
          </p>
        </div>
        
      </div>
      
      <!-- Footer Note -->
      <div style="text-align: center; padding: 24px 0;">
        <p class="email-text-muted" style="color: hsl(195, 60%, 20%); margin: 0; font-size: 12px; line-height: 1.5;">
          You're getting this message because a password reset was requested for your account.
        </p>
      </div>
      
    </div>
  </body>
</html>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "PULSE Pickleball <support@pulsepb.com>",
        to: [user.email],
        subject: "Reset your Pulse Pickleball password",
        html: emailHtml,
        headers: {
          'X-Preview-Text': `Tap the button to set a new password. This link expires in ${linkExpiresIn}.`
        }
      }),
    });


    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Password reset email sent successfully:", emailResult);

    return new Response(JSON.stringify(emailResult), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
