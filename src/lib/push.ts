import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/platform";

/**
 * Native (Capacitor) push notifications.
 *
 * Web push lives in usePushSubscription (service worker + VAPID). That can't
 * run inside the native WebView, so on iOS/Android we register with the OS push
 * service (FCM / APNs) via @capacitor/push-notifications, get an opaque device
 * token, and store it in `device_tokens` for the backend sender to target.
 *
 * Delivery only works once Firebase (Android google-services.json + an FCM
 * credential) is configured — see GOOGLE_PLAY_LAUNCH.md. Until then this
 * registers listeners and fails gracefully (no token arrives), so nothing here
 * throws on an un-provisioned build.
 */

let listenersReady = false;
let navigateFn: ((path: string) => void) | null = null;

/** Let the app route a tapped notification through React Router. */
export function setPushNavigator(fn: (path: string) => void): void {
  navigateFn = fn;
}

async function upsertDeviceToken(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const platform = Capacitor.getPlatform();
    if (platform !== "android" && platform !== "ios") return;
    await supabase
      .from("device_tokens")
      .upsert(
        { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
        { onConflict: "token" },
      );
  } catch (e) {
    console.warn("device token upsert failed", e);
  }
}

/**
 * Attach listeners (idempotent) and register with the OS push service **only
 * if permission was already granted** — so returning users refresh their token
 * silently without a permission prompt. Call once at startup. No-op on web.
 */
export async function initNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    if (!listenersReady) {
      await PushNotifications.addListener("registration", (t) => {
        void upsertDeviceToken(t.value);
      });
      await PushNotifications.addListener("registrationError", (err) => {
        console.warn("push registration error", err);
      });
      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const link = action.notification?.data?.link;
        if (typeof link === "string" && link && navigateFn) navigateFn(link);
      });
      listenersReady = true;
    }

    const perm = await PushNotifications.checkPermissions();
    if (perm.receive === "granted") {
      await PushNotifications.register();
    }
  } catch (e) {
    console.warn("native push init skipped", e);
  }
}

/**
 * Explicit opt-in: prompt for permission and register. Returns true if the user
 * granted and registration started. Drives the "Enable notifications" button in
 * the native app. No-op / false on web.
 */
export async function enableNativePush(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await initNativePush(); // ensure listeners exist before register fires
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return false;
    await PushNotifications.register();
    return true;
  } catch (e) {
    console.warn("enable native push failed", e);
    return false;
  }
}

/** Current native push permission: 'granted' | 'denied' | 'prompt' | null (web). */
export async function getNativePushPermission(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.checkPermissions();
    return perm.receive;
  } catch {
    return null;
  }
}
