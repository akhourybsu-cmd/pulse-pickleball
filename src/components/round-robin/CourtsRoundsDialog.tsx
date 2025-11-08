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

type Mode = 'courts' | 'games' | null;

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
  const [mode, setMode] = useState<Mode>(null);
  const [newCourts, setNewCourts] = useState(currentCourts);
  const [newGamesPerPlayer, setNewGamesPerPlayer] = useState(currentGamesPerPlayer);
  const [loading, setLoading] = useState(false);

  // Calculate rounds based on courts and games per player
  const calculatedRounds = suggestRounds(totalPlayers, newCourts, mode === 'games' ? newGamesPerPlayer : currentGamesPerPlayer);

  const handleUpdateCourts = async () => {
    if (newCourts === currentCourts || newCourts < 1) return;
    
    setLoading(true);
    try {
      await onUpdateCourts(newCourts);
      setMode(null);
      setNewCourts(currentCourts);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGamesPerPlayer = async () => {
    if (newGamesPerPlayer === currentGamesPerPlayer || newGamesPerPlayer < 1) return;
    
    setLoading(true);
    try {
      await onUpdateGamesPerPlayer(newGamesPerPlayer);
      setMode(null);
      setNewGamesPerPlayer(currentGamesPerPlayer);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode(null);
    setNewCourts(currentCourts);
    setNewGamesPerPlayer(currentGamesPerPlayer);
    onOpenChange(false);
  };

  const courtsWillChange = newCourts !== currentCourts;
  const gamesWillChange = newGamesPerPlayer !== currentGamesPerPlayer;
  const fromRound = currentRound || 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Courts & Games</DialogTitle>
          <DialogDescription>
            Modify courts and games per player. Rounds will auto-calculate based on these settings.
          </DialogDescription>
        </DialogHeader>

        {!mode ? (
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setMode('courts')}
            >
              <Grid3x3 className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Adjust Number of Courts</div>
                <div className="text-sm text-muted-foreground">
                  Currently: {currentCourts} {currentCourts === 1 ? 'court' : 'courts'}
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setMode('games')}
            >
              <Gamepad2 className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Adjust Games Per Player</div>
                <div className="text-sm text-muted-foreground">
                  Currently: {currentGamesPerPlayer} {currentGamesPerPlayer === 1 ? 'game' : 'games'}
                </div>
              </div>
            </Button>
          </div>
        ) : mode === 'courts' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="courts">Number of Courts</Label>
              <Input
                id="courts"
                type="number"
                min="1"
                max="20"
                value={newCourts}
                onChange={(e) => setNewCourts(parseInt(e.target.value) || 1)}
              />
              <p className="text-sm text-muted-foreground">
                Enter between 1 and 20 courts
              </p>
            </div>

            <Alert>
              <AlertDescription>
                <strong>With {newCourts} {newCourts === 1 ? 'court' : 'courts'} and {currentGamesPerPlayer} {currentGamesPerPlayer === 1 ? 'game' : 'games'} per player:</strong>
                <br />
                This will require {calculatedRounds} {calculatedRounds === 1 ? 'round' : 'rounds'} for {totalPlayers} players
              </AlertDescription>
            </Alert>

            {courtsWillChange && hasScores && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This event has scored matches. Changing courts 
                  will regenerate future rounds and may affect scheduled matches.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="games">Games Per Player</Label>
              <Input
                id="games"
                type="number"
                min="1"
                max="20"
                value={newGamesPerPlayer}
                onChange={(e) => setNewGamesPerPlayer(parseInt(e.target.value) || 1)}
              />
              <p className="text-sm text-muted-foreground">
                Target number of games each player should play
              </p>
            </div>

            <Alert>
              <AlertDescription>
                <strong>With {currentCourts} {currentCourts === 1 ? 'court' : 'courts'} and {newGamesPerPlayer} {newGamesPerPlayer === 1 ? 'game' : 'games'} per player:</strong>
                <br />
                This will require {calculatedRounds} {calculatedRounds === 1 ? 'round' : 'rounds'} for {totalPlayers} players
              </AlertDescription>
            </Alert>

            {gamesWillChange && hasScores && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This event has scored matches. Changing games per player 
                  will regenerate the schedule and may affect scheduled matches.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {mode === 'courts' && (
            <Button 
              onClick={handleUpdateCourts} 
              disabled={newCourts === currentCourts || newCourts < 1 || loading}
            >
              {loading ? "Updating..." : "Update Courts"}
            </Button>
          )}
          {mode === 'games' && (
            <Button 
              onClick={handleUpdateGamesPerPlayer} 
              disabled={newGamesPerPlayer === currentGamesPerPlayer || newGamesPerPlayer < 1 || loading}
            >
              {loading ? "Updating..." : "Update Games Per Player"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
