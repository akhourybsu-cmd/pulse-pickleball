import { TrendingUp, Activity } from "lucide-react";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { PlayerIdentityCard } from "@/components/dashboard/PlayerIdentityCard";

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
  activeTab?: "performance" | "activity";
  onTabChange?: (tab: "performance" | "activity") => void;
}

/**
 * Player Identity hero block on the dashboard.
 *
 * Previously rendered its OWN top nav strip (PULSE logo + notification bell +
 * theme + sign-out), which duplicated PlayerShell's header. The nav strip
 * has been removed — PlayerShell now owns the top chrome across every
 * player tab. This component is now just the identity card + (on mobile)
 * the QuickActions row + the Performance/Activity toggle.
 *
 * Notification + sign-out wiring stays in Dashboard.tsx (passed through to
 * PlayerShell's nav).
 */
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
  activeTab = "performance",
  onTabChange,
}: ProfileHeroProps) => {
  return (
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
          <QuickActionsBar />

          {/* Performance / Activity toggle pill */}
          <div className="flex justify-center">
            <div className="inline-flex bg-muted/50 p-0.5 rounded-full border border-border/30">
              <button
                onClick={() => onTabChange("performance")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === "performance"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="tracking-tight">Performance</span>
              </button>
              <button
                onClick={() => onTabChange("activity")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === "activity"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="tracking-tight">Activity</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
