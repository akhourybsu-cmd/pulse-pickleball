import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDICATOR_SPRING } from "@/lib/motion";

/**
 * Selected-state checkmark badge for wizard option cards. Absolutely
 * positioned (the parent must be `relative`) so showing it never changes
 * the card's size or nudges neighbours. Pops in with a spring, or appears
 * instantly under reduced motion.
 */
export function SelectionTick({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          aria-hidden
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0 } : INDICATOR_SPRING}
          className={cn(
            "absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm",
            className,
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
