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
        "relative rounded-2xl border border-border/50 p-5 sm:p-6",
        "bg-gradient-to-br from-card via-card to-primary/[0.04]",
        "shadow-[0_4px_24px_-8px_hsl(var(--primary)/0.18)]",
        "dark:shadow-[0_0_48px_hsl(var(--primary)/0.10)]",
        "overflow-hidden opacity-0 animate-fade-up",
      )}
      style={{ animationDelay: '50ms', animationFillMode: 'forwards' }}
    >
      {/* Decorative gradient orb — primary-tinted, very subtle, sits behind the
          win-rate ring on the right. Adds depth without competing for attention. */}
      <div
        className="absolute top-0 right-0 w-48 h-48 -translate-y-1/3 translate-x-1/4 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.10) 0%, transparent 65%)",
        }}
      />

      {/* Accent stripe — light mode gets a subtle one too now, not just dark */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary via-primary to-primary/60 rounded-l-2xl" />

      {/* Identity Row - Left-anchored with ring on right */}
      <div className="relative flex items-start justify-between gap-3 sm:gap-4">
        {/* Left: Avatar + Identity */}
        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
          {/* Avatar */}
          <Avatar 
            className="h-14 w-14 min-[360px]:h-16 min-[360px]:w-16 sm:h-[72px] sm:w-[72px] ring-2 ring-primary/60 shadow-lg cursor-pointer hover:ring-primary transition-all opacity-0 animate-scale-in flex-shrink-0"
            style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}
            onClick={() => navigate('/player/profile')}
          >
            <AvatarImage src={avatarUrl || undefined} alt={name} />
            <AvatarFallback className="text-base min-[360px]:text-lg sm:text-xl font-bold bg-primary/20 text-primary">
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
              onClick={() => navigate('/player/profile')}
            >
              {name}
            </h2>
            
            {/* Rating Pill — taps through to Player Pulse, the interactive
                analytics screen that tells the story behind the number. */}
            <button
              type="button"
              onClick={() => navigate("/player/pulse")}
              aria-label="View your Player Pulse analytics"
              className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full pl-2 pr-3 py-1 w-fit hover:bg-primary/15 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Star className="h-3.5 w-3.5 fill-primary" />
              <span className="text-sm font-bold tabular-nums tracking-tight">
                {hasRating ? currentRating.toFixed(2) : "—"}
              </span>
              <span className="text-[11px] font-medium text-primary/80 uppercase tracking-wider">
                {hasRating ? "PULSE" : "No Rating"}
              </span>
            </button>
            
            {/* Location */}
            {location ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-sm truncate">{location}</span>
              </div>
            ) : (
              <button 
                className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-primary transition-colors group"
                onClick={() => navigate("/player/profile/edit?focus=location")}
              >
                <Settings className="h-3.5 w-3.5 group-hover:rotate-45 transition-transform" />
                <span className="text-sm">Add location</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Right: Win Rate Ring */}
        <div 
          className="flex-shrink-0 opacity-0 animate-scale-in hidden min-[360px]:block"
          style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
        >
          <CircularProgressRing 
            percentage={winRate} 
            size={60} 
            strokeWidth={5}
          />
        </div>
      </div>
      
      {/* Win Rate Ring - Stacked on very narrow screens */}
      <div 
        className="flex justify-end mt-2 opacity-0 animate-scale-in min-[360px]:hidden"
        style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
      >
        <CircularProgressRing 
          percentage={winRate} 
          size={56} 
          strokeWidth={5}
        />
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
