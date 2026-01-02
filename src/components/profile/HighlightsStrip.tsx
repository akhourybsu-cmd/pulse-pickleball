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
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {highlights.map((highlight, i) => (
        <div 
          key={i}
          className={cn(
            "flex items-start gap-3 p-3 rounded-xl",
            "bg-muted/30 dark:bg-muted/20 border border-border/30",
            "hover:bg-muted/50 hover:border-border/50 transition-all duration-200",
            "opacity-0 animate-fade-up"
          )}
          style={{ 
            animationDelay: `${400 + i * 80}ms`,
            animationFillMode: 'forwards'
          }}
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-background/80 flex items-center justify-center">
            {highlight.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 font-medium">
              {highlight.label}
            </p>
            <p 
              className="text-lg font-display font-bold truncate" 
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {highlight.value}
            </p>
            {highlight.subValue && (
              <p className="text-[10px] text-muted-foreground/70 truncate">
                {highlight.subValue}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
