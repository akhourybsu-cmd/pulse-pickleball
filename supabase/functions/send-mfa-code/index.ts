import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMFACodeRequest {
  email: string;
  method: "email" | "sms";
  phoneNumber?: string;
}

const generateCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, method, phoneNumber }: SendMFACodeRequest = await req.json();

    // Generate a 6-digit code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the code in database using secure function
    const { data: codeId, error: insertError } = await supabaseClient
      .rpc("insert_mfa_code", {
        p_user_id: user.id,
        p_code: code,
        p_method: method,
        p_expires_at: expiresAt.toISOString(),
      });

    if (insertError) throw insertError;

    // Send the code based on method
    if (method === "email") {
      await resend.emails.send({
        from: "PULSE Security <security@resend.dev>",
        to: [email],
        subject: "Your PULSE Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Your Verification Code</h1>
            <p style="font-size: 16px; color: #666;">Use this code to complete your login:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h2 style="font-size: 32px; letter-spacing: 8px; color: #000; margin: 0;">${code}</h2>
            </div>
            <p style="font-size: 14px; color: #999;">This code will expire in 10 minutes.</p>
            <p style="font-size: 14px; color: #999;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });
    } else if (method === "sms" && phoneNumber) {
      // SMS sending would require Twilio integration
      // For now, we'll return a message that SMS is not configured
      throw new Error("SMS method requires Twilio configuration");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-mfa-code function:", error);
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
