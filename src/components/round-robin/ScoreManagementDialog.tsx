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
import { Edit3, Trash2, Ban, AlertTriangle, ChevronRight, ChevronLeft, ShieldCheck } from "lucide-react";
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
  a1_guest_id?: string | null;
  a2_guest_id?: string | null;
  b1_guest_id?: string | null;
  b2_guest_id?: string | null;
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
                  <div className="space-y-4">
                    {/* Action cards — consistent visual language with PlayerManagementDialog. */}
                    <div className="space-y-2">
                      {[
                        {
                          id: 'enter' as const,
                          icon: Edit3,
                          title: 'Enter Scores',
                          description: 'Enter or update scores for any match in this round',
                          tone: 'default' as const,
                          show: true,
                        },
                        {
                          id: 'edit' as const,
                          icon: Edit3,
                          title: 'Edit Score',
                          description: 'Update an existing score and recalculate standings',
                          tone: 'default' as const,
                          show: scoredMatches.length > 0,
                        },
                        {
                          id: 'void' as const,
                          icon: Ban,
                          title: 'Void Match',
                          description: 'Keep the record but remove from standings and ratings',
                          tone: 'warning' as const,
                          show: true,
                        },
                        {
                          id: 'delete' as const,
                          icon: Trash2,
                          title: 'Delete Match (Admin)',
                          description: 'Permanently remove the match record',
                          tone: 'destructive' as const,
                          show: isAdmin,
                        },
                      ].filter((a) => a.show).map((action) => {
                        const Icon = action.icon;
                        const isDestructive = action.tone === 'destructive';
                        const isWarning = action.tone === 'warning';
                        // Tonal coding: destructive = red border + red tile; warning =
                        // amber tile only (the action is reversible — voided matches
                        // can still be reviewed); default = primary tile.
                        const wrapperTone = isDestructive
                          ? 'border-destructive/25 hover:border-destructive/50 hover:bg-destructive/5'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30';
                        const tileTone = isDestructive
                          ? 'bg-destructive/10 text-destructive'
                          : isWarning
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-primary/10 text-primary';
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => setMode(action.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border bg-card active:scale-[0.99] transition-all text-left ${wrapperTone}`}
                          >
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tileTone}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold text-sm ${isDestructive ? 'text-destructive' : ''}`}>{action.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{action.description}</div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>

                    {/* Round preview — match cards with court + score + teams. */}
                    <div className="pt-3 border-t border-border/60">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Matches in Round {selectedRound}
                      </p>
                      <div className="space-y-2">
                        {roundMatches.map((match) => {
                          const hasScore = match.team1_score !== null && match.team2_score !== null;
                          return (
                            <div key={match.id} className="p-3 rounded-xl bg-muted/40 text-sm space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-semibold text-muted-foreground">
                                  COURT {match.court_no}
                                </span>
                                {hasScore ? (
                                  <span className="text-base font-bold tabular-nums text-primary">
                                    {match.team1_score}–{match.team2_score}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No score</span>
                                )}
                              </div>
                              <div className="space-y-0.5 text-foreground/90">
                                <div className="truncate">
                                  <span className="text-muted-foreground">A:</span>{' '}
                                  {getPlayerName(match.a1_player_id ?? match.a1_guest_id)} &amp; {getPlayerName(match.a2_player_id ?? match.a2_guest_id)}
                                </div>
                                <div className="truncate">
                                  <span className="text-muted-foreground">B:</span>{' '}
                                  {getPlayerName(match.b1_player_id ?? match.b1_guest_id)} &amp; {getPlayerName(match.b2_player_id ?? match.b2_guest_id)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
                              Court {match.court_no}: {getPlayerName(match.a1_player_id ?? match.a1_guest_id)} & {getPlayerName(match.a2_player_id ?? match.a2_guest_id)} vs {getPlayerName(match.b1_player_id ?? match.b1_guest_id)} & {getPlayerName(match.b2_player_id ?? match.b2_guest_id)}
                              {match.team1_score !== null && match.team2_score !== null && ` (${match.team1_score}-${match.team2_score})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMatchData && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team A</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="99"
                              value={team1Score}
                              onChange={(e) => setTeam1Score(parseInt(e.target.value) || 0)}
                              className="h-12 text-2xl text-center font-bold tabular-nums focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground truncate">
                              {getPlayerName(selectedMatchData.a1_player_id ?? selectedMatchData.a1_guest_id)} &amp; {getPlayerName(selectedMatchData.a2_player_id ?? selectedMatchData.a2_guest_id)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team B</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="99"
                              value={team2Score}
                              onChange={(e) => setTeam2Score(parseInt(e.target.value) || 0)}
                              className="h-12 text-2xl text-center font-bold tabular-nums focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground truncate">
                              {getPlayerName(selectedMatchData.b1_player_id ?? selectedMatchData.b1_guest_id)} &amp; {getPlayerName(selectedMatchData.b2_player_id ?? selectedMatchData.b2_guest_id)}
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
                              Court {match.court_no}: {getPlayerName(match.a1_player_id ?? match.a1_guest_id)} & {getPlayerName(match.a2_player_id ?? match.a2_guest_id)} vs {getPlayerName(match.b1_player_id ?? match.b1_guest_id)} & {getPlayerName(match.b2_player_id ?? match.b2_guest_id)} ({match.team1_score}-{match.team2_score})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMatchData && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team A</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="99"
                              value={team1Score}
                              onChange={(e) => setTeam1Score(parseInt(e.target.value) || 0)}
                              className="h-12 text-2xl text-center font-bold tabular-nums focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground truncate">
                              {getPlayerName(selectedMatchData.a1_player_id ?? selectedMatchData.a1_guest_id)} &amp; {getPlayerName(selectedMatchData.a2_player_id ?? selectedMatchData.a2_guest_id)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team B</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="99"
                              value={team2Score}
                              onChange={(e) => setTeam2Score(parseInt(e.target.value) || 0)}
                              className="h-12 text-2xl text-center font-bold tabular-nums focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground truncate">
                              {getPlayerName(selectedMatchData.b1_player_id ?? selectedMatchData.b1_guest_id)} &amp; {getPlayerName(selectedMatchData.b2_player_id ?? selectedMatchData.b2_guest_id)}
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
                              Court {match.court_no}: {getPlayerName(match.a1_player_id ?? match.a1_guest_id)} & {getPlayerName(match.a2_player_id ?? match.a2_guest_id)} vs {getPlayerName(match.b1_player_id ?? match.b1_guest_id)} & {getPlayerName(match.b2_player_id ?? match.b2_guest_id)} ({match.team1_score}-{match.team2_score})
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
                              Court {match.court_no}: {getPlayerName(match.a1_player_id ?? match.a1_guest_id)} & {getPlayerName(match.a2_player_id ?? match.a2_guest_id)} vs {getPlayerName(match.b1_player_id ?? match.b1_guest_id)} & {getPlayerName(match.b2_player_id ?? match.b2_guest_id)} ({match.team1_score}-{match.team2_score})
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

          <DialogFooter className="gap-2 sm:gap-2">
            {mode && (
              <Button
                variant="ghost"
                onClick={resetForm}
                className="mr-auto text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {mode === 'enter' && (
              <Button
                onClick={handleEditScore}
                disabled={!selectedMatch || team1Score === team2Score || loading}
                className="gap-1.5"
              >
                <Edit3 className="h-4 w-4" />
                {loading ? "Saving…" : "Save Score"}
              </Button>
            )}
            {mode === 'edit' && (
              <Button
                onClick={handleEditScore}
                disabled={!selectedMatch || team1Score === team2Score || !hasScoreChanged || loading}
                className="gap-1.5"
              >
                <Edit3 className="h-4 w-4" />
                {loading ? "Saving…" : "Update Score"}
              </Button>
            )}
            {mode === 'void' && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDialogOpen(true)}
                disabled={!selectedMatch || loading}
                className="gap-1.5"
              >
                <Ban className="h-4 w-4" />
                Void Match
              </Button>
            )}
            {mode === 'delete' && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDialogOpen(true)}
                disabled={!selectedMatch || loading}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
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
