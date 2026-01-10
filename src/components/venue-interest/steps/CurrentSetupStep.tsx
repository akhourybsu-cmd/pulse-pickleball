import { FileSpreadsheet, Monitor, ClipboardList, Coffee, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrentSetupStepProps {
  value: string;
  onChange: (value: string) => void;
}

const SETUP_OPTIONS = [
  { id: "spreadsheets", label: "Spreadsheets", icon: FileSpreadsheet },
  { id: "courtreserve", label: "CourtReserve or similar", icon: Monitor },
  { id: "whiteboards", label: "Whiteboards / clipboards", icon: ClipboardList },
  { id: "informal", label: "Informal / nothing formal", icon: Coffee },
  { id: "multiple_tools", label: "Multiple tools", icon: Layers },
];

export function CurrentSetupStep({ value, onChange }: CurrentSetupStepProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">How do you currently manage play and events?</h2>
        <p className="text-muted-foreground">This helps us understand your needs</p>
      </div>

      <div className="flex-1 space-y-3">
        {SETUP_OPTIONS.map((option) => {
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
