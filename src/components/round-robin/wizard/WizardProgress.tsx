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
 * In-body wizard progress — mirrors the Record Match wizard:
 * a small "Step N of N" row with a back chevron on the left and progress
 * dots on the right. Sits inside the page body, below the PULSE header.
 */
export function WizardProgress({
  currentStep,
  totalSteps,
  onBack,
  canGoBack,
  stepLabel,
}: WizardProgressProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2 min-w-0">
        {canGoBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 flex-shrink-0"
            aria-label="Previous step"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="text-sm text-muted-foreground truncate">
          Step {currentStep + 1} of {totalSteps}
          {stepLabel ? ` · ${stepLabel}` : ""}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              index < currentStep
                ? "bg-primary"
                : index === currentStep
                ? "bg-primary w-4"
                : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
