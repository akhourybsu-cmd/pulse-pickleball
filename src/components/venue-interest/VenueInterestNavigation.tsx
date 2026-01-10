import { Button } from "@/components/ui/button";

interface VenueInterestNavigationProps {
  onContinue: () => void;
  onSkip?: () => void;
  isValid: boolean;
  isOptional: boolean;
  isLastStep: boolean;
  isContactStep: boolean;
  isLoading?: boolean;
}

export function VenueInterestNavigation({
  onContinue,
  onSkip,
  isValid,
  isOptional,
  isLastStep,
  isContactStep,
  isLoading,
}: VenueInterestNavigationProps) {
  if (isLastStep) {
    return null; // Confirmation step has its own navigation
  }

  const getButtonText = () => {
    if (isLoading) return "Submitting...";
    if (isContactStep) return "Get Started with Pulse";
    return "Continue";
  };

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
          {getButtonText()}
        </Button>
      </div>
    </div>
  );
}
