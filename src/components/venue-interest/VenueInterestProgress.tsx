import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface VenueInterestProgressProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  canGoBack: boolean;
}

export function VenueInterestProgress({ 
  currentStep, 
  totalSteps, 
  onBack, 
  canGoBack 
}: VenueInterestProgressProps) {
  const navigate = useNavigate();
  // Exclude confirmation step from progress display
  const displayTotal = totalSteps - 1;
  const displayCurrent = Math.min(currentStep + 1, displayTotal);
  const progressPercent = (displayCurrent / displayTotal) * 100;

  const isConfirmation = currentStep === totalSteps - 1;

  if (isConfirmation) {
    return null;
  }

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
            Step {displayCurrent} of {displayTotal}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Progress value={progressPercent} className="h-1" />
      </div>
    </div>
  );
}
