import { useNavigate, Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Users, MapPin, Trophy, TrendingUp, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { UnverifiedMatchesIndicator } from "@/components/UnverifiedMatchesIndicator";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
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
  activeTab?: "performance" | "activity";
  onTabChange?: (tab: "performance" | "activity") => void;
}

export const ProfileHero = ({
  userId,
  fullName,
  displayName,
  avatarUrl,
  location,
  currentRating,
  totalMatches,
  wins = 0,
  losses = 0,
  partnersCount = 0,
  courtsPlayed = 0,
  unreadNotifications = 0,
  onNotificationOpen,
  onSignOut,
  activeTab = "performance",
  onTabChange,
}: ProfileHeroProps) => {
  const navigate = useNavigate();
  const name = displayName || fullName || "Player";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const reliability = Math.min(((totalMatches || 0) / 30) * 100, 100);
  const hasRating = currentRating !== undefined && currentRating > 0;

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

      {/* Unified Player Overview Zone - Single cohesive surface */}
      <div className="relative bg-muted/30 dark:bg-muted/10">
        {/* Accent stripe for dark mode */}
        <div className="hidden dark:block absolute left-0 top-0 bottom-0 w-1 bg-primary" />
        
        {/* Content - Centered container with increased padding */}
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-6 lg:py-7">
          {/* Single unified surface with no internal card borders */}
          <div className="flex flex-col gap-5">
            {/* Row 1: Avatar + Name + Location + Stats inline */}
            <div className="flex items-center gap-4">
              <Avatar 
                className="h-14 w-14 lg:h-18 lg:w-18 border-2 border-primary/30 shadow-[0_0_20px_hsl(var(--primary)/0.2)] cursor-pointer hover:border-primary/50 transition-colors flex-shrink-0"
                onClick={() => navigate(`/profile/${userId}`)}
              >
                <AvatarImage src={avatarUrl || undefined} alt={name} />
                <AvatarFallback className="text-base lg:text-lg font-bold bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <h1 className="text-lg lg:text-xl font-semibold text-foreground truncate leading-tight">
                  {name}
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  {location ? (
                    <span className="truncate">{location}</span>
                  ) : (
                    <button 
                      className="text-primary/70 hover:text-primary transition-colors border-b border-dashed border-primary/30"
                      onClick={() => navigate("/profile/edit?focus=location")}
                    >
                      Set location
                    </button>
                  )}
                  <span className="hidden sm:inline text-muted-foreground/50">•</span>
                  <span className="hidden sm:inline">{partnersCount} partners</span>
                  <span className="hidden sm:inline text-muted-foreground/50">•</span>
                  <span className="hidden sm:inline">{courtsPlayed} courts</span>
                </div>
              </div>

              {/* Mobile stat chips */}
              <div className="flex sm:hidden gap-2">
                <div className="flex items-center gap-1 bg-background/80 px-2 py-1 rounded-full text-xs">
                  <Users className="w-3 h-3 text-primary/70" />
                  <span className="font-medium">{partnersCount}</span>
                </div>
                <div className="flex items-center gap-1 bg-background/80 px-2 py-1 rounded-full text-xs">
                  <MapPin className="w-3 h-3 text-primary/70" />
                  <span className="font-medium">{courtsPlayed}</span>
                </div>
              </div>
            </div>

            {/* Subtle divider */}
            <div className="h-px bg-border/50" />

            {/* Row 2: Rating + Record + Win Rate - Inline flowing layout with larger sizing */}
            <div className="flex items-center gap-5 lg:gap-6">
              {/* Rating Ring - Larger and more prominent */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 lg:w-16 lg:h-16">
                  <svg className="w-full h-full -rotate-90">
                    <defs>
                      <linearGradient id="heroRatingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(174 60% 51%)" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="50%"
                      cy="50%"
                      r="40%"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10%"
                      className="text-border"
                    />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="40%"
                      fill="none"
                      stroke="url(#heroRatingGradient)"
                      strokeWidth="10%"
                      strokeLinecap="round"
                      strokeDasharray={`${reliability * 2.51} 251`}
                      className="transition-all duration-1000 ease-out"
                      style={{ filter: 'drop-shadow(0 0 4px hsl(var(--primary) / 0.4))' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {hasRating ? (
                      <span className="text-base lg:text-lg font-bold text-foreground">
                        {currentRating.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">NR</span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">Doubles</span>
              </div>

              {/* Stat pills inline - Larger text */}
              <div className="flex items-center gap-4 lg:gap-5">
                <button 
                  onClick={() => navigate("/match/history")}
                  className="flex items-center gap-1.5 hover:bg-background/50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <span className="text-lg lg:text-xl font-semibold text-foreground">{wins}-{losses}</span>
                  <span className="text-xs text-muted-foreground">Record</span>
                </button>
                
                <span className="text-muted-foreground/30">|</span>
                
                <button 
                  onClick={() => navigate("/match/history")}
                  className="flex items-center gap-1.5 hover:bg-background/50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <span className="text-lg lg:text-xl font-semibold text-foreground">{winRate}%</span>
                  <span className="text-xs text-muted-foreground">Win</span>
                </button>
                
                <span className="text-muted-foreground/30">|</span>
                
                <button 
                  onClick={() => navigate("/match/history")}
                  className="flex items-center gap-1.5 hover:bg-background/50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Trophy className="w-4 h-4 text-primary/70" />
                  <span className="text-lg lg:text-xl font-semibold text-foreground">{totalMatches || 0}</span>
                  <span className="text-xs text-muted-foreground">Matches</span>
                </button>
              </div>
            </div>

            {/* Quick Actions + Performance/Activity Toggle (Mobile only) */}
            {onTabChange && (
              <div className="lg:hidden space-y-4">
                <div className="h-px bg-border/50" />
                
                {/* Quick Actions - 2x2 Grid */}
                <QuickActionsBar />
                
                {/* Performance/Activity Toggle */}
                <div className="flex justify-center">
                  <div className="inline-flex bg-muted/40 p-0.5 rounded-full">
                    <button
                      onClick={() => onTabChange("performance")}
                      className={`
                        flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
                        ${activeTab === "performance" 
                          ? "bg-background text-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                        }
                      `}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Performance
                    </button>
                    <button
                      onClick={() => onTabChange("activity")}
                      className={`
                        flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
                        ${activeTab === "activity" 
                          ? "bg-background text-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                        }
                      `}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Activity
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
