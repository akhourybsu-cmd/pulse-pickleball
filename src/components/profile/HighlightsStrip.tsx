import { cn } from "@/lib/utils";

interface Highlight {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}

interface HighlightsStripProps {
  highlights: Highlight[];
  className?: string;
}

export const HighlightsStrip = ({ highlights, className }: HighlightsStripProps) => {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5", className)}>
      {highlights.map((highlight, i) => (
        <div 
          key={i}
          className={cn(
            "flex items-start gap-3 p-3.5 rounded-xl min-h-[88px]",
            "bg-gradient-to-br from-muted/40 to-muted/20",
            "dark:from-muted/30 dark:to-muted/10",
            "border border-border/40 dark:border-border/30",
            "hover:border-primary/30 hover:shadow-sm",
            "transition-all duration-200",
            "opacity-0 animate-fade-up"
          )}
          style={{ 
            animationDelay: `${380 + i * 60}ms`,
            animationFillMode: 'forwards'
          }}
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center shadow-sm">
            {highlight.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
              {highlight.label}
            </p>
            <p 
              className="text-lg font-display font-bold truncate leading-tight" 
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {highlight.value}
            </p>
            {highlight.subValue && (
              <p className="text-[9px] text-muted-foreground/60 truncate mt-0.5">
                {highlight.subValue}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
