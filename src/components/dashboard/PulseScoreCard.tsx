import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PulseScoreBadge } from "@/components/profile/PulseScoreBadge";

interface PulseScoreCardProps {
  currentRating: number | null | undefined;
  weeklyChange: number;
  userId: string | undefined;
}

export const PulseScoreCard = ({ currentRating, weeklyChange, userId }: PulseScoreCardProps) => {
  const navigate = useNavigate();
  const rating = currentRating ?? 3.0;

  const getTrendIcon = () => {
    if (weeklyChange > 0.01) return <TrendingUp className="w-4 h-4 text-primary" />;
    if (weeklyChange < -0.01) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (weeklyChange > 0.01) return "text-primary";
    if (weeklyChange < -0.01) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card 
        className="cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-primary/5 via-background to-secondary/10 border-l-4 border-l-primary pulse-score-focal"
        onClick={() => userId && navigate(`/profile/${userId}`)}
        data-tour="pulse-score"
      >
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center text-center">
            {/* Title */}
            <p className="text-sm font-medium text-muted-foreground mb-2">Live Pulse Score</p>
            
            {/* Large Score Display */}
            <div className="flex items-center gap-4 mb-3">
              <motion.span 
                className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary pulse-score-number"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              >
                {rating.toFixed(2)}
              </motion.span>
              
              {/* ECG Animation */}
              <motion.svg 
                className="ecg-pulse flex-shrink-0" 
                width="60" 
                height="20" 
                viewBox="0 0 80 24"
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.8 }}
              >
                <path 
                  d="M0 12 L20 12 L25 4 L30 20 L35 12 L80 12" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  pathLength="100"
                />
              </motion.svg>
            </div>

            {/* Tier Badge */}
            <div className="mb-3">
              <PulseScoreBadge score={rating} />
            </div>

            {/* Weekly Trend */}
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className={`text-sm font-medium ${getTrendColor()}`}>
                {weeklyChange > 0 ? "+" : ""}{weeklyChange.toFixed(2)} this week
              </span>
            </div>

            {/* Tap hint */}
            <p className="text-xs text-muted-foreground mt-3">Tap to view full stats</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
