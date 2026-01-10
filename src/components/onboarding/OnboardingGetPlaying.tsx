import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { OnboardingLayout } from "./OnboardingLayout";
import { Calendar, ClipboardList, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { useDiscoverEvents } from "@/hooks/useDiscoverEvents";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface OnboardingGetPlayingProps {
  onSkip: () => void;
}

export const OnboardingGetPlaying = ({ onSkip }: OnboardingGetPlayingProps) => {
  const navigate = useNavigate();
  
  // Fetch a few upcoming events to show as preview
  const { data: events, isLoading } = useDiscoverEvents({
    limit: 3,
    dateRange: 'this_week',
  });

  const handleFindEvents = () => {
    navigate('/player/find?onboarding=true');
  };

  const handleRecordMatch = () => {
    navigate('/match/new?onboarding=true');
  };

  return (
    <OnboardingLayout currentStep={1}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4"
          >
            <Sparkles className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Let's Get You Playing!
          </h1>
          <p className="text-muted-foreground text-sm">
            Your Pulse Rating starts at 3.00 and updates with every match you play
          </p>
        </div>

        {/* Rating Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-5 border border-border text-center"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            Your starting rating
          </div>
          <div className="text-5xl font-bold text-primary mb-2">3.00</div>
          <p className="text-xs text-muted-foreground">
            Play matches to see it grow!
          </p>
        </motion.div>

        {/* Two Options */}
        <div className="space-y-3">
          {/* Option 1: Find an Event */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            onClick={handleFindEvents}
            className="w-full p-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-primary-foreground/20">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">Find an Event</h3>
                  <ChevronRight className="w-5 h-5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-sm text-primary-foreground/80 mt-0.5">
                  Join a round robin, tournament, or open play
                </p>
              </div>
            </div>
            
            {/* Event Preview (if available) */}
            {!isLoading && events && events.length > 0 && (
              <div className="mt-3 pt-3 border-t border-primary-foreground/20">
                <p className="text-xs text-primary-foreground/70 mb-2">Events happening soon:</p>
                <div className="space-y-1.5">
                  {events.slice(0, 2).map((event) => (
                    <div key={event.id} className="flex items-center gap-2 text-sm">
                      <div className={cn(
                        "w-8 h-8 rounded-md flex flex-col items-center justify-center text-[10px] font-medium",
                        "bg-primary-foreground/20"
                      )}>
                        <span>{format(new Date(event.start_time), "MMM")}</span>
                        <span className="font-bold text-xs">{format(new Date(event.start_time), "d")}</span>
                      </div>
                      <span className="truncate flex-1">{event.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.button>

          {/* Option 2: Record a Match */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            onClick={handleRecordMatch}
            className="w-full p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-muted">
                <ClipboardList className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Log a Past Match</h3>
                  <ChevronRight className="w-5 h-5 text-muted-foreground opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Already played today? Record it now
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Skip */}
        <div className="text-center pt-2">
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            I'll do this later
          </button>
        </div>
      </div>
    </OnboardingLayout>
  );
};
