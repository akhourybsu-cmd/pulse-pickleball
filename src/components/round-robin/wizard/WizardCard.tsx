import { ReactNode, useEffect, useRef } from "react";
import { motion, Variants, useReducedMotion } from "framer-motion";
import { DUR, EASE_OUT } from "@/lib/motion";

interface WizardCardProps {
  children: ReactNode;
  direction: number;
}

const variants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 8 : -8,
    scale: 0.995,
    opacity: 0,
  }),
  center: {
    x: 0,
    scale: 1,
    opacity: 1,
    transition: { duration: DUR.content, ease: EASE_OUT },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 8 : -8,
    scale: 0.998,
    opacity: 0,
    transition: { duration: DUR.press, ease: EASE_OUT },
  }),
};

// Reduced-motion users get a short cross-fade without movement or a glow pulse.
const reducedVariants = {
  enter: { x: 0, scale: 1, opacity: 0 },
  center: { x: 0, scale: 1, opacity: 1 },
  exit: { x: 0, scale: 1, opacity: 0 },
};

/** Each keyed step settles in with a brief PULSE gold border beat. */
export function WizardCard({ children, direction }: WizardCardProps) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = cardRef.current?.closest(".rr-step-viewport");
    viewport?.scrollTo({ top: 0, behavior: "instant" });
    cardRef.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, []);
  return (
    <motion.div
      custom={direction}
      variants={reduced ? reducedVariants : variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: DUR.press }}
      className="rr-step-motion w-full"
    >
      <div ref={cardRef} className="rr-step-card">
        {children}
      </div>
    </motion.div>
  );
}
