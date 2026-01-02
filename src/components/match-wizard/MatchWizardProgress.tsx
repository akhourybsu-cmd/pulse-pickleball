import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardStep } from "./hooks/useMatchWizardSteps";

interface MatchWizardProgressProps {
  steps: WizardStep[];
  currentStepIndex: number;
  onBack: () => void;
  canGoBack: boolean;
}

export function MatchWizardProgress({
  steps,
  currentStepIndex,
  onBack,
  canGoBack,
}: MatchWizardProgressProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        {canGoBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="text-sm text-muted-foreground">
          Step {currentStepIndex + 1} of {steps.length}
        </div>
      </div>
      
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              index < currentStepIndex
                ? 'bg-primary'
                : index === currentStepIndex
                ? 'bg-primary w-4'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
