import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OnboardingLayout } from "./OnboardingLayout";
import { Star, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import CountUp from "react-countup";

interface OnboardingRatingRevealProps {
  currentRating: number;
  ratingChange: number;
  onContinue: () => void;
}

export const OnboardingRatingReveal = ({ 
  currentRating, 
  ratingChange,
  onContinue 
}: OnboardingRatingRevealProps) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const displayRating = currentRating || 3.0;
  const displayChange = ratingChange || 0;

  return (
    <OnboardingLayout currentStep={2}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="text-5xl mb-4"
          >
            🎉
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            You're on the Board!
          </h1>
        </div>

        {/* Rating card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-2xl p-8 border border-primary/30"
        >
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
              Your Pulse Rating
            </p>
            <div className="flex items-center justify-center gap-2">
              <Star className="w-8 h-8 text-primary" />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-6xl font-bold text-foreground"
              >
                <CountUp 
                  end={displayRating} 
                  decimals={2} 
                  duration={1.5}
                  delay={0.6}
                />
              </motion.div>
              <Star className="w-8 h-8 text-primary" />
            </div>
            
            {displayChange !== 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className={`inline-flex items-center gap-1 text-sm font-medium ${
                  displayChange > 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {displayChange > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingUp className="w-4 h-4 rotate-180" />
                )}
                {displayChange > 0 ? '+' : ''}{displayChange.toFixed(2)} from match
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Explanation */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-sm text-muted-foreground"
        >
          Your rating will update after every match. Play more, climb higher!
        </motion.p>

        {/* Expandable info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="w-full flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted/70 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              📈 How Pulse Ratings Work
            </span>
            {showExplanation ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="px-4 pb-4 pt-2"
            >
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Win against stronger players?</strong> You gain more points.
                </p>
                <p>
                  <strong className="text-foreground">Lose to weaker players?</strong> You lose more points.
                </p>
                <p>
                  <strong className="text-foreground">Close games?</strong> Ratings adjust less dramatically.
                </p>
                <p className="text-xs pt-2 text-muted-foreground/70">
                  The system uses an ELO-based algorithm that factors in opponent strength and match margins.
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="pt-2"
        >
          <Button 
            onClick={onContinue}
            className="w-full h-12 text-base font-semibold"
          >
            See What's Next
          </Button>
        </motion.div>
      </div>
    </OnboardingLayout>
  );
};
