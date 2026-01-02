import { cn } from "@/lib/utils";
import { AnimatedCountUp } from "./AnimatedCountUp";

interface AnimatedStatChipProps {
  label: string;
  value: number | string;
  isPrimary?: boolean;
  suffix?: string;
  decimals?: number;
  delay?: number;
  className?: string;
}

export const AnimatedStatChip = ({ 
  label, 
  value, 
  isPrimary = false,
  suffix = "",
  decimals = 0,
  delay = 0,
  className
}: AnimatedStatChipProps) => {
  const isNumeric = typeof value === 'number';

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300",
        "bg-muted/30 dark:bg-muted/20 border border-border/30",
        isPrimary && "bg-primary/5 dark:bg-primary/10 border-primary/20",
        "opacity-0 animate-fade-up",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
        {label}
      </p>
      <p 
        className={cn(
          "text-xl font-display font-bold",
          isPrimary && "text-primary"
        )}
      >
        {isNumeric ? (
          <AnimatedCountUp 
            value={value} 
            decimals={decimals} 
            suffix={suffix}
            duration={800}
          />
        ) : (
          value
        )}
      </p>
    </div>
  );
};
