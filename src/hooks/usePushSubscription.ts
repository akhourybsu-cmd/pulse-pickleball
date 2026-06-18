import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushState = "unsupported" | "denied" | "disabled" | "enabled" | "loading";

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const refresh = useCallback(async () => {
    if (!supported) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "enabled" : "disabled");
    } catch {
      setState("disabled");
    }
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    if (!supported) return;
    if (!VAPID_PUBLIC_KEY) {
      console.error("VITE_VAPID_PUBLIC_KEY missing");
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "disabled"); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
        });
      }
      const j = sub.toJSON() as any;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("push_subscriptions").upsert({
        user_id: u.user.id,
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh ?? "",
        auth: j.keys?.auth ?? "",
        user_agent: navigator.userAgent,
      }, { onConflict: "endpoint" });
      setState("enabled");
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("disabled");
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { state, busy, supported, enable, disable, refresh };
}
