interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function getCapacitorBridge(): CapacitorBridge | undefined {
  return (globalThis as typeof globalThis & { Capacitor?: CapacitorBridge }).Capacitor;
}

/**
 * True when PULSE is running inside the native (iOS/Android) Capacitor shell,
 * false in a normal web browser. Use this to hide web-only affordances (PWA
 * install prompt, web-push banner) that don't make sense in the installed app.
 */
export function isNativeApp(): boolean {
  try {
    const bridge = getCapacitorBridge();
    if (bridge?.isNativePlatform) return bridge.isNativePlatform();
    return Boolean(bridge?.getPlatform && bridge.getPlatform() !== "web");
  } catch {
    return false;
  }
}

/**
 * One-time native startup tweaks. No-op on web. Safe to call unconditionally.
 * - Status-bar icon style: the app's top bar (and the status-bar area behind
 *   it) is the dark ink brand color, so the status-bar icons must be light —
 *   Capacitor's Style.Dark means "dark background ⇒ light icons".
 * - Android hardware back button: navigate in-app history instead of exiting
 *   on the first press, with a "press back again to exit" guard at the root.
 */
export async function initNativeApp(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) {
    console.warn("Native app init skipped:", e);
  }
  await initBackButton();
}

/**
 * Android hardware back button. Capacitor's default exits the app the instant
 * back is pressed with no web history — a jarring experience at a root tab.
 * Instead: go back in the router's history when there is somewhere to go, and
 * at the root require a second press within a short window to exit (the
 * standard Android "press back again to exit" pattern). No-op on iOS (no
 * hardware back button) and on web.
 */
async function initBackButton(): Promise<void> {
  try {
    const { App } = await import("@capacitor/app");
    let lastBackAt = 0;
    const EXIT_WINDOW_MS = 2000;

    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      // At a root route: confirm exit on a second quick press.
      const now = performance.now();
      if (now - lastBackAt < EXIT_WINDOW_MS) {
        App.exitApp();
        return;
      }
      lastBackAt = now;
      void toastExitHint();
    });
  } catch (e) {
    console.warn("Back-button handler skipped:", e);
  }
}

async function toastExitHint(): Promise<void> {
  try {
    const { toast } = await import("sonner");
    toast("Press back again to exit");
  } catch {
    /* toast is best-effort */
  }
}
