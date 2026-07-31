import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigationType, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { DUR, EASE_OUT, tabSlideVariants } from "@/lib/motion";
import {
  classifyTransition,
  shellRouteKind,
  transitionKey,
  type NavigationType,
} from "@/lib/navigation/navClassification";

// Page-slide duration: the "tab" token (200ms) sits in the 200–240ms window;
// EASE_OUT decelerates hard so the incoming screen settles cleanly.
const SLIDE = { duration: DUR.tab, ease: EASE_OUT };

/**
 * The single transition owner for the player shell's content region.
 *
 * Every navigation is classified once (see navClassification) into a lateral
 * primary-tab slide, a forward/back detail push, a delegated route (owned by
 * the Community/League outlets or an immersive full-screen shell), or nothing
 * at all (deep link, replace, query-only, within-tab). Primary tabs and
 * detail routes share ONE AnimatePresence so continuity is preserved as you
 * move between them; delegated + non-animated changes keep the app's prior
 * gentle fade so nothing double-animates and immersive fixed action bars are
 * never re-anchored by a transform.
 *
 * IMPORTANT: each animated layer renders a FROZEN outlet element captured with
 * useOutlet() rather than a live <Outlet/>. A live <Outlet/> always renders
 * the *current* route, so the outgoing layer would show the new page (and, once
 * popLayout makes it absolute, leave it overlapping). Freezing pins each layer
 * to the route it entered with, so the exiting layer shows the OLD page and is
 * cleanly removed when its exit animation ends — no permanent overlap.
 *
 * The header, FAB, and bottom nav live ABOVE this component in PlayerShell —
 * only the region between them moves.
 */
export function ShellContentTransition({ immersive }: { immersive: boolean }) {
  const location = useLocation();
  const navType = useNavigationType();
  const reduced = useReducedMotion();
  // Frozen snapshot of the current route's element — held per layer so the
  // outgoing layer keeps rendering the page it entered with.
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

  if (delegated) {
    // Owned by an outlet or an immersive shell. A bare keyed motion.div (no
    // AnimatePresence ⇒ no exiting layer, no overlap) with the prior fade:
    // opacity-only for immersive routes (a transform would re-anchor their
    // fixed action bars), a small lift otherwise. Outlet subtrees key on a
    // constant so their own outlet owns depth transitions.
    const initial = immersive ? { opacity: 0 } : { opacity: 0, y: 8 };
    const animate = immersive ? { opacity: 1 } : { opacity: 1, y: 0 };
    return (
      <motion.div
        key={transitionKey(nextPath)}
        initial={initial}
        animate={animate}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {outlet}
      </motion.div>
    );
  }

  // Primary tabs + detail routes share one AnimatePresence. `direction` is 0
  // for within-tab / first-render changes (same key ⇒ no animation anyway),
  // ±1 for a real lateral slide or forward/back push. The restrained 28%
  // opaque translate keeps the viewport fully covered (no gap flash); the
  // parent clips horizontal overflow (matching the proven Community/League
  // outlets) so a mid-slide layer can't push a sideways scrollbar.
  return (
    <div className="relative overflow-x-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <SlideLayer key={transitionKey(nextPath)} direction={direction}>
          {outlet}
        </SlideLayer>
      </AnimatePresence>
    </div>
  );
}

/**
 * One animated route layer. While EXITING (framer's useIsPresent === false) it
 * is marked aria-hidden + inert so the outgoing screen can't take focus or be
 * read by a screen reader; pointer-events are disabled by the exit variant.
 * `inert` is set on the node directly because React 18 doesn't type it.
 */
function SlideLayer({ direction, children }: { direction: number; children: ReactNode }) {
  const isPresent = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isPresent) {
      el.removeAttribute("aria-hidden");
      el.removeAttribute("inert");
    } else {
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("inert", "");
    }
  }, [isPresent]);

  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={tabSlideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={SLIDE}
      style={{ willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}
