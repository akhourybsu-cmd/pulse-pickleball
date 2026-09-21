import { Loader2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WizardNavigationProps {
  onContinue: () => void;
  onBack: () => void;
  onSkip?: () => void;
  onReturnToReview?: () => void;
  isValid: boolean;
  isOptional: boolean;
  isLastStep: boolean;
  isLoading?: boolean;
  canGoBack: boolean;
  nextLabel?: string;
  hint?: string;
}

export function WizardNavigation({ onContinue, onBack, onSkip, onReturnToReview, isValid, isOptional, isLastStep, isLoading, canGoBack, nextLabel, hint }: WizardNavigationProps) {
  return <footer className="rr-navigation">
    <div className="rr-navigation-inner">
      <div className="rr-footer-caption"><span className="rr-eyebrow">{isLastStep ? "Ready when you are" : "Keep the momentum"}</span><p>{isLastStep ? "Your next great game starts here." : `Up next · ${nextLabel}`}</p></div>
      <div className="rr-footer-controls">
        {hint && !isValid && <p id="rr-step-hint" role="status" className="rr-validation-hint">{hint}</p>}
        <div className="flex w-full items-center gap-2 sm:gap-3">
          {canGoBack && <Button variant="outline" onClick={onBack} disabled={isLoading} className="rr-back-button h-12 rounded-xl px-3 sm:px-5"><ArrowLeft /><span>Back</span></Button>}
          {isOptional && onSkip && <Button variant="ghost" onClick={onSkip} disabled={isLoading} className="h-12 px-3">Skip</Button>}
          <Button onClick={onReturnToReview ?? onContinue} disabled={!isValid || isLoading}
            aria-describedby={!isValid && hint ? "rr-step-hint" : undefined}
            className="rr-continue group h-12 flex-1 gap-2 rounded-xl px-4 font-bold sm:min-w-52 sm:flex-none sm:px-6">
            {isLoading ? <><Loader2 className="h-4 w-4 motion-safe:animate-spin" />Creating event…</>
              : isLastStep ? <><Check />Create Round Robin</>
              : <>{onReturnToReview ? "Return to review" : "Continue"}<ArrowRight className="motion-safe:transition-transform motion-safe:group-hover:translate-x-1" /></>}
          </Button>
        </div>
      </div>
    </div>
  </footer>;
}
