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
        "flex min-h-[58px] flex-col items-center justify-center rounded-xl border border-border/35 bg-muted/25 p-2.5 transition-colors duration-200 dark:bg-muted/20 lg:min-h-[64px]",
        isPrimary && "bg-primary/5 dark:bg-primary/10 border-primary/20",
        "opacity-0 animate-fade-up cursor-default",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <p className="mb-1 whitespace-nowrap text-[9px] font-medium uppercase tracking-wider text-muted-foreground min-[390px]:text-[10px]">
        {label}
      </p>
      <p 
        className={cn(
          "whitespace-nowrap font-display text-base font-bold leading-none min-[390px]:text-lg",
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
