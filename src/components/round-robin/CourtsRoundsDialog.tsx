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
import { AlertTriangle, Grid3x3, Calendar } from "lucide-react";

interface CourtsRoundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCourts: number;
  currentRounds: number;
  currentRound: number | null;
  hasScores: boolean;
  totalPlayers: number;
  onUpdateCourts: (newCourts: number) => Promise<void>;
  onUpdateRounds: (newRounds: number) => Promise<void>;
}

type Mode = 'courts' | 'rounds' | null;

export function CourtsRoundsDialog({
  open,
  onOpenChange,
  currentCourts,
  currentRounds,
  currentRound,
  hasScores,
  totalPlayers,
  onUpdateCourts,
  onUpdateRounds,
}: CourtsRoundsDialogProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [newCourts, setNewCourts] = useState(currentCourts);
  const [newRounds, setNewRounds] = useState(currentRounds);
  const [loading, setLoading] = useState(false);

  // Calculate optimal rounds to maximize games played
  const calculateOptimalRounds = (courts: number, players: number): number => {
    const playersPerRound = courts * 4;
    const matchesNeededForEachPair = Math.ceil((players * (players - 1)) / 8); // Each player with each other as partner/opponent
    const baseRounds = Math.ceil(matchesNeededForEachPair / courts);
    return Math.max(baseRounds, Math.ceil(players / 2)); // At least enough rounds so everyone plays multiple times
  };

  const optimalRounds = calculateOptimalRounds(newCourts, totalPlayers);

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

  const handleUpdateRounds = async () => {
    if (newRounds === currentRounds || newRounds < 1) return;
    
    setLoading(true);
    try {
      await onUpdateRounds(newRounds);
      setMode(null);
      setNewRounds(currentRounds);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode(null);
    setNewCourts(currentCourts);
    setNewRounds(currentRounds);
    onOpenChange(false);
  };

  const courtsWillIncrease = newCourts > currentCourts;
  const courtsWillDecrease = newCourts < currentCourts;
  const roundsWillIncrease = newRounds > currentRounds;
  const roundsWillDecrease = newRounds < currentRounds;
  const fromRound = currentRound || 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Courts & Rounds</DialogTitle>
          <DialogDescription>
            Modify the tournament structure. Changes will regenerate future rounds.
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
              onClick={() => setMode('rounds')}
            >
              <Calendar className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Adjust Number of Rounds</div>
                <div className="text-sm text-muted-foreground">
                  Currently: {currentRounds} {currentRounds === 1 ? 'round' : 'rounds'}
                </div>
              </div>
            </Button>
          </div>
        ) : mode === 'courts' ? (
          <div className="space-y-4 py-4">
            <Alert>
              <Grid3x3 className="w-4 h-4" />
              <AlertDescription>
                {courtsWillIncrease && (
                  <>Increasing courts will regenerate the schedule from Round {fromRound} onward, 
                  distributing matches across more courts.</>
                )}
                {courtsWillDecrease && (
                  <>Decreasing courts will consolidate matches and may create more byes. 
                  Schedule will be regenerated from Round {fromRound} onward.</>
                )}
              </AlertDescription>
            </Alert>

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
                <strong>Suggested rounds with {newCourts} {newCourts === 1 ? 'court' : 'courts'}:</strong> {optimalRounds} rounds
                <br />
                <span className="text-xs text-muted-foreground">
                  This maximizes games for {totalPlayers} players. You can adjust rounds separately if needed.
                </span>
              </AlertDescription>
            </Alert>

            {courtsWillDecrease && hasScores && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This event has scored matches. Decreasing courts 
                  will regenerate future rounds and may affect scheduled matches.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert>
              <Calendar className="w-4 h-4" />
              <AlertDescription>
                {roundsWillIncrease && (
                  <>Adding rounds will generate additional rounds with the same fairness rules.</>
                )}
                {roundsWillDecrease && (
                  <>Removing rounds will delete all rounds beyond Round {newRounds}. 
                  This cannot be undone.</>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="rounds">Number of Rounds</Label>
              <Input
                id="rounds"
                type="number"
                min="1"
                max="50"
                value={newRounds}
                onChange={(e) => setNewRounds(parseInt(e.target.value) || 1)}
              />
              <p className="text-sm text-muted-foreground">
                Enter between 1 and 50 rounds
              </p>
            </div>

            {roundsWillDecrease && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Warning:</strong> You are decreasing from {currentRounds} to {newRounds} rounds.
                  {hasScores && newRounds < fromRound && (
                    <> This will delete rounds that have scored matches. All scores in those rounds will be lost.</>
                  )}
                  {hasScores && newRounds >= fromRound && (
                    <> Rounds {newRounds + 1} through {currentRounds} will be deleted.</>
                  )}
                  {!hasScores && (
                    <> Rounds {newRounds + 1} through {currentRounds} will be deleted.</>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {roundsWillDecrease && newRounds < fromRound && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Cannot proceed:</strong> You cannot decrease rounds below the current round ({fromRound}).
                  Complete or void the event first.
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
            <>
              {optimalRounds !== currentRounds && (
                <Button 
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await onUpdateCourts(newCourts);
                      await onUpdateRounds(optimalRounds);
                      setMode(null);
                    } finally {
                      setLoading(false);
                    }
                  }} 
                  disabled={newCourts === currentCourts || newCourts < 1 || loading}
                >
                  {loading ? "Updating..." : `Update & Set ${optimalRounds} Rounds`}
                </Button>
              )}
              <Button 
                variant={optimalRounds !== currentRounds ? "outline" : "default"}
                onClick={handleUpdateCourts} 
                disabled={newCourts === currentCourts || newCourts < 1 || loading}
              >
                {loading ? "Updating..." : "Update Courts Only"}
              </Button>
            </>
          )}
          {mode === 'rounds' && (
            <Button 
              onClick={handleUpdateRounds} 
              disabled={
                newRounds === currentRounds || 
                newRounds < 1 || 
                (roundsWillDecrease && newRounds < fromRound) || 
                loading
              }
              variant={roundsWillDecrease ? "destructive" : "default"}
            >
              {loading ? "Updating..." : roundsWillDecrease ? "Delete Rounds" : "Add Rounds"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
