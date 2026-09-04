import { toast } from "sonner";
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

/**
 * Native push is OFF until Firebase is provisioned.
 *
 * On Android, PushNotifications.register() calls into FCM, which crashes the
 * app at the native layer ("Default FirebaseApp is not initialized") when no
 * google-services.json is bundled — and a native crash can't be caught by the
 * JS try/catch below. Until a Firebase project + google-services.json (and an
 * FCM credential for the backend sender) are wired up per GOOGLE_PLAY_LAUNCH.md,
 * we never call register(). Flip this to true once that config is in place.
 */
export const NATIVE_PUSH_ENABLED = true;

/** Whether the native enable-notifications UI should be offered on this build. */
export function isNativePushConfigured(): boolean {
  return NATIVE_PUSH_ENABLED && isNativeApp();
}

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
    const { Capacitor } = await import("@capacitor/core");
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
  if (!isNativeApp() || !NATIVE_PUSH_ENABLED) return;
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
      // Foreground receipt: Android does NOT show a system banner for an FCM
      // notification message while the app is open — it hands it to this
      // listener instead. Surface it in-app so it isn't silently lost.
      await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        const title = notification.title ?? "PULSE";
        const body = notification.body ?? "";
        const link = notification.data?.link;
        toast(title, {
          description: body || undefined,
          action:
            typeof link === "string" && link && navigateFn
              ? { label: "View", onClick: () => navigateFn?.(link) }
              : undefined,
        });
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
  if (!isNativeApp() || !NATIVE_PUSH_ENABLED) return false;
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
