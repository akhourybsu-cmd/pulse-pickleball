import { useState } from "react";
import { Link, useNavigate } [MOCK - truncated for brevity] ... } from "react-router-dom";
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
import logo from "@/assets/pulse-logo-premium.svg";

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

      // 5. Create match approvals for real players.
      //    Auto-approve everyone on the SUBMITTER'S team — the submitter and
      //    their partner played the same game on the same side, so the
      //    submitter is effectively confirming the result for that side.
      //    Opponents still need to individually confirm.
      const submitterTeam =
        participants.find(p => p.player_id === user.id)?.team ?? null;

      const realPlayers = participants.filter(p => p.player_id);

      if (realPlayers.length > 0) {
        const nowIso = new Date().toISOString();
        const approvals = realPlayers.map(p => {
          const autoApprove =
            p.player_id === user.id ||
            (submitterTeam !== null && p.team === submitterTeam);
          return {
            match_id: match.id,
            player_id: p.player_id,
            approved: autoApprove ? true : null,
            approved_at: autoApprove ? nowIso : null,
          };
        });

        const { error: approvalsError } = await supabase
          .from('match_approvals')
          .insert(approvals);

        if (approvalsError) throw approvalsError;
      }

      // Notify opponents (anyone NOT on submitter's team) that a match needs
      // verification. The DB trigger already inserts verification rows on
      // approval-row creation, but we add a richer per-opponent toast-style
      // notification so they see who submitted and where to go.
      const opponents = realPlayers.filter(
        p => submitterTeam !== null && p.team !== submitterTeam
      );
      if (opponents.length > 0) {
        await supabase.from('user_notifications').insert(
          opponents.map(p => ({
            user_id: p.player_id!,
            notification_type: 'match_submitted_for_verification',
            category: 'matches',
            priority: 'high',
            title: 'New match needs your verification',
            message: 'A teammate submitted a match — tap to confirm the result.',
            link: '/player/matches?tab=pending',
            actor_id: user.id,
            metadata: { match_id: match.id },
          }))
        );

        // Send branded verification email to each opponent (best-effort).
        try {
          // Build human-readable context from submitter + match details.
          const playerIds = [
            user.id,
            ...realPlayers.map(p => p.player_id!).filter(id => id !== user.id),
          ];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, display_name')
            .in('id', playerIds);
          const nameFor = (id: string) => {
            const p = profiles?.find(pr => pr.id === id);
            return p?.display_name || p?.full_name || 'A player';
          };
          const submittedByName = nameFor(user.id);
          const scoreStr = `${team1Score}–${team2Score}`;
          const playedAt = new Date(formData.matchDate).toLocaleString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          const verifyUrl = `${window.location.origin}/player/matches?tab=pending`;
          const formatLabel =
            formData.matchFormat === 'singles' ? 'Singles' : 'Doubles';

          await Promise.all(
            opponents.map(async (opp) => {
              const oppId = opp.player_id!;
              // Opponent's partner is the other person on their team.
              const partnerId = realPlayers.find(
                p => p.team === opp.team && p.player_id !== oppId
              )?.player_id;
              // The submitter's team (team opposite to opp.team)
              const submitterSide = realPlayers
                .filter(p => p.team !== opp.team)
                .map(p => nameFor(p.player_id!))
                .join(' & ');

              await supabase.functions.invoke('send-transactional-email', {
                body: {
                  templateName: 'match-verification-request',
                  recipientUserId: oppId,
                  idempotencyKey: `match-verify-${match.id}-${oppId}`,
                  templateData: {
                    recipientName: nameFor(oppId).split(' ')[0],
                    submittedByName,
                    matchSummary: formatLabel,
                    score: scoreStr,
                    partner: partnerId ? nameFor(partnerId) : undefined,
                    opponents: submitterSide,
                    playedAt,
                    location: locationLabel || undefined,
                    verifyUrl,
                  },
                },
              });
            })
          );
        } catch (emailErr) {
          // Email is non-blocking — the in-app notification already fired.
          console.warn('Match verification email failed', emailErr);
        }
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
      <div className="sticky top-0 z-40 bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-[72px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/player/dashboard')}
            className="h-9 w-9"
            aria-label="Cancel and return home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img
            src={logo}
            alt="PULSE"
            className="h-[60px] sm:h-[75px] w-auto"
          />
          <div className="h-9 w-9" aria-hidden="true" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        <div className="mb-4">
          <h1 className="text-xl font-semibold leading-tight">Record Match</h1>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            Saved to your PULSE history
          </p>
        </div>

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
