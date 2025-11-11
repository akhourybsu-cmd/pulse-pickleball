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
    
    const emailHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏓 PULSE Pickleball</h1>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
        </div>
        
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour and can only be used once.
        </div>
        
        <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
          If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
        </p>
        
        <p style="font-size: 14px; color: #6c757d;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="word-break: break-all; color: #0EA5E9;">${resetLink}</span>
        </p>
      </div>
      <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 14px; color: #6c757d;">
        <p style="margin: 0;">
          <strong>PULSE Pickleball</strong><br>
          Track your matches, improve your game
        </p>
        <p style="margin: 10px 0 0 0; font-size: 12px;">
          Questions? Contact us at <a href="mailto:support@pulsepb.com" style="color: #0EA5E9;">support@pulsepb.com</a>
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
        subject: "Reset Your PULSE Password",
        html: emailHtml,
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
