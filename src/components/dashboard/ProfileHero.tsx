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
      {/* Teal Navigation Header */}
      <nav className="bg-secondary border-b border-secondary-foreground/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard">
            <img 
              src={logo} 
              alt="PULSE" 
              className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
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

      {/* Gradient Background */}
      <div className="absolute inset-0 top-[60px] bg-gradient-to-br from-primary via-primary/90 to-primary/70 dark:from-primary/80 dark:via-primary/60 dark:to-secondary" />
      
      {/* Subtle Pattern Overlay */}
      <div className="absolute inset-0 top-[60px] opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }} />
      </div>

      {/* Content */}
      <div className="relative px-4 pt-4 pb-6">
        {/* Profile Info */}
        <div className="flex items-start gap-4 mb-6">
          <Avatar 
            className="h-20 w-20 border-4 border-white/30 shadow-lg cursor-pointer hover:border-white/50 transition-colors"
            onClick={() => navigate(`/profile/${userId}`)}
          >
            <AvatarImage src={avatarUrl || undefined} alt={name} />
            <AvatarFallback className="text-xl font-bold bg-secondary text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-primary-foreground truncate">
              {name}
            </h1>
            <p className="text-primary-foreground/70 text-sm">
              {location || "Location not set"}
            </p>
            <Badge className={`mt-2 ${tier.color}`}>
              {tier.name}
            </Badge>
          </div>
        </div>

        {/* Social Stats */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-foreground">{partnersCount}</p>
            <p className="text-xs text-primary-foreground/70">Partners</p>
          </div>
          <div className="w-px h-8 bg-primary-foreground/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-foreground">{courtsPlayed}</p>
            <p className="text-xs text-primary-foreground/70">Courts Played</p>
          </div>
        </div>

        {/* Rating Display */}
        <RatingDisplay
          doublesRating={currentRating}
          totalMatches={totalMatches}
          wins={wins}
          losses={losses}
        />
      </div>
    </div>
  );
};