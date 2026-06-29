import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  canGoBack: boolean;
  /** Friendly label of the current step (e.g., "Players"). */
  stepLabel?: string;
}

/**
 * In-body wizard progress.
 *
 * Visual overhaul:
 *   • Bigger, more confident "Step N · Label" treatment with the step
 *     number rendered as a primary-tinted chip — easier to read across
 *     a 13-step wizard than a quiet "Step 4 of 13" sentence.
 *   • Continuous progress bar instead of a row of dots — dots at 13
 *     steps were too small to track. The bar plus the explicit number
 *     give two ways to read where you are.
 *   • Back chevron is now part of a tighter row so the whole thing
 *     reads as one element.
 */
export function WizardProgress({
  currentStep,
  totalSteps,
  onBack,
  canGoBack,
  stepLabel,
}: WizardProgressProps) {
  // 1-based display, clamped so the bar fills at the final step.
  const oneBased = currentStep + 1;
  const pct = Math.min(100, Math.max(0, ((currentStep + 1) / totalSteps) * 100));

  return (
    <div className="mb-6 space-y-2.5">
      {/* Top row — back chevron + step count chip + step label */}
      <div className="flex items-center gap-2 min-w-0">
        {canGoBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 flex-shrink-0 -ml-2"
            aria-label="Previous step"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : (
          // Keep horizontal alignment stable when back is unavailable —
          // first-step wizards otherwise pop sideways.
          <div className="h-8 w-2 flex-shrink-0" aria-hidden />
        )}

        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 text-primary px-2.5 py-0.5 text-[11px] font-semibold tabular-nums flex-shrink-0"
          aria-label={`Step ${oneBased} of ${totalSteps}`}
        >
          {oneBased}
          <span className="text-primary/60">/ {totalSteps}</span>
        </span>

        {stepLabel && (
          <span className="text-sm font-medium text-foreground/85 truncate">
            {stepLabel}
          </span>
        )}
      </div>

      {/* Progress bar — continuous fill, easier to read than dots at
          13-step density. */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
