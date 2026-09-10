import { lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { isVenueCommunitiesEnabled } from '@/lib/venues/featureFlag';
import { useVenueModules } from '@/hooks/useVenueModules';
import { VenueStaffProvider } from '@/components/venue/VenueStaffContext';
import { Button } from '@/components/ui/button';
import { VenueLoadState } from '@/components/venue/VenueLoadState';

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
  const { group, loading, isError, refetch } = useGroupDetail(groupId);
  const [params, setParams] = useSearchParams();
  const communityView = params.get('view') === 'community';
  const isVenue = isVenueCommunitiesEnabled() && !!group?.venue_id;
  const modules = useVenueModules(isVenue ? group?.venue_id : null);

  if (!loading && (isError || !group)) return <VenueLoadState fullPage onRetry={() => void refetch()} />;

  if (loading || (modules.loading && !communityView)) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isVenue && modules.isError && !communityView) return <div role="alert" className="m-4 space-y-3 rounded-2xl border p-5 font-sans sm:p-6"><h2 className="text-lg font-semibold">Facility features couldn’t load</h2><p className="text-sm leading-6 text-muted-foreground">Court booking and operations need a fresh access check. You can still open the venue’s community for posts, messages, and members.</p><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => modules.refetch()}>Try again</Button><Button className="min-h-11" onClick={() => { const next = new URLSearchParams(params); next.set('view', 'community'); setParams(next); }}>Open community</Button></div></div>;
  const facilityShell = isVenue && (modules.booking || modules.facility) && !communityView;

  return (
    <Suspense fallback={<div className="p-4"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
      {facilityShell ? <VenueCommunity key={groupId} /> : <VenueStaffProvider venueId={isVenue ? group?.venue_id : null} venueName={group?.venue?.name} accent={group?.venue?.primary_color}><GroupDetail key={groupId} /></VenueStaffProvider>}
    </Suspense>
  );
}
