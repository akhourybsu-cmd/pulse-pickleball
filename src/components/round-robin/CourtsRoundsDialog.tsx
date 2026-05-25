import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Grid3x3, Gamepad2, Minus, Plus, RotateCcw } from "lucide-react";
import { suggestRounds } from "@/lib/roundRobinFairness";
import { cn } from "@/lib/utils";

/**
 * Inline numeric stepper — matches the wizard ScheduleStep pattern so the
 * organizer sees a consistent control everywhere they pick a count.
 */
function NumericStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  icon: Icon,
  label,
  suffix,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight">{label}</div>
            <div className="text-xs text-muted-foreground leading-tight">{suffix}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            aria-label={`Decrease ${label}`}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className={cn(
            "min-w-[2.5rem] text-center text-2xl font-bold tabular-nums leading-none",
          )}>
            {value}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            aria-label={`Increase ${label}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CourtsRoundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCourts: number;
  currentGamesPerPlayer: number;
  currentRound: number | null;
  hasScores: boolean;
  totalPlayers: number;
  onUpdateCourts: (newCourts: number) => Promise<void>;
  onUpdateGamesPerPlayer: (newGamesPerPlayer: number) => Promise<void>;
}



export function CourtsRoundsDialog({
  open,
  onOpenChange,
  currentCourts,
  currentGamesPerPlayer,
  currentRound,
  hasScores,
  totalPlayers,
  onUpdateCourts,
  onUpdateGamesPerPlayer,
}: CourtsRoundsDialogProps) {
  const [newCourts, setNewCourts] = useState(currentCourts);
  const [newGamesPerPlayer, setNewGamesPerPlayer] = useState(currentGamesPerPlayer);
  const [loading, setLoading] = useState(false);

  // Calculate rounds based on courts and games per player
  const calculatedRounds = suggestRounds(totalPlayers, newCourts, newGamesPerPlayer);

  const handleUpdate = async () => {
    const courtsChanged = newCourts !== currentCourts;
    const gamesChanged = newGamesPerPlayer !== currentGamesPerPlayer;
    
    if (!courtsChanged && !gamesChanged) return;
    
    setLoading(true);
    try {
      if (courtsChanged) {
        await onUpdateCourts(newCourts);
      }
      if (gamesChanged) {
        await onUpdateGamesPerPlayer(newGamesPerPlayer);
      }
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewCourts(currentCourts);
    setNewGamesPerPlayer(currentGamesPerPlayer);
    onOpenChange(false);
  };

  const hasChanges = newCourts !== currentCourts || newGamesPerPlayer !== currentGamesPerPlayer;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Courts &amp; Games</DialogTitle>
          <DialogDescription>
            Rounds recalculate automatically when either setting changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <NumericStepper
            value={newCourts}
            onChange={setNewCourts}
            min={1}
            max={20}
            icon={Grid3x3}
            label="Courts available"
            suffix="Simultaneous matches per round"
          />
          <NumericStepper
            value={newGamesPerPlayer}
            onChange={setNewGamesPerPlayer}
            min={1}
            max={20}
            icon={Gamepad2}
            label="Games per player"
            suffix="Total matches each player gets"
          />

          {/* Calculated-rounds preview — visually weighted as the outcome of
              the two inputs above. Primary-tinted background, large numeric. */}
          <div
            className="rounded-xl border border-primary/20 p-4"
            style={{ backgroundColor: "hsl(var(--primary) / 0.05)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Schedule preview
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {newCourts} {newCourts === 1 ? "court" : "courts"} ·{" "}
                  {newGamesPerPlayer} {newGamesPerPlayer === 1 ? "game" : "games"} ·{" "}
                  {totalPlayers} players
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-3xl font-bold text-primary tabular-nums leading-none">
                  {calculatedRounds}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {calculatedRounds === 1 ? "round" : "rounds"}
                </div>
              </div>
            </div>
          </div>

          {hasChanges && hasScores && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <strong>Warning:</strong> This event has scored matches. Changing these settings
                will regenerate the schedule and may affect scheduled matches.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={!hasChanges || newCourts < 1 || newGamesPerPlayer < 1 || loading}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            {loading ? "Updating…" : "Apply Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
