import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  AnimatePresence, motion, useReducedMotion,
} from "framer-motion";

/**
 * Directional slide transition for the three Community routes:
 *   /player/community                        (list, depth 0)
 *   /player/community/group/:id              (detail, depth 2)
 *   /player/community/group/:id/manage       (manage, depth 3)
 *
 * Going deeper → new page slides in from the right (native-app feel).
 * Going shallower → outgoing page slides out to the right.
 * Same-depth or first mount (deep-link / refresh) → no animation,
 * so a direct URL renders instantly with no flash.
 *
 * Design choices:
 *  • Uses AnimatePresence `mode="popLayout"` — the exiting page pops
 *    out of layout automatically, so we don't need absolute
 *    positioning + fixed heights to prevent scroll breakage.
 *  • Direction lives on a ref (not state) so we don't cause a
 *    re-render just to compute it.
 *  • Respects `prefers-reduced-motion` via useReducedMotion() — those
 *    users get a plain Outlet with no motion at all.
 *  • Only wraps Community routes. The rest of the app is untouched.
 *  • PlayerShell (header + bottom nav) sits ABOVE this in the tree
 *    and is not remounted, so nav stays visually stable through the
 *    transition.
 *  • Does not touch history — react-router owns navigation, this
 *    only animates the render.
 */

const DURATION = 0.28;
const EASE = [0.32, 0.72, 0, 1] as const; // iOS-ish cubic, decelerates hard

/** Path-depth heuristic. "/player/community" = 0, "/foo/bar/baz" = deeper. */
function communityDepth(pathname: string): number {
  const match = pathname.match(/^\/player\/community(?:\/(.*))?$/);
  if (!match) return 0;
  const rest = match[1];
  if (!rest) return 0;
  return rest.split("/").filter(Boolean).length;
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : direction < 0 ? "-8%" : 0,
    opacity: direction === 0 ? 1 : direction > 0 ? 0.6 : 0.85,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? "-8%" : direction < 0 ? "100%" : 0,
    opacity: direction === 0 ? 1 : direction > 0 ? 0.85 : 0.6,
  }),
};

export function CommunityTransitionOutlet() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const prevDepthRef = useRef<number>(communityDepth(location.pathname));

  const currentDepth = communityDepth(location.pathname);
  const direction =
    currentDepth > prevDepthRef.current ? 1 :
    currentDepth < prevDepthRef.current ? -1 :
    0;

  // Update the ref AFTER the current render so this render still
  // sees the correct direction. The direction only matters for the
  // motion.div about to mount; subsequent renders read the updated ref.
  useEffect(() => {
    prevDepthRef.current = currentDepth;
  }, [currentDepth]);

  // Reduced-motion users bypass the entire animation pipeline.
  // Also bail on first-render (direction === 0) so deep-links don't
  // ever animate. AnimatePresence's `initial={false}` covers that
  // too, but the explicit escape hatch is cheaper.
  if (reduced) {
    return <Outlet />;
  }

  return (
    // overflow-x hidden so a page mid-transition can't push a
    // horizontal scrollbar onto the outer scroller. Height is
    // inherited from the parent flow — no min-height math needed
    // because popLayout removes the exiting element from layout.
    <div className="relative overflow-x-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: DURATION, ease: EASE }}
          // Prevent brief horizontal scrollbar when a page is off-screen
          // during the transition. The parent container clips.
          style={{ willChange: "transform" }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
