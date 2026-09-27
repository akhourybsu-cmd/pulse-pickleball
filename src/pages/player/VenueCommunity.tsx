import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Ticket, ChevronRight, FolderOpen, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useVenueModules } from '@/hooks/useVenueModules';
import { useVenueDay } from '@/hooks/useVenueDay';
import { venueCalendarNow } from '@/lib/venues/timezone';
import { venueChrome } from '@/lib/venues/branding';
import { parseVenueHours } from '@/lib/venues/hours';
import { VenueStaffProvider, useMyVenueRole, canOperateVenue, canManageVenue } from '@/components/venue/VenueStaffContext';
import { VenueBookingGrid } from '@/components/venue/VenueBookingGrid';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
import { DayStrip } from '@/components/venue/DayStrip';
import { BookCourtDialog } from '@/components/venue/BookCourtDialog';
import { VenueHome } from '@/components/venue/VenueHome';
import { VenueEventDialog } from '@/components/venue/VenueEventDialog';
import { VenueProgramDialog } from '@/components/venue/VenueProgramDialog';
import { VenueEventsPage, VenuePageHeading, VenuePlayCategories } from '@/components/venue/VenuePlayerPages';
import { useVenueEvents } from '@/hooks/useVenueEvents';
import type { VenueEventFilter } from '@/lib/venues/events';
import { GroupFiles } from '@/components/community/GroupFiles';
import { InviteModal } from '@/components/community/InviteModal';
import { CommunityJoinAction } from '@/components/community/CommunityJoinAction';
import { communityUrl } from '@/lib/communityShare';
import { GroupNotificationSettingsSheet } from '@/components/community/GroupNotificationSettingsSheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GroupFeed } from '@/components/community/GroupFeed';
import { GroupMembers } from '@/components/community/GroupMembers';
import { usePrivateVenueSandbox } from '@/hooks/usePrivateVenueSandbox';
import { PrivateVenueNotice } from '@/components/venue/PrivateVenueNotice';
import { VenueLoadState } from '@/components/venue/VenueLoadState';
import { useAuthState } from '@/hooks/useAuthState';
import { availableBookingEnd } from '@/lib/venues/experience';
import { GroupChat } from '@/components/community/GroupChat';
import { useGroupPresence } from '@/hooks/useGroupPresence';
import { useGroupRealtime } from '@/hooks/useGroupRealtime';
import { useGroupPosts } from '@/hooks/useGroupPosts';
import { useVenuePrograms } from '@/hooks/useVenuePrograms';
import { QuickPostComposer, type PostType } from '@/components/community/QuickPostComposer';
import { CollapsedComposerBar } from '@/components/community/CollapsedComposerBar';
import { VenueMobileShell, VenuePanel } from '@/components/venue/VenueMobileShell';
import { initialVenueCommunityTab, venueTabParams, parseVenueDay, venueDayKey } from '@/lib/venues/navigation';
import { parseGroupSettings } from '@/types/groupSettings';
import { VenueClubHeader } from '@/components/venue/VenueClubHeader';
import { VenueClubHome, VenueClubCommunityNav, VenueClubAbout } from '@/components/venue/VenueClubHome';
import { useVenueCommunityPreview } from '@/hooks/useVenueCommunityPreview';
import { programPhase, PROGRAM_FORMATS } from '@/lib/venues/programExperience';
import {
  VenueDesktopNavigation,
  VenueDesktopRail,
  VenueMasthead,
  type VenuePageTab,
} from '@/components/venue/VenuePageChrome';

/**
 * A venue's community.
 *
 * Deliberately NOT the standard community page. A community is a conversation
 * with a schedule attached; a venue is a facility you book, whose conversation
 * is secondary. So this leads with the things a court-reservation app leads
 * with — what's free right now, what's on today, book a court — and keeps the
 * feed and members behind them.
 *
 * Everything underneath is shared: sessions are `group_events`, posts are
 * `group_posts`, members are `group_members`. The venue layer is identity and
 * arrangement, never a second data model. The staff dashboard that will sit
 * alongside this reads the same `useVenueDay` hook, so the two can never
 * disagree about what is happening at the venue.
 */

export default function VenueCommunity() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sharing, setSharing] = useState(false);

  const { group, membership, loading, isError, refetch: refetchGroup } = useGroupDetail(groupId);
  const { profile } = useAuthState();
  const selectedDay = parseVenueDay(searchParams.get('day')) ?? venueCalendarNow(group?.venue?.timezone);
  selectedDay.setHours(0, 0, 0, 0);
  const setDay = (value: Date) => {
    const next = new URLSearchParams(searchParams); next.set('day', venueDayKey(value));
    setSearchParams(next, { replace: true });
  };

  // Social inbox rows deep-link with ?tab=chat. The venue shell previously
  // ignored that parameter and always opened Home, making the row feel broken.
  const initialTab = initialVenueCommunityTab(searchParams);
  const activeTab = initialTab;
  // Chat and feed are expensive and subscribe to realtime, so they mount only
  // once visited and then stay mounted — remounting a chat loses its scroll
  // position and re-runs its queries every time you glance at another tab.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([initialTab]));
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const communitySection = searchParams.get('section') === 'players' ? 'members' : 'posts';
  const setCommunitySection = (section: 'posts' | 'members') => {
    const next = venueTabParams(searchParams, 'feed');
    if (section === 'members') next.set('section', 'players'); else next.delete('section');
    setSearchParams(next, { replace: activeTab === 'feed' });
  };
  const playCategory = ['all', 'open_play', 'clinic', 'practice'].includes(searchParams.get('playCategory') ?? '') ? searchParams.get('playCategory')! : 'all';
  const setPlayCategory = (value: string) => {
    const next = venueTabParams(searchParams, 'play'); next.set('playCategory', value);
    setSearchParams(next, { replace: activeTab === 'play' });
  };
  const eventFilter = (['competition', 'leagues', 'social'].includes(searchParams.get('eventFilter') ?? '') ? searchParams.get('eventFilter') : 'upcoming') as VenueEventFilter;
  const setEventFilter = (value: VenueEventFilter) => {
    const next = venueTabParams(searchParams, 'events'); next.set('eventFilter', value);
    setSearchParams(next, { replace: activeTab === 'events' });
  };
  const communityPreview = useVenueCommunityPreview(groupId, !isDesktopLayout && initialTab === 'home');

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopLayout(query.matches);
    query.addEventListener('change', sync);
    sync();
    return () => query.removeEventListener('change', sync);
  }, []);

  const openTab = (tab: VenuePageTab) => {
    setVisitedTabs((seen) => (seen.has(tab) ? seen : new Set([...seen, tab])));
    setSearchParams(venueTabParams(searchParams, tab));
  };

  // Also honor a chat deep link that arrives while React Router reuses this
  // mounted route (for example, moving between group rows without a reload).
  useEffect(() => {
    setVisitedTabs((seen) => (seen.has(activeTab) ? seen : new Set([...seen, activeTab])));
  }, [activeTab]);

  // One presence subscription for the page, shared with chat. Two would
  // double-count who is online.
  const { onlineCount, isConnected, isOnline } = useGroupPresence(groupId);
  useGroupRealtime(groupId);

  // The feed's composer. Without this the venue feed rendered its post CTAs
  // and none of them did anything — a community you cannot post in.
  const { createPost } = useGroupPosts(groupId || '');
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const [quickPostType, setQuickPostType] = useState<PostType>('post');

  const openQuickPost = (type: PostType) => {
    setQuickPostType(type);
    setQuickPostOpen(true);
  };

  const [bookingCourtId, setBookingCourtId] = useState<string | null>(null);
  const [bookingStart, setBookingStart] = useState<Date | null>(null);
  const [bookingMinutes, setBookingMinutes] = useState<number | null>(null);
  const [eventCreatorOpen, setEventCreatorOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Snapshot the viewer's last-read marker BEFORE anything updates it, so the
  // chat's unread divider reflects where they actually left off.
  const lastReadRef = useRef<string | null>(null);
  const lastReadGroupRef = useRef<string | null>(null);
  useEffect(() => {
    const chatMarker = membership?.last_chat_read_at ?? membership?.last_read_at;
    if (lastReadGroupRef.current !== groupId) {
      lastReadGroupRef.current = groupId ?? null;
      lastReadRef.current = chatMarker ?? null;
    } else if (lastReadRef.current === null && chatMarker) {
      lastReadRef.current = chatMarker;
    }
  }, [groupId, membership?.last_chat_read_at, membership?.last_read_at]);

  const venue = group?.venue ?? null;
  // Overview always reads today without replacing the player's saved schedule day.
  const day = activeTab === 'home' ? venueCalendarNow(venue?.timezone) : selectedDay;
  day.setHours(0, 0, 0, 0);
  const chrome = useMemo(() => venueChrome(venue), [venue]);
  const hours = useMemo(() => parseVenueHours(venue?.hours_of_operation), [venue]);

  const { role: venueRole } = useMyVenueRole(group?.venue_id);

  const {
    courts, programming, going, viewerRsvpByEvent, grid, closed, slotMinutes, freeNow,
    loading: dayLoading, error: dayError, refresh, hasCourts,
  } = useVenueDay(group?.venue_id, groupId, day, hours, venue?.timezone);
  const programQueries = useVenuePrograms(group?.venue_id, selectedProgramId);
  const selectedProgram = programQueries.detail.data?.event ?? null;
  const occasions = useVenueEvents(group?.venue_id, groupId, activeTab === 'events');

  const isMember = membership?.status === 'active';
  const groupSettings = useMemo(() => parseGroupSettings(group?.settings), [group?.settings]);
  // Venue authority comes from venue_staff, not from community moderation —
  // running the courts and moderating the conversation are different jobs.
  const isCommunityAdmin = membership?.role === 'owner' || membership?.role === 'moderator';
  const canManageSettings = canManageVenue(venueRole) || isCommunityAdmin;
  const modules = useVenueModules(group?.venue_id);
  const privateSample = usePrivateVenueSandbox(group?.venue_id);
  const bookingTabAvailable = modules.booking && (hasCourts || dayLoading || !!dayError);
  const isOperator = modules.facility && (canOperateVenue(venueRole) || membership?.role === 'owner');
  const chatEnabled = groupSettings.chat_enabled;
  const canSendChat = isCommunityAdmin || (isMember && groupSettings.allow_member_chat);
  const canCreatePosts = isCommunityAdmin || (isMember && groupSettings.allow_member_posts);
  const canCreateLfg = isCommunityAdmin || (isMember && groupSettings.allow_member_lfg);
  // Members may book unless the group has turned member-created events off —
  // the same setting that gates every other kind of session, so a venue has one
  // switch to think about rather than two.
  const canBook =
    modules.booking && !dayError && !dayLoading && isMember &&
    (canManageSettings ||
      (group?.settings as Record<string, unknown> | null)?.allow_member_events !== false);
  const canCreateProgram = modules.facility && (
    venueRole === 'owner' ||
    venueRole === 'manager' ||
    venueRole === 'organizer' ||
    membership?.role === 'owner');

  useEffect(() => {
    if (loading || !group) return;
    const invalidChat = activeTab === 'chat' && !chatEnabled;
    const invalidBook = activeTab === 'book' && !modules.loading && !modules.isError && !dayLoading && !dayError && (!hasCourts || !modules.booking);
    if (!invalidChat && !invalidBook) return;
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [activeTab, chatEnabled, hasCourts, modules.booking, modules.loading, modules.isError, dayLoading, dayError, searchParams, setSearchParams, loading, group]);

  if (!loading && (isError || !group)) return <VenueLoadState fullPage onRetry={() => void refetchGroup()} />;

  if (loading || !group) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const bookingCourt = courts.find((c) => c.id === bookingCourtId) ?? null;
  const activeCourtCount = courts.filter(court => court.is_active !== false).length;
  const dayEnd = availableBookingEnd(grid, bookingCourtId, bookingStart);

  const nextUp = programQueries.upcoming.data ?? [];
  const todayPrograms = dayError ? [] : programming.filter(session => PROGRAM_FORMATS.some(format => format === session.event_format) && programPhase(session) !== 'ended');
  const clubSessions = todayPrograms.length ? todayPrograms.map(session => ({ ...session, going: going[session.id] ?? 0 })) : nextUp;

  const showDesktopRail =
    activeTab === 'play' ||
    activeTab === 'events' ||
    activeTab === 'feed' ||
    activeTab === 'chat' ||
    activeTab === 'more';

  const identity = { name: venue?.name ?? group.name, logoUrl: venue?.logo_url ?? group.icon_url, logoImageFit: venue?.logo_image_fit, logoShape: venue?.logo_shape, secondaryColor: venue?.secondary_color, logoBackgroundColor: venue?.logo_background_color };
  const onShare = !privateSample && (group.invite_code || group.visibility === 'public') ? () => setSharing(true) : undefined;
  const availabilityError = dayError && <div className="mb-5"><VenueLoadState title="Availability is temporarily unavailable" description="We couldn’t verify courts, programs and reservations. Retry before choosing a time; your existing bookings are unchanged." onRetry={refresh} /></div>;

  return (
    <VenueStaffProvider
      venueId={group.venue_id}
      venueName={venue?.name ?? null}
      accent={chrome?.accentHex}
    >
    <div className="flex min-h-[100dvh] flex-col bg-background lg:bg-muted/[0.16] font-sans [&_h1]:font-sans [&_h2]:font-sans [&_h3]:font-sans">
      <InviteModal open={sharing} onOpenChange={setSharing} inviteCode={group.invite_code} shareUrl={group.visibility === 'public' ? communityUrl(group.id) : undefined} groupName={identity.name} />
      {isDesktopLayout && <VenueMasthead
        venueName={venue?.name ?? group.name}
        tagline={venue?.tagline}
        logoUrl={venue?.logo_url ?? group.icon_url}
        coverImageUrl={venue?.cover_image_url}
        logoImageFit={venue?.logo_image_fit}
        coverImageFit={venue?.cover_image_fit}
        logoShape={venue?.logo_shape}
        logoBackgroundColor={venue?.logo_background_color}
        secondaryColor={venue?.secondary_color}
        coverFocalPoint={venue?.cover_focal_point}
        fallbackBackground={chrome?.backgroundImage}
        bloom={chrome?.bloom}
        accent={chrome?.accentHex}
        verified={group.is_venue_verified}
        hasCourts={hasCourts && modules.booking}
        freeNow={freeNow}
        courtCount={activeCourtCount}
        memberCount={group.member_count ?? 0}
        nextStart={nextUp[0]?.start_time}
        isOperator={isOperator}
        isAdmin={canManageSettings}
        onBack={() => navigate('/player/community')}
        onShare={onShare}
        onOperations={() => navigate(`/player/community/group/${groupId}/ops`)}
        onSettings={() => navigate(`/player/community/group/${groupId}/manage`)}
      />}

      {privateSample && isDesktopLayout && <div className="mx-auto w-full max-w-[1480px] px-4 pt-4 sm:px-6"><PrivateVenueNotice /></div>}

      <Tabs
        orientation={isDesktopLayout ? 'vertical' : 'horizontal'}
        value={activeTab}
        onValueChange={(value) => openTab(value as VenuePageTab)}
        className="flex min-h-0 flex-1 flex-col"
        style={{ '--venue-accent': chrome?.accentHex ?? 'hsl(var(--primary))' } as React.CSSProperties}
      >
        <VenueMobileShell mobile={!isDesktopLayout} activeTab={activeTab} visited={visitedTabs} memoryKey={(membership?.user_id ?? 'guest') + ':' + groupId} identity={identity} hasBooking={bookingTabAvailable}
          onCommunity={() => openTab('feed')} onPlay={() => openTab('play')}
          onExit={() => (location.state as { fromSocialInbox?: boolean } | null)?.fromSocialInbox ? navigate(-1) : navigate('/player/community')}
          onBookings={() => navigate('/player/bookings')}
          onTools={() => setFilesOpen(true)}
          onShare={onShare}
          onSettings={canManageSettings ? () => navigate(`/player/community/group/${groupId}/manage`) : undefined}
          onOperations={isOperator ? () => navigate(`/player/community/group/${groupId}/ops`) : undefined}
          footer={!isMember && !canManageSettings && !isOperator ? <div className="border-t bg-background px-4 py-3"><div className="mx-auto max-w-xl"><CommunityJoinAction key={group.id + ':' + profile?.id} group={group} membership={membership} /></div></div> : activeTab === 'feed' && canCreatePosts && communitySection === 'posts' ? <CollapsedComposerBar embedded onExpand={() => openQuickPost('post')} onPhotoClick={() => openQuickPost('photo')} avatarUrl={profile?.avatar_url} displayName={profile?.display_name || profile?.full_name} contextName={identity.name} venueMode /> : undefined}
        >
        <div className="venue-page-body min-w-0 flex-1">
          <div className="venue-page-container mx-auto max-w-[1480px] px-5 py-5 sm:px-6 sm:py-6 lg:py-8">
            <div
              className={cn(
                'venue-page-columns lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-6 min-[1440px]:gap-8',
                showDesktopRail && 'min-[1280px]:grid-cols-[200px_minmax(0,1fr)_260px]',
              )}
            >
              {isDesktopLayout && <VenueDesktopNavigation activeTab={activeTab}
                hasCourts={bookingTabAvailable}
                chatEnabled={chatEnabled}
                isOperator={isOperator}
                isAdmin={canManageSettings}
                onOperations={() => navigate(`/player/community/group/${groupId}/ops`)}
                onSettings={() => navigate(`/player/community/group/${groupId}/manage`)}
              />}

              <main className="venue-page-main min-w-0">
                <VenuePanel value="home" className="venue-panel-enter mt-0">
                  {!isDesktopLayout && <div className="-mx-5 -mt-5 mb-7"><VenueClubHeader embedded
                    identity={identity} cover={{ src: venue?.cover_image_url, fit: venue?.cover_image_fit, focalPoint: venue?.cover_focal_point }}
                    city={venue?.city} state={venue?.state} verified={group.is_venue_verified} hoursRaw={venue?.hours_of_operation} timeZone={venue?.timezone}
                    courtCount={dayLoading || dayError ? 0 : activeCourtCount} freeNow={freeNow} hasBooking={bookingTabAvailable} isAdmin={canManageSettings} isOperator={isOperator}
                    onBack={() => navigate('/player/community')} onSettings={() => navigate(`/player/community/group/${groupId}/manage`)} onOperations={() => navigate(`/player/community/group/${groupId}/ops`)}
                    onBook={() => openTab('book')} onPlay={() => setPlayCategory('open_play')} onSchedule={() => setPlayCategory('all')}
                  /></div>}
                  {privateSample && !isDesktopLayout && <div className="mb-4"><PrivateVenueNotice /></div>}
                  {availabilityError}
                  {isDesktopLayout ? <VenueHome
                    welcomeHeadline={venue?.welcome_headline ?? null}
                    welcomeMessage={venue?.welcome_message ?? null}
                    city={venue?.city ?? null}
                    state={venue?.state ?? null}
                    phone={venue?.phone ?? null}
                    websiteUrl={venue?.website_url ?? null}
                    email={venue?.email ?? null}
                    hours={hours}
                    nextUp={nextUp}
                    loadingPrograms={programQueries.upcoming.isPending}
                    programsUnavailable={programQueries.upcoming.isError}
                    onRetryPrograms={() => void programQueries.upcoming.refetch()}
                    onPickProgram={setSelectedProgramId}
                    hasCourts={hasCourts && modules.booking}
                    freeNow={freeNow}
                    courtCount={activeCourtCount}
                    accent={chrome?.accentHex}
                    onBook={() => openTab('book')}
                    onOpenPlay={() => openTab('play')}
                    onBookings={() => navigate('/player/bookings')}
                  /> : <VenueClubHome name={venue?.name ?? group.name} hasBooking={bookingTabAvailable} sessions={clubSessions} timeZone={venue?.timezone}
                    loading={dayLoading || (!todayPrograms.length && programQueries.upcoming.isPending)} error={!todayPrograms.length && programQueries.upcoming.isError} onRetry={() => void programQueries.upcoming.refetch()}
                    players={communityPreview.data ?? []} memberCount={group.member_count ?? 0} onlineCount={onlineCount} welcomeHeadline={venue?.welcome_headline} welcomeMessage={venue?.welcome_message}
                    onBook={() => openTab('book')} onPlay={() => setPlayCategory('open_play')} onEvents={() => openTab('events')} onSchedule={() => setPlayCategory('all')} onCommunity={() => setCommunitySection('posts')} onMembers={() => setCommunitySection('members')} onAbout={() => openTab('more')} onPick={setSelectedProgramId}
                  />}
                </VenuePanel>

                {bookingTabAvailable && (
                  <VenuePanel value="book" section={venueDayKey(selectedDay)} className="venue-panel-enter mt-0">
                    <VenuePageHeading title={'Play at ' + identity.name} />
                    <VenuePlayCategories category="book" hasBooking={bookingTabAvailable} onChange={setPlayCategory} onBook={() => openTab('book')} onLeagues={() => setEventFilter('leagues')} />
                    {availabilityError}
                    {!dayError && <VenueBookingGrid
                      timeZone={venue?.timezone}
                      closed={closed}
                      grid={grid}
                      day={day}
                      loading={dayLoading}
                      canBook={canBook}
                      accent={chrome?.accentHex}
                      onDayChange={setDay}
                      onPickSlot={(courtId, start, minutes) => {
                        setBookingCourtId(courtId);
                        setBookingStart(start);
                        setBookingMinutes(minutes || null);
                      }}
                    />}
                  </VenuePanel>
                )}

                <VenuePanel value="play" section={venueDayKey(selectedDay) + ':' + playCategory} className="venue-panel-enter mt-0">
                  <div className="max-w-3xl space-y-5">
                    <VenuePageHeading title={'Play at ' + identity.name} description="Find a session, join a game or reserve your court." onAdd={canCreateProgram ? () => setEventCreatorOpen(true) : undefined} />
                    <VenuePlayCategories category={playCategory} hasBooking={bookingTabAvailable} onChange={setPlayCategory} onBook={() => openTab('book')} onLeagues={() => setEventFilter('leagues')} />
                    <DayStrip value={selectedDay} onChange={setDay} accent={chrome?.accentHex} timeZone={venue?.timezone} />
                    <h3 className="text-sm font-semibold">{venueDayKey(selectedDay) === venueDayKey(venueCalendarNow(venue?.timezone)) ? 'Available today' : 'Sessions on ' + selectedDay.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
                    {availabilityError}
                    {!dayError && <VenueProgramming hideFilters timeZone={venue?.timezone}
                      sessions={programming.filter(session => ['open_play', 'clinic', 'practice'].includes(session.event_format) && (playCategory === 'all' || session.event_format === playCategory))}
                      going={going} loading={dayLoading} accent={chrome?.accentHex}
                      viewerRsvpByEvent={viewerRsvpByEvent} onPick={setSelectedProgramId} />}
                  </div>
                </VenuePanel>

                <VenuePanel value="events" section={eventFilter} className="venue-panel-enter mt-0">
                  <VenueEventsPage name={identity.name} events={occasions.data ?? []} filter={eventFilter} onFilter={setEventFilter}
                    loading={occasions.isPending} error={occasions.isError} onRetry={() => void occasions.refetch()}
                    timeZone={venue?.timezone} onAdd={canCreateProgram ? () => setEventCreatorOpen(true) : undefined}
                    onProgram={setSelectedProgramId} onLeague={id => navigate('/player/leagues/' + id)} />
                </VenuePanel>

                <VenuePanel
                  value="feed" section={communitySection}
                  className={cn('mt-0 max-w-[760px]', activeTab !== 'feed' && 'hidden')}
                  forceMount={visitedTabs.has('feed') ? true : undefined}
                >
                  <VenuePageHeading title="Community" />
                  {<VenueClubCommunityNav section={communitySection} onPosts={() => setCommunitySection('posts')} onMembers={() => setCommunitySection('members')} onChat={chatEnabled ? () => openTab('chat') : undefined} />}
                  {communitySection === 'members' && <GroupMembers groupId={groupId!} isAdmin={isCommunityAdmin} isOwner={membership?.role === 'owner'} currentUserId={membership?.user_id ?? null} isOnline={isOnline} />}
                  <div className={communitySection === 'members' ? 'hidden' : undefined}>
                  {visitedTabs.has('feed') && (
                    <GroupFeed
                      groupId={groupId!}
                      groupName={venue?.name ?? group.name}
                      isAdmin={isCommunityAdmin}
                      currentUserId={membership?.user_id ?? null}
                      venueMode embeddedVenue
                      onOpenQuickPost={canCreatePosts ? (type) => openQuickPost(type as PostType) : undefined}
                      onSwitchToEvents={() => openTab('events')}
                    />
                  )}
                  </div>
                </VenuePanel>

                <VenuePanel
                  value="chat"
                  className={cn('mt-0 max-w-[820px]', activeTab !== 'chat' && 'hidden')}
                  forceMount={visitedTabs.has('chat') ? true : undefined}
                >
                  <VenuePageHeading title="Community" />
                  <VenueClubCommunityNav section="chat" onPosts={() => setCommunitySection('posts')} onMembers={() => setCommunitySection('members')} onChat={() => openTab('chat')} />
                  {visitedTabs.has('chat') && (
                    <div className="venue-chat-frame h-[min(720px,calc(100dvh-8rem))] min-h-0 overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-[0_16px_45px_-30px_hsl(var(--foreground)/0.42)]">
                      <GroupChat
                        groupId={groupId!}
                        currentUserId={membership?.user_id ?? null}
                        onlineCount={onlineCount}
                        isConnected={isConnected}
                        isAdmin={isCommunityAdmin}
                        lastReadAt={lastReadRef.current}
                        isActive={activeTab === 'chat'}
                        title="Venue chat"
                        subtitle={isDesktopLayout ? (privateSample ? 'Private sample · Only you' : 'Venue chat') : undefined}
                        venueIdentity={isDesktopLayout ? identity : undefined}

                        canSendMessages={canSendChat}
                      />
                    </div>
                  )}
                </VenuePanel>

                <VenuePanel value="more" className="venue-panel-enter mt-0">
                  <div className="max-w-[820px] space-y-4">
                    <VenueClubAbout name={identity.name} description={venue?.welcome_message || venue?.welcome_headline} city={venue?.city} state={venue?.state} hoursRaw={venue?.hours_of_operation} timeZone={venue?.timezone} phone={venue?.phone} email={venue?.email} websiteUrl={venue?.website_url} amenities={venue?.amenities} />
                    <button
                      type="button"
                      onClick={() => navigate('/player/bookings')}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left hover:border-primary/40"
                    >
                      <Ticket
                        className="h-4 w-4 shrink-0 text-primary"
                        style={chrome?.accentHex ? { color: chrome.accentHex } : undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">My bookings</p>
                        <p className="text-xs text-muted-foreground">
                          Courts you're holding and sessions you've joined
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>

                    <Button variant="outline" className="min-h-12 w-full justify-between rounded-2xl bg-card" onClick={() => setFilesOpen(true)}><span className="flex items-center gap-3"><FolderOpen className="h-4 w-4" />Venue files & policies</span><ChevronRight className="h-4 w-4" /></Button>
                    <Button variant="outline" className="min-h-12 w-full justify-between rounded-2xl bg-card" onClick={() => setNotificationsOpen(true)}><span className="flex items-center gap-3"><Bell className="h-4 w-4" />Notifications</span><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </VenuePanel>
              </main>

              {showDesktopRail && (
                <VenueDesktopRail
                  venueName={venue?.name ?? group.name}
                  activeTab={activeTab}
                  hasCourts={hasCourts && modules.booking}
                  freeNow={freeNow}
                  courtCount={activeCourtCount}
                  memberCount={group.member_count ?? 0}
                  onlineCount={onlineCount}
                  chatEnabled={chatEnabled}
                  nextUp={nextUp}
                  hours={hours}
                  accent={chrome?.accentHex}
                  onOpenTab={openTab}
                  onBookings={() => navigate('/player/bookings')}
                  onPickProgram={setSelectedProgramId}
                />
              )}
            </div>
          </div>
        </div>
        </VenueMobileShell>
      </Tabs>

      <Dialog open={filesOpen} onOpenChange={setFilesOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Venue files & policies</DialogTitle><DialogDescription>Documents shared by {identity.name}.</DialogDescription></DialogHeader>
          {filesOpen && <GroupFiles groupId={groupId!} isAdmin={isCommunityAdmin} currentUserId={membership?.user_id ?? null} />}
        </DialogContent>
      </Dialog>
      <GroupNotificationSettingsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} groupId={groupId!} groupName={identity.name} />
      <QuickPostComposer
        open={quickPostOpen}
        onOpenChange={setQuickPostOpen}
        initialType={quickPostType}
        groupId={groupId || ''}
        contextName={venue?.name ?? group.name}
        venueMode
        canPostAnnouncements={isCommunityAdmin}
        canPostLfg={canCreateLfg}
        onSubmit={async (data) => !!(await createPost(data))}
      />

      {group.venue_id && (
        <>
          <BookCourtDialog
            timeZone={venue?.timezone}
            open={!!bookingCourtId && !!bookingStart}
            onOpenChange={(o) => {
              if (!o) {
                setBookingCourtId(null);
                setBookingStart(null);
                setBookingMinutes(null);
              }
            }}
            groupId={groupId!}
            venueId={group.venue_id}
            court={bookingCourt}
            start={bookingStart}
            slotMinutes={slotMinutes}
            presetMinutes={bookingMinutes}
            dayEnd={dayEnd}
            onBooked={refresh}
          />
          <VenueEventDialog
            open={eventCreatorOpen}
            onOpenChange={setEventCreatorOpen}
            groupId={groupId!}
            venueId={group.venue_id}
            venueName={venue?.name ?? group.name}
            courts={courts}
            initialDate={day}
            onCreated={() => {
              refresh();
              void programQueries.upcoming.refetch();
              void occasions.refetch();
            }}
          />
          <VenueProgramDialog
            event={selectedProgram}
            venueName={venue?.name ?? group.name}
            open={!!selectedProgramId}
            key={selectedProgramId ?? 'no-program'}
            loading={!!selectedProgramId && programQueries.detail.isPending}
            error={programQueries.detail.error}
            onRetry={() => void programQueries.detail.refetch()}
            onOpenChange={(open) => {
              if (!open) setSelectedProgramId(null);
            }}
            canRsvp={programQueries.detail.data?.canRsvp === true}
            onOpenHost={() => navigate(`/player/community/group/${selectedProgram?.group_id}`)}
            accent={chrome?.accentHex}
            onRsvp={async (eventId, status) => {
              const finalStatus = await programQueries.updateRsvp(eventId, status);
              refresh();
              return finalStatus;
            }}
          />
        </>
      )}
    </div>
    </VenueStaffProvider>
  );
}

