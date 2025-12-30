import { Button } from "@/components/ui/button";

interface WizardNavigationProps {
  onContinue: () => void;
  onSkip?: () => void;
  isValid: boolean;
  isOptional: boolean;
  isLastStep: boolean;
  isLoading?: boolean;
}

export function WizardNavigation({
  onContinue,
  onSkip,
  isValid,
  isOptional,
  isLastStep,
  isLoading,
}: WizardNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-inset-bottom">
      <div className="max-w-md mx-auto flex items-center gap-3">
        {isOptional && onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            className="flex-shrink-0"
          >
            Skip
          </Button>
        )}
        <Button
          onClick={onContinue}
          disabled={!isValid || isLoading}
          className="flex-1"
        >
          {isLoading ? "Creating..." : isLastStep ? "Create Round Robin" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
