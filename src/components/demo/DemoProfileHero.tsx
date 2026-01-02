import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Star } from "lucide-react";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { AnimatedStatChip } from "@/components/profile/AnimatedStatChip";
import { cn } from "@/lib/utils";
import { demoProfile, demoWinRate } from "@/data/demoData";

export const DemoProfileHero = () => {
  const initials = demoProfile.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
      
      {/* Identity Row */}
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        {/* Left: Avatar + Identity */}
        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
          {/* Avatar */}
          <Avatar 
            className="h-14 w-14 min-[360px]:h-16 min-[360px]:w-16 sm:h-[72px] sm:w-[72px] ring-2 ring-primary/60 shadow-lg opacity-0 animate-scale-in flex-shrink-0"
            style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}
          >
            <AvatarFallback className="text-base min-[360px]:text-lg sm:text-xl font-bold bg-primary/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {/* Name + Meta */}
          <div 
            className="flex flex-col gap-1.5 min-w-0 opacity-0 animate-fade-up"
            style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}
          >
            <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground leading-tight line-clamp-2">
              {demoProfile.display_name}
            </h2>
            
            {/* Rating Pill */}
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 w-fit">
              <Star className="h-3.5 w-3.5 fill-primary" />
              <span className="text-sm font-semibold">
                {demoProfile.current_rating.toFixed(2)} Rating
              </span>
            </div>
            
            {/* Location */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-sm truncate">{demoProfile.location}</span>
            </div>
          </div>
        </div>
        
        {/* Right: Win Rate Ring */}
        <div 
          className="flex-shrink-0 opacity-0 animate-scale-in hidden min-[360px]:block"
          style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
        >
          <CircularProgressRing 
            percentage={demoWinRate} 
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
          percentage={demoWinRate} 
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
          value={demoProfile.current_rating} 
          decimals={2}
          isPrimary
          delay={200}
        />
        <AnimatedStatChip 
          label="Matches" 
          value={demoProfile.total_matches} 
          delay={240}
        />
        <AnimatedStatChip 
          label="Win %" 
          value={demoWinRate} 
          suffix="%" 
          delay={280}
        />
        <AnimatedStatChip 
          label="Record" 
          value={`${demoProfile.wins}-${demoProfile.losses}`} 
          delay={320}
        />
      </div>
    </div>
  );
};
