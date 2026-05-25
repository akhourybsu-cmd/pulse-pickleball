import { ReactNode } from "react";
import { motion, Transition } from "framer-motion";

interface WizardCardProps {
  children: ReactNode;
  direction: number;
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 40 : -40,
    opacity: 0,
  }),
};

// Softer spring — smaller distance + faster settle for a snappy but smooth feel.
const transition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 34,
  mass: 0.7,
};

/**
 * Inner card wrapper for each wizard step.
 *
 * Visual upgrade from a flat single-color card to a subtle top-light gradient
 * with a soft elevation. The gradient is design-system-driven (uses --card and
 * --primary) so it adapts to both light and dark themes automatically.
 */
export function WizardCard({ children, direction }: WizardCardProps) {
  return (
    <motion.div
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
      className="w-full"
    >
      <div
        className="rounded-2xl border border-border/60 p-6 sm:p-7 min-h-[320px] flex flex-col shadow-[0_4px_20px_-4px_hsl(var(--foreground)/0.06)]"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card)) 70%, hsl(var(--primary) / 0.04) 100%)",
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}
