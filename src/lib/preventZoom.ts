/**
 * Suppress browser pinch-zoom so the app feels native across devices.
 *
 * The viewport meta (maximum-scale=1, user-scalable=no) already handles
 * touch pinch, double-tap, and iOS focus-zoom inside an installed PWA.
 * This covers the gaps the viewport meta can't:
 *   • Desktop Safari + iOS Safari pinch → gesture* events
 *   • Chromium desktop trackpad pinch / ⌘|Ctrl + wheel → wheel with ctrlKey
 *
 * Deliberately NOT blocked: keyboard zoom (⌘|Ctrl + / − / 0). That's an
 * explicit accessibility affordance, not the accidental gesture zoom that
 * makes a web app feel like a web page — leave it working.
 */
export function preventPinchZoom(): void {
  const block = (e: Event) => e.preventDefault();

  // Safari (desktop + iOS) pinch.
  document.addEventListener("gesturestart", block, { passive: false });
  document.addEventListener("gesturechange", block, { passive: false });
  document.addEventListener("gestureend", block, { passive: false });

  // Chromium/desktop trackpad pinch + Ctrl/⌘ + scroll arrive as a wheel
  // event with ctrlKey set. Only intercept that case so normal scrolling
  // (and horizontal scroll) is untouched.
  document.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
}
