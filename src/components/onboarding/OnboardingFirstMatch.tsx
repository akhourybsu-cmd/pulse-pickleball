import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { OnboardingLayout } from "./OnboardingLayout";
import { Gamepad2, TrendingUp, Trophy } from "lucide-react";

interface OnboardingFirstMatchProps {
  onRecordMatch: () => void;
  onSkip: () => void;
}

export const OnboardingFirstMatch = ({ 
  onRecordMatch, 
  onSkip 
}: OnboardingFirstMatchProps) => {
  const navigate = useNavigate();

  const handleRecordMatch = () => {
    // Navigate to match wizard with onboarding flag
    navigate('/match/new?onboarding=true');
  };

  return (
    <OnboardingLayout currentStep={1}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/20 mb-4">
            <Gamepad2 className="w-8 h-8 text-secondary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Record Your First Match
          </h1>
          <p className="text-muted-foreground text-sm">
            Every match you record updates your Pulse Rating — your dynamic skill score.
          </p>
        </div>

        {/* Rating explanation card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-muted/50 rounded-xl p-6 border border-border"
        >
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              Your rating starts at
            </div>
            <div className="text-5xl font-bold text-primary">
              3.00
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              It adjusts after every match based on who you play and how you perform.
            </p>
          </div>
        </motion.div>

        {/* Benefits list */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 text-sm">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Trophy className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Track your progress</p>
              <p className="text-muted-foreground text-xs">See how your skills improve over time</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Find balanced games</p>
              <p className="text-muted-foreground text-xs">Get matched with players at your level</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button 
            onClick={handleRecordMatch}
            className="w-full h-12 text-base font-semibold"
          >
            Record a Match
          </Button>
          <button
            onClick={onSkip}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            I'll record one later
          </button>
        </div>

        {/* Tip */}
        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg py-2 px-3 inline-block">
            💡 Already played today? Log it now!
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
};
