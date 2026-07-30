/**
 * PULSE motion system — one source of truth for timing, easing, and the
 * handful of framer-motion variants used across premium interaction
 * surfaces (League Play, the Round Robin wizard, …). Durations follow the
 * product's interaction spec:
 *
 *   press feedback      80–140 ms
 *   hover / focus       120–180 ms
 *   tab indicator       180–240 ms
 *   content transition  200–320 ms
 *   modal / drawer      220–350 ms
 *
 * Every consumer is expected to gate motion on `useReducedMotion()`
 * (framer) or Tailwind's `motion-safe:` / `motion-reduce:` variants, so
 * reduced-motion users get instant state changes instead of movement.
 *
 * These are transform/opacity-only by design — no width/height/top/left
 * animation — so nothing here can cause layout shift or jank.
 */

/** Seconds, for framer-motion `transition={{ duration }}`. */
export const DUR = {
  press: 0.12,
  hover: 0.15,
  tab: 0.2,
  content: 0.26,
  overlay: 0.28,
} as const;

/** iOS-ish cubic — decelerates hard, feels responsive and "sporty". */
export const EASE_OUT = [0.32, 0.72, 0, 1] as const;
/** Standard material in-out for symmetric enter/exit. */
export const EASE_INOUT = [0.4, 0, 0.2, 1] as const;

/** Spring used for sliding indicators (tabs, segmented control). */
export const INDICATOR_SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

/**
 * Directional content transition for keyed panels (tab bodies). `dir`
 * is +1 when moving forward/right, -1 backward/left, 0 for no direction
 * (first mount / reduced motion → pure fade). Movement is a restrained
 * ~10px so the header stays visually anchored.
 */
export const contentVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir === 0 ? 0 : dir > 0 ? 10 : -10,
  }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir === 0 ? 0 : dir > 0 ? -10 : 10,
  }),
};

/**
 * Shared "premium entrance" — a gentle staggered fade-up for a column of
 * sections/cards. Pair `staggerContainer` on the wrapper with `staggerItem`
 * on each child. Gate both behind a reduced-motion check at the call site
 * (pass no variants when reduced) so it fully collapses to a static render.
 */
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
};

/**
 * Full-screen directional route transition (deeper = in from the right).
 * Mirrors the proven Community outlet; percentages keep it resolution
 * independent and the parent clips overflow-x so nothing scrolls sideways.
 */
export const routeVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "100%" : dir < 0 ? "-8%" : 0,
    opacity: dir === 0 ? 1 : dir > 0 ? 0.6 : 0.85,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? "-8%" : dir < 0 ? "100%" : 0,
    opacity: dir === 0 ? 1 : dir > 0 ? 0.85 : 0.6,
  }),
};

/**
 * Tactile press/hover/focus classes for buttons and pressable surfaces.
 * Pure Tailwind so there's zero JS cost and `motion-safe:` fully removes
 * the movement for reduced-motion users. Transform-only ⇒ no layout shift.
 *
 *   • press  — compresses to 0.97 while active
 *   • hover  — the shared Button variants already handle color/shadow;
 *              this only adds the compression + a smooth transform ramp
 */
export const PRESSABLE =
  "motion-safe:transition-transform motion-safe:duration-100 motion-safe:active:scale-[0.97]";

/** Selection tiles / cards: gentler compression so large surfaces settle. */
export const PRESSABLE_CARD =
  "motion-safe:transition-transform motion-safe:duration-100 motion-safe:active:scale-[0.98]";
