import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyMFACodeRequest {
  code: string;
  email: string;
  method?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { code, email, method }: VerifyMFACodeRequest = await req.json();

    // Get user by email
    const { data: userData, error: userError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !userData) {
      throw new Error("User not found");
    }

    // Verify and use code using secure function
    const { data: isValid, error: verifyError } = await supabaseClient
      .rpc("verify_and_use_mfa_code", {
        p_user_id: userData.id,
        p_code: code,
        p_method: method || "email",
      });

    if (verifyError) throw verifyError;

    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired code" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Code verified successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-mfa-code function:", error);
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
