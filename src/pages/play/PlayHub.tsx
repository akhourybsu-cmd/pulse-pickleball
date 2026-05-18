import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass, Calendar, MapPin } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

const FindEvents = lazy(() => import('@/pages/player/FindEvents'));
const VenueDiscovery = lazy(() => import('@/pages/player/VenueDiscovery'));

type PlayTab = 'events' | 'venues';

const TabSkeleton = () => (
  <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto space-y-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-28 w-full rounded-xl" />
    ))}
  </div>
);

/**
 * PlayHub — the unified discovery surface for everything a player can do.
 * Top-level tabs separate Events (round robins, tournaments, clinics, open play)
 * from Venues (places to play). Each tab embeds an existing discovery component
 * with its header suppressed so the hub controls page chrome.
 *
 * Tab state is URL-driven via `?tab=events|venues` so deep links are shareable.
 */
export default function PlayHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: PlayTab = tabParam === 'venues' ? 'venues' : 'events';

  const setActiveTab = (next: PlayTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'events') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    setSearchParams(params, { replace: true });
  };

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
            Find round robins, tournaments, open play, clinics, and places to play.
          </p>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as PlayTab)}
            className="mt-3 sm:mt-4"
          >
            <TabsList className="grid w-full grid-cols-2 max-w-sm">
              <TabsTrigger value="events" className="gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Events
              </TabsTrigger>
              <TabsTrigger value="venues" className="gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Venues
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab body */}
      <Suspense fallback={<TabSkeleton />}>
        {activeTab === 'events' ? (
          <FindEvents hideHeader />
        ) : (
          <VenueDiscovery hideHeader />
        )}
      </Suspense>
    </div>
  );
}
