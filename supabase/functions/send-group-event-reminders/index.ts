// send-group-event-reminders: scan upcoming group events and fan out reminders.
// Windows: T+24h ±15min, T+1h ±10min. Honors per-group mute (events channel).
// Dedupes via event_reminders_sent (event_type = 'group_event_24h' | 'group_event_1h').
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Window = { kind: "24h" | "1h"; from: string; to: string; reminderType: string; label: string };

function windows(now: Date): Window[] {
  const min = (m: number) => 60 * 1000 * m;
  const t24 = new Date(now.getTime() + 24 * 60 * min(1));
  const t1 = new Date(now.getTime() + 60 * min(1));
  return [
    {
      kind: "24h",
      from: new Date(t24.getTime() - min(15)).toISOString(),
      to: new Date(t24.getTime() + min(15)).toISOString(),
      reminderType: "group_event_24h",
      label: "Tomorrow",
    },
    {
      kind: "1h",
      from: new Date(t1.getTime() - min(10)).toISOString(),
      to: new Date(t1.getTime() + min(10)).toISOString(),
      reminderType: "group_event_1h",
      label: "Starting soon",
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const now = new Date();
    const wins = windows(now);
    let totalNotified = 0;

    for (const w of wins) {
      const { data: events } = await admin
        .from("group_events")
        .select("id, group_id, title, start_time, custom_location")
        .gte("start_time", w.from)
        .lte("start_time", w.to);

      if (!events || events.length === 0) continue;

      for (const ev of events) {
        // RSVPs: going OR maybe
        const { data: rsvps } = await admin
          .from("group_event_rsvps")
          .select("user_id, status")
          .eq("event_id", ev.id)
          .in("status", ["going", "maybe"]);

        if (!rsvps || rsvps.length === 0) continue;

        for (const r of rsvps) {
          // Dedupe
          const { data: sent } = await admin
            .from("event_reminders_sent")
            .select("id")
            .eq("event_id", ev.id)
            .eq("user_id", r.user_id)
            .eq("event_type", w.reminderType)
            .maybeSingle();
          if (sent) continue;

          // Honor per-group mute (events channel)
          const { data: enabled } = await admin.rpc("is_group_channel_enabled", {
            p_user_id: r.user_id,
            p_group_id: ev.group_id,
            p_channel: "events",
          });
          if (enabled === false) continue;

          const title = w.kind === "1h" ? `Starting soon: ${ev.title}` : `Tomorrow: ${ev.title}`;
          const message = w.kind === "1h"
            ? `Your group event starts in ~1 hour${ev.custom_location ? " · " + ev.custom_location : ""}`
            : `Your group event is tomorrow${ev.custom_location ? " · " + ev.custom_location : ""}`;

          await admin.rpc("create_notification", {
            p_user_id: r.user_id,
            p_notification_type: w.reminderType,
            p_category: "events",
            p_title: title,
            p_message: message,
            p_link: `/community/${ev.group_id}/event/${ev.id}`,
            p_priority: w.kind === "1h" ? "high" : "normal",
            p_metadata: { event_id: ev.id, group_id: ev.group_id, window: w.kind },
            p_actor_id: null,
            p_expires_at: new Date(new Date(ev.start_time).getTime() + 24 * 3600 * 1000).toISOString(),
          });

          await admin.from("event_reminders_sent").insert({
            event_id: ev.id,
            user_id: r.user_id,
            event_type: w.reminderType,
          });

          totalNotified++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, notified: totalNotified, ran_at: now.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-group-event-reminders error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
