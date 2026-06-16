import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { OnboardingProgress } from "./OnboardingProgress";
import logo from "@/assets/pulse-logo-premium.svg";

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps?: number;
  showProgress?: boolean;
  stepLabels?: string[];
}

export const OnboardingLayout = ({ 
  children, 
  currentStep,
  totalSteps = 4,
  showProgress = true,
  stepLabels = ['Profile', 'First Match', 'Rating', 'Complete']
}: OnboardingLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-center h-[72px]">
          <Link to="/">
            <img 
              src={logo} 
              alt="PULSE Logo" 
              className="h-[50px] sm:h-[60px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            />
          </Link>
        </div>
      </nav>

      {/* Progress */}
      {showProgress && (
        <div className="w-full max-w-md mx-auto px-4 pt-6">
          <OnboardingProgress 
            currentStep={currentStep} 
            totalSteps={totalSteps}
            labels={stepLabels}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {children}
        </motion.div>
      </div>

      {/* Footer hint */}
      <div className="text-center pb-6 px-4">
        <p className="text-xs text-muted-foreground">
          💡 You can always edit your settings later
        </p>
      </div>
    </div>
  );
};
