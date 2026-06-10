import { lazy, Suspense } from 'react';
import { Compass } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerPageHeader } from '@/components/layout/PlayerPageHeader';

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
 * Phase 4 swaps the hand-rolled header for the shared PlayerPageHeader so
 * Home / Matches / Play / Profile all use the same header pattern.
 */
export default function PlayHub() {
  return (
    <div className="min-h-screen bg-background">
      <PlayerPageHeader
        icon={Compass}
        title="Find Play"
        subtitle="Round robins, open play, clinics, and other events near you."
        background="gradient"
      />

      {/* Embedded events feed */}
      <Suspense fallback={<TabSkeleton />}>
        <FindEvents hideHeader />
      </Suspense>
    </div>
  );
}
