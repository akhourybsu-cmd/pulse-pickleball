import { Capacitor } from "@capacitor/core";

/**
 * True when PULSE is running inside the native (iOS/Android) Capacitor shell,
 * false in a normal web browser. Use this to hide web-only affordances (PWA
 * install prompt, web-push banner) that don't make sense in the installed app.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * One-time native startup tweaks. No-op on web. Safe to call unconditionally.
 * Currently: status-bar icon style. The app's top bar (and the status-bar area
 * behind it) is the dark ink brand color, so the status-bar icons must be light
 * — Capacitor's Style.Dark means "dark background ⇒ light icons".
 */
export async function initNativeApp(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) {
    console.warn("Native app init skipped:", e);
  }
}
