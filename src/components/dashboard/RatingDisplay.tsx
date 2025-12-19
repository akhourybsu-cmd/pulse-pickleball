interface RatingDisplayProps {
  doublesRating: number | undefined;
  wins?: number;
  losses?: number;
}

export const RatingDisplay = ({
  doublesRating,
  wins = 0,
  losses = 0,
}: RatingDisplayProps) => {
  const totalMatches = wins + losses;
  // Calculate reliability/confidence (max at 30 matches = 100%)
  const reliability = Math.min((totalMatches / 30) * 100, 100);
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  const hasRating = doublesRating !== undefined && doublesRating > 0;
  
  // Thicker ring: 80px (r=32, cx/cy=40), strokeWidth=8
  const circumference = 2 * Math.PI * 32;
  const strokeDashoffset = circumference - (reliability / 100) * circumference;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
      <div className="flex items-center justify-center gap-6">
        {/* Compact Rating Ring with Gradient - 80px */}
        <div className="flex flex-col items-center">
          <div className="relative w-20 h-20">
            {/* SVG with gradient definition */}
            <svg className="w-full h-full -rotate-90">
              <defs>
                <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(174 60% 51%)" />
                </linearGradient>
              </defs>
              {/* Background Circle */}
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-border"
              />
              {/* Progress Circle with Gradient */}
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="url(#ratingGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
                style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.4))' }}
              />
            </svg>
            
            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {hasRating ? (
                <>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {Math.round(reliability)}%
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {doublesRating.toFixed(2)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-muted-foreground font-medium">—</span>
                  <span className="text-base font-bold text-muted-foreground">NR</span>
                </>
              )}
            </div>
          </div>
          <span className="mt-1 text-xs font-medium text-muted-foreground">Doubles</span>
        </div>

        {/* Inline Stats: Record • Win Rate */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">{wins}-{losses}</span>
            <span className="text-xs text-muted-foreground">Record</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">{winRate}%</span>
            <span className="text-xs text-muted-foreground">Win Rate</span>
          </div>
        </div>
      </div>
    </div>
  );
};
