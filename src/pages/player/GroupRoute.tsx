import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { isVenueCommunitiesEnabled } from '@/lib/venues/featureFlag';

const GroupDetail = lazy(() => import('./GroupDetail'));
const VenueCommunity = lazy(() => import('./VenueCommunity'));

/**
 * Chooses the shell for a community.
 *
 * A venue is a facility you book whose conversation is secondary; an ordinary
 * community is a conversation with a schedule attached. Those want genuinely
 * different layouts, so they are different pages rather than one page with a
 * pile of conditionals.
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

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const isVenue = isVenueCommunitiesEnabled() && !!group?.venue_id;

  return (
    <Suspense fallback={<div className="p-4"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
      {isVenue ? <VenueCommunity /> : <GroupDetail />}
    </Suspense>
  );
}
