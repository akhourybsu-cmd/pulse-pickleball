import { cn } from "@/lib/utils";

interface RatingDisplayProps {
  doublesRating: number | undefined;
  singlesRating: number | undefined;
  totalMatches?: number;
  wins?: number;
  losses?: number;
}

export const RatingDisplay = ({
  doublesRating,
  singlesRating,
  totalMatches = 0,
  wins = 0,
  losses = 0,
}: RatingDisplayProps) => {
  // Calculate reliability/confidence (max at 30 matches = 100%)
  const reliability = Math.min((totalMatches / 30) * 100, 100);
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  const RatingRing = ({ 
    rating, 
    label, 
    confidence 
  }: { 
    rating: number | undefined; 
    label: string; 
    confidence: number;
  }) => {
    const hasRating = rating !== undefined && rating > 0;
    const circumference = 2 * Math.PI * 42; // radius = 42
    const strokeDashoffset = circumference - (confidence / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-28 h-28">
          {/* Background Circle */}
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="56"
              cy="56"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-primary-foreground/20"
            />
            {/* Progress Circle */}
            <circle
              cx="56"
              cy="56"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-white transition-all duration-1000 ease-out"
            />
          </svg>
          
          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {hasRating ? (
              <>
                <span className="text-xs text-primary-foreground/70 font-medium">
                  {Math.round(confidence)}
                </span>
                <span className="text-2xl font-bold text-primary-foreground">
                  {rating.toFixed(2)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-primary-foreground/70 font-medium">—</span>
                <span className="text-xl font-bold text-primary-foreground/50">NR</span>
              </>
            )}
          </div>
        </div>
        <span className="mt-2 text-sm font-medium text-primary-foreground/80">{label}</span>
      </div>
    );
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
      <div className="flex items-center justify-center gap-8">
        <RatingRing
          rating={doublesRating}
          label="Doubles"
          confidence={reliability}
        />
        <RatingRing
          rating={singlesRating}
          label="Singles"
          confidence={0}
        />
      </div>
      
      {/* Stats Row */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-primary-foreground/10">
        <div className="text-center">
          <p className="text-lg font-semibold text-primary-foreground">
            {wins}-{losses}
          </p>
          <p className="text-xs text-primary-foreground/60">Record</p>
        </div>
        <div className="w-px h-6 bg-primary-foreground/20" />
        <div className="text-center">
          <p className="text-lg font-semibold text-primary-foreground">
            {winRate}%
          </p>
          <p className="text-xs text-primary-foreground/60">Win Rate</p>
        </div>
        <div className="w-px h-6 bg-primary-foreground/20" />
        <div className="text-center">
          <p className="text-lg font-semibold text-primary-foreground">
            {totalMatches}
          </p>
          <p className="text-xs text-primary-foreground/60">Matches</p>
        </div>
      </div>
    </div>
  );
};
