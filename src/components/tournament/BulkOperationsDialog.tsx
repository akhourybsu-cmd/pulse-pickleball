import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface Match {
  id: string;
  match_number: number;
  team1_id: string;
  team2_id: string;
  status: string;
  team1?: { team_name: string };
  team2?: { team_name: string };
}

interface BulkOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: Match[];
  onSuccess: () => void;
}

export const BulkOperationsDialog = ({
  open,
  onOpenChange,
  matches,
  onSuccess,
}: BulkOperationsDialogProps) => {
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Record<string, { team1: string; team2: string }>>({});

  const scheduledMatches = matches.filter(m => m.status === 'scheduled');

  const toggleMatch = (matchId: string) => {
    const newSelected = new Set(selectedMatches);
    if (newSelected.has(matchId)) {
      newSelected.delete(matchId);
    } else {
      newSelected.add(matchId);
    }
    setSelectedMatches(newSelected);
  };

  const updateScore = (matchId: string, team: 'team1' | 'team2', value: string) => {
    setScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: value
      }
    }));
  };

  const handleBulkSubmit = async () => {
    try {
      const updates = Array.from(selectedMatches).map(matchId => {
        const score = scores[matchId];
        if (!score || !score.team1 || !score.team2) {
          throw new Error(`Missing scores for match ${matchId}`);
        }

        return supabase
          .from('tournaments_matches')
          .update({
            team1_score: parseInt(score.team1),
            team2_score: parseInt(score.team2),
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', matchId);
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} matches`);
      }

      toast.success(`Updated ${selectedMatches.size} matches`);
      setSelectedMatches(new Set());
      setScores({});
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Bulk update error:', error);
      toast.error(error.message || "Failed to update matches");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Score Entry</DialogTitle>
          <DialogDescription>
            Enter scores for multiple completed matches at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {scheduledMatches.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No scheduled matches available
            </p>
          ) : (
            scheduledMatches.map(match => (
              <div key={match.id} className="border rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedMatches.has(match.id)}
                    onCheckedChange={() => toggleMatch(match.id)}
                  />
                  <div className="flex-1 space-y-3">
                    <div className="font-medium">
                      Match #{match.match_number}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">
                          {match.team1?.team_name || 'Team 1'}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Score"
                          disabled={!selectedMatches.has(match.id)}
                          value={scores[match.id]?.team1 || ''}
                          onChange={(e) => updateScore(match.id, 'team1', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">
                          {match.team2?.team_name || 'Team 2'}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Score"
                          disabled={!selectedMatches.has(match.id)}
                          value={scores[match.id]?.team2 || ''}
                          onChange={(e) => updateScore(match.id, 'team2', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between items-center pt-4">
          <div className="text-sm text-muted-foreground">
            {selectedMatches.size} match(es) selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkSubmit}
              disabled={selectedMatches.size === 0}
            >
              Submit {selectedMatches.size} Score(s)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
