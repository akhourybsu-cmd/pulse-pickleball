/**
 * Pure termination logic for the ScrollManager restore loop, split out so the
 * bounds are documented in one place and unit-testable without a DOM.
 *
 * The loop re-applies a saved scroll position across a few animation frames
 * (content can grow after mount as a lazy chunk + query data arrive) but must
 * ALWAYS terminate. It stops as soon as it lands within tolerance, and no
 * matter what after a hard cap on frames OR elapsed wall-clock time — so a
 * saved position taller than the final document (or content that became
 * permanently shorter) can never spin forever.
 */

export const RESTORE_MAX_ATTEMPTS = 20;
export const RESTORE_MAX_ELAPSED_MS = 400;
export const RESTORE_TOLERANCE_PX = 2;

export function isRestoreSettled(currentY: number, targetY: number): boolean {
  return Math.abs(currentY - targetY) <= RESTORE_TOLERANCE_PX;
}

export function isRestoreExhausted(attempts: number, elapsedMs: number): boolean {
  return attempts >= RESTORE_MAX_ATTEMPTS || elapsedMs >= RESTORE_MAX_ELAPSED_MS;
}

/** True when the retry loop should stop this frame (settled OR exhausted). */
export function shouldStopRestore(args: {
  attempts: number;
  elapsedMs: number;
  currentY: number;
  targetY: number;
}): boolean {
  return (
    isRestoreSettled(args.currentY, args.targetY) ||
    isRestoreExhausted(args.attempts, args.elapsedMs)
  );
}
