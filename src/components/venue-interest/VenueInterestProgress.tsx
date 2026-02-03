import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate, Link } from "react-router-dom";
import logo from "@/assets/pulse-logo-new.png";

interface VenueInterestProgressProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  canGoBack: boolean;
  showLogo?: boolean;
}

export function VenueInterestProgress({ 
  currentStep, 
  totalSteps, 
  onBack, 
  canGoBack,
  showLogo = true
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
    <div className="sticky top-0 z-10 bg-secondary border-b border-secondary-foreground/10">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            disabled={!canGoBack}
            className="h-8 w-8 text-white hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          {showLogo ? (
            <Link to="/">
              <img
                src={logo}
                alt="PULSE Logo"
                className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
          ) : (
            <span className="text-sm font-medium text-white/70">
              Step {displayCurrent} of {displayTotal}
            </span>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-8 w-8 text-white hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {showLogo && (
          <div className="text-center mb-2">
            <span className="text-xs font-medium text-white/60">
              Step {displayCurrent} of {displayTotal}
            </span>
          </div>
        )}
        
        <Progress value={progressPercent} className="h-1" />
      </div>
    </div>
  );
}
