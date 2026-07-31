import { useEffect, useRef, type ReactNode } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
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
 * The header, FAB, and bottom nav live ABOVE this component in PlayerShell —
 * only the region between them moves.
 */
export function ShellContentTransition({ immersive }: { immersive: boolean }) {
  const location = useLocation();
  const navType = useNavigationType();
  const reduced = useReducedMotion();
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
  if (reduced) return <Outlet />;

  const toKind = shellRouteKind(nextPath);
  const delegated =
    toKind === "league" ||
    toKind === "community-inner" ||
    toKind === "immersive" ||
    toKind === "other";

  if (delegated) {
    // Owned by an outlet or an immersive shell. Preserve the prior fade —
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
        <Outlet />
      </motion.div>
    );
  }

  // Primary tabs + detail routes share one AnimatePresence. `direction` is 0
  // for within-tab / first-render changes (same key ⇒ no animation anyway),
  // ±1 for a real lateral slide or forward/back push. The restrained 28%
  // opaque translate keeps the viewport fully covered (no gap flash); the
  // parent clips horizontal overflow only, so vertical scroll + sticky work.
  return (
    <div className="relative overflow-x-clip">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={transitionKey(nextPath)}
          custom={direction}
          variants={tabSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={SLIDE}
          style={{ willChange: "transform" }}
        >
          <AnimatedLayer>
            <Outlet />
          </AnimatedLayer>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Wraps the animated route content and, while its layer is EXITING (framer's
 * useIsPresent === false), marks it aria-hidden + inert + non-interactive so
 * the outgoing screen can't take focus, be announced by a screen reader, or
 * intercept taps meant for the incoming screen. `inert` is set on the node
 * directly because React 18 doesn't type the attribute.
 */
function AnimatedLayer({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isPresent) {
      el.removeAttribute("aria-hidden");
      el.removeAttribute("inert");
      el.style.pointerEvents = "";
    } else {
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("inert", "");
      el.style.pointerEvents = "none";
    }
  }, [isPresent]);

  return <div ref={ref}>{children}</div>;
}
