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

  const gradientId = `ring-gradient-${size}`;

  return (
    <div 
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
      style={{
        filter: 'drop-shadow(0 3px 12px hsl(var(--primary) / 0.3))'
      }}
    >
      <svg 
        width={size} 
        height={size} 
        className="transform -rotate-90"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="50%" stopColor="hsl(var(--primary) / 0.8)" />
            <stop offset="100%" stopColor="hsl(174 60% 50%)" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-40"
        />
        {/* Progress arc with gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
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
            className="text-base font-display font-bold"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {displayValue}{labelSuffix}
          </span>
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-medium">
            Win Rate
          </span>
        </div>
      )}
    </div>
  );
};
