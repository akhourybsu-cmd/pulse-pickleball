import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, CalendarClock, CalendarDays, LayoutGrid,
  MapPin, MessageSquare, MoreHorizontal, Settings, Users, Gauge,
  Ticket, ChevronRight, MessageCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useVenueDay } from '@/hooks/useVenueDay';
import { venueChrome } from '@/lib/venues/branding';
import { formatSlotTime } from '@/lib/venues/availability';
import { parseVenueHours, describeDay, DAY_NAMES } from '@/lib/venues/hours';
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
  const [activeTab, setActiveTab] = useState(initialTab);
  // Chat and feed are expensive and subscribe to realtime, so they mount only
  // once visited and then stay mounted — remounting a chat loses its scroll
  // position and re-runs its queries every time you glance at another tab.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([initialTab]));

  const openTab = (tab: string) => {
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
  // Venue authority comes from venue_staff, not from community moderation —
  // running the courts and moderating the conversation are different jobs.
  const isAdmin = canManageVenue(venueRole) || membership?.role === 'owner';
  const isOperator = canOperateVenue(venueRole) || membership?.role === 'owner';
  // Members may book unless the group has turned member-created events off —
  // the same setting that gates every other kind of session, so a venue has one
  // switch to think about rather than two.
  const canBook =
    isMember &&
    (isAdmin ||
      (group?.settings as Record<string, unknown> | null)?.allow_member_events !== false);

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

  // Chat is a conversation, not a card in the middle of a venue brochure.
  // Give it the whole visible viewport so focusing the composer cannot move
  // the hero, tab strip, or document around it. The normal venue shell remains
  // mounted only for Home/Book/Play/Feed/More.
  if (activeTab === 'chat') {
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
            isAdmin={isAdmin}
            lastReadAt={lastReadRef.current}
            isActive
            title={venue?.name ?? group.name}
            subtitle="Venue chat"
            avatarUrl={venue?.logo_url ?? group.icon_url ?? null}
            onBack={closeChat}
            immersive
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
      {/* Venue hero — a facility masthead, not the community's ink band. The
          cover carries the identity, the stats carry the answer most people
          arrived for. */}
      <header className="relative shrink-0 overflow-hidden">
        <div
          className="relative h-44 sm:h-56"
          style={{
            backgroundImage: venue?.cover_image_url
              ? `url(${venue.cover_image_url})`
              : chrome?.backgroundImage ??
                'linear-gradient(158deg, hsl(var(--ink-700)) 0%, hsl(var(--ink-900)) 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Scrim so white text survives any cover photo. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.12) 100%)',
            }}
          />
          {chrome?.bloom && (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 78% 18%, ${chrome.bloom} 0%, transparent 34%)`,
              }}
            />
          )}

          <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[calc(0.6rem+env(safe-area-inset-top))]">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 hover:text-white"
              onClick={() => navigate('/player/community')}
              aria-label="Back to Community"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="ml-auto flex items-center gap-1.5">
              {isOperator && (
                <>
                  {/* Operations is the staff surface: same data as this page,
                      more authority over it. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 hover:text-white"
                    onClick={() => navigate(`/player/community/group/${groupId}/ops`)}
                    aria-label="Venue operations"
                  >
                    <Gauge className="h-[18px] w-[18px]" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 hover:text-white"
                      onClick={() => navigate(`/player/community/group/${groupId}/manage`)}
                      aria-label="Venue settings"
                    >
                      <Settings className="h-[18px] w-[18px]" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1400px] items-end gap-3 px-4 pb-4 sm:px-6">
            {venue?.logo_url ? (
              <img
                src={venue.logo_url}
                alt={`${venue.name} logo`}
                className="h-14 w-14 shrink-0 rounded-xl bg-white/10 object-cover shadow-lg ring-1 ring-white/30 sm:h-16 sm:w-16"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-xl font-bold text-white shadow-lg backdrop-blur-sm sm:h-16 sm:w-16 sm:text-2xl"
              >
                {(venue?.name ?? group.name).trim().slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-2xl font-bold leading-none tracking-[-0.025em] text-white sm:text-3xl">
                  {venue?.name ?? group.name}
                </h1>
                {group.is_venue_verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-amber-400" aria-label="Verified venue" />
                )}
              </div>
              {venue?.tagline && (
                <p className="mt-1 truncate text-sm text-white/78">{venue.tagline}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stat strip — the court-reservation answer, above everything else. */}
        <div className="border-b border-border/70 bg-card">
          <div className="mx-auto flex max-w-[1400px] items-center overflow-x-auto px-4 py-3 sm:px-6">
            <Stat
              icon={LayoutGrid}
              label={hasCourts ? `${freeNow} of ${courts.length} free` : 'No courts yet'}
              accent={chrome?.accentHex}
            />
            <Stat icon={Users} label={`${group.member_count ?? 0} members`} />
            {nextUp[0] && (
              <Stat
                icon={CalendarClock}
                label={`Next at ${formatSlotTime(new Date(nextUp[0].start_time))}`}
              />
            )}
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={openTab}
        className="flex min-h-0 flex-1 flex-col"
        style={{ '--venue-accent': chrome?.accentHex ?? 'hsl(var(--primary))' } as React.CSSProperties}
      >
        {/* A scrolling strip rather than a squeezed row: six destinations do not
            fit a phone at a readable size, and shrinking them all to fit is how
            tab bars become unreadable. */}
        <div className="border-b border-border/70 bg-card">
          <div className="mx-auto max-w-[1400px] overflow-x-auto px-2 sm:px-4">
            <TabsList className="h-auto w-max justify-start gap-0 rounded-none border-0 bg-transparent p-0">
              <VenueTab value="home" icon={MapPin}>Home</VenueTab>
              {hasCourts && <VenueTab value="book" icon={LayoutGrid}>Book</VenueTab>}
              <VenueTab value="play" icon={CalendarDays}>Play</VenueTab>
              <VenueTab value="feed" icon={MessageSquare}>Feed</VenueTab>
              <VenueTab value="chat" icon={MessageCircle}>Chat</VenueTab>
              <VenueTab value="more" icon={MoreHorizontal}>More</VenueTab>
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
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
                {/* Same day model as Book, so moving between the two keeps the
                    viewer on the day they were already looking at. */}
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

            {/* A feed constrained to a readable measure. Posts running the full
                width of a laptop are unreadable however well they are styled. */}
            <TabsContent
              value="feed"
              className={cn('mt-0 max-w-2xl', activeTab !== 'feed' && 'hidden')}
              forceMount={visitedTabs.has('feed') ? true : undefined}
            >
              {visitedTabs.has('feed') && (
                <GroupFeed
                  groupId={groupId!}
                  groupName={venue?.name ?? group.name}
                  isAdmin={isAdmin}
                  currentUserId={membership?.user_id ?? null}
                  onOpenQuickPost={(type) => openQuickPost(type as PostType)}
                  onSwitchToEvents={() => openTab('play')}
                />
              )}
            </TabsContent>

            {/* Chat needs a concrete height: GroupChat is h-full and would
                collapse inside a page that grows with its content. */}
            <TabsContent
              value="chat"
              className={cn('mt-0 max-w-3xl', activeTab !== 'chat' && 'hidden')}
              forceMount={visitedTabs.has('chat') ? true : undefined}
            >
              {visitedTabs.has('chat') && (
                <div className="h-[70dvh] min-h-[420px] overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_10px_32px_rgba(0,0,0,0.06)]">
                  <GroupChat
                    groupId={groupId!}
                    currentUserId={membership?.user_id ?? null}
                    onlineCount={onlineCount}
                    isConnected={isConnected}
                    isAdmin={isAdmin}
                    lastReadAt={lastReadRef.current}
                    isActive={activeTab === 'chat'}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="more" className="mt-0">
              <div className="max-w-3xl space-y-4">
                {/* A player who books here needs somewhere to see what they
                    booked; that list spans every venue, not just this one. */}
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
                  isAdmin={isAdmin}
                  isOwner={membership?.role === 'owner'}
                  currentUserId={membership?.user_id ?? null}
                  isOnline={isOnline}
                />
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* The feed's only way to write a post.
          GroupFeed renders no composer of its own — its newPostContent state is
          dead code and focusComposer() targets a textarea that does not exist —
          so the bar is the parent's responsibility. Without it the venue feed
          could be read and not written to. */}
      {activeTab === 'feed' && isMember && (
        <CollapsedComposerBar
          onExpand={() => openQuickPost('post')}
          onPhotoClick={() => openQuickPost('photo')}
          avatarUrl={profile?.avatar_url}
          displayName={profile?.display_name || profile?.full_name}
        />
      )}

      <QuickPostComposer
        open={quickPostOpen}
        onOpenChange={setQuickPostOpen}
        initialType={quickPostType}
        groupId={groupId || ''}
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

/** Heading with a rule, matching the operations dashboard's rhythm. */
function VenueTab({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative gap-1.5 rounded-none border-0 bg-transparent px-3 py-3 text-xs font-semibold text-muted-foreground shadow-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-[var(--venue-accent)] after:transition-transform data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:scale-x-100"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </TabsTrigger>
  );
}

function Stat({
  icon: Icon,
  label,
  accent,
}: {
  icon: typeof MapPin;
  label: string;
  accent?: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3 first:pl-0 [&+&]:border-l [&+&]:border-border/70">
      <Icon
        className="h-3.5 w-3.5 text-muted-foreground"
        style={accent ? { color: accent } : undefined}
      />
      <span className="text-xs font-semibold text-foreground/80">{label}</span>
    </div>
  );
}

