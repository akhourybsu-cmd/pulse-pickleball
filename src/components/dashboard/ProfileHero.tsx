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
}

/**
 * Player Identity hero block on the dashboard.
 *
 * Phase 1 stripped this component of its inline top nav strip (the duplicate
 * PULSE-logo / theme / notification / sign-out bar) so PlayerShell can own
 * the top chrome.
 *
 * Phase 2 removed the mobile Performance/Activity toggle that used to live
 * here — the Dashboard now uses a single linear mobile flow with Activity
 * surfacing at the top of the body. This component is now purely:
 *   • PlayerIdentityCard (avatar, name, rating, win-rate, stats)
 *   • QuickActionsBar on mobile only (desktop renders it in the left column)
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

      {/* Quick Actions — mobile-only here. Desktop renders QuickActionsBar
          inside the left column of the body grid (under the "Quick actions"
          SectionHeader). */}
      <div className="lg:hidden mt-4">
        <QuickActionsBar />
      </div>
    </div>
  );
};
