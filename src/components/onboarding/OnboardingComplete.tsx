import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { OnboardingLayout } from "./OnboardingLayout";
import { Calendar, Users, BarChart3, ChevronRight, Rocket } from "lucide-react";

interface OnboardingCompleteProps {
  onComplete: () => void;
}

export const OnboardingComplete = ({ onComplete }: OnboardingCompleteProps) => {
  const navigate = useNavigate();

  const nextSteps = [
    {
      icon: Calendar,
      title: "Find Events",
      description: "Round robins, tournaments nearby",
      action: () => navigate('/events'),
      actionLabel: "Explore",
    },
    {
      icon: Users,
      title: "Join a Group",
      description: "Connect with local players",
      action: () => navigate('/courts'),
      actionLabel: "Browse",
    },
    {
      icon: BarChart3,
      title: "View Your Stats",
      description: "Match history, court performance",
      action: () => navigate('/history'),
      actionLabel: "View",
    },
  ];

  return (
    <OnboardingLayout currentStep={3}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4"
          >
            <Rocket className="w-8 h-8 text-primary" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-foreground mb-2"
          >
            You're Ready to Play!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground text-sm"
          >
            Here's what you can explore next:
          </motion.p>
        </div>

        {/* Next steps cards */}
        <div className="space-y-3">
          {nextSteps.map((step, index) => (
            <motion.button
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              onClick={step.action}
              className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-muted/50 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <step.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {step.actionLabel}
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="pt-4"
        >
          <Button 
            onClick={onComplete}
            className="w-full h-12 text-base font-semibold"
          >
            Go to Dashboard
          </Button>
        </motion.div>

        {/* Celebration confetti-like decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground">
            🎾 Welcome to the Pulse community! 🎾
          </p>
        </motion.div>
      </div>
    </OnboardingLayout>
  );
};
