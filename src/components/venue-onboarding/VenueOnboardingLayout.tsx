import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { VenueOnboardingProgress } from './VenueOnboardingProgress';

interface VenueOnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  showProgress?: boolean;
  stepLabels?: string[];
}

export const VenueOnboardingLayout = ({
  children,
  currentStep,
  totalSteps,
  showProgress = true,
  stepLabels = ['Profile', 'First Event', 'Share', 'Complete'],
}: VenueOnboardingLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-lg">Venue Setup</span>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      {showProgress && (
        <div className="container px-4 pt-6">
          <VenueOnboardingProgress 
            currentStep={currentStep} 
            totalSteps={totalSteps}
            labels={stepLabels}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="container px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};
