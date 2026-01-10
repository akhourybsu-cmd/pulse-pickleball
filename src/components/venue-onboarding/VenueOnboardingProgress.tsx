import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VenueOnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export const VenueOnboardingProgress = ({
  currentStep,
  totalSteps,
  labels = [],
}: VenueOnboardingProgressProps) => {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <div key={i} className="flex items-center flex-1">
              {/* Step circle */}
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  stepNumber
                )}
              </div>
              
              {/* Connector line */}
              {i < totalSteps - 1 && (
                <div 
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-colors",
                    stepNumber < currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Step labels */}
      {labels.length > 0 && (
        <div className="flex justify-between">
          {labels.map((label, i) => {
            const stepNumber = i + 1;
            const isCurrent = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            
            return (
              <span
                key={i}
                className={cn(
                  "text-xs text-center flex-1",
                  isCurrent && "text-primary font-medium",
                  isCompleted && "text-muted-foreground",
                  !isCurrent && !isCompleted && "text-muted-foreground"
                )}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
