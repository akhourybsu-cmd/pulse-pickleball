import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, HelpCircle } from "lucide-react";
import createEventImg from "@/assets/tutorial/rr-create-event.png";
import scheduleViewImg from "@/assets/tutorial/rr-schedule-view.png";
import scoreEntryImg from "@/assets/tutorial/rr-score-entry.png";
import kioskModeImg from "@/assets/tutorial/rr-kiosk-mode.png";
import playerManagementImg from "@/assets/tutorial/rr-player-management.png";
import settingsPanelImg from "@/assets/tutorial/rr-settings-panel.png";

interface TutorialSlide {
  title: string;
  description: string;
  image: string;
  details: string[];
}

const tutorialSlides: TutorialSlide[] = [
  {
    title: "Welcome to Round Robin Events!",
    description: "Organize seamless pickleball round robin tournaments with PULSE. This guide will walk you through every feature to help you run a successful event.",
    image: createEventImg,
    details: [
      "Automatic schedule generation for fair play",
      "Real-time score tracking and leaderboards",
      "Professional kiosk mode for TV displays",
      "Easy player management and check-ins",
      "Complete audit history of all changes"
    ]
  },
  {
    title: "Creating Your Event",
    description: "Start by setting up your event details. Choose your event name, date, number of courts, and how many rounds you want to play.",
    image: createEventImg,
    details: [
      "Enter a descriptive event name (e.g., 'Summer Pickleball Tournament')",
      "Select the event date using the date picker",
      "Specify the number of courts available (1-10)",
      "Choose the number of rounds to play (typically 4-8 rounds)",
      "Add players by searching from your PULSE community",
      "Events start in 'Draft' status until you're ready to begin"
    ]
  },
  {
    title: "Understanding the Schedule",
    description: "Once created, the system automatically generates a fair schedule ensuring everyone plays with and against different partners.",
    image: scheduleViewImg,
    details: [
      "Schedule shows all matches organized by court and round",
      "Each match displays the four players and their pairings",
      "Color coding helps distinguish different courts",
      "Round numbers are clearly labeled for easy navigation",
      "Schedule ensures maximum partner variety and fair play",
      "You can view upcoming rounds and plan rotations"
    ]
  },
  {
    title: "Managing Players",
    description: "Easily manage your participant list, track check-ins, and make adjustments as needed.",
    image: playerManagementImg,
    details: [
      "Add players before or after creating the event",
      "Search from your PULSE network to invite participants",
      "View check-in status for each player",
      "See skill levels to help balance teams",
      "Remove players if they cancel (schedule auto-adjusts)",
      "Add late arrivals and regenerate schedule if needed",
      "Player count must be divisible by 4 for optimal scheduling"
    ]
  },
  {
    title: "Entering Scores",
    description: "Record match results quickly and accurately. Scores can be entered by organizers or players themselves.",
    image: scoreEntryImg,
    details: [
      "Click on any match to open the score entry modal",
      "Enter game scores (e.g., 11-7, 11-9)",
      "System validates scores (must reach 11, win by 2)",
      "Confirm results to update the leaderboard immediately",
      "Players can enter their own scores if permitted",
      "Edit or correct scores anytime during the event",
      "All score changes are tracked in audit history"
    ]
  },
  {
    title: "Kiosk Mode for TV Display",
    description: "Transform any TV or large screen into a professional tournament display showing live matches and upcoming rounds.",
    image: kioskModeImg,
    details: [
      "Click 'Open Kiosk' to launch fullscreen display mode",
      "Shows current matches on all courts with large, readable text",
      "Displays player names prominently for easy identification",
      "Live countdown timer to next round keeps players on schedule",
      "Real-time score updates appear automatically",
      "Upcoming matchups preview helps players prepare",
      "Perfect for mounting on TVs at your venue",
      "Responsive design works on tablets and large displays"
    ]
  },
  {
    title: "Event Settings & Controls",
    description: "Fine-tune your event with powerful organizer tools and settings.",
    image: settingsPanelImg,
    details: [
      "Edit event details (name, date, courts, rounds) anytime",
      "Manage courts and rounds configuration",
      "Access complete audit history of all changes",
      "Set organizer PIN for kiosk mode security",
      "Control who can enter scores",
      "Enable/disable player self-score entry",
      "Export results and statistics after the event",
      "Delete event if needed (with confirmation)"
    ]
  },
  {
    title: "Running Your Event - Best Practices",
    description: "Tips for a smooth tournament experience from start to finish.",
    image: scheduleViewImg,
    details: [
      "📋 Check player list and court availability before starting",
      "📺 Set up kiosk display where all players can see it",
      "⏰ Communicate round duration (typically 15-20 minutes)",
      "🎯 Announce match assignments before each round",
      "📊 Update scores promptly to keep leaderboard current",
      "🔄 Use Edit Mode sparingly - changes affect fairness",
      "✅ Double-check final scores before completing event",
      "🏆 Review standings and celebrate your winners!"
    ]
  },
  {
    title: "Advanced Features",
    description: "Unlock the full power of Round Robin with these advanced capabilities.",
    image: settingsPanelImg,
    details: [
      "🔧 Edit Mode: Make manual schedule adjustments when needed",
      "📜 Audit History: Review every change made to the event",
      "🔐 Organizer PIN: Secure kiosk mode from unauthorized changes",
      "📱 QR Check-in: Players can check in via QR code",
      "📊 Live Leaderboard: Rankings update in real-time",
      "🎲 Fairness Algorithm: Ensures balanced partner rotations",
      "💾 Auto-save: All changes save automatically",
      "🔄 Re-schedule: Regenerate schedule if players change"
    ]
  },
  {
    title: "You're Ready to Go!",
    description: "You now have everything you need to organize amazing Round Robin events. Start creating your first tournament!",
    image: createEventImg,
    details: [
      "Click 'Create Your First Event' to get started",
      "Invite players from your PULSE network",
      "The system handles complex scheduling automatically",
      "Focus on facilitating great games, not paperwork",
      "Players will love the professional organization",
      "Need help? Visit the FAQ or reach out to support",
      "Happy organizing! 🏓"
    ]
  }
];

export function RoundRobinTutorial() {
  const [open, setOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < tutorialSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentSlide(0);
  };

  const slide = tutorialSlides[currentSlide];

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <HelpCircle className="h-4 w-4" />
        How to Run an Event
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Round Robin Tutorial</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress Indicator */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Step {currentSlide + 1} of {tutorialSlides.length}
                </span>
                <div className="flex gap-1">
                  {tutorialSlides.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 w-8 rounded-full transition-colors ${
                        index === currentSlide ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{slide.title}</h3>
                  <p className="text-muted-foreground">{slide.description}</p>
                </div>

                {/* Image */}
                <div className="rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-auto object-cover"
                  />
                </div>

                {/* Details */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Key Points:</h4>
                  <ul className="space-y-2">
                    {slide.details.map((detail, index) => (
                      <li key={index} className="flex gap-2 text-sm">
                        <span className="text-primary mt-1">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentSlide === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleClose}>
                  Close
                </Button>
                {currentSlide === tutorialSlides.length - 1 ? (
                  <Button onClick={handleClose}>Get Started!</Button>
                ) : (
                  <Button onClick={handleNext} className="gap-2">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
