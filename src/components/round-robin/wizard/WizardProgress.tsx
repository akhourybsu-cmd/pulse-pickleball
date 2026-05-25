import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  canGoBack: boolean;
  /** Friendly label of the current step (e.g., "Players"). Shown center-screen
   *  so the player always knows what they're doing without the chrome shouting. */
  stepLabel?: string;
  closeDestination?: string;
}

/**
 * Wizard top chrome — single sticky header strip.
 *
 * Replaces the previous double-row layout (logo row + centered "Step N of N"
 * sub-row + progress bar). Now: one row with back/title-progress/close, plus
 * a thin progress bar at the bottom edge. Cleaner, premium, and works
 * identically across all 8 steps.
 */
export function WizardProgress({
  currentStep,
  totalSteps,
  onBack,
  canGoBack,
  stepLabel,
  closeDestination = "/player/dashboard",
}: WizardProgressProps) {
  const navigate = useNavigate();
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="sticky top-0 z-20 bg-secondary border-b border-secondary-foreground/10 shadow-sm">
      <div className="max-w-md mx-auto px-3 sm:px-4 py-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          disabled={!canGoBack}
          className="h-9 w-9 text-white hover:text-white hover:bg-white/10 disabled:opacity-30 flex-shrink-0"
          aria-label="Previous step"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Centered title block — step number + step name */}
        <div className="flex-1 min-w-0 flex flex-col items-center text-center">
          <span className="text-[11px] font-medium text-white/60 leading-tight tracking-wide uppercase">
            Step {currentStep + 1} of {totalSteps}
          </span>
          {stepLabel && (
            <span className="text-sm font-semibold text-white leading-tight truncate max-w-full">
              {stepLabel}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(closeDestination)}
          className="h-9 w-9 text-white hover:text-white hover:bg-white/10 flex-shrink-0"
          aria-label="Close wizard"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Thin progress bar — flush with the header bottom, no padding around it */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
