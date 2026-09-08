import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Grid3x3, Gamepad2, Info, RotateCcw, Save } from "lucide-react";
import { NumericStepper } from "./NumericStepper";
import { ResponsiveSettingsModal, ModalActions } from "./ResponsiveSettingsModal";
import { ScheduleImpactPreview } from "./ScheduleImpactPreview";
import type { ScheduleAdjustmentPlan } from "@/lib/roundRobin/scheduleAdjustment";
import type { SeatId } from "@/lib/roundRobin/scheduleCore";

export interface RoundRobinScheduleSettings {
  numCourts: number;
  gamesPerPlayer: number;
}

interface CourtsRoundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCourts: number;
  currentGamesPerPlayer: number;
  currentTotalRounds?: number;
  currentRound: number | null;
  hasScores: boolean;
  hasSchedule: boolean;
  totalPlayers: number;
  estimatedPlayerCount?: number;
  onApply: (settings: RoundRobinScheduleSettings) => Promise<void>;
  getImpactPlan?: (settings: RoundRobinScheduleSettings) => ScheduleAdjustmentPlan | null;
  getPlayerName?: (seatId: SeatId) => string;
}

export function CourtsRoundsDialog({
  open,
  onOpenChange,
  currentCourts,
  currentGamesPerPlayer,
  currentTotalRounds,
  currentRound,
  hasScores,
  hasSchedule,
  totalPlayers,
  estimatedPlayerCount,
  onApply,
  getImpactPlan,
  getPlayerName,
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

  const handleUpdate = async () => {
    const courtsChanged = newCourts !== currentCourts;
    const gamesChanged = newGamesPerPlayer !== currentGamesPerPlayer;

    if (!courtsChanged && !gamesChanged) return;

    setLoading(true);
    try {
      // One callback keeps both settings together: scheduled events rebuild
      // once, while pre-schedule setup persists one configuration update.
      await onApply({
        numCourts: newCourts,
        gamesPerPlayer: newGamesPerPlayer,
      });
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
  const isPreScheduleSetup = !hasSchedule && totalPlayers < 4;
  const previewPlayerCount = isPreScheduleSetup
    ? Math.max(4, estimatedPlayerCount ?? totalPlayers)
    : totalPlayers;
  // There is no valid schedule plan below four active players. Keep this path
  // configuration-only so hosts can save setup without accidentally invoking
  // (or being blocked by) schedule generation.
  const impactPlan = isPreScheduleSetup
    ? null
    : getImpactPlan?.({
        numCourts: newCourts,
        gamesPerPlayer: newGamesPerPlayer,
      }) ?? null;

  return (
    <ResponsiveSettingsModal
      open={open}
      onOpenChange={(next) => { if (!next) handleClose(); }}
      title="Courts & Games"
      description={isPreScheduleSetup
        ? "Save the setup now, then generate the rotation when at least four active players are ready."
        : "Preview the impact, then rebuild the remaining rotation in one step."}
      footer={
        <ModalActions>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={
              !hasChanges ||
              newCourts < 1 ||
              newGamesPerPlayer < 1 ||
              loading ||
              (!isPreScheduleSetup && impactPlan?.ok === false)
            }
            className="gap-1.5"
          >
            {isPreScheduleSetup
              ? <Save className="h-4 w-4" />
              : <RotateCcw className="h-4 w-4" />}
            {loading
              ? isPreScheduleSetup ? "Saving setup…" : "Rebuilding schedule…"
              : hasChanges ? isPreScheduleSetup ? "Save setup" : "Apply & rebuild"
              : "No changes"}
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
          suffix="Target games for each player"
        />

        {isPreScheduleSetup && (
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">
                Setup estimate for {previewPlayerCount} players.
              </strong>{" "}
              These settings save immediately without creating matches. The final round count, rests, and fairness adapt to the active roster when you generate the schedule.
            </p>
          </div>
        )}

        <ScheduleImpactPreview
          playerCount={previewPlayerCount}
          courtCount={newCourts}
          gamesPerPlayer={newGamesPerPlayer}
          previous={isPreScheduleSetup ? undefined : {
            courtCount: currentCourts,
            gamesPerPlayer: currentGamesPerPlayer,
            rounds: currentTotalRounds,
          }}
          currentRound={currentRound}
          preserveCompleted={hasScores || (currentRound ?? 1) > 1}
          title={isPreScheduleSetup ? "Setup estimate" : "Impact preview"}
          compact
          plan={impactPlan}
          getPlayerName={getPlayerName}
        />
      </div>
    </ResponsiveSettingsModal>
  );
}
