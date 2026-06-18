// =====================================================================
// Group event reminders (Community Phase 3.2).
//
// Cron-driven Edge Function — should be invoked every 15 minutes by a
// Supabase scheduled job. On each invocation it inserts in-app
// notifications for two windows:
//
//   • '24h reminder' — group_events starting between 23:45h–24:15h from
//     now. Catches the day-before reminder for RSVPs.
//   • '1h reminder'  — group_events starting between 50–70m from now.
//     Catches the "leave now" nudge.
//
// Dedup via event_reminders_sent (existing table). We encode the
// reminder kind into the event_type column ('group_event_24h' /
// 'group_event_1h') so the UNIQUE(user_id, event_id, event_type)
// constraint already gives us idempotency.
//
// Per-group mute is honored by joining against group_notification_prefs
// and dropping members with events=false or muted_all=true.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReminderKind = '24h' | '1h';

interface ReminderEnvelope {
  user_id: string;
  event_id: string;
  group_id: string;
  group_name: string;
  event_title: string;
  start_time: string;
  kind: ReminderKind;
}

function fmtRelative(startISO: string, kind: ReminderKind) {
  const start = new Date(startISO);
  const hour = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (kind === '24h') {
    const dayLabel = start.toLocaleDateString('en-US', { weekday: 'long' });
    return `Tomorrow · ${dayLabel} at ${hour}`;
  }
  return `Starting at ${hour}`;
}

function payloadFor(reminder: ReminderEnvelope) {
  const lead = reminder.kind === '24h' ? 'Tomorrow' : 'In about an hour';
  return {
    notification_type: reminder.kind === '24h' ? 'group_event_24h' : 'group_event_1h',
    category: 'community',
    title: `${lead} — ${reminder.event_title}`,
    message: `${reminder.group_name}: ${fmtRelative(reminder.start_time, reminder.kind)}`,
    link: `/player/community/group/${reminder.group_id}?tab=schedule`,
    priority: reminder.kind === '1h' ? 'high' : 'normal',
    metadata: {
      group_id: reminder.group_id,
      event_id: reminder.event_id,
      reminder_kind: reminder.kind,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    // 24h window — events starting 23:45 to 24:15 from now. Cron firing
    // every 15 minutes hits each row in exactly one window.
    const w24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 45 * 60 * 1000);
    const w24End = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000);
    // 1h window — 50 to 70 min.
    const w1Start = new Date(now.getTime() + 50 * 60 * 1000);
    const w1End = new Date(now.getTime() + 70 * 60 * 1000);

    async function collect(windowStart: Date, windowEnd: Date, kind: ReminderKind) {
      const { data: events, error } = await supabase
        .from('group_events')
        .select(`
          id, title, start_time, group_id,
          groups!inner ( id, name ),
          group_event_rsvps!inner ( user_id, status )
        `)
        .gte('start_time', windowStart.toISOString())
        .lt('start_time', windowEnd.toISOString())
        .in('group_event_rsvps.status', ['going', 'maybe']);

      if (error) {
        console.error(`[reminders ${kind}] fetch error:`, error);
        return [] as ReminderEnvelope[];
      }

      const out: ReminderEnvelope[] = [];
      for (const ev of events ?? []) {
        const grp = Array.isArray(ev.groups) ? ev.groups[0] : ev.groups;
        const rsvps = Array.isArray(ev.group_event_rsvps) ? ev.group_event_rsvps : [];
        for (const r of rsvps) {
          out.push({
            user_id: r.user_id,
            event_id: ev.id,
            group_id: ev.group_id,
            group_name: grp?.name ?? 'your group',
            event_title: ev.title,
            start_time: ev.start_time,
            kind,
          });
        }
      }
      return out;
    }

    const [r24, r1] = await Promise.all([
      collect(w24Start, w24End, '24h'),
      collect(w1Start, w1End, '1h'),
    ]);
    const reminders = [...r24, ...r1];

    console.log(`[reminders] 24h=${r24.length} 1h=${r1.length}`);

    if (reminders.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Drop reminders for users who muted the events channel (or muted
    // the whole group). Batch the membership-prefs query for speed.
    const userGroupPairs = Array.from(new Set(reminders.map((r) => `${r.user_id}:${r.group_id}`)));
    const userIds = Array.from(new Set(reminders.map((r) => r.user_id)));
    const groupIds = Array.from(new Set(reminders.map((r) => r.group_id)));
    const { data: prefs } = await supabase
      .from('group_notification_prefs')
      .select('user_id, group_id, events, muted_all')
      .in('user_id', userIds)
      .in('group_id', groupIds);
    const mutedKeys = new Set(
      (prefs ?? [])
        .filter((p: any) => p.muted_all || p.events === false)
        .map((p: any) => `${p.user_id}:${p.group_id}`)
    );

    let sent = 0;
    let skipped = 0;

    for (const r of reminders) {
      const muteKey = `${r.user_id}:${r.group_id}`;
      if (mutedKeys.has(muteKey)) {
        skipped++;
        continue;
      }

      const sentType = r.kind === '24h' ? 'group_event_24h' : 'group_event_1h';

      // Insert into event_reminders_sent FIRST — UNIQUE constraint on
      // (user_id, event_id, event_type) gives us atomic dedup. If we
      // raced another invocation, this errors and we skip the notification.
      const { error: dedupErr } = await supabase
        .from('event_reminders_sent')
        .insert({ user_id: r.user_id, event_id: r.event_id, event_type: sentType });

      if (dedupErr) {
        // 23505 = unique_violation → already sent. Everything else is logged.
        if ((dedupErr as any).code !== '23505') {
          console.error('[reminders] dedup write failed:', dedupErr);
        }
        skipped++;
        continue;
      }

      const p = payloadFor(r);
      const { error: notifErr } = await supabase.rpc('create_notification', {
        p_user_id: r.user_id,
        p_notification_type: p.notification_type,
        p_category: p.category,
        p_title: p.title,
        p_message: p.message,
        p_link: p.link,
        p_priority: p.priority,
        p_metadata: p.metadata,
        p_related_user_id: null,
        p_expires_at: new Date(new Date(r.start_time).getTime() + 60 * 60 * 1000).toISOString(),
      });

      if (notifErr) {
        console.error('[reminders] notify failed:', notifErr);
        // Roll back the dedup so a retry can succeed.
        await supabase
          .from('event_reminders_sent')
          .delete()
          .eq('user_id', r.user_id)
          .eq('event_id', r.event_id)
          .eq('event_type', sentType);
        skipped++;
        continue;
      }

      sent++;
    }

    return new Response(JSON.stringify({ sent, skipped, candidates: reminders.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[reminders] unhandled error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
