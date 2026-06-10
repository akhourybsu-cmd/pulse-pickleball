import { lazy, Suspense } from 'react';
import { Compass } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const FindEvents = lazy(() => import('@/pages/player/FindEvents'));

const TabSkeleton = () => (
  <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto space-y-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-28 w-full rounded-xl" />
    ))}
  </div>
);

/**
 * PlayHub — player-side discovery surface.
 *
 * Previously had Events + Venues tabs. The Venues tab was removed as part of
 * the player-first refocus — venue browsing lives behind the mode toggle on
 * the venue/organizer side. The hub now embeds the events feed directly with
 * its header suppressed so the hub controls page chrome.
 *
 * Note: this component is still meaningfully different from rendering
 * FindEvents directly because it provides the consistent player-shell
 * page chrome (compact header + subtitle). When deep cleanup happens later
 * we may collapse this into FindEvents.
 */
export default function PlayHub() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hub header — compact on mobile, clear hierarchy */}
      <div className="bg-gradient-to-b from-muted/20 to-background pt-4 sm:pt-5 pb-3 px-4 sm:px-6 border-b border-border/30">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            <h1 className="page-title">Find Play</h1>
          </div>
          <p className="page-subtitle mt-0.5 hidden sm:block">
            Round robins, open play, clinics, and other events near you.
          </p>
        </div>
      </div>

      {/* Embedded events feed */}
      <Suspense fallback={<TabSkeleton />}>
        <FindEvents hideHeader />
      </Suspense>
    </div>
  );
}
