import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, TrendingUp, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { UnverifiedMatchesIndicator } from "@/components/UnverifiedMatchesIndicator";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { PlayerIdentityCard } from "@/components/dashboard/PlayerIdentityCard";
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
  unreadNotifications = 0,
  onNotificationOpen,
  onSignOut,
  activeTab = "performance",
  onTabChange,
}: ProfileHeroProps) => {

  return (
    <div className="relative overflow-hidden">
      {/* Navigation Header - Premium Polish */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-3 flex items-center justify-between h-[64px] sm:h-[72px]">
          <Link to="/" className="ml-1">
            <img 
              src={logo} 
              alt="PULSE Logo" 
              className="h-[52px] sm:h-[65px] w-auto cursor-pointer hover:opacity-90 transition-opacity" 
            />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
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
              className="text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10 h-8 w-8 sm:h-9 sm:w-9"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Player Identity Card Zone - Premium Polish */}
      <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5">
        <PlayerIdentityCard
          userId={userId}
          fullName={fullName}
          displayName={displayName}
          avatarUrl={avatarUrl}
          location={location}
          currentRating={currentRating}
          totalMatches={totalMatches}
          wins={wins}
          losses={losses}
        />

        {/* Quick Actions + Performance/Activity Toggle (Mobile only) */}
        {onTabChange && (
          <div className="lg:hidden space-y-4 mt-4">
            {/* Quick Actions - 2x2 Grid */}
            <QuickActionsBar />
            
            {/* Performance/Activity Toggle - Premium Pill */}
            <div className="flex justify-center">
              <div className="inline-flex bg-muted/50 p-0.5 rounded-full border border-border/30">
                <button
                  onClick={() => onTabChange("performance")}
                  className={`
                    flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                    ${activeTab === "performance" 
                      ? "bg-card text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="tracking-tight">Performance</span>
                </button>
                <button
                  onClick={() => onTabChange("activity")}
                  className={`
                    flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                    ${activeTab === "activity" 
                      ? "bg-card text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span className="tracking-tight">Activity</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
