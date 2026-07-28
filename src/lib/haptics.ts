/**
 * Subtle, best-effort haptic feedback for meaningful confirmations
 * (score submitted/confirmed, a round processed). Reserved for moments
 * that matter — never for ordinary navigation or taps.
 *
 * The web's only broadly-supported primitive is `navigator.vibrate`,
 * which exists on Android Chrome/Firefox and is a no-op / absent
 * elsewhere (notably iOS Safari has no Vibration API). We feature-detect
 * and silently do nothing when it's unavailable, so callers can fire a
 * haptic unconditionally without guarding each site.
 *
 * Patterns are intentionally short so the feedback reads as a crisp
 * "done", not a buzz.
 */

export type HapticPattern = "tap" | "success" | "warning";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  /** A single light tick — the lightest acknowledgement. */
  tap: 10,
  /** Short double pulse — a positive confirmation. */
  success: [14, 40, 22],
  /** Heavier double pulse — something needs attention. */
  warning: [24, 60, 24],
};

function canVibrate(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  );
}

/**
 * Fire a haptic pulse if the platform supports it. Safe to call from any
 * event handler — unsupported platforms and thrown errors (some embedded
 * webviews reject vibrate) are swallowed.
 */
export function haptic(pattern: HapticPattern = "tap"): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* no-op: vibrate can throw in restricted webviews */
  }
}
