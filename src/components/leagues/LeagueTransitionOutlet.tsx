import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/leagues/motion";

/**
 * Depth-aware enter transition for the player-facing league routes:
 *   /player/leagues                       (list, depth 0)
 *   /player/leagues/:leagueId             (detail, depth 1)
 *   /player/leagues/:leagueId/manage      (manage, depth 2)
 *
 * Enter-only sibling of CommunityTransitionOutlet: only the incoming screen
 * animates, so the outgoing page is never held in the tree (no overlap, no
 * perceived delay when switching).
 */

const DURATION = 0.18;
const OFFSET = 24;

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
      <motion.div
        key={location.pathname}
        initial={
          direction === 0
            ? { opacity: 0 }
            : { opacity: 0, x: direction > 0 ? OFFSET : -OFFSET }
        }
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: DURATION, ease: EASE_OUT }}
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
