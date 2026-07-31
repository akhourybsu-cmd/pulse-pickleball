import { useEffect, useRef } from "react";
import { useLocation, useNavigationType, useOutlet } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import {
  classifyTransition,
  shellRouteKind,
  transitionKey,
  type NavigationType,
} from "@/lib/navigation/navClassification";

/**
 * The single transition owner for the player shell's content region.
 *
 * DESIGN (v2 — enter-only):
 * The previous version used AnimatePresence with mode="popLayout" and a frozen
 * outlet per layer. That kept the OUTGOING page mounted for the duration of the
 * exit animation, which caused the two symptoms users reported:
 *   • the tab appeared not to switch immediately (old content still visible)
 *   • overlapping / spilling content and stacked fixed buttons mid-transition
 *
 * Now there is exactly ONE layer at any time: the new route renders instantly
 * and animates itself in (short directional slide + fade). Nothing exits, so
 * nothing can overlap, and the perceived switch is immediate.
 *
 * Immersive routes (DM thread, match entry) get opacity-only motion so their
 * fixed action bars are never re-anchored by a transform.
 */

const DURATION = 0.18;
// Small offset only — enough to read as directional, never enough to look like
// a page is sliding across content.
const OFFSET = 24;

export function ShellContentTransition({ immersive }: { immersive: boolean }) {
  const location = useLocation();
  const navType = useNavigationType();
  const reduced = useReducedMotion();
  const outlet = useOutlet();
  const prevPathRef = useRef<string | null>(null);
  const nextPath = location.pathname;

  const { direction } = classifyTransition({
    prevPath: prevPathRef.current,
    nextPath,
    navigationType: navType as NavigationType,
  });

  useEffect(() => {
    prevPathRef.current = nextPath;
  }, [nextPath]);

  // Reduced motion → instant swap; navigation is never delayed for animation.
  if (reduced) return <>{outlet}</>;

  const toKind = shellRouteKind(nextPath);
  const delegated =
    toKind === "league" ||
    toKind === "community-inner" ||
    toKind === "immersive" ||
    toKind === "other";

  // Immersive + delegated subtrees: fade only (no transform).
  const initial =
    delegated || direction === 0
      ? { opacity: 0 }
      : { opacity: 0, x: direction > 0 ? OFFSET : -OFFSET };
  const animate = { opacity: 1, x: 0 };

  return (
    <div className="relative overflow-x-hidden">
      <motion.div
        key={transitionKey(nextPath)}
        initial={initial}
        animate={animate}
        transition={{ duration: DURATION, ease: EASE_OUT }}
      >
        {outlet}
      </motion.div>
    </div>
  );
}
