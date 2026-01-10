import { Calendar, Users, Sparkles, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrimaryGoalStepProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const GOALS = [
  { id: "hosting_events", label: "Hosting events & tournaments", icon: Calendar },
  { id: "round_robins", label: "Running round robins / open play", icon: Users },
  { id: "venue_presence", label: "Creating a branded venue presence", icon: Sparkles },
  { id: "community", label: "Growing our pickleball community", icon: TrendingUp },
  { id: "all", label: "All of the above", icon: CheckCircle2 },
];

export function PrimaryGoalStep({ value, onChange }: PrimaryGoalStepProps) {
  const handleSelect = (goalId: string) => {
    if (goalId === "all") {
      // If "All" is selected, toggle between all options and empty
      if (value.includes("all")) {
        onChange([]);
      } else {
        onChange(GOALS.map((g) => g.id));
      }
      return;
    }

    // Regular multi-select behavior
    let newValue: string[];
    if (value.includes(goalId)) {
      newValue = value.filter((v) => v !== goalId && v !== "all");
    } else {
      newValue = [...value.filter((v) => v !== "all"), goalId];
      // If all individual options are selected, add "all"
      const individualGoals = GOALS.filter((g) => g.id !== "all").map((g) => g.id);
      if (individualGoals.every((g) => newValue.includes(g))) {
        newValue = [...newValue, "all"];
      }
    }
    onChange(newValue);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">What are you most interested in using Pulse for?</h2>
        <p className="text-muted-foreground">Select all that apply</p>
      </div>

      <div className="flex-1 space-y-3">
        {GOALS.map((goal) => {
          const Icon = goal.icon;
          const isSelected = value.includes(goal.id);

          return (
            <button
              key={goal.id}
              onClick={() => handleSelect(goal.id)}
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
              <span className="font-medium">{goal.label}</span>
              {isSelected && (
                <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
