import { useNavigate, Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Users, MapPin, Trophy } from "lucide-react";
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

  // Determine tier based on rating with metallic gradients
  const getTier = (rating: number | undefined) => {
    if (!rating) return { name: "Unrated", className: "bg-muted text-muted-foreground" };
    if (rating >= 4.5) return { name: "Diamond", className: "bg-gradient-to-r from-cyan-400 to-cyan-600 text-white shadow-sm" };
    if (rating >= 4.0) return { name: "Platinum", className: "bg-gradient-to-r from-slate-300 to-slate-500 text-white shadow-sm" };
    if (rating >= 3.5) return { name: "Gold", className: "bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-sm" };
    if (rating >= 3.0) return { name: "Silver", className: "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-800 shadow-sm" };
    return { name: "Bronze", className: "bg-gradient-to-r from-amber-500 to-amber-700 text-white shadow-sm" };
  };

  const tier = getTier(currentRating);

  return (
    <div className="relative overflow-hidden">
      {/* Navigation Header - 72px height with shadow */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between h-[72px]">
          <Link to="/dashboard" className="ml-2">
            <img 
              src={logo} 
              alt="PULSE Logo" 
              className="h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
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
              className="text-white hover:text-white/90 hover:bg-white/10 h-[38px] w-[38px]"
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
          <div className="flex items-center gap-4 mb-6">
            <Avatar 
              className="h-16 w-16 border-2 border-primary/30 shadow-[0_0_20px_hsl(var(--primary)/0.3)] cursor-pointer hover:border-primary/50 transition-colors flex-shrink-0"
              onClick={() => navigate(`/profile/${userId}`)}
            >
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback className="text-lg font-bold bg-primary/20 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-semibold text-foreground truncate leading-tight">
                {name}
              </h1>
              <p 
                className="text-muted-foreground/60 text-sm truncate border-b border-dashed border-muted-foreground/30 inline-block cursor-pointer hover:text-muted-foreground transition-colors"
                onClick={() => navigate("/profile/edit")}
              >
                {location || "Location not set"}
              </p>
              <Badge className={`mt-1.5 text-[10px] px-2 py-0.5 rounded-md ${tier.className}`}>
                {tier.name}
              </Badge>
            </div>
          </div>

          {/* 3-Column Stat Row with Icons: Partners | Courts | Matches */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <button 
              onClick={() => navigate("/match/history")}
              className="text-center hover:bg-muted/50 rounded-lg py-2 transition-colors group"
            >
              <Users className="w-4 h-4 text-primary/70 mx-auto mb-1 group-hover:text-primary transition-colors" />
              <p className="text-xl font-bold text-foreground">{partnersCount}</p>
              <p className="text-xs text-muted-foreground">Partners</p>
            </button>
            <button 
              onClick={() => navigate("/court/connector")}
              className="text-center border-x border-border hover:bg-muted/50 rounded-lg py-2 transition-colors group"
            >
              <MapPin className="w-4 h-4 text-primary/70 mx-auto mb-1 group-hover:text-primary transition-colors" />
              <p className="text-xl font-bold text-foreground">{courtsPlayed}</p>
              <p className="text-xs text-muted-foreground">Courts</p>
            </button>
            <button 
              onClick={() => navigate("/match/history")}
              className="text-center hover:bg-muted/50 rounded-lg py-2 transition-colors group"
            >
              <Trophy className="w-4 h-4 text-primary/70 mx-auto mb-1 group-hover:text-primary transition-colors" />
              <p className="text-xl font-bold text-foreground">{totalMatches || 0}</p>
              <p className="text-xs text-muted-foreground">Matches</p>
            </button>
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
