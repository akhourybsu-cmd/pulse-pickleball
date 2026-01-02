import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface CircularProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  labelSuffix?: string;
  className?: string;
}

export const CircularProgressRing = ({ 
  percentage, 
  size = 90, 
  strokeWidth = 8,
  showLabel = true,
  labelSuffix = "%",
  className
}: CircularProgressRingProps) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedProgress / 100) * circumference;

  useEffect(() => {
    startTimeRef.current = null;
    const duration = 800;
    
    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }
      
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentProgress = percentage * eased;
      
      setAnimatedProgress(currentProgress);
      setDisplayValue(Math.round(currentProgress));
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    
    // Small delay before starting animation
    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [percentage]);

  return (
    <div 
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
      style={{
        filter: 'drop-shadow(0 2px 8px hsl(var(--primary) / 0.25))'
      }}
    >
      <svg 
        width={size} 
        height={size} 
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-50"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-none"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span 
            className={cn(
              "font-display font-bold",
              size <= 64 ? "text-sm" : "text-base"
            )}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {displayValue}{labelSuffix}
          </span>
          <span className={cn(
            "uppercase tracking-wider text-muted-foreground",
            size <= 64 ? "text-[7px]" : "text-[8px]"
          )}>
            Win Rate
          </span>
        </div>
      )}
    </div>
  );
};
