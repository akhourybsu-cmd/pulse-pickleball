// admin-test-push: fire a native (FCM) test push to an admin's own devices, or
// to a target user, and return diagnostics (device-token count + FCM sent count).
// Admin-only. Purpose: verify the native push pipeline end-to-end from the app.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendFcmToUser } from "../_shared/fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) Authenticate the caller
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const callerId = userData.user.id;

    // 2) Admin-only
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (isAdmin !== true) return json({ error: "forbidden", message: "Admin privileges required" }, 403);

    // 3) Resolve target (defaults to the caller's own account)
    let targetUserId = callerId;
    try {
      const body = await req.json();
      if (body && typeof body.target_user_id === "string" && body.target_user_id) {
        targetUserId = body.target_user_id;
      }
    } catch (_) { /* no body → self */ }

    // 4) Diagnostics: how many native device tokens does the target have?
    const { data: tokens } = await admin
      .from("device_tokens")
      .select("id, platform")
      .eq("user_id", targetUserId);
    const deviceTokens = tokens?.length ?? 0;

    // 5) Send the native (FCM) test push. sendFcmToUser is a no-op (returns 0)
    //    if FCM_SERVICE_ACCOUNT_JSON isn't configured or the user has no tokens.
    const sent = await sendFcmToUser(admin, targetUserId, {
      title: "PULSE test notification",
      body: "🎾 Your native push notifications are working!",
      url: "/settings/notifications",
      tag: "pulse-admin-test",
      priority: "high",
    });

    // Helpful, specific diagnosis for the admin UI.
    let diagnosis: string;
    if (deviceTokens === 0) {
      diagnosis = "No native device tokens registered for this user. On the phone: log in, enable notifications (grant the permission), and confirm a row appears in device_tokens.";
    } else if (sent === 0) {
      diagnosis = "Device token(s) found but FCM sent 0 — likely FCM_SERVICE_ACCOUNT_JSON is missing/invalid, or the token is stale. Check the function logs.";
    } else {
      diagnosis = `Sent to ${sent} of ${deviceTokens} device(s). If it didn't appear, make sure the app was backgrounded (foreground pushes show as an in-app toast, not a system banner).`;
    }

    return json({ ok: true, target_user_id: targetUserId, deviceTokens, sent, diagnosis });
  } catch (e) {
    console.error("[admin-test-push] error", e);
    return json({ error: "internal", message: String(e) }, 500);
  }
});
