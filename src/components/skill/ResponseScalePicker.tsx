import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDICATOR_SPRING } from "@/lib/motion";
import {
  RESPONSE_KEYS,
  RESPONSE_LABELS,
  type ResponseKey,
} from "@/lib/skill/model";

/**
 * The shared ability-response selector — a 7-point scale rendered as an
 * accessible radiogroup. Deliberately COMPACT: each option is a single row so
 * the whole question + all options fit one mobile viewport without scrolling.
 * A short one-line hint carries the meaning of each level (the % ranges),
 * while the internal mastery numbers are never shown. "Not sure" is set apart
 * so it reads as an acceptable answer, not a failure.
 */

// One-line, glanceable hints (the descriptive % ranges live in
// RESPONSE_DESCRIPTIONS; these are their compact display form).
const RESPONSE_HINT: Record<ResponseKey, string> = {
  not_yet: "Can't do it yet",
  drill_only: "Only in practice",
  occasionally: "Under 30% of the time",
  sometimes: "About 30–59%",
  usually: "About 60–79%",
  reliably: "80%+, even under pressure",
  not_sure: "Not enough reps to say",
};

export function ResponseScalePicker({
  value,
  onSelect,
}: {
  value: ResponseKey | null;
  onSelect: (key: ResponseKey) => void;
}) {
  const reduced = useReducedMotion();
  const scale = RESPONSE_KEYS.filter((k) => k !== "not_sure");

  const Row = ({ optionKey, dashed }: { optionKey: ResponseKey; dashed?: boolean }) => {
    const active = value === optionKey;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={`${RESPONSE_LABELS[optionKey]} — ${RESPONSE_HINT[optionKey]}`}
        onClick={() => onSelect(optionKey)}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-xl border py-2.5 pl-3.5 pr-10 text-left",
          "transition-[background-color,border-color,transform] duration-150 active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
          dashed && !active && "border-dashed",
          active
            ? "border-primary bg-primary/8 shadow-[0_1px_0_hsl(var(--primary)/0.15)]"
            : "border-border/70 hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <span className={cn("text-sm font-semibold leading-none shrink-0", active && "text-primary")}>
          {RESPONSE_LABELS[optionKey]}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] leading-none text-muted-foreground">
          {RESPONSE_HINT[optionKey]}
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full transition-opacity",
            active ? "opacity-100" : "opacity-0",
          )}
        >
          {active ? (
            <motion.span
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={reduced ? { duration: 0 } : INDICATOR_SPRING}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </motion.span>
          ) : null}
        </span>
      </button>
    );
  };

  return (
    <div role="radiogroup" aria-label="How reliably can you do this?" className="space-y-1.5">
      {scale.map((key) => (
        <Row key={key} optionKey={key} />
      ))}
      <div className="pt-1">
        <Row optionKey="not_sure" dashed />
      </div>
    </div>
  );
}
