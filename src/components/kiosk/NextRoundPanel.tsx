import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Loader2 } from "lucide-react";

interface NextRoundMatch {
  courtNumber: number;
  teamA: string[];
  teamB: string[];
}

interface NextRoundPanelProps {
  nextRoundMatches: NextRoundMatch[];
  allFinalThisRound: boolean;
  currentRound: number;
  totalRounds: number;
  onStartNextRound: () => void;
  isLastRound: boolean;
}

export function NextRoundPanel({
  nextRoundMatches,
  allFinalThisRound,
  currentRound,
  totalRounds,
  onStartNextRound,
  isLastRound,
}: NextRoundPanelProps) {
  return (
    <div className="space-y-6">
      {/* Next Round Preview */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isLastRound ? "Tournament Complete" : `Round ${currentRound + 1} Preview`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLastRound ? (
            <div className="text-center py-8">
              <Badge variant="default" className="text-lg px-4 py-2 bg-green-600">
                All Rounds Complete
              </Badge>
              <p className="mt-4 text-muted-foreground">
                Thank you for participating!
              </p>
            </div>
          ) : nextRoundMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading next round assignments...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nextRoundMatches.map((match) => (
                <div
                  key={match.courtNumber}
                  className="p-4 rounded-lg bg-background border"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-bold">C{match.courtNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {match.teamA.join(' / ')}
                      </div>
                      <div className="text-xs text-muted-foreground my-1">vs</div>
                      <div className="text-sm font-medium">
                        {match.teamB.join(' / ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Round Control */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl">Round Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {allFinalThisRound ? (
            <>
              <Badge variant="default" className="text-base px-3 py-1 bg-green-600">
                All matches reported
              </Badge>
              {!isLastRound && (
                <Button
                  onClick={onStartNextRound}
                  size="lg"
                  className="w-full h-16 text-xl font-bold bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/90"
                >
                  <PlayCircle className="w-6 h-6 mr-2" />
                  Start Round {currentRound + 1}
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[hsl(var(--accent))]" />
                <p className="text-muted-foreground">
                  Waiting for all scores from Round {currentRound}...
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
