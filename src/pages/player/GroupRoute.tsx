import { VenueTheme } from '@/components/venue/VenueTheme';
import { lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { isVenueCommunitiesEnabled } from '@/lib/venues/featureFlag';
import { useVenueModules } from '@/hooks/useVenueModules';
import { VenueStaffProvider } from '@/components/venue/VenueStaffContext';
import { Button } from '@/components/ui/button';
import { VenueLoadState } from '@/components/venue/VenueLoadState';
import { VenueEntrance } from '@/components/venue/VenueEntrance';
import { isRallyHausDemo } from '@/lib/venues/rallyHausDemo';

const GroupDetail = lazy(() => import('./GroupDetail'));
const VenueCommunity = lazy(() => import('./VenueCommunity'));
const RallyHausDemoPage = lazy(() => import('@/components/venue/RallyHausDemoPage'));

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

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (group && isRallyHausDemo(group.venue?.id, group.id, params)) return <Suspense fallback={<div role="status" className="p-8">Opening Rally Haus…</div>}><RallyHausDemoPage group={group} /></Suspense>;

  const moduleError = isVenue && modules.isError && !communityView;
  const moduleFailure = <div role="alert" className="m-4 space-y-3 rounded-2xl border p-5 font-sans sm:p-6"><h2 className="text-lg font-semibold">Facility features couldn’t load</h2><p className="text-sm leading-6 text-muted-foreground">Court booking and operations need a fresh access check. You can still open the venue’s community for posts, messages, and members.</p><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => modules.refetch()}>Try again</Button><Button className="min-h-11" onClick={() => { const next = new URLSearchParams(params); next.set('view', 'community'); setParams(next); }}>Open community</Button></div></div>;
  const facilityShell = isVenue && (modules.booking || modules.facility) && !communityView;
  const page = facilityShell ? <VenueCommunity key={groupId} /> : <VenueStaffProvider venueId={isVenue ? group?.venue_id : null} venueName={group?.venue?.name} accent={group?.venue?.primary_color}><GroupDetail key={groupId} /></VenueStaffProvider>;

  if (isVenue) return <VenueTheme brand={group?.venue}><VenueEntrance key={groupId} identity={{
    name: group?.venue?.name || group?.name || 'Your venue',
    logoUrl: group?.venue?.logo_url || group?.icon_url,
    logoShape: group?.venue?.logo_shape,
    logoImageFit: group?.venue?.logo_image_fit,
    primaryColor: group?.venue?.primary_color,
    secondaryColor: group?.venue?.secondary_color,
    logoBackgroundColor: group?.venue?.logo_background_color,
  }} pending={modules.loading && !communityView} bypass={moduleError}>
    {moduleError ? moduleFailure : page}
  </VenueEntrance></VenueTheme>;

  return (
    <Suspense fallback={<div className="p-4"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
      {page}
    </Suspense>
  );
}
