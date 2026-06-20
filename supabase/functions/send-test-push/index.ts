// send-test-push: send a test web-push to the authenticated caller's own devices only.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_CONTACT = Deno.env.get("VAPID_CONTACT") ?? "mailto:admin@pulsepb.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("[send-test-push] invoked", { method: req.method });
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.error("[send-test-push] VAPID not configured");
      return new Response(JSON.stringify({ error: "push_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Optional endpoint filter to target the current device only
    let endpointFilter: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.endpoint === "string") endpointFilter = body.endpoint;
    } catch (_) { /* no body */ }

    let q = admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (endpointFilter) q = q.eq("endpoint", endpointFilter);
    let { data: subs, error: subsErr } = await q;

    if (subsErr) {
      console.error("subs query error", subsErr);
      return new Response(JSON.stringify({ error: "subs_lookup_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[send-test-push] sub lookup", { userId, endpointFilter: endpointFilter ? endpointFilter.slice(0, 60) + "..." : null, count: subs?.length ?? 0 });

    // Fallback: if endpoint filter didn't match (e.g. stale on the device), try all of this user's subs
    if ((!subs || subs.length === 0) && endpointFilter) {
      const { data: allSubs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId);
      subs = allSubs ?? [];
      console.log("[send-test-push] fallback to all user subs", { count: subs.length });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, error: "no_subscriptions" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const payload = JSON.stringify({
      title: "PULSE Test Notification",
      body: "Notifications are working on this device.",
      url: "/settings/notifications",
      tag: "pulse-test",
      priority: "high",
    });

    const deadIds: string[] = [];
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60, urgency: "high" },
        );
        sent++;
      } catch (err: any) {
        const status = err?.statusCode ?? 0;
        console.error("push error", status, err?.body ?? err?.message);
        if (status === 404 || status === 410) deadIds.push(s.id);
      }
    }));

    if (deadIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", deadIds);
    }

    // Best-effort in-app notification record
    try {
      await admin.from("user_notifications").insert({
        user_id: userId,
        notification_type: "test",
        title: "PULSE Test Notification",
        message: "Notifications are working on this device.",
        category: "system",
        link: "/settings/notifications",
      });
    } catch (e) {
      console.warn("in-app record skipped", e);
    }

    console.log("[send-test-push] done", { sent, pruned: deadIds.length, total: subs.length });
    return new Response(JSON.stringify({ sent, pruned: deadIds.length, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("send-test-push error", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
