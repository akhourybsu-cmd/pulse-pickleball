import { Users, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormatStepProps {
  value: "open" | "mixed" | "male" | "female";
  onChange: (value: "open" | "mixed" | "male" | "female") => void;
}

const formats = [
  {
    id: "open" as const,
    label: "Open",
    description: "No gender requirement",
    icon: Users,
  },
  {
    id: "mixed" as const,
    label: "Mixed",
    description: "1 male + 1 female per team",
    icon: Users,
  },
  {
    id: "male" as const,
    label: "Men's",
    description: "Male players only",
    icon: UserRound,
  },
  {
    id: "female" as const,
    label: "Women's",
    description: "Female players only",
    icon: UserRound,
  },
];

export function FormatStep({ value, onChange }: FormatStepProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Format</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Select the format for your Round Robin
      </p>

      <div className="flex-1 grid grid-cols-2 gap-3">
        {formats.map((format) => {
          const Icon = format.icon;
          return (
            <button
              key={format.id}
              type="button"
              onClick={() => onChange(format.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 text-center transition-all",
                value === format.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-lg",
                  value === format.id ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{format.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {value !== "open" && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-4">
          ⚠ Players must have their gender set in their profile
        </p>
      )}
    </div>
  );
}
