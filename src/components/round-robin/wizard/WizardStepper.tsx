import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRESSABLE } from "@/lib/motion";

interface WizardStepperProps {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  /** md = compact (Schedule), lg = hero count (Players). */
  size?: "md" | "lg";
  decrementLabel?: string;
  incrementLabel?: string;
}

const SIZES = {
  md: { gap: "gap-5", btn: "h-12 w-12", icon: "h-5 w-5", num: "text-4xl w-16 h-12" },
  lg: { gap: "gap-6", btn: "h-14 w-14", icon: "h-6 w-6", num: "text-5xl w-20 h-14" },
};

/**
 * Circular −/+ stepper with a tactile press on each control and an
 * animated value that rolls up/down as it changes. The value sits in a
 * fixed-size box so the row never reflows, and reduced-motion users get
 * an instant swap. Shared across the wizard's Schedule + Players steps so
 * every counter feels the same.
 */
export function WizardStepper({
  value, onChange, min, max, size = "md",
  decrementLabel, incrementLabel,
}: WizardStepperProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size];
  return (
    <div className={cn("flex items-center justify-center", s.gap)}>
      <Button
        variant="outline"
        size="icon"
        className={cn(s.btn, "rounded-full", PRESSABLE)}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={decrementLabel}
      >
        <Minus className={s.icon} />
      </Button>

      <span className={cn("relative flex items-center justify-center", s.num)}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute font-bold tabular-nums"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>

      <Button
        variant="outline"
        size="icon"
        className={cn(s.btn, "rounded-full", PRESSABLE)}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={incrementLabel}
      >
        <Plus className={s.icon} />
      </Button>
    </div>
  );
}
