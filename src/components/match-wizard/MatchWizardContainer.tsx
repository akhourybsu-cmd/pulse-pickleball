import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MatchWizardProgress } from "./MatchWizardProgress";
import { MatchWizardCard } from "./MatchWizardCard";
import { MatchWizardNavigation } from "./MatchWizardNavigation";
import { DateLocationStep } from "./steps/DateLocationStep";
import { MatchTypeStep } from "./steps/MatchTypeStep";
import { PlayerSelectionStep } from "./steps/PlayerSelectionStep";
import { ScoreEntryStep } from "./steps/ScoreEntryStep";
import { ReviewStep } from "./steps/ReviewStep";
import { 
  useMatchWizardSteps, 
  getInitialFormData, 
  MatchWizardFormData 
} from "./hooks/useMatchWizardSteps";

export function MatchWizardContainer() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<MatchWizardFormData>(getInitialFormData());
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { steps, totalSteps, isStepValid } = useMatchWizardSteps(formData);
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === totalSteps - 1;

  const updateFormData = <K extends keyof MatchWizardFormData>(
    field: K,
    value: MatchWizardFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const goNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setDirection('forward');
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setDirection('backward');
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleContinue = async () => {
    if (isLastStep) {
      await handleSubmit();
    } else {
      goNext();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    let createdMatchId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const slotsPerTeam = formData.matchFormat === 'singles' ? 1 : 2;

      // 1. Persist the chosen city/town to user_recent_locations so the next
      //    match defaults are sensible. PULSE no longer pins matches to a
      //    specific court — the wizard captures a normalized location label
      //    (e.g. "Brooklyn, NY 11201") that's stored on matches.other_location.
      const customLoc = formData.customLocation;
      if (customLoc && !customLoc.id) {
        await supabase
          .from('user_recent_locations')
          .upsert({
            user_id: user.id,
            name: customLoc.name,
            city: customLoc.city || null,
            state: customLoc.state || null,
            used_at: new Date().toISOString(),
          }, { onConflict: 'user_id,name' });
      } else if (customLoc?.id) {
        await supabase
          .from('user_recent_locations')
          .update({ used_at: new Date().toISOString() })
          .eq('id', customLoc.id);
      }

      const locationLabel =
        customLoc?.name?.trim() ||
        [customLoc?.city, customLoc?.state].filter(Boolean).join(', ').trim() ||
        null;

      // Determine scores based on winner
      const team1Score = formData.winner === 1 ? formData.winnerScore : formData.loserScore;
      const team2Score = formData.winner === 2 ? formData.winnerScore : formData.loserScore;

      // 2. Create match record
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          match_date: formData.matchDate,
          team1_score: team1Score,
          team2_score: team2Score,
          created_by: user.id,
          match_type: 'casual',
          match_format: formData.matchFormat,
          court_id: null,
          other_location: locationLabel,
          status: 'pending',
          rating_eligible: formData.updateRatings,
        })
        .select('id')
        .single();

      if (matchError) throw matchError;
      createdMatchId = match.id;

      // 3. Create guest players if any
      const guestPlayerMap = new Map<string, string>(); // guestName -> guestPlayerId
      
      for (const [teamNum, team] of [[1, formData.team1], [2, formData.team2]] as const) {
        for (const slot of (team as typeof formData.team1).slice(0, slotsPerTeam)) {
          if (slot.isGuest && slot.guestName) {
            const { data: guestPlayer, error: guestError } = await supabase
              .from('guest_match_players')
              .insert({
                match_id: match.id,
                display_name: slot.guestName,
                notes: slot.guestNotes || null,
                team: teamNum,
              })
              .select('id')
              .single();

            if (guestError) throw guestError;
            guestPlayerMap.set(`${teamNum}-${slot.guestName}`, guestPlayer.id);
          }
        }
      }

      // 4. Create match participants
      const participants: Array<{
        match_id: string;
        player_id: string | null;
        guest_player_id: string | null;
        team: number;
      }> = [];

      for (const [teamNum, team] of [[1, formData.team1], [2, formData.team2]] as const) {
        for (const slot of (team as typeof formData.team1).slice(0, slotsPerTeam)) {
          if (slot.playerId || slot.isGuest) {
            participants.push({
              match_id: match.id,
              player_id: slot.isGuest ? null : slot.playerId,
              guest_player_id: slot.isGuest && slot.guestName 
                ? guestPlayerMap.get(`${teamNum}-${slot.guestName}`) || null 
                : null,
              team: teamNum,
            });
          }
        }
      }

      const { error: participantsError } = await supabase
        .from('match_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      // 5. Create match approvals for real players
      const realPlayerIds = participants
        .filter(p => p.player_id)
        .map(p => p.player_id!);

      if (realPlayerIds.length > 0) {
        const approvals = realPlayerIds.map(playerId => ({
          match_id: match.id,
          player_id: playerId,
          approved: playerId === user.id ? true : null, // Auto-approve for creator
          approved_at: playerId === user.id ? new Date().toISOString() : null,
        }));

        const { error: approvalsError } = await supabase
          .from('match_approvals')
          .insert(approvals);

        if (approvalsError) throw approvalsError;
      }

      toast.success('Match submitted — pending player verification.');
      // Land on the player's matches page with the Pending tab pre-selected
      // so they immediately see the match they just submitted awaiting
      // confirmation from the other players.
      navigate('/player/matches?tab=pending');
    } catch (error: any) {
      console.error('Error recording match:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      // Roll back the orphan match row so the user can retry without
      // leaving stale data behind.
      if (createdMatchId) {
        await supabase.from('matches').delete().eq('id', createdMatchId);
      }
      toast.error(error?.message || 'Failed to record match');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep.id) {
      case 'date-location':
        return <DateLocationStep formData={formData} updateFormData={updateFormData} />;
      case 'match-type':
        return <MatchTypeStep formData={formData} updateFormData={updateFormData} onAutoAdvance={goNext} />;
      case 'players':
        return <PlayerSelectionStep formData={formData} updateFormData={updateFormData} />;
      case 'score':
        return <ScoreEntryStep formData={formData} updateFormData={updateFormData} />;
      case 'review':
        return <ReviewStep formData={formData} updateFormData={updateFormData} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            // Predictable exit — always back to the player home rather than
            // navigate(-1), which can leak outside the shell if the user
            // deep-linked here.
            onClick={() => navigate('/player/dashboard')}
            className="h-9 w-9"
            aria-label="Cancel and return home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold leading-tight">Record Match</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Saved to your PULSE history
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        <MatchWizardProgress
          steps={steps}
          currentStepIndex={currentStepIndex}
          onBack={goBack}
          canGoBack={currentStepIndex > 0}
        />

        <AnimatePresence mode="wait">
          <MatchWizardCard
            key={currentStep.id}
            direction={direction}
            stepId={currentStep.id}
          >
            {renderStep()}
          </MatchWizardCard>
        </AnimatePresence>
      </div>

      {/* Navigation - Skip auto-advance steps */}
      {currentStep.id !== 'match-type' && (
        <MatchWizardNavigation
          onContinue={handleContinue}
          isValid={isStepValid(currentStep.id)}
          isLoading={isSubmitting}
          isLastStep={isLastStep}
        />
      )}
    </div>
  );
}
