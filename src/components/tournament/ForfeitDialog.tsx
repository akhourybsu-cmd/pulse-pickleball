import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Flag } from "lucide-react";

interface ForfeitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: {
    id: string;
    team1_id: string;
    team2_id: string;
    team1: { team_name: string };
    team2: { team_name: string };
  } | null;
  onSuccess: () => void;
}

const FORFEIT_REASONS = [
  { value: "no_show", label: "No Show" },
  { value: "withdrawal", label: "Team Withdrawal" },
  { value: "disqualification", label: "Disqualification" },
  { value: "injury", label: "Injury/Medical" },
  { value: "other", label: "Other" },
];

const DEFAULT_FORFEIT_SCORE = { winner: 11, loser: 0 };

export function ForfeitDialog({ open, onOpenChange, match, onSuccess }: ForfeitDialogProps) {
  const { toast } = useToast();
  const [forfeitTeamId, setForfeitTeamId] = useState<string>("");
  const [forfeitReason, setForfeitReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!match || !forfeitTeamId || !forfeitReason) {
      toast({
        title: "Missing information",
        description: "Please select which team forfeited and the reason",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    // Determine scores: forfeiting team loses
    const team1Forfeited = forfeitTeamId === match.team1_id;
    const team1Score = team1Forfeited ? DEFAULT_FORFEIT_SCORE.loser : DEFAULT_FORFEIT_SCORE.winner;
    const team2Score = team1Forfeited ? DEFAULT_FORFEIT_SCORE.winner : DEFAULT_FORFEIT_SCORE.loser;

    const { error } = await supabase
      .from("tournaments_matches")
      .update({
        status: "completed",
        team1_score: team1Score,
        team2_score: team2Score,
        forfeit_team_id: forfeitTeamId,
        forfeit_reason: forfeitReason,
        completed_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (error) {
      toast({
        title: "Error recording forfeit",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const forfeitTeamName = forfeitTeamId === match.team1_id 
        ? match.team1.team_name 
        : match.team2.team_name;
      toast({
        title: "Forfeit recorded",
        description: `${forfeitTeamName} forfeited the match`,
      });
      onOpenChange(false);
      setForfeitTeamId("");
      setForfeitReason("");
      onSuccess();
    }

    setSubmitting(false);
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Record Forfeit
          </DialogTitle>
          <DialogDescription>
            {match.team1.team_name} vs {match.team2.team_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Which team forfeited?</Label>
            <Select value={forfeitTeamId} onValueChange={setForfeitTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={match.team1_id}>{match.team1.team_name}</SelectItem>
                <SelectItem value={match.team2_id}>{match.team2.team_name}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reason for forfeit</Label>
            <Select value={forfeitReason} onValueChange={setForfeitReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {FORFEIT_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">Score will be recorded as:</p>
            <p className="text-muted-foreground mt-1">
              {forfeitTeamId === match.team1_id ? (
                <>
                  {match.team2.team_name}: {DEFAULT_FORFEIT_SCORE.winner} - {match.team1.team_name}: {DEFAULT_FORFEIT_SCORE.loser}
                </>
              ) : forfeitTeamId === match.team2_id ? (
                <>
                  {match.team1.team_name}: {DEFAULT_FORFEIT_SCORE.winner} - {match.team2.team_name}: {DEFAULT_FORFEIT_SCORE.loser}
                </>
              ) : (
                "Select a team to see the score"
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit}
            disabled={submitting || !forfeitTeamId || !forfeitReason}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Forfeit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
