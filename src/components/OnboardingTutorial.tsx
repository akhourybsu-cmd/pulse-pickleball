import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingTutorialProps {
  userId: string;
  onComplete: () => void;
}

export const OnboardingTutorial = ({ userId, onComplete }: OnboardingTutorialProps) => {
  const [run, setRun] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkTutorialStatus = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('tutorial_completed')
        .eq('id', userId)
        .single();

      if (data && !data.tutorial_completed) {
        // Small delay to let the page render
        setTimeout(() => setRun(true), 500);
      }
    };

    checkTutorialStatus();
  }, [userId]);

  const steps: Step[] = [
    {
      target: 'body',
      content: (
        <div>
          <h2 className="text-xl font-bold mb-2">Welcome to Pulse Pickleball! 🏓</h2>
          <p>Let's take a quick tour of your dashboard to get you started.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="pulse-score"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Your Pulse Score</h3>
          <p>This is your live skill rating that updates after each match. It starts at 3.00 and adjusts based on your performance and opponents' ratings.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="record-match"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Record New Match</h3>
          <p>Click here to log a match you've just played. You can record matches for yourself or help others record theirs.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="match-history"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Match History</h3>
          <p>View all your past matches, see detailed stats, and track your progress over time.</p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="court-board"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Court Board</h3>
          <p>Post when you're looking for players or see who else is looking to play. Organize pickup games easily!</p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="events"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Events</h3>
          <p>Create and manage pickleball events like round robins, tournaments, or open play sessions. Track all matches for a specific event.</p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="leaderboard"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Leaderboard</h3>
          <p>See how you rank against other players in your region. Competition is friendly, but the stats are real!</p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="badges"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Your Badges</h3>
          <p>Earn badges for achievements like winning streaks, playing at different times, or reaching milestones. Collect them all!</p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="view-profile"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Your Profile</h3>
          <p>Access your profile to view detailed stats, badges, and personal information.</p>
        </div>
      ),
      placement: 'bottom',
    },
  ];

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, index, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Mark tutorial as completed
      await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', userId);

      setRun(false);
      
      // Navigate to edit profile
      navigate('/profile/edit');
      onComplete();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          zIndex: 10000,
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        },
        spotlight: {
          borderRadius: '8px',
        },
      }}
      locale={{
        last: 'Finish & Edit Profile',
        skip: 'Skip Tutorial',
      }}
    />
  );
};
