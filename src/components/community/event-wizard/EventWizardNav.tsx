import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface EventWizardNavProps {
  onContinue: () => void;
  onSkip?: () => void;
  isValid: boolean;
  isLastStep: boolean;
  isLoading?: boolean;
  showSkip?: boolean;
}

export function EventWizardNav({
  onContinue,
  onSkip,
  isValid,
  isLastStep,
  isLoading,
  showSkip,
}: EventWizardNavProps) {
  return (
    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/50">
      {showSkip && onSkip && (
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
      )}
      <Button
        onClick={onContinue}
        disabled={!isValid || isLoading}
        size="sm"
        className="min-w-[100px]"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isLastStep ? (
          'Create Event'
        ) : (
          'Continue'
        )}
      </Button>
    </div>
  );
}
