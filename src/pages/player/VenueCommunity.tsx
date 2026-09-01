import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, CalendarClock, CalendarDays, LayoutGrid,
  MapPin, MessageSquare, MoreHorizontal, Settings, Users, Globe, Phone, Gauge,
  Ticket, ChevronRight, MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  const { group, membership, loading } = useGroupDetail(groupId);
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [activeTab, setActiveTab] = useState('home');
  // Chat and feed are expensive and subscribe to realtime, so they mount only
  // once visited and then stay mounted — remounting a chat loses its scroll
  // position and re-runs its queries every time you glance at another tab.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['home']));

  const openTab = (tab: string) => {
    setActiveTab(tab);
    setVisitedTabs((seen) => (seen.has(tab) ? seen : new Set([...seen, tab])));
  };

  // One presence subscription for the page, shared with chat. Two would
  // double-count who is online.
  const { onlineCount, isConnected } = useGroupPresence(groupId);
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

  // Snapshot the viewer's last-read marker BEFORE anything updates it, so the
  // chat's unread divider reflects where they actually left off.
  const lastReadRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastReadRef.current === null && membership?.last_read_at) {
      lastReadRef.current = membership.last_read_at;
    }
  }, [membership?.last_read_at]);

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

  return (
    <VenueStaffProvider
      venueId={group.venue_id}
      venueName={venue?.name ?? null}
      accent={chrome?.accentHex}
    >
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Venue hero — a facility masthead, not the community's ink band. The
          cover carries the identity, the stats carry the answer most people
          arrived for. */}
      <header className="relative shrink-0 overflow-hidden">
        <div
          className="relative h-40 sm:h-52"
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

          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-3">
            {venue?.logo_url && (
              <img
                src={venue.logo_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover ring-2 ring-white/25"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-xl font-bold leading-tight text-white sm:text-2xl">
                  {venue?.name ?? group.name}
                </h1>
                {group.is_venue_verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-amber-400" aria-label="Verified venue" />
                )}
              </div>
              {venue?.tagline && (
                <p className="truncate text-xs text-white/80">{venue.tagline}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stat strip — the court-reservation answer, above everything else. */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2.5">
          <Stat
            icon={LayoutGrid}
            label={hasCourts ? `${freeNow} of ${courts.length} free` : 'No courts yet'}
            accent={chrome?.accentHex}
          />
          <Stat icon={Users} label={`${group.member_count ?? 0} members`} />
          {nextUp[0] && (
            <Stat
              icon={CalendarClock}
              label={`Next: ${formatSlotTime(new Date(nextUp[0].start_time))}`}
            />
          )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={openTab} className="flex min-h-0 flex-1 flex-col">
        {/* A scrolling strip rather than a squeezed row: six destinations do not
            fit a phone at a readable size, and shrinking them all to fit is how
            tab bars become unreadable. */}
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-[1400px] overflow-x-auto px-2 sm:px-4">
            <TabsList className="h-auto w-max justify-start gap-1 rounded-none border-0 bg-transparent p-1.5">
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
          <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
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
                <div className="h-[70dvh] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
                  <GroupChat
                    groupId={groupId!}
                    currentUserId={membership?.user_id ?? null}
                    onlineCount={onlineCount}
                    isConnected={isConnected}
                    isAdmin={isAdmin}
                    lastReadAt={lastReadRef.current}
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
                  currentUserId={membership?.user_id ?? null}
                />
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      <QuickPostComposer
        open={quickPostOpen}
        onOpenChange={setQuickPostOpen}
        initialType={quickPostType}
        groupId={groupId || ''}
        onSubmit={async (data: any) => !!(await createPost(data))}
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
      className="gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
    <Badge
      variant="outline"
      className={cn('shrink-0 gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold')}
      style={accent ? { borderColor: `${accent}55`, color: accent } : undefined}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

