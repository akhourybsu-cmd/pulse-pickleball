import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit3, Trash2, Ban, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScheduleMatch {
  id: string;
  round_no: number;
  court_no: number;
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
  match_id: string | null;
}

interface ScoreManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleMatch[];
  isAdmin: boolean;
  ratingEligible: boolean;
  getPlayerName: (playerId: string | null) => string;
  onEditScore: (matchId: string, team1Score: number, team2Score: number) => Promise<void>;
  onVoidMatch: (matchId: string) => Promise<void>;
  onDeleteMatch: (matchId: string) => Promise<void>;
}

type ActionMode = 'enter' | 'edit' | 'void' | 'delete' | null;

export function ScoreManagementDialog({
  open,
  onOpenChange,
  schedule,
  isAdmin,
  ratingEligible,
  getPlayerName,
  onEditScore,
  onVoidMatch,
  onDeleteMatch,
}: ScoreManagementDialogProps) {
  const [mode, setMode] = useState<ActionMode>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const scoredMatches = schedule.filter(s => 
    !s.is_bye && (s.team1_score !== null || s.team2_score !== null)
  );

  const allMatches = schedule.filter(s => !s.is_bye);

  const roundsWithScores = Array.from(
    new Set(scoredMatches.map(m => m.round_no))
  ).sort((a, b) => a - b);

  const allRounds = Array.from(
    new Set(allMatches.map(m => m.round_no))
  ).sort((a, b) => a - b);

  const roundMatches = (mode === 'enter' ? allMatches : scoredMatches).filter(m => m.round_no === selectedRound);
  const selectedMatchData = roundMatches.find(m => m.id === selectedMatch);

  useEffect(() => {
    if (selectedMatchData) {
      setTeam1Score(selectedMatchData.team1_score || 0);
      setTeam2Score(selectedMatchData.team2_score || 0);
    }
  }, [selectedMatchData]);

  const handleEditScore = async () => {
    if (!selectedMatch || team1Score === team2Score) return;
    
    setLoading(true);
    try {
      await onEditScore(selectedMatch, team1Score, team2Score);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleVoidMatch = async () => {
    if (!selectedMatch) return;
    
    setLoading(true);
    try {
      await onVoidMatch(selectedMatch);
      resetForm();
      setConfirmDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!selectedMatch) return;
    
    setLoading(true);
    try {
      await onDeleteMatch(selectedMatch);
      resetForm();
      setConfirmDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMode(null);
    setSelectedMatch("");
    setTeam1Score(0);
    setTeam2Score(0);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const hasScoreChanged = selectedMatchData && (
    team1Score !== selectedMatchData.team1_score ||
    team2Score !== selectedMatchData.team2_score
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Score & Match Management</DialogTitle>
            <DialogDescription>
              Edit scores, void matches, or delete match records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {allMatches.length === 0 ? (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  No matches in the schedule yet.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Round Selector */}
                <div className="space-y-2">
                  <Label>Select Round</Label>
                  <Select 
                    value={selectedRound.toString()} 
                    onValueChange={(v) => {
                      setSelectedRound(parseInt(v));
                      resetForm();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(mode === 'enter' ? allRounds : roundsWithScores).map(round => (
                        <SelectItem key={round} value={round.toString()}>
                          Round {round}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!mode && roundMatches.length > 0 ? (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start h-auto py-4"
                      onClick={() => setMode('enter')}
                    >
                      <Edit3 className="w-5 h-5 mr-3" />
                      <div className="text-left">
                        <div className="font-semibold">Enter Scores</div>
                        <div className="text-sm text-muted-foreground">
                          Enter or update scores for any match in this round
                        </div>
                      </div>
                    </Button>

                    {scoredMatches.length > 0 && (
                      <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-4"
                        onClick={() => setMode('edit')}
                      >
                        <Edit3 className="w-5 h-5 mr-3" />
                        <div className="text-left">
                          <div className="font-semibold">Edit Score</div>
                          <div className="text-sm text-muted-foreground">
                            Update match score and recalculate standings
                          </div>
                        </div>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      className="w-full justify-start h-auto py-4"
                      onClick={() => setMode('void')}
                    >
                      <Ban className="w-5 h-5 mr-3" />
                      <div className="text-left">
                        <div className="font-semibold">Void Match</div>
                        <div className="text-sm text-muted-foreground">
                          Keep record but remove from standings/ratings
                        </div>
                      </div>
                    </Button>

                    {isAdmin && (
                      <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-4 text-destructive"
                        onClick={() => setMode('delete')}
                      >
                        <Trash2 className="w-5 h-5 mr-3" />
                        <div className="text-left">
                          <div className="font-semibold">Delete Match (Admin)</div>
                          <div className="text-sm text-muted-foreground">
                            Permanently remove match record
                          </div>
                        </div>
                      </Button>
                    )}

                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-3">Scored Matches in Round {selectedRound}</p>
                      <div className="space-y-2">
                        {roundMatches.map(match => (
                          <div key={match.id} className="p-3 border rounded-lg text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="secondary">Court {match.court_no}</Badge>
                              <Badge variant="default">{match.team1_score} - {match.team2_score}</Badge>
                            </div>
                            <div className="space-y-1">
                              <div><strong>Team A:</strong> {getPlayerName(match.a1_player_id)} & {getPlayerName(match.a2_player_id)}</div>
                              <div><strong>Team B:</strong> {getPlayerName(match.b1_player_id)} & {getPlayerName(match.b2_player_id)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : mode === 'enter' ? (
                  <div className="space-y-4">
                    <Alert>
                      <Edit3 className="w-4 h-4" />
                      <AlertDescription>
                        Enter scores for unscored matches or update existing scores. Changes recalculate standings
                        {ratingEligible && <> and reset match verification</>}.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label>Select Match</Label>
                      <Select value={selectedMatch} onValueChange={setSelectedMatch}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a match..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roundMatches.map(match => (
                            <SelectItem key={match.id} value={match.id}>
                              Court {match.court_no}: {getPlayerName(match.a1_player_id)} & {getPlayerName(match.a2_player_id)} vs {getPlayerName(match.b1_player_id)} & {getPlayerName(match.b2_player_id)}
                              {match.team1_score !== null && match.team2_score !== null && ` (${match.team1_score}-${match.team2_score})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMatchData && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Team A Score</Label>
                            <Input
                              type="number"
                              min="0"
                              max="99"
                              value={team1Score}
                              onChange={(e) => setTeam1Score(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-muted-foreground">
                              {getPlayerName(selectedMatchData.a1_player_id)} & {getPlayerName(selectedMatchData.a2_player_id)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Team B Score</Label>
                            <Input
                              type="number"
                              min="0"
                              max="99"
                              value={team2Score}
                              onChange={(e) => setTeam2Score(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-muted-foreground">
                              {getPlayerName(selectedMatchData.b1_player_id)} & {getPlayerName(selectedMatchData.b2_player_id)}
                            </p>
                          </div>
                        </div>

                        {team1Score === team2Score && (
                          <Alert variant="destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                              Scores cannot be tied. Please enter different scores.
                            </AlertDescription>
                          </Alert>
                        )}

                        {hasScoreChanged && (
                          <Alert>
                            <ShieldCheck className="w-4 h-4" />
                            <AlertDescription>
                              <strong>Note:</strong> Verification will be reset for this match. Players will need to verify the new score.
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    )}
                  </div>
                ) : mode === 'edit' ? (
                  <div className="space-y-4">
                    <Alert>
                      <Edit3 className="w-4 h-4" />
                      <AlertDescription>
                        Editing a score will recalculate standings
                        {ratingEligible && <>, reflow ratings forward, and reset match verification</>}.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label>Select Match</Label>
                      <Select value={selectedMatch} onValueChange={setSelectedMatch}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a match..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roundMatches.map(match => (
                            <SelectItem key={match.id} value={match.id}>
                              Court {match.court_no}: {getPlayerName(match.a1_player_id)} & {getPlayerName(match.a2_player_id)} vs {getPlayerName(match.b1_player_id)} & {getPlayerName(match.b2_player_id)} ({match.team1_score}-{match.team2_score})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMatchData && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Team A Score</Label>
                            <Input
                              type="number"
                              min="0"
                              max="99"
                              value={team1Score}
                              onChange={(e) => setTeam1Score(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-muted-foreground">
                              {getPlayerName(selectedMatchData.a1_player_id)} & {getPlayerName(selectedMatchData.a2_player_id)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Team B Score</Label>
                            <Input
                              type="number"
                              min="0"
                              max="99"
                              value={team2Score}
                              onChange={(e) => setTeam2Score(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-muted-foreground">
                              {getPlayerName(selectedMatchData.b1_player_id)} & {getPlayerName(selectedMatchData.b2_player_id)}
                            </p>
                          </div>
                        </div>

                        {team1Score === team2Score && (
                          <Alert variant="destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                              Scores cannot be tied. Please enter different scores.
                            </AlertDescription>
                          </Alert>
                        )}

                        {hasScoreChanged && (
                          <Alert>
                            <ShieldCheck className="w-4 h-4" />
                            <AlertDescription>
                              <strong>Note:</strong> Verification will be reset for this match. Players will need to verify the new score.
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    )}
                  </div>
                ) : mode === 'void' ? (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <Ban className="w-4 h-4" />
                      <AlertDescription>
                        Voiding a match keeps the record visible with a "Voided" badge, but removes it from standings and ratings calculations.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label>Select Match to Void</Label>
                      <Select value={selectedMatch} onValueChange={setSelectedMatch}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a match..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roundMatches.map(match => (
                            <SelectItem key={match.id} value={match.id}>
                              Court {match.court_no}: {getPlayerName(match.a1_player_id)} & {getPlayerName(match.a2_player_id)} vs {getPlayerName(match.b1_player_id)} & {getPlayerName(match.b2_player_id)} ({match.team1_score}-{match.team2_score})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : mode === 'delete' ? (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <Trash2 className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Admin Only:</strong> Permanently delete this match record. This will remove it from the schedule and reflow ratings. This action cannot be undone.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label>Select Match to Delete</Label>
                      <Select value={selectedMatch} onValueChange={setSelectedMatch}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a match..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roundMatches.map(match => (
                            <SelectItem key={match.id} value={match.id}>
                              Court {match.court_no}: {getPlayerName(match.a1_player_id)} & {getPlayerName(match.a2_player_id)} vs {getPlayerName(match.b1_player_id)} & {getPlayerName(match.b2_player_id)} ({match.team1_score}-{match.team2_score})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {mode === 'enter' && (
              <Button 
                onClick={handleEditScore} 
                disabled={!selectedMatch || team1Score === team2Score || loading}
              >
                {loading ? "Saving..." : "Save Score"}
              </Button>
            )}
            {mode === 'edit' && (
              <Button 
                onClick={handleEditScore} 
                disabled={!selectedMatch || team1Score === team2Score || !hasScoreChanged || loading}
              >
                {loading ? "Saving..." : "Update Score"}
              </Button>
            )}
            {mode === 'void' && (
              <Button 
                variant="destructive"
                onClick={() => setConfirmDialogOpen(true)} 
                disabled={!selectedMatch || loading}
              >
                Void Match
              </Button>
            )}
            {mode === 'delete' && (
              <Button 
                variant="destructive"
                onClick={() => setConfirmDialogOpen(true)} 
                disabled={!selectedMatch || loading}
              >
                Delete Match
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === 'void' ? 'Void Match?' : 'Delete Match?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'void' ? (
                <>
                  This will mark the match as voided. The match will remain visible with a "Voided" badge, 
                  but will be excluded from standings and ratings calculations.
                </>
              ) : (
                <>
                  <strong>This action cannot be undone.</strong> The match record will be permanently deleted 
                  from the schedule, and ratings will be reflowed to account for the removal.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={mode === 'void' ? handleVoidMatch : handleDeleteMatch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Processing..." : mode === 'void' ? 'Void Match' : 'Delete Match'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
