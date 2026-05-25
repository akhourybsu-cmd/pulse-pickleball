import { Loader2, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WizardNavigationProps {
  onContinue: () => void;
  onSkip?: () => void;
  isValid: boolean;
  isOptional: boolean;
  isLastStep: boolean;
  isLoading?: boolean;
}

/**
 * Sticky bottom navigation for the wizard.
 *
 * Tighter visual presence (smaller container, subtle gradient lift) so the
 * focus stays on the step content above. Primary CTA is full-width to make
 * the action obvious; Skip (when applicable) is a subtle ghost button so
 * optional steps don't feel like dead-ends.
 */
export function WizardNavigation({
  onContinue,
  onSkip,
  isValid,
  isOptional,
  isLastStep,
  isLoading,
}: WizardNavigationProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/60 pb-[env(safe-area-inset-bottom)]"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--background) / 0.85) 0%, hsl(var(--background)) 30%)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="max-w-md mx-auto px-3 sm:px-4 py-3 flex items-center gap-2">
        {isOptional && onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip
          </Button>
        )}
        <Button
          onClick={onContinue}
          disabled={!isValid || isLoading}
          className="flex-1 gap-1.5 font-semibold"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating round robin…
            </>
          ) : isLastStep ? (
            <>
              <Check className="h-4 w-4" />
              Create Round Robin
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
