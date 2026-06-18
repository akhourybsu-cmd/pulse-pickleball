import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Web Push subscribe flow.
 *
 * Reads the VAPID public key from `VITE_VAPID_PUBLIC_KEY`. When absent
 * (e.g. local dev without keys), the hook reports `supported=false` so
 * the UI can render a clear "ask your admin to enable push" state.
 *
 * On enable() we:
 *   1. Ensure the SW is registered + ready.
 *   2. Request Notification permission (browser-mediated).
 *   3. Call pushManager.subscribe with the VAPID public key.
 *   4. Upsert the resulting endpoint into push_subscriptions.
 *
 * disable() reverses the SW subscription and removes the row.
 *
 * The hook keeps its own `enabled` state derived from the current
 * SW subscription so the UI reflects browser truth (not just our DB).
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushSubscription() {
  const { toast } = useToast();
  const vapidKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!vapidKey;

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default',
  );

  // Reflect current SW subscription state on mount + after every toggle.
  const refresh = useCallback(async () => {
    if (!supported) {
      setEnabled(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setEnabled(!!sub);
      setPermission(Notification.permission);
    } catch (e) {
      console.error('[push] refresh failed', e);
      setEnabled(false);
    }
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    if (!supported) {
      toast({
        title: 'Push not configured',
        description: 'VAPID key missing — contact an admin.',
        variant: 'destructive',
      });
      return false;
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        toast({
          title: 'Permission denied',
          description: 'Enable notifications in your browser settings to receive PULSE alerts.',
          variant: 'destructive',
        });
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        });
      }

      // Extract the two keys we need to send via Web Push from the
      // server side. PushSubscriptionJSON makes this clean.
      const json = sub.toJSON();
      const p256dh = (json.keys as any)?.p256dh;
      const auth = (json.keys as any)?.auth;
      if (!json.endpoint || !p256dh || !auth) {
        throw new Error('Subscription missing endpoint or keys');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          { user_id: user.id, endpoint: json.endpoint, p256dh, auth },
          { onConflict: 'user_id,endpoint' },
        );
      if (error) throw error;

      setEnabled(true);
      toast({ title: 'Notifications enabled' });
      return true;
    } catch (e: any) {
      console.error('[push] enable failed', e);
      toast({
        title: 'Could not enable notifications',
        description: e?.message ?? 'Try again in a moment',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, toast, vapidKey]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint);
        }
      }
      setEnabled(false);
      toast({ title: 'Notifications disabled' });
    } catch (e: any) {
      console.error('[push] disable failed', e);
      toast({
        title: 'Could not disable notifications',
        description: e?.message ?? 'Try again in a moment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supported, toast]);

  return { supported, enabled, loading, permission, enable, disable };
}
