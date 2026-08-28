import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

/**
 * Touch-first numeric stepper used by every Round Robin settings surface.
 *
 * Buttons are 44px on mobile (Apple/Android minimum touch target) and the
 * value is large + tabular so it reads at a glance while standing courtside.
 * Replaces raw `<input type="number">` spinners, which are near-impossible
 * to hit on a phone.
 */
export function NumericStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  icon: Icon,
  label,
  suffix,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">{label}</div>
            <div className="text-[11px] text-muted-foreground leading-snug">{suffix}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full active:scale-95 transition-transform"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            aria-label={`Decrease ${label}`}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span
            aria-live="polite"
            className="min-w-[2.5rem] text-center text-2xl font-bold tabular-nums leading-none"
          >
            {value}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full active:scale-95 transition-transform"
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            aria-label={`Increase ${label}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
