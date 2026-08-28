import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Grid3x3, Gamepad2, RotateCcw } from "lucide-react";
import { suggestRounds } from "@/lib/roundRobinFairness";
import { NumericStepper } from "./NumericStepper";
import { ResponsiveSettingsModal, ModalActions } from "./ResponsiveSettingsModal";

interface CourtsRoundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCourts: number;
  currentGamesPerPlayer: number;
  currentRound: number | null;
  hasScores: boolean;
  totalPlayers: number;
  onUpdateCourts: (newCourts: number) => Promise<void>;
  onUpdateGamesPerPlayer: (newGamesPerPlayer: number, courtsOverride?: number) => Promise<void>;
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

  // Re-sync when the dialog is reopened — the event may have changed courts
  // since this component first mounted (useState initial values are sticky).
  useEffect(() => {
    if (open) {
      setNewCourts(currentCourts);
      setNewGamesPerPlayer(currentGamesPerPlayer);
    }
  }, [open, currentCourts, currentGamesPerPlayer]);

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
        // Pass the new court count through: the parent's `event` state is still
        // the pre-update copy when both settings change in one apply.
        await onUpdateGamesPerPlayer(newGamesPerPlayer, newCourts);
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
    <ResponsiveSettingsModal
      open={open}
      onOpenChange={(next) => { if (!next) handleClose(); }}
      title="Courts & Games"
      description="Rounds recalculate automatically when either setting changes."
      footer={
        <ModalActions>
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
        </ModalActions>
      }
    >
      <div className="space-y-3 pb-1">
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
          className="rounded-xl border border-primary/20 p-3.5 sm:p-4"
          style={{ backgroundColor: "hsl(var(--primary) / 0.05)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-primary uppercase tracking-[0.14em]">
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
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-xs leading-snug">
              <strong>Heads up:</strong> completed rounds and their scores are kept.
              Only the current and upcoming rounds are rebuilt with the new court count.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </ResponsiveSettingsModal>
  );
}
