import { useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

export function RoundRobinGuidedTour() {
  const [run, setRun] = useState(false);

  const steps: Step[] = [
    {
      target: 'body',
      content: (
        <div>
          <h2 className="text-xl font-bold mb-2">Welcome to Round Robin Events! 🏓</h2>
          <p>Let's walk through how to organize a professional pickleball tournament step by step.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="create-event-btn"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Create Your First Event</h3>
          <p>Click here to start creating a new Round Robin tournament. You'll set up the event details, select players, and configure courts.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="upcoming-events"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Upcoming Events</h3>
          <p>Your scheduled tournaments appear here. Click any event to manage it, view the schedule, or enter scores.</p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="past-events"]',
      content: (
        <div>
          <h3 className="font-bold mb-2">Past Events</h3>
          <p>Review completed tournaments, view final standings, and access historical data from your past events.</p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-bold mb-3">Key Features You'll Use</h3>
          <ul className="space-y-2 text-sm">
            <li>• <strong>Auto Schedule:</strong> The system generates fair matchups ensuring everyone plays with different partners</li>
            <li>• <strong>Score Entry:</strong> Record results as games finish - the leaderboard updates in real-time</li>
            <li>• <strong>Kiosk Mode:</strong> Display matches on a TV screen so players know where to go</li>
            <li>• <strong>Player Management:</strong> Add/remove players and track check-ins</li>
            <li>• <strong>Audit History:</strong> Review all changes made during the event</li>
          </ul>
        </div>
      ),
      placement: 'center',
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-bold mb-3">Quick Tips for Success</h3>
          <ul className="space-y-2 text-sm">
            <li>📋 <strong>Player Count:</strong> Must be divisible by 4 (8, 12, 16, etc.)</li>
            <li>⏰ <strong>Round Time:</strong> Allow 15-20 minutes per round</li>
            <li>📺 <strong>Kiosk Setup:</strong> Connect a TV early and test the display</li>
            <li>🔐 <strong>Set a PIN:</strong> Protect kiosk mode from unauthorized changes</li>
            <li>✅ <strong>Score Promptly:</strong> Enter results after each match to keep players informed</li>
          </ul>
        </div>
      ),
      placement: 'center',
    },
    {
      target: 'body',
      content: (
        <div>
          <h2 className="text-xl font-bold mb-2">You're Ready! 🎉</h2>
          <p className="mb-3">You now know the basics of organizing Round Robin events with PULSE.</p>
          <p className="text-sm text-muted-foreground">Click "Create Event" to get started. The system will guide you through each step.</p>
        </div>
      ),
      placement: 'center',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setRun(true)}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <HelpCircle className="h-4 w-4" />
        Tutorial
      </Button>

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
          last: 'Get Started!',
          skip: 'Skip Tutorial',
          back: 'Back',
          next: 'Next',
        }}
      />
    </>
  );
}
