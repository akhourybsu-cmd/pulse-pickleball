import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { isPrimaryTabPath } from "@/lib/navigation/primaryTabs";

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
 * user was reading is persisted to disk. Restoration retries across a few
 * frames because a tab's content (lazy chunk + query data) can arrive after
 * the route mounts; without the retry we'd clamp to a not-yet-tall page.
 */

const positions = new Map<string, number>();

function keyFor(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

function restoreTo(y: number): void {
  if (y <= 0) {
    window.scrollTo(0, 0);
    return;
  }
  let attempts = 0;
  const step = () => {
    window.scrollTo(0, y);
    attempts += 1;
    // Keep trying until we land within a couple px of the target or give up,
    // covering async content that grows the page after mount.
    if (Math.abs(window.scrollY - y) > 2 && attempts < 20) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

export function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"
  const key = keyFor(location.pathname, location.search);

  // Decide where to land whenever the route changes.
  useEffect(() => {
    const saved = positions.get(key);
    if (navType === "POP") {
      restoreTo(saved ?? 0);
    } else if (saved != null && isPrimaryTabPath(location.pathname)) {
      // Re-entering a primary tab we've visited — pick up where we left off.
      restoreTo(saved);
    } else {
      window.scrollTo(0, 0);
    }
    // Intentionally keyed on the resolved location key.
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
