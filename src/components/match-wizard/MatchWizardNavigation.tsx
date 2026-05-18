import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface MatchWizardNavigationProps {
  onContinue: () => void;
  isValid: boolean;
  isLoading?: boolean;
  isLastStep: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
}

export function MatchWizardNavigation({
  onContinue,
  isValid,
  isLoading = false,
  isLastStep,
  showSkip = false,
  onSkip,
}: MatchWizardNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t safe-area-bottom z-50">
      <div className="max-w-lg mx-auto flex gap-3">
        {showSkip && onSkip && (
          <Button
            variant="outline"
            onClick={onSkip}
            className="flex-1"
            disabled={isLoading}
          >
            Skip
          </Button>
        )}
        <Button
          onClick={onContinue}
          disabled={!isValid || isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isLastStep ? 'Submitting...' : 'Loading...'}
            </>
          ) : (
            isLastStep ? 'Submit Match' : 'Continue'
          )}
        </Button>
      </div>
    </div>
  );
}
