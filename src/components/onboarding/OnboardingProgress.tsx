import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export const OnboardingProgress = ({
  currentStep,
  totalSteps,
  labels = ['Profile', 'How it works', 'Ready']
}: OnboardingProgressProps) => {
  return (
    <div className="w-full">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <div
              key={index}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                isComplete && "bg-primary",
                isCurrent && "bg-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
                !isComplete && !isCurrent && "bg-muted-foreground/30"
              )}
            />
          );
        })}
      </div>
      
      {/* Step label */}
      <p className="text-xs text-muted-foreground text-center">
        Step {currentStep + 1} of {totalSteps}
        {labels[currentStep] && ` — ${labels[currentStep]}`}
      </p>
    </div>
  );
};

interface OnboardingChecklistProps {
  items: {
    label: string;
    completed: boolean;
    current?: boolean;
  }[];
}

export const OnboardingChecklist = ({ items }: OnboardingChecklistProps) => {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div 
          key={index}
          className={cn(
            "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
            item.current && "bg-primary/10",
            item.completed && "text-muted-foreground"
          )}
        >
          <div className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-xs border-2 transition-all",
            item.completed && "bg-primary border-primary text-primary-foreground",
            item.current && !item.completed && "border-primary text-primary",
            !item.completed && !item.current && "border-muted-foreground/40 text-muted-foreground/40"
          )}>
            {item.completed ? (
              <Check className="w-3 h-3" />
            ) : (
              <span>{index + 1}</span>
            )}
          </div>
          <span className={cn(
            "text-sm font-medium",
            item.completed && "line-through",
            item.current && "text-foreground"
          )}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};
