import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Ticket, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useVenueDay } from '@/hooks/useVenueDay';
import { venueChrome } from '@/lib/venues/branding';
import { parseVenueHours } from '@/lib/venues/hours';
import { VenueStaffProvider, useMyVenueRole, canOperateVenue, canManageVenue } from '@/components/venue/VenueStaffContext';
import { VenueBookingGrid } from '@/components/venue/VenueBookingGrid';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
import { DayStrip } from '@/components/venue/DayStrip';
import { BookCourtDialog } from '@/components/venue/BookCourtDialog';
import { VenueHome } from '@/components/venue/VenueHome';
import { GroupFeed } from '@/components/community/GroupFeed';
import { GroupMembers } from '@/components/community/GroupMembers';
import { GroupChat } from '@/components/community/GroupChat';
import { useGroupPresence } from '@/hooks/useGroupPresence';
import { useGroupRealtime } from '@/hooks/useGroupRealtime';
import { useGroupPosts } from '@/hooks/useGroupPosts';
import { QuickPostComposer, type PostType } from '@/components/community/QuickPostComposer';
import { CollapsedComposerBar } from '@/components/community/CollapsedComposerBar';
import { useVisualViewportPane } from '@/hooks/useVisualViewportPane';
import { initialVenueCommunityTab } from '@/lib/venues/navigation';
import { parseGroupSettings } from '@/types/groupSettings';
import {
  VenueDesktopNavigation,
  VenueDesktopRail,
  VenueMasthead,
  VenueMobileTabs,
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

  const { group, membership, loading } = useGroupDetail(groupId);
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Social inbox rows deep-link with ?tab=chat. The venue shell previously
  // ignored that parameter and always opened Home, making the row feel broken.
  const initialTab = initialVenueCommunityTab(searchParams);
  const [activeTab, setActiveTab] = useState<VenuePageTab>(initialTab);
  // Chat and feed are expensive and subscribe to realtime, so they mount only
  // once visited and then stay mounted — remounting a chat loses its scroll
  // position and re-runs its queries every time you glance at another tab.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([initialTab]));
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopLayout(query.matches);
    query.addEventListener('change', sync);
    sync();
    return () => query.removeEventListener('change', sync);
  }, []);

  const openTab = (tab: VenuePageTab) => {
    setActiveTab(tab);
    setVisitedTabs((seen) => (seen.has(tab) ? seen : new Set([...seen, tab])));
    const next = new URLSearchParams(searchParams);
    if (tab === 'chat') next.set('tab', 'chat');
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  // Also honor a chat deep link that arrives while React Router reuses this
  // mounted route (for example, moving between group rows without a reload).
  useEffect(() => {
    if (searchParams.get('tab') !== 'chat') return;
    setActiveTab('chat');
    setVisitedTabs((seen) => (seen.has('chat') ? seen : new Set([...seen, 'chat'])));
  }, [searchParams]);

  // A fixed pane sized to window.visualViewport is what keeps the composer
  // immediately above an overlay keyboard in Capacitor/iOS/Android WebViews.
  // It is applied only to the immersive chat state; the venue's other tabs
  // remain a normally scrolling page.
  const chatPaneStyle = useVisualViewportPane();

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

  const [profile, setProfile] = useState<{
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data) setProfile(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [bookingCourtId, setBookingCourtId] = useState<string | null>(null);
  const [bookingStart, setBookingStart] = useState<Date | null>(null);
  const [bookingMinutes, setBookingMinutes] = useState<number | null>(null);

  // Snapshot the viewer's last-read marker BEFORE anything updates it, so the
  // chat's unread divider reflects where they actually left off.
  const lastReadRef = useRef<string | null>(null);
  useEffect(() => {
    const chatMarker = membership?.last_chat_read_at ?? membership?.last_read_at;
    if (lastReadRef.current === null && chatMarker) {
      lastReadRef.current = chatMarker;
    }
  }, [membership?.last_chat_read_at, membership?.last_read_at]);

  const venue = group?.venue ?? null;
  const chrome = useMemo(() => venueChrome(venue), [venue]);
  const hours = useMemo(() => parseVenueHours(venue?.hours_of_operation), [venue]);

  const { role: venueRole } = useMyVenueRole(group?.venue_id);

  const {
    courts, programming, going, grid, closed, slotMinutes, freeNow,
    loading: dayLoading, refresh, hasCourts,
  } = useVenueDay(group?.venue_id, groupId, day, hours);

  const isMember = membership?.status === 'active';
  const groupSettings = useMemo(() => parseGroupSettings(group?.settings), [group?.settings]);
  // Venue authority comes from venue_staff, not from community moderation —
  // running the courts and moderating the conversation are different jobs.
  const isCommunityAdmin = membership?.role === 'owner' || membership?.role === 'moderator';
  const canManageSettings = canManageVenue(venueRole) || isCommunityAdmin;
  const isOperator = canOperateVenue(venueRole) || membership?.role === 'owner';
  const chatEnabled = groupSettings.chat_enabled;
  const canSendChat = isCommunityAdmin || (isMember && groupSettings.allow_member_chat);
  const canCreatePosts = isCommunityAdmin || (isMember && groupSettings.allow_member_posts);
  const canCreateLfg = isCommunityAdmin || (isMember && groupSettings.allow_member_lfg);
  // Members may book unless the group has turned member-created events off —
  // the same setting that gates every other kind of session, so a venue has one
  // switch to think about rather than two.
  const canBook =
    isMember &&
    (canManageSettings ||
      (group?.settings as Record<string, unknown> | null)?.allow_member_events !== false);

  useEffect(() => {
    const invalidChat = activeTab === 'chat' && !chatEnabled;
    const invalidBook = activeTab === 'book' && !hasCourts;
    if (!invalidChat && !invalidBook) return;
    setActiveTab('home');
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [activeTab, chatEnabled, hasCourts, searchParams, setSearchParams]);

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
  const dayEnd = grid[0]?.slots[grid[0].slots.length - 1]?.end ?? null;

  const nextUp = programming
    .filter((p) => new Date(p.start_time) >= new Date())
    .slice(0, 3);

  const showDesktopRail =
    activeTab === 'play' ||
    activeTab === 'feed' ||
    activeTab === 'chat' ||
    activeTab === 'more';

  // Chat is a conversation, not a card in the middle of a venue brochure.
  // Give it the whole visible viewport so focusing the composer cannot move
  // the hero, tab strip, or document around it. The normal venue shell remains
  // mounted only for Home/Book/Play/Feed/More.
  if (activeTab === 'chat' && chatEnabled && !isDesktopLayout) {
    const cameFromSocial = Boolean(
      (location.state as { fromSocialInbox?: boolean } | null)?.fromSocialInbox,
    );
    const closeChat = () => {
      if (cameFromSocial) navigate(-1);
      else openTab('home');
    };

    return (
      <VenueStaffProvider
        venueId={group.venue_id}
        venueName={venue?.name ?? null}
        accent={chrome?.accentHex}
      >
        <div
          className="z-40 flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background"
          style={chatPaneStyle}
        >
          <GroupChat
            groupId={groupId!}
            currentUserId={membership?.user_id ?? null}
            onlineCount={onlineCount}
            isConnected={isConnected}
            isAdmin={isCommunityAdmin}
            lastReadAt={lastReadRef.current}
            isActive
            title={venue?.name ?? group.name}
            subtitle="Venue chat"
            avatarUrl={venue?.logo_url ?? group.icon_url ?? null}
            onBack={closeChat}
            immersive
            canSendMessages={canSendChat}
          />
        </div>
      </VenueStaffProvider>
    );
  }

  return (
    <VenueStaffProvider
      venueId={group.venue_id}
      venueName={venue?.name ?? null}
      accent={chrome?.accentHex}
    >
    <div className="flex min-h-[100dvh] flex-col bg-muted/[0.16]">
      <VenueMasthead
        venueName={venue?.name ?? group.name}
        tagline={venue?.tagline}
        logoUrl={venue?.logo_url ?? group.icon_url}
        coverImageUrl={venue?.cover_image_url}
        fallbackBackground={chrome?.backgroundImage}
        bloom={chrome?.bloom}
        accent={chrome?.accentHex}
        verified={group.is_venue_verified}
        hasCourts={hasCourts}
        freeNow={freeNow}
        courtCount={courts.length}
        memberCount={group.member_count ?? 0}
        nextStart={nextUp[0]?.start_time}
        isOperator={isOperator}
        isAdmin={canManageSettings}
        onBack={() => navigate('/player/community')}
        onOperations={() => navigate(`/player/community/group/${groupId}/ops`)}
        onSettings={() => navigate(`/player/community/group/${groupId}/manage`)}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => openTab(value as VenuePageTab)}
        className="flex min-h-0 flex-1 flex-col"
        style={{ '--venue-accent': chrome?.accentHex ?? 'hsl(var(--primary))' } as React.CSSProperties}
      >
        <VenueMobileTabs hasCourts={hasCourts} chatEnabled={chatEnabled} />

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
            <div
              className={cn(
                'lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start lg:gap-8 min-[1180px]:gap-10',
                showDesktopRail && 'min-[1180px]:grid-cols-[210px_minmax(0,1fr)_292px]',
              )}
            >
              <VenueDesktopNavigation
                hasCourts={hasCourts}
                chatEnabled={chatEnabled}
                isOperator={isOperator}
                isAdmin={canManageSettings}
                onOperations={() => navigate(`/player/community/group/${groupId}/ops`)}
                onSettings={() => navigate(`/player/community/group/${groupId}/manage`)}
              />

              <main className="min-w-0">
                <TabsContent value="home" className="mt-0">
                  <VenueHome
                    welcomeHeadline={venue?.welcome_headline ?? null}
                    welcomeMessage={venue?.welcome_message ?? null}
                    city={venue?.city ?? null}
                    state={venue?.state ?? null}
                    phone={venue?.phone ?? null}
                    websiteUrl={venue?.website_url ?? null}
                    hours={hours}
                    nextUp={nextUp}
                    hasCourts={hasCourts}
                    freeNow={freeNow}
                    courtCount={courts.length}
                    accent={chrome?.accentHex}
                    onBook={() => openTab('book')}
                    onOpenPlay={() => openTab('play')}
                  />
                </TabsContent>

                {hasCourts && (
                  <TabsContent value="book" className="mt-0">
                    {closed && (
                      <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-center text-sm text-muted-foreground">
                        Closed on this day.
                      </p>
                    )}
                    <VenueBookingGrid
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
                    />
                  </TabsContent>
                )}

                <TabsContent value="play" className="mt-0">
                  <div className="max-w-3xl space-y-3">
                    <DayStrip value={day} onChange={setDay} accent={chrome?.accentHex} />
                    <VenueProgramming
                      sessions={programming}
                      going={going}
                      loading={dayLoading}
                      venueName={venue?.name ?? null}
                      accent={chrome?.accentHex}
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="feed"
                  className={cn('mt-0 max-w-[760px]', activeTab !== 'feed' && 'hidden')}
                  forceMount={visitedTabs.has('feed') ? true : undefined}
                >
                  {visitedTabs.has('feed') && (
                    <GroupFeed
                      groupId={groupId!}
                      groupName={venue?.name ?? group.name}
                      isAdmin={isCommunityAdmin}
                      currentUserId={membership?.user_id ?? null}
                      venueMode
                      onOpenQuickPost={canCreatePosts ? (type) => openQuickPost(type as PostType) : undefined}
                      onSwitchToEvents={() => openTab('play')}
                    />
                  )}
                </TabsContent>

                <TabsContent
                  value="chat"
                  className={cn('mt-0 max-w-[820px]', activeTab !== 'chat' && 'hidden')}
                  forceMount={visitedTabs.has('chat') ? true : undefined}
                >
                  {visitedTabs.has('chat') && (
                    <div className="h-[min(720px,calc(100dvh-8rem))] min-h-[520px] overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-[0_16px_45px_-30px_hsl(var(--foreground)/0.42)]">
                      <GroupChat
                        groupId={groupId!}
                        currentUserId={membership?.user_id ?? null}
                        onlineCount={onlineCount}
                        isConnected={isConnected}
                        isAdmin={isCommunityAdmin}
                        lastReadAt={lastReadRef.current}
                        isActive={activeTab === 'chat'}
                        title={venue?.name ?? group.name}
                        subtitle="Venue chat"
                        avatarUrl={venue?.logo_url ?? group.icon_url ?? null}
                        canSendMessages={canSendChat}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="more" className="mt-0">
                  <div className="max-w-[820px] space-y-4">
                    <button
                      type="button"
                      onClick={() => navigate('/player/bookings')}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/40"
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
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>

                    <GroupMembers
                      groupId={groupId!}
                      isAdmin={isCommunityAdmin}
                      isOwner={membership?.role === 'owner'}
                      currentUserId={membership?.user_id ?? null}
                      isOnline={isOnline}
                    />
                  </div>
                </TabsContent>
              </main>

              {showDesktopRail && (
                <VenueDesktopRail
                  venueName={venue?.name ?? group.name}
                  activeTab={activeTab}
                  hasCourts={hasCourts}
                  freeNow={freeNow}
                  courtCount={courts.length}
                  memberCount={group.member_count ?? 0}
                  onlineCount={onlineCount}
                  chatEnabled={chatEnabled}
                  nextUp={nextUp}
                  hours={hours}
                  accent={chrome?.accentHex}
                  onOpenTab={openTab}
                  onBookings={() => navigate('/player/bookings')}
                />
              )}
            </div>
          </div>
        </div>
      </Tabs>

      {/* Keep the fixed composer as a thumb-reachable mobile affordance. On
          desktop the feed's in-column Share card is the clearer entry point. */}
      {activeTab === 'feed' && canCreatePosts && (
        <CollapsedComposerBar
          className="lg:hidden"
          onExpand={() => openQuickPost('post')}
          onPhotoClick={() => openQuickPost('photo')}
          avatarUrl={profile?.avatar_url}
          displayName={profile?.display_name || profile?.full_name}
          contextName={venue?.name ?? group.name}
          venueMode
        />
      )}

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
        <BookCourtDialog
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
      )}
    </div>
    </VenueStaffProvider>
  );
}

