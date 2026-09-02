import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventWizardNavProps {
  onContinue: () => void;
  onSkip?: () => void;
  isValid: boolean;
  isLastStep: boolean;
  isLoading?: boolean;
  showSkip?: boolean;
  finalLabel?: string;
  sticky?: boolean;
}

export function EventWizardNav({
  onContinue,
  onSkip,
  isValid,
  isLastStep,
  isLoading,
  showSkip,
  finalLabel = 'Create Event',
  sticky = false,
}: EventWizardNavProps) {
  return (
    <div className={cn(
      'mt-4 flex items-center justify-end gap-2 border-t border-border/50 pt-3',
      sticky && '-mx-4 -mb-4 sticky bottom-0 z-20 bg-background/95 px-4 pb-4 backdrop-blur-xl',
    )}>
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
          finalLabel
        ) : (
          'Continue'
        )}
      </Button>
    </div>
  );
}
