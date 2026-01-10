import { CalendarDays, Calendar, CalendarCheck, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventVolumeStepProps {
  value: string;
  onChange: (value: string) => void;
}

const VOLUME_OPTIONS = [
  { id: "occasionally", label: "Occasionally", icon: CalendarDays },
  { id: "monthly", label: "Monthly", icon: Calendar },
  { id: "weekly", label: "Weekly", icon: CalendarCheck },
  { id: "multiple_weekly", label: "Multiple times per week", icon: CalendarClock },
];

export function EventVolumeStep({ value, onChange }: EventVolumeStepProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">How often do you host pickleball events or organized play?</h2>
        <p className="text-muted-foreground">This is optional — skip if you're not sure yet</p>
      </div>

      <div className="flex-1 space-y-3">
        {VOLUME_OPTIONS.map((option) => {
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
