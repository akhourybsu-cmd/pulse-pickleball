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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

interface DisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: {
    id: string;
    team1: { team_name: string };
    team2: { team_name: string };
    team1_score: number | null;
    team2_score: number | null;
    disputed?: boolean;
    dispute_notes?: string | null;
  } | null;
  onSuccess: () => void;
}

export function DisputeDialog({ open, onOpenChange, match, onSuccess }: DisputeDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);

  const handleFlagDispute = async () => {
    if (!match || !notes.trim()) {
      toast({
        title: "Notes required",
        description: "Please describe the reason for the dispute",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from("tournaments_matches")
      .update({
        disputed: true,
        dispute_notes: notes.trim(),
      })
      .eq("id", match.id);

    if (error) {
      toast({
        title: "Error flagging dispute",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Dispute flagged",
        description: "This match has been marked for review",
      });
      onOpenChange(false);
      setNotes("");
      onSuccess();
    }

    setSubmitting(false);
  };

  const handleResolveDispute = async () => {
    if (!match) return;

    setResolving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("tournaments_matches")
      .update({
        disputed: false,
        dispute_resolved_by: user?.id || null,
        dispute_resolved_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (error) {
      toast({
        title: "Error resolving dispute",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Dispute resolved",
        description: "The match dispute has been cleared",
      });
      onOpenChange(false);
      setNotes("");
      onSuccess();
    }

    setResolving(false);
  };

  if (!match) return null;

  const isDisputed = match.disputed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isDisputed ? "text-amber-500" : "text-muted-foreground"}`} />
            {isDisputed ? "Resolve Dispute" : "Flag Dispute"}
          </DialogTitle>
          <DialogDescription>
            {match.team1.team_name} vs {match.team2.team_name}
            {match.team1_score !== null && match.team2_score !== null && (
              <span className="ml-2">
                (Score: {match.team1_score} - {match.team2_score})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isDisputed ? (
            <>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  This match is currently disputed
                </p>
                {match.dispute_notes && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Reason:</strong> {match.dispute_notes}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Resolving this dispute will confirm the current score and clear the dispute flag.
                You can edit the score before resolving if needed.
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="dispute-notes">Describe the dispute</Label>
              <Textarea
                id="dispute-notes"
                placeholder="e.g., Team disputes the recorded score, claims it was 11-9 not 11-7..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Disputed matches will be highlighted for admin review
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isDisputed ? (
            <Button 
              onClick={handleResolveDispute}
              disabled={resolving}
              className="bg-green-600 hover:bg-green-700"
            >
              {resolving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Resolve Dispute
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={handleFlagDispute}
              disabled={submitting || !notes.trim()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Flag as Disputed
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
