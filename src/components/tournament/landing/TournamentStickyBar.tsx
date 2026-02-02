import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TournamentStickyBarProps {
  eventName: string;
  fee: number;
  onRegister: () => void;
  disabled?: boolean;
}

export function TournamentStickyBar({ 
  eventName, 
  fee, 
  onRegister,
  disabled = false 
}: TournamentStickyBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past ~70vh (hero section)
      const scrollThreshold = window.innerHeight * 0.7;
      setIsVisible(window.scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && !disabled && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
        >
          <div className="bg-background/95 backdrop-blur-lg border-t border-border shadow-2xl shadow-black/20">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
                {/* Tournament Name (truncated) */}
                <div className="flex-1 min-w-0 hidden sm:block">
                  <p className="font-semibold text-foreground truncate">
                    {eventName}
                  </p>
                  {fee > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ${fee} per team
                    </p>
                  )}
                </div>

                {/* Mobile: Just show price */}
                <div className="flex-1 min-w-0 sm:hidden">
                  <p className="font-semibold text-foreground truncate text-sm">
                    {eventName}
                  </p>
                </div>

                {/* Register Button */}
                <Button
                  size="lg"
                  onClick={onRegister}
                  className="shrink-0 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] transition-all"
                >
                  Register {fee > 0 && <span className="ml-1">${fee}</span>}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
