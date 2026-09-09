import { lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { isVenueCommunitiesEnabled } from '@/lib/venues/featureFlag';
import { useVenueModules } from '@/hooks/useVenueModules';
import { VenueStaffProvider } from '@/components/venue/VenueStaffContext';
import { Button } from '@/components/ui/button';

const GroupDetail = lazy(() => import('./GroupDetail'));
const VenueCommunity = lazy(() => import('./VenueCommunity'));

/**
 * Chooses the shell for a community.
 *
 * Every venue starts as a full community with venue branding. Optional facility
 * modules add the booking/operations shell; they never replace community tools.
 *
 * The dispatch happens here, above both, so neither has to know the other
 * exists and — importantly — so the venue shell doesn't mount the standard
 * page's presence and realtime subscriptions on its way to being replaced.
 * The group query is shared (`useGroupDetail`), so whichever page mounts reads
 * it straight from cache rather than fetching again.
 */
export default function GroupRoute() {
  const { groupId } = useParams<{ groupId: string }>();
  const { group, loading } = useGroupDetail(groupId);
  const [params] = useSearchParams();
  const isVenue = isVenueCommunitiesEnabled() && !!group?.venue_id;
  const modules = useVenueModules(isVenue ? group?.venue_id : null);

  if (loading || modules.loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isVenue && modules.isError) return <div role="alert" className="m-4 rounded-2xl border p-6"><p>We couldn’t load this venue’s features.</p><Button variant="outline" className="mt-3" onClick={() => modules.refetch()}>Try again</Button></div>;
  const facilityShell = isVenue && (modules.booking || modules.facility) && params.get('view') !== 'community';

  return (
    <Suspense fallback={<div className="p-4"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
      {facilityShell ? <VenueCommunity /> : <VenueStaffProvider venueId={isVenue ? group?.venue_id : null} venueName={group?.venue?.name} accent={group?.venue?.primary_color}><GroupDetail /></VenueStaffProvider>}
    </Suspense>
  );
}
