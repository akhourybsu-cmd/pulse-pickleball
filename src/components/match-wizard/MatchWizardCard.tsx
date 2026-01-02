import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MatchWizardCardProps {
  children: ReactNode;
  direction: 'forward' | 'backward';
  stepId: string;
}

export function MatchWizardCard({ children, direction, stepId }: MatchWizardCardProps) {
  return (
    <motion.div
      key={stepId}
      initial={{ 
        x: direction === 'forward' ? 100 : -100, 
        opacity: 0 
      }}
      animate={{ 
        x: 0, 
        opacity: 1 
      }}
      exit={{ 
        x: direction === 'forward' ? -100 : 100, 
        opacity: 0 
      }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
