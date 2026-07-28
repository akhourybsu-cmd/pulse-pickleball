import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DUR, EASE_OUT, routeVariants } from "@/lib/leagues/motion";

/**
 * Directional slide transition for the player-facing league routes:
 *   /player/leagues                       (list, depth 0)
 *   /player/leagues/:leagueId             (detail, depth 1)
 *   /player/leagues/:leagueId/manage      (manage, depth 2)
 *
 * Going deeper → the new screen slides in from the right; going
 * shallower → it slides back in from the left. Same-depth or first mount
 * (deep-link / refresh) → no animation, so a direct URL renders instantly
 * with no flash.
 *
 * This is a byte-for-byte sibling of CommunityTransitionOutlet — same
 * design rationale: AnimatePresence `popLayout` (no absolute positioning,
 * so scroll isn't broken), direction on a ref (no extra render), reduced
 * motion bypasses the whole pipeline, and react-router still owns
 * navigation + history — we only animate the render. Wrapping the routes
 * changes nothing about their paths, elements, guards, or the shell above.
 */

/** "/player/leagues" = 0, deeper paths count trailing segments. */
function leagueDepth(pathname: string): number {
  const match = pathname.match(/^\/player\/leagues(?:\/(.*))?$/);
  if (!match) return 0;
  const rest = match[1];
  if (!rest) return 0;
  return rest.split("/").filter(Boolean).length;
}

export function LeagueTransitionOutlet() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const currentDepth = leagueDepth(location.pathname);
  const prevDepthRef = useRef<number>(currentDepth);

  const direction =
    currentDepth > prevDepthRef.current ? 1 :
    currentDepth < prevDepthRef.current ? -1 :
    0;

  useEffect(() => {
    prevDepthRef.current = currentDepth;
  }, [currentDepth]);

  if (reduced) {
    return <Outlet />;
  }

  return (
    <div className="relative overflow-x-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={routeVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: DUR.overlay, ease: EASE_OUT }}
          style={{ willChange: "transform" }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
