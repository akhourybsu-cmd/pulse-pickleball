import { motion, useReducedMotion } from "framer-motion";
import { Check, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDICATOR_SPRING, PRESSABLE_CARD } from "@/lib/motion";
import {
  RESPONSE_KEYS,
  RESPONSE_LABELS,
  RESPONSE_DESCRIPTIONS,
  type ResponseKey,
} from "@/lib/skill/model";

/**
 * The shared ability-response selector. Renders the 7-point scale as an
 * accessible radiogroup with plain-language labels + descriptions — the
 * internal mastery numbers are NEVER shown. "Not sure" is set apart so it
 * reads as an acceptable answer, not a failure.
 */
export function ResponseScalePicker({
  value,
  onSelect,
}: {
  value: ResponseKey | null;
  onSelect: (key: ResponseKey) => void;
}) {
  const reduced = useReducedMotion();
  const scale = RESPONSE_KEYS.filter((k) => k !== "not_sure");

  return (
    <div role="radiogroup" aria-label="How reliably can you do this?" className="space-y-2">
      {scale.map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(key)}
            className={cn(
              "relative w-full text-left rounded-xl border p-3 pr-10 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
              PRESSABLE_CARD,
              active ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/40 hover:bg-muted/30",
            )}
          >
            <div className="text-sm font-semibold leading-tight">{RESPONSE_LABELS[key]}</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{RESPONSE_DESCRIPTIONS[key]}</div>
            {active && (
              <motion.span
                aria-hidden
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                transition={reduced ? { duration: 0 } : INDICATOR_SPRING}
                className="absolute top-1/2 right-3 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </motion.span>
            )}
          </button>
        );
      })}

      {/* "Not sure" — visually separated, explicitly acceptable. */}
      <button
        type="button"
        role="radio"
        aria-checked={value === "not_sure"}
        onClick={() => onSelect("not_sure")}
        className={cn(
          "relative w-full text-left rounded-xl border border-dashed p-3 pr-10 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
          PRESSABLE_CARD,
          value === "not_sure" ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <div className="text-sm font-semibold leading-tight inline-flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          {RESPONSE_LABELS.not_sure}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{RESPONSE_DESCRIPTIONS.not_sure}</div>
        {value === "not_sure" && (
          <span aria-hidden className="absolute top-1/2 right-3 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </button>
    </div>
  );
}
