import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users } from "lucide-react";
import SwipeToConfirm from "@/components/SwipeToConfirm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface MatchData {
  team1Player1: string;
  team1Player1Name: string;
  team1Player2: string;
  team1Player2Name: string;
  team2Player1: string;
  team2Player1Name: string;
  team2Player2: string;
  team2Player2Name: string;
  team1Score: string;
  team2Score: string;
  matchDate: string;
  selectedCourt: string;
  courtName: string;
  otherLocation: string;
  currentUserId: string;
  currentUserName: string;
}

interface MatchConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchData: MatchData | null;
  onSuccess: () => void;
}

const MatchConfirmationDialog = ({ open, onOpenChange, matchData, onSuccess }: MatchConfirmationDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!matchData) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const score1 = parseInt(matchData.team1Score);
      const score2 = parseInt(matchData.team2Score);

      const { data: matchDbData, error: matchError } = await supabase
        .from("matches")
        .insert({
          match_date: matchData.matchDate,
          team1_score: score1,
          team2_score: score2,
          created_by: matchData.currentUserId,
          court_id: matchData.selectedCourt === 'other' ? null : matchData.selectedCourt,
          other_location: matchData.selectedCourt === 'other' ? matchData.otherLocation : null,
          status: 'approved',
        })
        .select()
        .single();

      if (matchError) throw matchError;

      const participants = [
        {
          match_id: matchDbData.id,
          player_id: matchData.team1Player1,
          team: 1,
        },
        {
          match_id: matchDbData.id,
          player_id: matchData.team1Player2,
          team: 1,
        },
        {
          match_id: matchDbData.id,
          player_id: matchData.team2Player1,
          team: 2,
        },
        {
          match_id: matchDbData.id,
          player_id: matchData.team2Player2,
          team: 2,
        },
      ];

      const { error: participantsError } = await supabase
        .from("match_participants")
        .insert(participants);

      if (participantsError) throw participantsError;

      await supabase.rpc('recalculate_all_ratings');

      setTimeout(() => {
        toast.success("Match recorded successfully!");
        onSuccess();
      }, 1000);
    } catch (error: any) {
      const userMessage = error.message?.includes('unique') || error.message?.includes('duplicate')
        ? "A match with this information already exists"
        : "Couldn't submit. Try again.";
      
      if ((window as any).swipeToConfirmError) {
        (window as any).swipeToConfirmError(userMessage);
      } else {
        toast.error(userMessage);
      }
      setIsSubmitting(false);
      console.error(error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Confirm Match Results</h1>
            <p className="text-muted-foreground">
              Review the details below. If everything looks good, swipe to submit.
            </p>
          </div>

          {/* Match Details Card */}
          <Card className="shadow-lg">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Doubles Match
              </CardTitle>
              <CardDescription>Round Robin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Date */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-muted-foreground">Date</p>
                  <p className="text-foreground">{formatDate(matchData.matchDate)}</p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-muted-foreground">Court / Facility</p>
                  <p className="text-foreground">
                    {matchData.selectedCourt === 'other' 
                      ? matchData.otherLocation 
                      : matchData.courtName}
                  </p>
                </div>
              </div>

              {/* Teams and Scores */}
              <div className="space-y-4 border-t pt-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Team 1 */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-primary text-lg">Team 1</h3>
                    <div className="space-y-1">
                      <p className="text-foreground">{matchData.team1Player1Name}</p>
                      <p className="text-foreground">{matchData.team1Player2Name}</p>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-4 text-center">
                      <p className="text-4xl font-bold text-primary">{matchData.team1Score}</p>
                    </div>
                  </div>

                  {/* Team 2 */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-secondary text-lg">Team 2</h3>
                    <div className="space-y-1">
                      <p className="text-foreground">{matchData.team2Player1Name}</p>
                      <p className="text-foreground">{matchData.team2Player2Name}</p>
                    </div>
                    <div className="bg-secondary/10 rounded-lg p-4 text-center">
                      <p className="text-4xl font-bold text-secondary">{matchData.team2Score}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Entered By */}
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Entered by: <span className="font-semibold text-foreground">{matchData.currentUserName}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isSubmitting}
              >
                Edit Match
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>

            {/* Swipe to Confirm */}
            <SwipeToConfirm
              onConfirm={handleConfirm}
              text="Swipe to lock and submit"
              successText="Match submitted"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchConfirmationDialog;
