import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GROUP_EVENT_STEPS } from "./groupFlow";

interface Props {
  currentStep: number;
  canVisit: (step: number) => boolean;
  onStepChange: (step: number) => void;
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void;
  isLoading: boolean;
  validationMessage: string | null;
  createError: string | null;
  returningToReview: boolean;
  children: ReactNode;
}

export function GroupEventWizardShell({
  currentStep,
  canVisit,
  onStepChange,
  onBack,
  onContinue,
  onClose,
  isLoading,
  validationMessage,
  createError,
  returningToReview,
  children,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const step = GROUP_EVENT_STEPS[currentStep];
  const review = currentStep === GROUP_EVENT_STEPS.length - 1;
  useEffect(() => {
    scrollArea.current?.scrollTo?.({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [currentStep]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              New community event
            </p>
            <h2
              ref={heading}
              tabIndex={-1}
              className="mt-1 text-xl font-semibold tracking-tight outline-none"
            >
              {step.label === "Basics"
                ? "Create an event"
                : step.label === "Schedule"
                  ? "Date, time & place"
                  : step.label === "Players"
                    ? "Player spots"
                    : "Review your event"}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={isLoading}
            onClick={onClose}
            aria-label="Close event creation"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav
          aria-label="Event creation steps"
          className="mt-4 grid grid-cols-4 gap-1"
        >
          {GROUP_EVENT_STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-current={index === currentStep ? "step" : undefined}
              disabled={isLoading || !canVisit(index)}
              onClick={() => onStepChange(index)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                index === currentStep
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground enabled:hover:bg-muted"
              )}
            >
              <span className="hidden sm:inline">{index + 1}.</span>
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div
        ref={scrollArea}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
        data-event-scroll
      >
        <fieldset disabled={isLoading} className="min-w-0 space-y-4">
          {children}
        </fieldset>
      </div>
      <footer className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        {createError && (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-destructive/25 p-2 text-sm text-destructive"
          >
            {createError}
          </p>
        )}
        {validationMessage && (
          <p role="status" className="mb-2 text-xs text-muted-foreground">
            {validationMessage}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={currentStep ? onBack : onClose}
            disabled={isLoading}
            className="h-11 gap-1.5"
          >
            {currentStep > 0 && <ArrowLeft className="h-4 w-4" />}
            {currentStep ? "Back" : "Cancel"}
          </Button>
          <Button
            onClick={onContinue}
            disabled={!!validationMessage || isLoading}
            className="h-11 gap-2 rounded-xl px-5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : review ? (
              <>
                <Check className="h-4 w-4" />
                Create event
              </>
            ) : (
              <>
                {returningToReview
                  ? "Return to review"
                  : currentStep === 2
                    ? "Review event"
                    : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
