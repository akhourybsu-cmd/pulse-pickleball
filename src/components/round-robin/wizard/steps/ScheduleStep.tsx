import { useState } from "react";
import { Zap, Target, Trophy, Settings, CalendarDays } from "lucide-react";
import { StepHeader } from "../StepHeader";
import { SelectionTick } from "../SelectionTick";
import { WizardStepper } from "../WizardStepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PRESSABLE_CARD } from "@/lib/motion";
import { ScheduleImpactPreview } from "@/components/round-robin/ScheduleImpactPreview";
import {
  planCreationSchedulePreview,
  type CreationPreviewParticipant,
} from "@/lib/roundRobin/creationSchedulePreview";
import type { EventFormat } from "@/lib/roundRobin/scheduleCore";

interface ScheduleStepProps {
  playerCount: number;
  courtCount: number;
  onCourtCountChange: (v: number) => void;
  gamesPerPlayer: number;
  onGamesPerPlayerChange: (v: number) => void;
  format: EventFormat;
  selectedPlayers: CreationPreviewParticipant[];
  rosterCompositionKnown: boolean;
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
  playerCount,
  courtCount,
  onCourtCountChange,
  gamesPerPlayer,
  onGamesPerPlayerChange,
  format,
  selectedPlayers,
  rosterCompositionKnown,
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

  const creationPlan = rosterCompositionKnown
    ? planCreationSchedulePreview({
        participants: selectedPlayers,
        numCourts: courtCount,
        gamesPerPlayer,
        format,
      })
    : null;

  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={CalendarDays}
        title="Schedule setup"
        description="Every change previews the new rotation instantly."
      />

      <div className="flex-1 space-y-6">
        {/* Courts stepper */}
        <div>
          <label className="text-sm font-medium mb-3 block">
            Courts available
          </label>
          <WizardStepper
            value={courtCount}
            onChange={onCourtCountChange}
            min={1}
            max={20}
            size="md"
            decrementLabel="Decrease court count"
            incrementLabel="Increase court count"
          />
          <p className="text-xs text-muted-foreground text-center mt-2">
            The scheduler uses every court your roster can fill
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
                  aria-pressed={active}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 text-center transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                    PRESSABLE_CARD,
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <SelectionTick active={active} />
                  <div
                    className={cn(
                      "p-1.5 rounded-lg motion-safe:transition-colors",
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
              aria-pressed={showCustomGames}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                PRESSABLE_CARD,
                showCustomGames
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <SelectionTick active={showCustomGames} />
              <div
                className={cn(
                  "p-1.5 rounded-lg motion-safe:transition-colors",
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

        <ScheduleImpactPreview
          playerCount={playerCount}
          courtCount={courtCount}
          gamesPerPlayer={gamesPerPlayer}
          title="Live schedule preview"
          compact
          plan={creationPlan}
          mixedRosterEstimate={format === "mixed" && !rosterCompositionKnown}
          showImpactSummary={false}
        />
      </div>
    </div>
  );
}
