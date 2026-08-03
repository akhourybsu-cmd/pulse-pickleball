// Account deletion — lets a signed-in user permanently delete their own PULSE
// account and data. Required by Google Play / App Store policy.
//
// Flow: verify the caller's JWT (they can only ever delete THEMSELVES), then use
// the service role to remove their profile row and hard-delete their auth user.
// FKs with ON DELETE CASCADE from auth.users clean up the rest of their data;
// any table that should be purged but isn't cascaded can be added to the
// best-effort list below.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "not_authenticated" }, 401);

    // 1. Who is calling? getUser() validates the JWT — the caller can only ever
    //    act on their own account; there is no user id in the request body.
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "not_authenticated" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Best-effort removal of the profile row (covers setups where profiles
    //    isn't ON DELETE CASCADE off auth.users). Errors are non-fatal — the
    //    auth deletion below is the authoritative step.
    await admin.from("profiles").delete().eq("id", user.id);

    // 3. Hard-delete the auth user. Cascaded FKs remove the remaining data.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error("delete-account: auth.admin.deleteUser failed:", delErr.message);
      return json({ error: "deletion_failed", message: delErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("delete-account: unexpected error", e);
    return json({ error: "server_error" }, 500);
  }
});
