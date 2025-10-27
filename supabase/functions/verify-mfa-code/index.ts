import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8080",
  "https://pulse.lovable.app",
  "https://ryxklkayezjnwwunuphn.supabase.co"
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

interface VerifyMFACodeRequest {
  code: string;
  email: string;
  method?: string;
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

const checkRateLimit = (email: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(email);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= MAX_ATTEMPTS) {
    return false;
  }

  userLimit.count++;
  return true;
};

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Validate request body
    let requestData: VerifyMFACodeRequest;
    try {
      requestData = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { code, email, method } = requestData;

    // Input validation
    if (!email || typeof email !== "string" || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!code || typeof code !== "string" || !code.match(/^\d{6}$/)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid verification code format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Rate limiting
    if (!checkRateLimit(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many verification attempts. Please try again later." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get user by email
    const { data: userData, error: userError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify and use code using secure function
    const { data: isValid, error: verifyError } = await supabaseClient
      .rpc("verify_and_use_mfa_code", {
        p_user_id: userData.id,
        p_code: code,
        p_method: method || "email",
      });

    if (verifyError) {
      console.error("Verification error:", verifyError);
      return new Response(
        JSON.stringify({ success: false, error: "Verification failed" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

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
    console.error("Unexpected error in verify-mfa-code:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
