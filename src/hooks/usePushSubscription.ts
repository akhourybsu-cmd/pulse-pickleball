import { withAuthDeadline } from "@/lib/authDeadline";
import { useAuthState } from "@/hooks/useAuthState";
import { toast } from "sonner";
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function subscriptionUsesVapidKey(
  subscription: PushSubscription,
  vapidPublicKey: string
): boolean {
  const activeKey = subscription.options.applicationServerKey;
  if (!activeKey) return false;

  const expectedKey = urlBase64ToUint8Array(vapidPublicKey);
  const currentKey = new Uint8Array(activeKey);
  if (currentKey.length !== expectedKey.length) return false;

  return currentKey.every((byte, index) => byte === expectedKey[index]);
}

export type PushState =
  | "unsupported"
  | "denied"
  | "disabled"
  | "enabled"
  | "loading";

export function usePushSubscription() {
  const { user } = useAuthState();
  const userId = user?.id;
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const refresh = useCallback(async () => {
    setError(null);
    if (!supported) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    try {
      const reg = await withAuthDeadline(
        () => navigator.serviceWorker.ready,
        8000
      );
      const sub = await reg.pushManager.getSubscription();
      const keyMatches =
        sub && VAPID_PUBLIC_KEY
          ? subscriptionUsesVapidKey(sub, VAPID_PUBLIC_KEY)
          : Boolean(sub);
      if (!sub || !keyMatches || !userId) {
        setState("disabled");
        return;
      }
      const { data, error: loadError } = await withAuthDeadline((signal) =>
        supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", userId)
          .eq("endpoint", sub.endpoint)
          .abortSignal(signal)
          .maybeSingle()
      );
      if (loadError) throw loadError;
      setState(data ? "enabled" : "disabled");
    } catch {
      setError(
        "Could not check notifications on this device. Try again after reconnecting."
      );
      setState("disabled");
    }
  }, [supported, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!supported || !user || lock.current) return false;
    if (!VAPID_PUBLIC_KEY) {
      toast.error(
        "Device notifications are not available yet. In-app alerts still work."
      );
      return false;
    }
    lock.current = true;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "disabled");
        return;
      }
      const reg = await withAuthDeadline(
        () => navigator.serviceWorker.ready,
        8000
      );
      let sub = await reg.pushManager.getSubscription();
      if (sub && !subscriptionUsesVapidKey(sub, VAPID_PUBLIC_KEY)) {
        const { error: deleteError } = await withAuthDeadline((signal) =>
          supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub!.endpoint)
            .abortSignal(signal)
        );
        if (deleteError) throw deleteError;
        if (!(await sub.unsubscribe()))
          throw new Error("Device subscription was not removed.");
        sub = null;
      }
      if (!sub) {
        const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer.slice(
            keyBytes.byteOffset,
            keyBytes.byteOffset + keyBytes.byteLength
          ) as ArrayBuffer,
        });
      }
      const j = sub.toJSON() as any;
      const { error: saveError } = await withAuthDeadline((signal) =>
        supabase
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,
              endpoint: sub.endpoint,
              p256dh: j.keys?.p256dh ?? "",
              auth: j.keys?.auth ?? "",
              user_agent: navigator.userAgent,
            },
            { onConflict: "endpoint" }
          )
          .abortSignal(signal)
      );
      if (saveError) throw saveError;
      setError(null);
      setState("enabled");
      return true;
    } catch {
      setError("Could not save device notifications. Please try again.");
      toast.error("Could not save device notifications. Please try again.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [supported, user]);

  const disable = useCallback(async () => {
    if (!supported || lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      const reg = await withAuthDeadline(
        () => navigator.serviceWorker.ready,
        8000
      );
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const { error: deleteError } = await withAuthDeadline((signal) =>
          supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub!.endpoint)
            .abortSignal(signal)
        );
        if (deleteError) throw deleteError;
        if (!(await sub.unsubscribe()))
          throw new Error("Device subscription was not removed.");
      }
      setError(null);
      setState("disabled");
      return true;
    } catch {
      setError("Could not save device notifications. Please try again.");
      toast.error("Could not save device notifications. Please try again.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [supported]);

  return { state, busy, supported, enable, disable, refresh, error };
}
