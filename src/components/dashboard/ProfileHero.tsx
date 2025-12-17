import { useNavigate, Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";
import { RatingDisplay } from "./RatingDisplay";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { UnverifiedMatchesIndicator } from "@/components/UnverifiedMatchesIndicator";
import logo from "@/assets/pulse-logo-new.png";

interface ProfileHeroProps {
  userId: string | undefined;
  fullName: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  currentRating: number | undefined;
  totalMatches: number | undefined;
  wins: number | undefined;
  losses: number | undefined;
  partnersCount?: number;
  courtsPlayed?: number;
  unreadNotifications?: number;
  onNotificationOpen?: () => void;
  onSignOut?: () => void;
}

export const ProfileHero = ({
  userId,
  fullName,
  displayName,
  avatarUrl,
  location,
  currentRating,
  totalMatches,
  wins,
  losses,
  partnersCount = 0,
  courtsPlayed = 0,
  unreadNotifications = 0,
  onNotificationOpen,
  onSignOut,
}: ProfileHeroProps) => {
  const navigate = useNavigate();
  const name = displayName || fullName || "Player";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Determine tier based on rating
  const getTier = (rating: number | undefined) => {
    if (!rating) return { name: "Unrated", color: "bg-muted text-muted-foreground" };
    if (rating >= 4.5) return { name: "Diamond", color: "bg-cyan-500 text-white" };
    if (rating >= 4.0) return { name: "Platinum", color: "bg-slate-400 text-white" };
    if (rating >= 3.5) return { name: "Gold", color: "bg-yellow-500 text-black" };
    if (rating >= 3.0) return { name: "Silver", color: "bg-slate-300 text-black" };
    return { name: "Bronze", color: "bg-amber-600 text-white" };
  };

  const tier = getTier(currentRating);

  return (
    <div className="relative overflow-hidden">
      {/* Navigation Header - Standard mobile app bar height */}
      <nav className="bg-secondary border-b border-secondary-foreground/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img 
              src={logo} 
              alt="PULSE Logo" 
              className="h-[68px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            />
          </Link>
          <div className="flex items-center gap-2">
            <UnverifiedMatchesIndicator />
            <ThemeToggle />
            <NotificationBell 
              unreadCount={unreadNotifications}
              onOpen={onNotificationOpen}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              className="text-white hover:text-white/90 hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Compact Hero Section */}
      <div className="relative bg-[#F7FBF2] dark:bg-[#142029] border-b border-border">
        {/* Accent stripe for dark mode */}
        <div className="hidden dark:block absolute left-0 top-0 bottom-0 w-1 bg-primary" />
        
        {/* Content - 8pt spacing */}
        <div className="px-4 pt-4 pb-4">
          {/* Compact Profile Row: Avatar + Name + Tier */}
          <div className="flex items-center gap-4 mb-4">
            <Avatar 
              className="h-16 w-16 border-2 border-primary/30 shadow-md cursor-pointer hover:border-primary/50 transition-colors flex-shrink-0"
              onClick={() => navigate(`/profile/${userId}`)}
            >
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback className="text-lg font-bold bg-primary/20 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">
                {name}
              </h1>
              <p className="text-muted-foreground text-sm truncate">
                {location || "Location not set"}
              </p>
              <Badge className={`mt-1 text-xs ${tier.color}`}>
                {tier.name}
              </Badge>
            </div>
          </div>

          {/* 3-Column Stat Row: Partners | Courts | Matches */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{partnersCount}</p>
              <p className="text-xs text-muted-foreground">Partners</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-xl font-bold text-foreground">{courtsPlayed}</p>
              <p className="text-xs text-muted-foreground">Courts</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{totalMatches || 0}</p>
              <p className="text-xs text-muted-foreground">Matches</p>
            </div>
          </div>

          {/* Compact Rating Display */}
          <RatingDisplay
            doublesRating={currentRating}
            wins={wins}
            losses={losses}
          />
        </div>
      </div>
    </div>
  );
};
