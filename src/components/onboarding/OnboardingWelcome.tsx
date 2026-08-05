import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OnboardingChecklist } from "./OnboardingProgress";

interface OnboardingWelcomeProps {
  isOpen: boolean;
  onStart: () => void;
  onSkip: () => void;
  hasCompletedProfile?: boolean;
}

export const OnboardingWelcome = ({
  isOpen,
  onStart,
  onSkip,
  hasCompletedProfile = false,
}: OnboardingWelcomeProps) => {
  if (!isOpen) return null;

  // Mirrors the 3-step flow. No accidental dismiss — the player chooses Start
  // or Skip, so the moment is deliberate.
  const checklistItems = [
    { label: "Set up your profile", completed: hasCompletedProfile, current: !hasCompletedProfile },
    { label: "Learn how PULSE works", completed: false, current: hasCompletedProfile },
    { label: "Start playing", completed: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="pt-10 pb-6 px-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-5xl mb-4"
          >
            🏓
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome to Pulse!
          </h2>
          <p className="text-muted-foreground text-sm">
            Your pickleball journey starts here.
          </p>
        </div>

        {/* Checklist */}
        <div className="px-6 pb-6">
          <OnboardingChecklist items={checklistItems} />
        </div>

        {/* Actions */}
        <div className="px-6 pb-8 space-y-3">
          <Button 
            onClick={onStart} 
            className="w-full h-12 text-base font-semibold"
          >
            Let's Go!
          </Button>
          <button
            onClick={onSkip}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Skip for now
          </button>
        </div>

        {/* Decorative gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
      </motion.div>
    </motion.div>
  );
};
