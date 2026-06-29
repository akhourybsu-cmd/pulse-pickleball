import { useState } from "react";
import { Minus, Plus, Zap, Target, Trophy, Settings, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepHeader } from "../StepHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ScheduleStepProps {
  courtCount: number;
  onCourtCountChange: (v: number) => void;
  gamesPerPlayer: number;
  onGamesPerPlayerChange: (v: number) => void;
}

const gamesPresets = [
  { id: 2, label: "Quick", description: "2 games", icon: Zap },
  { id: 3, label: "Standard", description: "3 games", icon: Target },
  { id: 4, label: "Extended", description: "4 games", icon: Trophy },
];

/**
 * Consolidated "Schedule" step — combines the previous Courts and Games
 * screens. Both fields drive schedule generation (capacity + total games),
 * so showing them together gives the organizer a coherent view of "how the
 * play happens" rather than two minimally-different numeric screens.
 */
export function ScheduleStep({
  courtCount,
  onCourtCountChange,
  gamesPerPlayer,
  onGamesPerPlayerChange,
}: ScheduleStepProps) {
  const [showCustomGames, setShowCustomGames] = useState(
    !gamesPresets.some((p) => p.id === gamesPerPlayer)
  );

  const handleGamesPreset = (n: number) => {
    setShowCustomGames(false);
    onGamesPerPlayerChange(n);
  };

  const handleCustomClick = () => {
    setShowCustomGames(true);
    if (!gamesPerPlayer || gamesPerPlayer < 1) onGamesPerPlayerChange(5);
  };

  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={CalendarDays}
        title="Schedule setup"
        description="Courts you have, and games each player gets."
      />

      <div className="flex-1 space-y-7">
        {/* Courts stepper */}
        <div>
          <label className="text-sm font-medium mb-3 block">
            Courts available
          </label>
          <div className="flex items-center justify-center gap-5">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => onCourtCountChange(Math.max(1, courtCount - 1))}
              disabled={courtCount <= 1}
              aria-label="Decrease court count"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <span className="text-4xl font-bold tabular-nums w-16 text-center">
              {courtCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => onCourtCountChange(Math.min(20, courtCount + 1))}
              disabled={courtCount >= 20}
              aria-label="Increase court count"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            More courts = more simultaneous games
          </p>
        </div>

        {/* Games per player */}
        <div>
          <label className="text-sm font-medium mb-3 block">
            Games per player
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {gamesPresets.map((preset) => {
              const Icon = preset.icon;
              const active = gamesPerPlayer === preset.id && !showCustomGames;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleGamesPreset(preset.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div
                    className={cn(
                      "p-1.5 rounded-lg",
                      active ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight">
                      {preset.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleCustomClick}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all",
                showCustomGames
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-lg",
                  showCustomGames
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <Settings className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">Custom</p>
                <p className="text-xs text-muted-foreground">Choose any</p>
              </div>
            </button>
          </div>

          {showCustomGames && (
            <Select
              value={gamesPerPlayer.toString()}
              onValueChange={(v) => onGamesPerPlayerChange(parseInt(v))}
            >
              <SelectTrigger className="h-12 mt-3">
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
    </div>
  );
}
