import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { MapPin, Star } from "lucide-react";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { AnimatedStatChip } from "@/components/profile/AnimatedStatChip";

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
    <Card 
      className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/10 shadow-xl dark:shadow-[0_0_40px_hsl(var(--primary)/0.08)] overflow-hidden opacity-0 animate-fade-up"
      style={{ animationDelay: '50ms', animationFillMode: 'forwards' }}
    >
      {/* Accent stripe for dark mode */}
      <div className="hidden dark:block absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      
      <div className="p-5 lg:p-6">
        {/* Top Row: Avatar + Identity + Win Rate Ring */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          {/* Avatar */}
          <Avatar 
            className="h-20 w-20 ring-2 ring-primary/60 shadow-lg cursor-pointer hover:ring-primary transition-all opacity-0 animate-scale-in flex-shrink-0"
            style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
            onClick={() => navigate(`/profile/${userId}`)}
          >
            <AvatarImage src={avatarUrl || undefined} alt={name} />
            <AvatarFallback className="text-xl font-bold bg-primary/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {/* Identity Section */}
          <div 
            className="flex-1 min-w-0 text-center sm:text-left opacity-0 animate-fade-up"
            style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}
          >
            <h1 className="text-2xl font-display font-bold text-foreground leading-tight line-clamp-2">
              {name}
            </h1>
            
            {/* Rating Pill */}
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 mt-2">
              <Star className="w-3.5 h-3.5 fill-primary" />
              <span className="text-sm font-semibold">
                {hasRating ? `${currentRating.toFixed(2)} Rating` : "No Rating"}
              </span>
            </div>
            
            {/* Location */}
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-muted-foreground mt-2">
              <MapPin className="w-3.5 h-3.5" />
              {location ? (
                <span>{location}</span>
              ) : (
                <button 
                  className="text-primary/70 hover:text-primary transition-colors border-b border-dashed border-primary/30"
                  onClick={() => navigate("/profile/edit?focus=location")}
                >
                  Add location
                </button>
              )}
            </div>
          </div>
          
          {/* Win Rate Ring */}
          <div 
            className="opacity-0 animate-scale-in flex-shrink-0"
            style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
          >
            <CircularProgressRing 
              percentage={winRate} 
              size={90} 
              strokeWidth={8}
            />
          </div>
        </div>
        
        {/* Divider */}
        <div className="h-px bg-border/50 my-5" />
        
        {/* Stat Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AnimatedStatChip 
            label="Rating" 
            value={hasRating ? currentRating! : "—"} 
            decimals={2}
            isPrimary
            delay={250}
          />
          <AnimatedStatChip 
            label="Matches" 
            value={totalMatches || 0} 
            delay={300}
          />
          <AnimatedStatChip 
            label="Win %" 
            value={winRate} 
            suffix="%" 
            delay={350}
          />
          <AnimatedStatChip 
            label="Record" 
            value={`${wins}-${losses}`} 
            delay={400}
          />
        </div>
      </div>
    </Card>
  );
};
