import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { differenceInSeconds, addMinutes } from "date-fns";

interface Match {
  id: string;
  team1_id: string;
  team2_id: string;
  team1_score: number | null;
  team2_score: number | null;
  status: string;
  player_score_submitted_by: string | null;
  player_score_submitted_at: string | null;
  opponent_confirmed: boolean | null;
  auto_confirmed: boolean | null;
}

interface Team {
  id: string;
  team_name: string;
  player1_id: string | null;
}

interface PlayerScoreEntryProps {
  matchId: string;
  currentUserId: string;
  autoConfirmMinutes?: number;
  onComplete?: () => void;
}

export function PlayerScoreEntry({ 
  matchId, 
  currentUserId, 
  autoConfirmMinutes = 3,
  onComplete 
}: PlayerScoreEntryProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  // Countdown timer for auto-confirm
  useEffect(() => {
    if (!match?.player_score_submitted_at || match.opponent_confirmed !== null) return;

    const updateCountdown = () => {
      const submittedAt = new Date(match.player_score_submitted_at!);
      const expiresAt = addMinutes(submittedAt, autoConfirmMinutes);
      const remaining = differenceInSeconds(expiresAt, new Date());
      
      if (remaining <= 0) {
        setCountdown(0);
        // Trigger auto-confirm check
        handleAutoConfirm();
      } else {
        setCountdown(remaining);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [match?.player_score_submitted_at, match?.opponent_confirmed, autoConfirmMinutes]);

  const fetchMatch = async () => {
    setLoading(true);
    
    const { data: matchData, error: matchError } = await supabase
      .from("tournaments_matches")
      .select("id, team1_id, team2_id, team1_score, team2_score, status, player_score_submitted_by, player_score_submitted_at, opponent_confirmed, auto_confirmed")
      .eq("id", matchId)
      .single();

    if (matchError || !matchData) {
      toast({ title: "Error loading match", description: matchError?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setMatch(matchData);

    // Fetch teams
    const { data: teams } = await supabase
      .from("tournaments_teams")
      .select("id, team_name, player1_id")
      .in("id", [matchData.team1_id, matchData.team2_id]);

    if (teams) {
      const tA = teams.find(t => t.id === matchData.team1_id);
      const tB = teams.find(t => t.id === matchData.team2_id);
      setTeamA(tA || null);
      setTeamB(tB || null);

      // Determine which team the current user is on
      const userTeam = teams.find(t => t.player1_id === currentUserId);
      setUserTeamId(userTeam?.id || null);
    }

    // Pre-fill scores if already submitted
    if (matchData.team1_score !== null) setScoreA(matchData.team1_score.toString());
    if (matchData.team2_score !== null) setScoreB(matchData.team2_score.toString());

    setLoading(false);
  };

  const handleSubmitScore = async () => {
    const numScoreA = parseInt(scoreA);
    const numScoreB = parseInt(scoreB);

    if (isNaN(numScoreA) || isNaN(numScoreB)) {
      toast({ title: "Invalid scores", description: "Please enter valid numbers", variant: "destructive" });
      return;
    }

    if (numScoreA === numScoreB) {
      toast({ title: "Invalid scores", description: "Scores cannot be tied", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from("tournaments_matches")
      .update({
        team1_score: numScoreA,
        team2_score: numScoreB,
        player_score_submitted_by: currentUserId,
        player_score_submitted_at: new Date().toISOString(),
        opponent_confirmed: null,
      })
      .eq("id", matchId);

    if (error) {
      toast({ title: "Error submitting score", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Score submitted", description: "Waiting for opponent confirmation" });
      fetchMatch();
    }

    setSubmitting(false);
  };

  const handleConfirmScore = async () => {
    setSubmitting(true);

    const { error } = await supabase
      .from("tournaments_matches")
      .update({
        opponent_confirmed: true,
        opponent_confirmed_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", matchId);

    if (error) {
      toast({ title: "Error confirming score", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Score confirmed", description: "Match result has been recorded" });
      onComplete?.();
    }

    setSubmitting(false);
  };

  const handleDisputeScore = async () => {
    setSubmitting(true);

    const { error } = await supabase
      .from("tournaments_matches")
      .update({
        opponent_confirmed: false,
        disputed: true,
        dispute_notes: disputeReason || null,
      })
      .eq("id", matchId);

    if (error) {
      toast({ title: "Error disputing score", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Score disputed", description: "A tournament official will review" });
      setShowDisputeDialog(false);
    }

    setSubmitting(false);
  };

  const handleAutoConfirm = async () => {
    if (!match || match.opponent_confirmed !== null || match.auto_confirmed) return;

    const { error } = await supabase
      .from("tournaments_matches")
      .update({
        opponent_confirmed: true,
        auto_confirmed: true,
        status: "completed",
      })
      .eq("id", matchId);

    if (!error) {
      toast({ title: "Score auto-confirmed", description: "Match result has been recorded" });
      onComplete?.();
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!match || !teamA || !teamB) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Match not found
        </CardContent>
      </Card>
    );
  }

  const isSubmitter = match.player_score_submitted_by === currentUserId;
  const isOpponent = !isSubmitter && userTeamId !== null;
  const awaitingConfirmation = match.player_score_submitted_at && match.opponent_confirmed === null;
  const isCompleted = match.status === "completed";
  const isDisputed = match.status === "disputed";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Match Score</CardTitle>
          <CardDescription>
            {isCompleted ? "Final Score" : awaitingConfirmation ? "Awaiting Confirmation" : "Enter the final score"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display/Entry */}
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <p className="font-semibold text-lg mb-2">{teamA.team_name}</p>
              {isCompleted || awaitingConfirmation ? (
                <div className="text-4xl font-bold">{match.team1_score}</div>
              ) : (
                <Input
                  type="number"
                  min="0"
                  max="99"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="text-center text-2xl h-16"
                />
              )}
            </div>
            
            <div className="text-center text-muted-foreground text-2xl font-light">
              vs
            </div>
            
            <div className="text-center">
              <p className="font-semibold text-lg mb-2">{teamB.team_name}</p>
              {isCompleted || awaitingConfirmation ? (
                <div className="text-4xl font-bold">{match.team2_score}</div>
              ) : (
                <Input
                  type="number"
                  min="0"
                  max="99"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="text-center text-2xl h-16"
                />
              )}
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex justify-center gap-2">
            {isCompleted && (
              <Badge className="gap-1" variant="default">
                <CheckCircle className="h-3 w-3" />
                Confirmed
              </Badge>
            )}
            {isDisputed && (
              <Badge className="gap-1" variant="destructive">
                <AlertTriangle className="h-3 w-3" />
                Disputed
              </Badge>
            )}
            {match.auto_confirmed && (
              <Badge variant="secondary">Auto-confirmed</Badge>
            )}
          </div>

          {/* Auto-confirm Timer */}
          {awaitingConfirmation && countdown !== null && countdown > 0 && (
            <div className="text-center p-4 bg-muted rounded-lg">
              <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Auto-confirms in</p>
              <p className="text-2xl font-mono font-bold">{formatCountdown(countdown)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {!isCompleted && !awaitingConfirmation && userTeamId && (
              <Button
                onClick={handleSubmitScore}
                disabled={submitting || !scoreA || !scoreB}
                className="w-full"
                size="lg"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Score
              </Button>
            )}

            {awaitingConfirmation && isOpponent && (
              <div className="space-y-2">
                <Button
                  onClick={handleConfirmScore}
                  disabled={submitting}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Confirm Score
                </Button>
                <Button
                  onClick={() => setShowDisputeDialog(true)}
                  disabled={submitting}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Dispute Score
                </Button>
              </div>
            )}

            {awaitingConfirmation && isSubmitter && (
              <p className="text-center text-sm text-muted-foreground">
                Waiting for your opponent to confirm the score...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dispute Dialog */}
      <AlertDialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dispute Score</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure the reported score is incorrect? A tournament official will be notified to resolve this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="What is the correct score?"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisputeScore} className="bg-destructive text-destructive-foreground">
              Submit Dispute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
