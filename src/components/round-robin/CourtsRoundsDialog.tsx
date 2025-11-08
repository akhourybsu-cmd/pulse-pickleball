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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Grid3x3, Gamepad2 } from "lucide-react";
import { suggestRounds } from "@/lib/roundRobinFairness";

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
  const fromRound = currentRound || 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Courts & Games</DialogTitle>
          <DialogDescription>
            Rounds will automatically adjust based on courts and games per player.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courts" className="flex items-center gap-2">
              <Grid3x3 className="w-4 h-4" />
              Number of Courts
            </Label>
            <Input
              id="courts"
              type="number"
              min="1"
              max="20"
              value={newCourts}
              onChange={(e) => setNewCourts(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="games" className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              Games Per Player
            </Label>
            <Input
              id="games"
              type="number"
              min="1"
              max="20"
              value={newGamesPerPlayer}
              onChange={(e) => setNewGamesPerPlayer(parseInt(e.target.value) || 1)}
            />
          </div>

          <Alert className="bg-primary/5 border-primary/20">
            <AlertDescription className="space-y-2">
              <div className="font-semibold text-primary">
                Auto-calculated Schedule:
              </div>
              <div className="text-sm">
                With {newCourts} {newCourts === 1 ? 'court' : 'courts'} and {newGamesPerPlayer} {newGamesPerPlayer === 1 ? 'game' : 'games'} per player:
              </div>
              <div className="text-lg font-bold text-primary">
                {calculatedRounds} {calculatedRounds === 1 ? 'Round' : 'Rounds'} Required
              </div>
              <div className="text-xs text-muted-foreground">
                for {totalPlayers} players
              </div>
            </AlertDescription>
          </Alert>

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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={!hasChanges || newCourts < 1 || newGamesPerPlayer < 1 || loading}
          >
            {loading ? "Updating..." : "Update Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
