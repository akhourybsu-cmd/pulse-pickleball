import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EVENT_WIZARD_STEPS } from './types';

interface EventWizardProgressProps {
  currentStep: number;
  onBack: () => void;
  onClose: () => void;
  canGoBack: boolean;
}

export function EventWizardProgress({ currentStep, onBack, onClose, canGoBack }: EventWizardProgressProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {canGoBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {EVENT_WIZARD_STEPS.length}
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {EVENT_WIZARD_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                idx === currentStep
                  ? 'bg-primary'
                  : idx < currentStep
                  ? 'bg-primary/50'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
