import { Search, Scale, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStepProps {
  value: string;
  onChange: (value: string) => void;
}

const TIMELINE_OPTIONS = [
  { id: "exploring", label: "Just exploring", icon: Search },
  { id: "evaluating", label: "Actively evaluating options", icon: Scale },
  { id: "ready", label: "Ready to get started soon", icon: Rocket },
];

export function TimelineStep({ value, onChange }: TimelineStepProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">What best describes your timeline?</h2>
        <p className="text-muted-foreground">No pressure — we're here when you're ready</p>
      </div>

      <div className="flex-1 space-y-3">
        {TIMELINE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all w-full",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-lg",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
