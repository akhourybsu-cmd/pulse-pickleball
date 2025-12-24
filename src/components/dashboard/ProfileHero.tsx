import { useNavigate, Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="relative overflow-hidden">
      {/* Navigation Header - 72px height with shadow */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/" className="ml-2">
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

      {/* Profile + Stats Section */}
      <div className="relative bg-[#F7FBF2] dark:bg-[#142029] border-b border-border">
        {/* Accent stripe for dark mode */}
        <div className="hidden dark:block absolute left-0 top-0 bottom-0 w-1 bg-primary" />
        
        {/* Content - Centered container */}
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5">
          {/* Desktop: Two-card layout (4-col profile + 8-col stats) */}
          {/* Mobile: Stacked layout */}
          <div className="flex flex-col lg:flex-row lg:gap-6">
            {/* Profile Summary Card */}
            <div className="lg:w-1/3 mb-4 lg:mb-0">
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm h-full">
                <div className="flex items-center gap-4">
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
                    <h1 className="text-xl font-semibold text-foreground truncate leading-tight">
                      {name}
                    </h1>
                    {location ? (
                      <p className="text-muted-foreground text-sm truncate">
                        {location}
                      </p>
                    ) : (
                      <button 
                        className="text-primary/70 text-sm hover:text-primary transition-colors border-b border-dashed border-primary/30"
                        onClick={() => navigate("/profile/edit?focus=location")}
                      >
                        Set location
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Summary Card */}
            <div className="lg:w-2/3">
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                {/* Stats Row + Rating in a compact layout */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* 3-Column Stat Row */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 flex-1">
                    <button 
                      onClick={() => navigate("/match/history")}
                      className="text-center hover:bg-muted/50 rounded-lg py-2 px-1 transition-colors group"
                    >
                      <Users className="w-4 h-4 text-primary/70 mx-auto mb-1 group-hover:text-primary transition-colors" />
                      <p className="text-lg sm:text-xl font-bold text-foreground">{partnersCount}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Partners</p>
                    </button>
                    <button 
                      onClick={() => navigate("/court/connector")}
                      className="text-center border-x border-border hover:bg-muted/50 rounded-lg py-2 px-1 transition-colors group"
                    >
                      <MapPin className="w-4 h-4 text-primary/70 mx-auto mb-1 group-hover:text-primary transition-colors" />
                      <p className="text-lg sm:text-xl font-bold text-foreground">{courtsPlayed}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Courts</p>
                    </button>
                    <button 
                      onClick={() => navigate("/match/history")}
                      className="text-center hover:bg-muted/50 rounded-lg py-2 px-1 transition-colors group"
                    >
                      <Trophy className="w-4 h-4 text-primary/70 mx-auto mb-1 group-hover:text-primary transition-colors" />
                      <p className="text-lg sm:text-xl font-bold text-foreground">{totalMatches || 0}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Matches</p>
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="hidden sm:block w-px h-16 bg-border" />
                  <div className="sm:hidden h-px w-full bg-border" />

                  {/* Rating Display - Compact */}
                  <div className="flex-shrink-0">
                    <RatingDisplay
                      doublesRating={currentRating}
                      wins={wins}
                      losses={losses}
                      compact
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
