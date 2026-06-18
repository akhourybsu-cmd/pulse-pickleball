// =====================================================================
// push-send — fan a single notification out as Web Push to every
// subscription registered for the recipient user.
//
// Called by:
//   (a) The DB trigger on user_notifications (via pg_net) — for new
//       in-app notifications that should also fire on the device.
//   (b) Directly by other edge functions (e.g. group-event-reminders).
//
// Request body:
//   {
//     user_id: UUID,
//     title:   string,
//     body:    string,
//     url?:    string,    // deep link on click
//     tag?:    string,    // collapses repeated rows on the OS shade
//     priority?: 'high' | 'normal'
//   }
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import webpush from 'https://esm.sh/web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendBody {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  priority?: 'high' | 'normal';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidContact = Deno.env.get('VAPID_CONTACT') ?? 'mailto:no-reply@pulsepickleball.app';

  if (!vapidPublic || !vapidPrivate) {
    return new Response(
      JSON.stringify({ error: 'VAPID keys not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  webpush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate);

  let payload: SendBody;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!payload.user_id || !payload.title) {
    return new Response(JSON.stringify({ error: 'Missing user_id or title' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Look up every subscription for this user. A user can have multiple
  // (e.g. phone + laptop) — we hit them all.
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', payload.user_id);

  if (error) {
    console.error('[push-send] subs query failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no_subscriptions' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const wpPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    priority: payload.priority,
  });

  let sent = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (s: any) => {
      const sub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(sub as any, wpPayload, {
          TTL: 60 * 60 * 24,
          urgency: payload.priority === 'high' ? 'high' : 'normal',
        });
        sent++;
      } catch (err: any) {
        // 404 / 410 from the push service = subscription is dead. Prune
        // so the user isn't paying for a no-op every time.
        const status = err?.statusCode ?? err?.status;
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
          pruned++;
        } else {
          console.error('[push-send] send failed:', err?.message ?? err);
        }
      }
    }),
  );

  return new Response(JSON.stringify({ sent, pruned, candidates: subs.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
