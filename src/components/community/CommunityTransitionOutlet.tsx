import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";

/**
 * Depth-aware enter transition for the three Community routes:
 *   /player/community                        (list, depth 0)
 *   /player/community/group/:id              (detail, depth 2)
 *   /player/community/group/:id/manage       (manage, depth 3)
 *
 * Enter-only by design: the previous AnimatePresence/popLayout version kept the
 * outgoing screen mounted through its exit, which produced overlapping content
 * and a laggy-feeling switch. Only the incoming page animates now, so there is
 * never more than one page in the tree.
 */

const OFFSET = 24;

function communityDepth(pathname: string): number {
  const match = pathname.match(/^\/player\/community(?:\/(.*))?$/);
  if (!match) return 0;
  const rest = match[1];
  if (!rest) return 0;
  return rest.split("/").filter(Boolean).length;
}

export function CommunityTransitionOutlet() {
  const location = useLocation();
  const currentDepth = communityDepth(location.pathname);
  const prevDepthRef = useRef<number>(currentDepth);

  const direction =
    currentDepth > prevDepthRef.current ? 1 :
    currentDepth < prevDepthRef.current ? -1 :
    0;

  useEffect(() => {
    prevDepthRef.current = currentDepth;
  }, [currentDepth]);

  return (
    <div className="relative overflow-x-hidden">
      <div
        key={location.pathname}
        className="pulse-route-enter"
        style={{
          "--pulse-route-enter-x": `${direction === 0 ? 0 : direction > 0 ? OFFSET : -OFFSET}px`,
        } as CSSProperties}
      >
        <Outlet />
      </div>
    </div>
  );
}
