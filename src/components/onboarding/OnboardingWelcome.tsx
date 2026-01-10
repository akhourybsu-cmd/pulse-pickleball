import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OnboardingChecklist } from "./OnboardingProgress";
import { X } from "lucide-react";

interface OnboardingWelcomeProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
  onSkip: () => void;
  hasCompletedProfile?: boolean;
  hasFirstMatch?: boolean;
}

export const OnboardingWelcome = ({
  isOpen,
  onClose,
  onStart,
  onSkip,
  hasCompletedProfile = false,
  hasFirstMatch = false,
}: OnboardingWelcomeProps) => {
  if (!isOpen) return null;

  const checklistItems = [
    { label: "Set up your profile", completed: hasCompletedProfile, current: !hasCompletedProfile },
    { label: "Find an event or record a match", completed: hasFirstMatch, current: hasCompletedProfile && !hasFirstMatch },
    { label: "See your Pulse Rating", completed: false, current: hasFirstMatch },
    { label: "You're ready!", completed: false },
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
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

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
