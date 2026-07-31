import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { isPrimaryTabPath } from "@/lib/navigation/primaryTabs";
import { shouldStopRestore } from "@/lib/navigation/scrollRestore";

/**
 * Scroll behavior for the app shell. Replaces the old "always scroll to top"
 * component so the primary tabs feel persistent:
 *
 *  • Back / forward (POP)            → restore where the user was.
 *  • Returning to a seen primary tab → restore its previous scroll position.
 *  • Any other forward navigation    → start at the top (a genuinely new page).
 *
 * Positions are held in an in-memory Map keyed by path+search for the life of
 * the session only — deliberately NOT localStorage, so nothing about where a
 * user was reading is persisted to disk.
 *
 * Restoration retries across frames because a route's content (lazy chunk +
 * query data) can grow the page after mount; without the retry we'd clamp to
 * a not-yet-tall page. The retry loop is strictly bounded and self-cleaning:
 *   - hard cap of MAX_ATTEMPTS frames AND a MAX_ELAPSED_MS wall-clock cutoff,
 *   - stops once within TOLERANCE_PX of the target,
 *   - aborts immediately on any intentional user scroll/keyboard input,
 *   - cancels its pending frame when the route changes again or on unmount.
 */

const positions = new Map<string, number>();

function keyFor(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

export function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"
  const key = keyFor(location.pathname, location.search);

  // Pending restore rAF handle + its abort listeners, so a new navigation (or
  // unmount) can cancel an in-flight restore instead of fighting the new page.
  const restoreRef = useRef<{ raf: number; cleanup: () => void } | null>(null);

  const cancelRestore = () => {
    if (restoreRef.current) {
      cancelAnimationFrame(restoreRef.current.raf);
      restoreRef.current.cleanup();
      restoreRef.current = null;
    }
  };

  // Decide where to land whenever the route changes.
  useEffect(() => {
    cancelRestore(); // never let a previous route's restore bleed into this one

    const saved = positions.get(key);
    const shouldRestore =
      navType === "POP" || (saved != null && isPrimaryTabPath(location.pathname));

    if (!shouldRestore || saved == null || saved <= 0) {
      window.scrollTo(0, 0);
      return cancelRestore;
    }

    // Bounded, abortable restore loop.
    const start = performance.now();
    let attempts = 0;
    let aborted = false;
    const abort = () => {
      aborted = true;
    };
    // Any genuine user input cancels restoration so we never fight the user.
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("wheel", abort, opts);
    window.addEventListener("touchmove", abort, opts);
    window.addEventListener("keydown", abort, opts);
    const cleanup = () => {
      window.removeEventListener("wheel", abort, opts);
      window.removeEventListener("touchmove", abort, opts);
      window.removeEventListener("keydown", abort, opts);
    };

    const step = () => {
      if (aborted) {
        cleanup();
        restoreRef.current = null;
        return;
      }
      window.scrollTo(0, saved);
      attempts += 1;
      if (
        shouldStopRestore({
          attempts,
          elapsedMs: performance.now() - start,
          currentY: window.scrollY,
          targetY: saved,
        })
      ) {
        cleanup();
        restoreRef.current = null;
        return;
      }
      restoreRef.current = { raf: requestAnimationFrame(step), cleanup };
    };
    restoreRef.current = { raf: requestAnimationFrame(step), cleanup };

    return cancelRestore;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, navType]);

  // Continuously record the live scroll position under the current key so it
  // is available if the user comes back. rAF-throttled; also flushed on the
  // cleanup that runs just before the next route takes over.
  const rafRef = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        positions.set(key, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
      positions.set(key, window.scrollY);
    };
  }, [key]);

  return null;
}
