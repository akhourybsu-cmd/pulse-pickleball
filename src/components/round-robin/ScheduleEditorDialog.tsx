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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeftRight, MoveHorizontal, Navigation, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
}

interface ScheduleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleMatch[];
  currentRound: number | null;
  getPlayerName: (playerId: string | null) => string;
  onSwapPartners: (matchId: string, team: 'A' | 'B') => Promise<void>;
  onSwapOpponents: (match1Id: string, match2Id: string) => Promise<void>;
  onMoveCourt: (matchId: string, newCourtNo: number) => Promise<void>;
}

type ActionMode = 'swap-partners' | 'swap-opponents' | 'move-court' | null;

export function ScheduleEditorDialog({
  open,
  onOpenChange,
  schedule,
  currentRound,
  getPlayerName,
  onSwapPartners,
  onSwapOpponents,
  onMoveCourt,
}: ScheduleEditorDialogProps) {
  const [mode, setMode] = useState<ActionMode>(null);
  const [selectedRound, setSelectedRound] = useState<number>(currentRound || 1);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A');
  const [selectedMatch2, setSelectedMatch2] = useState<string>("");
  const [newCourtNo, setNewCourtNo] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const roundMatches = schedule.filter(s => s.round_no === selectedRound && !s.is_bye);
  const hasScores = roundMatches.some(m => m.team1_score !== null || m.team2_score !== null);
  const isCompletedRound = selectedRound < (currentRound || 1);

  const selectedMatchData = roundMatches.find(m => m.id === selectedMatch);
  const selectedMatch2Data = roundMatches.find(m => m.id === selectedMatch2);

  const availableCourts = Array.from(
    new Set(schedule.filter(s => s.round_no === selectedRound).map(s => s.court_no))
  ).sort((a, b) => a - b);

  const handleSwapPartners = async () => {
    if (!selectedMatch) return;
    setLoading(true);
    try {
      await onSwapPartners(selectedMatch, selectedTeam);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleSwapOpponents = async () => {
    if (!selectedMatch || !selectedMatch2 || selectedMatch === selectedMatch2) return;
    setLoading(true);
    try {
      await onSwapOpponents(selectedMatch, selectedMatch2);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleMoveCourt = async () => {
    if (!selectedMatch) return;
    setLoading(true);
    try {
      await onMoveCourt(selectedMatch, newCourtNo);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMode(null);
    setSelectedMatch("");
    setSelectedMatch2("");
    setSelectedTeam('A');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Schedule Editor</DialogTitle>
          <DialogDescription>
            Make changes to the match schedule for a specific round.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                {Array.from({ length: schedule.reduce((max, s) => Math.max(max, s.round_no), 0) }, (_, i) => i + 1).map(round => (
                  <SelectItem key={round} value={round.toString()}>
                    Round {round}
                    {round < (currentRound || 1) && " (Completed)"}
                    {round === currentRound && " (Current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCompletedRound && (
            <Alert>
              <Lock className="w-4 h-4" />
              <AlertDescription>
                <strong>Round Locked:</strong> This round has scores. Editing is disabled to preserve match integrity.
              </AlertDescription>
            </Alert>
          )}

          {hasScores && !isCompletedRound && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Warning:</strong> This round has saved scores. Editing the schedule may affect recorded results.
              </AlertDescription>
            </Alert>
          )}

          {!mode && !isCompletedRound ? (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => setMode('swap-partners')}
              >
                <ArrowLeftRight className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Swap Partners</div>
                  <div className="text-sm text-muted-foreground">
                    Switch Player 1 and Player 2 within a team
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => setMode('swap-opponents')}
              >
                <MoveHorizontal className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Swap Opponents</div>
                  <div className="text-sm text-muted-foreground">
                    Exchange Team A ↔ Team B between two matches
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => setMode('move-court')}
              >
                <Navigation className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Move to Different Court</div>
                  <div className="text-sm text-muted-foreground">
                    Reassign a match to another court in this round
                  </div>
                </div>
              </Button>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">Matches in Round {selectedRound}</p>
                <div className="space-y-2">
                  {roundMatches.map(match => (
                    <div key={match.id} className="p-3 border rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary">Court {match.court_no}</Badge>
                        {(match.team1_score !== null || match.team2_score !== null) && (
                          <Badge variant="default">Scored</Badge>
                        )}
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
          ) : mode === 'swap-partners' && !isCompletedRound ? (
            <div className="space-y-4">
              <Alert>
                <ArrowLeftRight className="w-4 h-4" />
                <AlertDescription>
                  Swap Player 1 and Player 2 within the selected team. The match remains on the same court.
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
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Team</Label>
                <Select value={selectedTeam} onValueChange={(v) => setSelectedTeam(v as 'A' | 'B')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Team A</SelectItem>
                    <SelectItem value="B">Team B</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedMatchData && (
                <div className="p-3 border rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">Preview:</p>
                  <p className="text-sm">
                    {selectedTeam === 'A' ? (
                      <><strong>{getPlayerName(selectedMatchData.a2_player_id)}</strong> & <strong>{getPlayerName(selectedMatchData.a1_player_id)}</strong> vs {getPlayerName(selectedMatchData.b1_player_id)} & {getPlayerName(selectedMatchData.b2_player_id)}</>
                    ) : (
                      <>{getPlayerName(selectedMatchData.a1_player_id)} & {getPlayerName(selectedMatchData.a2_player_id)} vs <strong>{getPlayerName(selectedMatchData.b2_player_id)}</strong> & <strong>{getPlayerName(selectedMatchData.b1_player_id)}</strong></>
                    )}
                  </p>
                </div>
              )}
            </div>
          ) : mode === 'swap-opponents' && !isCompletedRound ? (
            <div className="space-y-4">
              <Alert>
                <MoveHorizontal className="w-4 h-4" />
                <AlertDescription>
                  Exchange Team A from Match 1 with Team B from Match 2, and vice versa. Both matches must be in the same round.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>First Match</Label>
                <Select value={selectedMatch} onValueChange={setSelectedMatch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose first match..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roundMatches.map(match => (
                      <SelectItem key={match.id} value={match.id}>
                        Court {match.court_no}: {getPlayerName(match.a1_player_id)} & {getPlayerName(match.a2_player_id)} vs {getPlayerName(match.b1_player_id)} & {getPlayerName(match.b2_player_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Second Match</Label>
                <Select value={selectedMatch2} onValueChange={setSelectedMatch2}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose second match..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roundMatches.filter(m => m.id !== selectedMatch).map(match => (
                      <SelectItem key={match.id} value={match.id}>
                        Court {match.court_no}: {getPlayerName(match.a1_player_id)} & {getPlayerName(match.a2_player_id)} vs {getPlayerName(match.b1_player_id)} & {getPlayerName(match.b2_player_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMatchData && selectedMatch2Data && (
                <div className="p-3 border rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">Preview After Swap:</p>
                  <div className="space-y-2 text-sm">
                    <div><strong>Court {selectedMatchData.court_no}:</strong> {getPlayerName(selectedMatchData.a1_player_id)} & {getPlayerName(selectedMatchData.a2_player_id)} vs <strong>{getPlayerName(selectedMatch2Data.b1_player_id)} & {getPlayerName(selectedMatch2Data.b2_player_id)}</strong></div>
                    <div><strong>Court {selectedMatch2Data.court_no}:</strong> <strong>{getPlayerName(selectedMatchData.b1_player_id)} & {getPlayerName(selectedMatchData.b2_player_id)}</strong> vs {getPlayerName(selectedMatch2Data.a1_player_id)} & {getPlayerName(selectedMatch2Data.a2_player_id)}</div>
                  </div>
                </div>
              )}
            </div>
          ) : mode === 'move-court' && !isCompletedRound ? (
            <div className="space-y-4">
              <Alert>
                <Navigation className="w-4 h-4" />
                <AlertDescription>
                  Move a match to a different court within the same round. Useful for court availability changes.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Select Match</Label>
                <Select value={selectedMatch} onValueChange={(v) => {
                  setSelectedMatch(v);
                  const match = roundMatches.find(m => m.id === v);
                  if (match) setNewCourtNo(match.court_no);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a match..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roundMatches.map(match => (
                      <SelectItem key={match.id} value={match.id}>
                        Court {match.court_no}: {getPlayerName(match.a1_player_id)} & {getPlayerName(match.a2_player_id)} vs {getPlayerName(match.b1_player_id)} & {getPlayerName(match.b2_player_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>New Court Number</Label>
                <Select value={newCourtNo.toString()} onValueChange={(v) => setNewCourtNo(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCourts.map(court => (
                      <SelectItem key={court} value={court.toString()}>
                        Court {court}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMatchData && newCourtNo !== selectedMatchData.court_no && (
                <div className="p-3 border rounded-lg bg-muted">
                  <p className="text-sm">
                    Moving from <strong>Court {selectedMatchData.court_no}</strong> to <strong>Court {newCourtNo}</strong>
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {mode === 'swap-partners' && !isCompletedRound && (
            <Button onClick={handleSwapPartners} disabled={!selectedMatch || loading}>
              {loading ? "Swapping..." : "Swap Partners"}
            </Button>
          )}
          {mode === 'swap-opponents' && !isCompletedRound && (
            <Button onClick={handleSwapOpponents} disabled={!selectedMatch || !selectedMatch2 || selectedMatch === selectedMatch2 || loading}>
              {loading ? "Swapping..." : "Swap Opponents"}
            </Button>
          )}
          {mode === 'move-court' && !isCompletedRound && (
            <Button onClick={handleMoveCourt} disabled={!selectedMatch || !selectedMatchData || newCourtNo === selectedMatchData.court_no || loading}>
              {loading ? "Moving..." : "Move Court"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
