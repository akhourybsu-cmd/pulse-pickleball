import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  canGoBack: boolean;
}

export function WizardProgress({ currentStep, totalSteps, onBack, canGoBack }: WizardProgressProps) {
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="sticky top-0 z-10 bg-background border-b">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            disabled={!canGoBack}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <div className="w-8" /> {/* Spacer for alignment */}
        </div>
        <Progress value={progressPercent} className="h-1" />
      </div>
    </div>
  );
}
