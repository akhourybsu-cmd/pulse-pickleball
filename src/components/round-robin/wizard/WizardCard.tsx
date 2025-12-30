import { ReactNode } from "react";
import { motion, Transition } from "framer-motion";

interface WizardCardProps {
  children: ReactNode;
  direction: number;
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
  }),
};

const transition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export function WizardCard({ children, direction }: WizardCardProps) {
  return (
    <motion.div
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
      className="w-full"
    >
      <div className="bg-card rounded-xl shadow-sm border p-6 min-h-[300px] flex flex-col">
        {children}
      </div>
    </motion.div>
  );
}
