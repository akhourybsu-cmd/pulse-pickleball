import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Star, Settings } from "lucide-react";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { AnimatedStatChip } from "@/components/profile/AnimatedStatChip";
import { cn } from "@/lib/utils";

interface PlayerIdentityCardProps {
  userId: string | undefined;
  fullName: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  currentRating: number | undefined;
  totalMatches: number | undefined;
  wins: number | undefined;
  losses: number | undefined;
}

export const PlayerIdentityCard = ({
  userId,
  fullName,
  displayName,
  avatarUrl,
  location,
  currentRating,
  totalMatches = 0,
  wins = 0,
  losses = 0,
}: PlayerIdentityCardProps) => {
  const navigate = useNavigate();
  const name = displayName || fullName || "Player";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const hasRating = currentRating !== undefined && currentRating > 0;

  return (
    <div 
      className={cn(
        "relative rounded-2xl border border-border/50 p-4",
        "bg-gradient-to-br from-card via-card/98 to-primary/[0.02]",
        "shadow-xl dark:shadow-[0_0_40px_hsl(var(--primary)/0.08)]",
        "overflow-hidden opacity-0 animate-fade-up"
      )}
      style={{ animationDelay: '50ms', animationFillMode: 'forwards' }}
    >
      {/* Accent stripe for dark mode */}
      <div className="hidden dark:block absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      
      {/* Identity Row - Left-anchored with ring on right */}
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        {/* Left: Avatar + Identity */}
        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
          {/* Avatar */}
          <Avatar 
            className="h-16 w-16 sm:h-[72px] sm:w-[72px] ring-2 ring-primary/60 shadow-lg cursor-pointer hover:ring-primary transition-all opacity-0 animate-scale-in flex-shrink-0"
            style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}
            onClick={() => navigate(`/profile/${userId}`)}
          >
            <AvatarImage src={avatarUrl || undefined} alt={name} />
            <AvatarFallback className="text-lg sm:text-xl font-bold bg-primary/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {/* Name + Meta */}
          <div 
            className="flex flex-col gap-1.5 min-w-0 opacity-0 animate-fade-up"
            style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}
          >
            <h2 
              className="text-xl sm:text-2xl font-display font-bold text-foreground leading-tight cursor-pointer hover:text-primary/90 transition-colors line-clamp-2"
              onClick={() => navigate(`/profile/${userId}`)}
            >
              {name}
            </h2>
            
            {/* Rating Pill */}
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 w-fit hover:bg-primary/15 transition-colors cursor-default">
              <Star className="h-3.5 w-3.5 fill-primary" />
              <span className="text-sm font-semibold">
                {hasRating ? `${currentRating.toFixed(2)} Rating` : "No Rating"}
              </span>
            </div>
            
            {/* Location */}
            {location ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-sm truncate">{location}</span>
              </div>
            ) : (
              <button 
                className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-primary transition-colors group"
                onClick={() => navigate("/profile/edit?focus=location")}
              >
                <Settings className="h-3.5 w-3.5 group-hover:rotate-45 transition-transform" />
                <span className="text-sm">Add location</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Right: Win Rate Ring */}
        <div 
          className="flex-shrink-0 opacity-0 animate-scale-in"
          style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
        >
          <CircularProgressRing 
            percentage={winRate} 
            size={72} 
            strokeWidth={6}
          />
        </div>
      </div>
      
      {/* Subtle Divider */}
      <div className="my-3 border-t border-border/30" />
      
      {/* Stat Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <AnimatedStatChip 
          label="Rating" 
          value={hasRating ? currentRating! : "—"} 
          decimals={2}
          isPrimary
          delay={200}
          className="hover:scale-[0.98] active:scale-[0.96] transition-transform"
        />
        <AnimatedStatChip 
          label="Matches" 
          value={totalMatches || 0} 
          delay={240}
          className="hover:scale-[0.98] active:scale-[0.96] transition-transform"
        />
        <AnimatedStatChip 
          label="Win %" 
          value={winRate} 
          suffix="%" 
          delay={280}
          className="hover:scale-[0.98] active:scale-[0.96] transition-transform"
        />
        <AnimatedStatChip 
          label="Record" 
          value={`${wins}-${losses}`} 
          delay={320}
          className="hover:scale-[0.98] active:scale-[0.96] transition-transform"
        />
      </div>
    </div>
  );
};
