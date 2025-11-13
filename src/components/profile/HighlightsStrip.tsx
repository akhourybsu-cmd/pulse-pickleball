interface Highlight {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}

interface HighlightsStripProps {
  highlights: Highlight[];
}

export const HighlightsStrip = ({ highlights }: HighlightsStripProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {highlights.map((highlight, i) => (
        <div 
          key={i}
          className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-muted hover:bg-muted/50 transition-colors"
        >
          <div className="text-2xl flex-shrink-0">{highlight.icon}</div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 font-sans">
              {highlight.label}
            </p>
            <p className="text-xl font-display font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {highlight.value}
            </p>
            {highlight.subValue && (
              <p className="text-xs text-muted-foreground mt-0.5 font-sans">{highlight.subValue}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
