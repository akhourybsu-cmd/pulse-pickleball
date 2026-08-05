import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { OnboardingProgress } from "./OnboardingProgress";
import { Logo } from "@/components/Logo";

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps?: number;
  showProgress?: boolean;
  stepLabels?: string[];
}

// The guided-onboarding chrome. Mobile-first: honors the notch + home-indicator
// safe areas, and the content region SCROLLS when a step is taller than the
// viewport (small phones) instead of centre-clipping — while still centring a
// short step on a tall screen.
export const OnboardingLayout = ({
  children,
  currentStep,
  totalSteps = 3,
  showProgress = true,
  stepLabels = ['Profile', 'How it works', 'Ready'],
}: OnboardingLayoutProps) => {
  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Header — safe-area aware, compact so short viewports keep room */}
      <nav className="shrink-0 border-b border-secondary-foreground/10 bg-secondary shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-center px-4 lg:px-6">
          <Link to="/" className="text-secondary-foreground transition-opacity hover:opacity-80">
            <Logo className="h-[42px] w-auto sm:h-[50px]" />
          </Link>
        </div>
      </nav>

      {/* Progress */}
      {showProgress && (
        <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-5">
          <OnboardingProgress
            currentStep={currentStep}
            totalSteps={totalSteps}
            labels={stepLabels}
          />
        </div>
      )}

      {/* Main content — scrolls when tall, centres when short */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            {children}
          </motion.div>
        </div>
      </div>

      {/* Footer hint — clears the home indicator */}
      <div className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 text-center">
        <p className="text-xs text-muted-foreground">
          💡 You can always change this later in your profile
        </p>
      </div>
    </div>
  );
};
