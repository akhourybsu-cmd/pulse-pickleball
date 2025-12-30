import { useState } from "react";
import { Zap, Target, Trophy, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GamesStepProps {
  value: number;
  onChange: (value: number) => void;
}

const presets = [
  { id: 2, label: "Quick", description: "2 games", icon: Zap },
  { id: 3, label: "Standard", description: "3 games", icon: Target },
  { id: 4, label: "Extended", description: "4 games", icon: Trophy },
];

export function GamesStep({ value, onChange }: GamesStepProps) {
  const [showCustom, setShowCustom] = useState(!presets.some((p) => p.id === value));

  const handlePresetClick = (preset: number) => {
    setShowCustom(false);
    onChange(preset);
  };

  const handleCustomClick = () => {
    setShowCustom(true);
    if (!value || value < 1) onChange(5);
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">How much play time?</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Games each player will participate in
      </p>

      <div className="flex-1">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {presets.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 text-center transition-all",
                  value === preset.id && !showCustom
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    value === preset.id && !showCustom
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{preset.label}</p>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleCustomClick}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 text-center transition-all",
              showCustom
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-lg",
                showCustom ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Custom</p>
              <p className="text-xs text-muted-foreground">Choose any</p>
            </div>
          </button>
        </div>

        {showCustom && (
          <Select value={value.toString()} onValueChange={(v) => onChange(parseInt(v))}>
            <SelectTrigger className="h-14">
              <SelectValue placeholder="Select games per player" />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} {num === 1 ? "game" : "games"} per player
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
