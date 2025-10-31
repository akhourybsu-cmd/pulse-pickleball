import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

interface ScoreEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (scoreA: number, scoreB: number) => void;
  courtNumber: number;
  roundNumber: number;
  teamA: string[];
  teamB: string[];
}

export function ScoreEntryModal({
  isOpen,
  onClose,
  onSubmit,
  courtNumber,
  roundNumber,
  teamA,
  teamB,
}: ScoreEntryModalProps) {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    // Validate scores
    if (scoreA === scoreB) {
      setError("Scores cannot be tied");
      return;
    }
    if (scoreA === 0 && scoreB === 0) {
      setError("Please enter valid scores");
      return;
    }
    
    onSubmit(scoreA, scoreB);
    // Reset
    setScoreA(0);
    setScoreB(0);
    setError("");
  };

  const handleClose = () => {
    setScoreA(0);
    setScoreB(0);
    setError("");
    onClose();
  };

  const adjustScore = (team: 'A' | 'B', delta: number) => {
    setError("");
    if (team === 'A') {
      setScoreA(Math.max(0, Math.min(99, scoreA + delta)));
    } else {
      setScoreB(Math.max(0, Math.min(99, scoreB + delta)));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold">
            Court {courtNumber} – Round {roundNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-6">
          {/* Team A Score */}
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground font-medium mb-1">TEAM A</div>
              <div className="text-2xl font-bold">
                {teamA[0]} {teamA[1] && `/ ${teamA[1]}`}
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={() => adjustScore('A', -1)}
                size="lg"
                variant="outline"
                className="h-20 w-20 rounded-full"
              >
                <Minus className="w-8 h-8" />
              </Button>
              
              <div className="w-32 h-24 rounded-lg border-2 border-primary bg-primary/10 flex items-center justify-center">
                <span className="text-5xl font-bold">{scoreA}</span>
              </div>
              
              <Button
                onClick={() => adjustScore('A', 1)}
                size="lg"
                variant="outline"
                className="h-20 w-20 rounded-full"
              >
                <Plus className="w-8 h-8" />
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xl font-bold text-muted-foreground">VS</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Team B Score */}
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground font-medium mb-1">TEAM B</div>
              <div className="text-2xl font-bold">
                {teamB[0]} {teamB[1] && `/ ${teamB[1]}`}
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={() => adjustScore('B', -1)}
                size="lg"
                variant="outline"
                className="h-20 w-20 rounded-full"
              >
                <Minus className="w-8 h-8" />
              </Button>
              
              <div className="w-32 h-24 rounded-lg border-2 border-primary bg-primary/10 flex items-center justify-center">
                <span className="text-5xl font-bold">{scoreB}</span>
              </div>
              
              <Button
                onClick={() => adjustScore('B', 1)}
                size="lg"
                variant="outline"
                className="h-20 w-20 rounded-full"
              >
                <Plus className="w-8 h-8" />
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-center text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            size="lg"
            className="w-full h-16 text-xl font-bold bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/90"
          >
            Submit Score
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
