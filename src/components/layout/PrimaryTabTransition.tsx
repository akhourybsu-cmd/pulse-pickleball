import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DUR, EASE_OUT, tabSlideVariants } from "@/lib/motion";
// Page-slide duration: the "tab" token (200ms) sits in the spec's 200–240ms
// window; EASE_OUT decelerates hard so the incoming screen settles cleanly.
const SLIDE = { duration: DUR.tab, ease: EASE_OUT };
import { primaryTabIndex, primaryTabPath, slideDirection } from "@/lib/navigation/primaryTabs";

/**
 * Page-content transition for the player shell.
 *
 * The five primary bottom-nav tabs slide horizontally so moving between them
 * feels like moving across adjacent areas of one app: the destination enters
 * from the side that matches its position in the nav (right if it's further
 * right, left if further left), and the current screen slides the opposite
 * way. Direction is derived once, from the previously-visited primary tab's
 * index vs. the destination's — so multi-tab skips (Home → Community) run a
 * single direct slide, and the very first render (deep link / refresh) never
 * fabricates a direction.
 *
 * Everything else — detail routes, leagues, play, and the immersive routes
 * that carry their own fixed bottom chrome — keeps the app's prior gentle
 * fade, so the Community/League subtree outlets still own their own depth
 * transitions and nothing double-animates. The header, FAB, and bottom nav
 * live ABOVE this component in PlayerShell and are never remounted.
 *
 * The header/nav staying put is why only the region between them moves.
 */
export function PrimaryTabTransition({ immersive }: { immersive: boolean }) {
  const location = useLocation();
  const reduced = useReducedMotion();

  // Last primary tab we settled on. Updated only for primary tabs, so a
  // detour through a detail route (e.g. Home → a league → Matches) still
  // computes a sensible Home→Matches direction.
  const prevIndexRef = useRef<number | null>(null);
  const idx = primaryTabIndex(location.pathname);
  const isPrimarySlide = idx >= 0 && !immersive;
  const direction = isPrimarySlide
    ? slideDirection(prevIndexRef.current ?? -1, idx)
    : 0;

  useEffect(() => {
    if (idx >= 0) prevIndexRef.current = idx;
  }, [idx]);

  // Reduced-motion users get an instant swap — navigation is never delayed
  // for an animation, and state/focus behavior is unaffected.
  if (reduced) return <Outlet />;

  if (!isPrimarySlide) {
    // Preserve the previous behavior for non-primary / immersive routes.
    // Community/League subtrees key on a constant so their own outlet owns
    // depth transitions instead of this wrapper fighting them.
    const isCommunity = location.pathname.startsWith("/player/community");
    const fadeKey = isCommunity ? "community-subtree" : location.pathname;
    const initial = immersive ? { opacity: 0 } : { opacity: 0, y: 8 };
    const animate = immersive ? { opacity: 1 } : { opacity: 1, y: 0 };
    return (
      <motion.div
        key={fadeKey}
        initial={initial}
        animate={animate}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.div>
    );
  }

  // Key by the tab ROOT (not the full pathname) so query-param or in-tab
  // sub-state changes don't retrigger the slide — only an actual tab change
  // does. `mode="popLayout"` pops the outgoing screen out of layout so the
  // incoming one takes its place with no height jump; the parent clips the
  // horizontal overflow (x only, so vertical scroll + sticky still work).
  const tabKey = primaryTabPath(location.pathname) ?? location.pathname;
  return (
    <div className="relative overflow-x-clip">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={tabKey}
          custom={direction}
          variants={tabSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={SLIDE}
          style={{ willChange: "transform" }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
