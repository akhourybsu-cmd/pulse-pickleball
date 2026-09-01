import { useState } from 'react';
import {
  AlertTriangle,
  Clock3,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Palette,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { buildDayGrid, type Court } from '@/lib/venues/availability';
import { courtStatuses, daySummary } from '@/lib/venues/ops';
import { upcomingGaps } from '@/lib/venues/ops';
import { OpsDashboard } from '@/components/venue/ops/OpsDashboard';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
import { VenueHome } from '@/components/venue/VenueHome';
import { VenueBookingGrid } from '@/components/venue/VenueBookingGrid';
import {
  VenueDesktopNavigation,
  VenueDesktopRail,
  VenueMasthead,
  VenueMobileTabs,
  type VenuePageTab,
} from '@/components/venue/VenuePageChrome';
import { ChatMessage } from '@/components/community/ChatMessage';
import { GroupFeed } from '@/components/community/GroupFeed';
import { QuickPostComposer, type PostType } from '@/components/community/QuickPostComposer';
import {
  VenueAdminShell,
  type VenueAdminNavItem,
} from '@/components/community/admin/VenueAdminShell';
import { VenueAdminOverview } from '@/components/community/admin/VenueAdminOverview';
import { AdminPermissionsTab } from '@/components/community/admin/AdminPermissionsTab';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { parseVenueHours } from '@/lib/venues/hours';
import { cn } from '@/lib/utils';
import { DEFAULT_GROUP_SETTINGS } from '@/types/groupSettings';
import type { VenueDaySession } from '@/hooks/useVenueDay';
import type { GroupMessage } from '@/hooks/useGroupChat';
import type { GroupPost } from '@/hooks/useGroupPosts';

/**
 * Design harness for the venue surfaces.
 *
 * DEV ONLY — the route is not registered in a production build. It exists so
 * these screens can be looked at with real proportions and realistic data
 * before anyone has a venue set up, rather than being judged from the source.
 */

// Mirrors the ELEVENO test venue so visual work is judged against the same
// brand palette and operating hours used in staging.
const ACCENT = '#C5AD11';
const ADMIN_COUNTS = { courts: 5, staff: 4, upcoming: 7, posts: 18 };
const VENUE_HOURS = parseVenueHours({
  slotMinutes: 60,
  days: {
    '0': { open: '09:00', close: '22:00' },
    '1': { open: '09:00', close: '22:00' },
    '2': { open: '09:00', close: '22:00' },
    '3': { open: '09:00', close: '22:00' },
    '4': { open: '09:00', close: '22:00' },
    '5': { open: '09:00', close: '22:00' },
    '6': { open: '09:00', close: '22:00' },
  },
});
const DAY = new Date();
DAY.setHours(0, 0, 0, 0);

function at(hour: number, minute = 0): Date {
  const d = new Date(DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const COURTS: Court[] = [
  { id: 'c1', name: 'Court 1', court_number: 1, is_active: true },
  { id: 'c2', name: 'Court 2', court_number: 2, is_active: true, is_premium: true },
  { id: 'c3', name: 'Court 3', court_number: 3, is_active: true },
  { id: 'c4', name: 'Court 4', court_number: 4, is_active: true },
  { id: 'c5', name: 'Court 5', court_number: 5, is_active: true },
  { id: 'c6', name: 'Court 6', court_number: 6, is_active: false },
];

function session(
  id: string,
  court: string,
  from: number,
  to: number,
  format: string,
  title: string,
  capacity: number | null = null,
): VenueDaySession {
  return {
    id,
    group_id: 'g1',
    title,
    description: null,
    event_format: format,
    capacity,
    created_by: 'u1',
    waitlist_enabled: true,
    venue_court_id: court,
    start_time: at(from).toISOString(),
    end_time: at(to).toISOString(),
  };
}

const NOW = at(14, 20);

const SESSIONS: VenueDaySession[] = [
  session('s1', 'c1', 13, 15, 'reservation', 'Tuesday crew'),
  session('s2', 'c2', 14, 16, 'open_play', 'Open Play · All Levels', 16),
  session('s3', 'c3', 12, 18, 'maintenance', 'Resurfacing'),
  session('s4', 'c4', 16, 18, 'clinic', 'Beginner Clinic', 8),
  session('s5', 'c5', 18, 20, 'round_robin', 'Thursday Round Robin', 12),
  session('s6', 'c1', 18, 20, 'reservation', 'Morrison booking'),
];

const GOING: Record<string, number> = { s2: 13, s4: 8, s5: 4 };

function chatMessage(
  id: string,
  userId: string,
  minute: number,
  content: string,
  displayName: string,
  reactions: GroupMessage['reactions'] = [],
): GroupMessage {
  const createdAt = at(14, minute).toISOString();
  return {
    id,
    group_id: 'eleveno',
    user_id: userId,
    content,
    created_at: createdAt,
    updated_at: createdAt,
    _status: 'sent',
    reactions,
    profile: {
      id: userId,
      display_name: displayName,
      full_name: displayName,
      avatar_url: null,
    },
  };
}

const CHAT_MESSAGES = [
  chatMessage('m1', 'alex', 4, 'Anyone looking for a fourth at 6:30 tonight?', 'Alex Morgan'),
  chatMessage('m2', 'alex', 5, 'We have Court 4 booked for ninety minutes.', 'Alex Morgan'),
  chatMessage('m3', 'me', 9, 'I can play. I’ll be there a few minutes early.', 'Taylor Reed', [
    { emoji: '👍', count: 2, hasReacted: false },
  ]),
  chatMessage('m4', 'jordan', 16, 'Perfect — I’ll join too. See everyone tonight!', 'Jordan Lee'),
];

function feedPost(
  id: string,
  userId: string,
  minute: number,
  overrides: Partial<GroupPost>,
): GroupPost {
  const createdAt = at(13, minute).toISOString();
  const displayName = userId === 'staff' ? 'ELEVENO Team' : userId === 'me' ? 'Taylor Reed' : 'Alex Morgan';
  return {
    id,
    group_id: 'eleveno',
    user_id: userId,
    type: 'feed',
    title: null,
    content: null,
    pinned: false,
    session_date: null,
    session_time: null,
    max_players: null,
    image_url: null,
    poll_options: null,
    last_activity_at: createdAt,
    created_at: createdAt,
    updated_at: createdAt,
    profile: {
      id: userId,
      display_name: displayName,
      full_name: displayName,
      avatar_url: null,
      current_rating: userId === 'staff' ? null : 3.8,
    },
    reactions: [],
    comment_count: 0,
    participant_count: 0,
    user_joined: false,
    ...overrides,
  };
}

const FEED_POSTS: GroupPost[] = [
  feedPost('p1', 'staff', 48, {
    type: 'announcement',
    title: 'Friday evening court update',
    content: 'Courts 5 and 6 will reopen at 5:30 PM after line maintenance. All other courts are running on schedule.',
    pinned: true,
    reactions: [{ emoji: '👍', count: 12, user_reacted: false }],
    comment_count: 3,
  }),
  feedPost('p2', 'alex', 26, {
    type: 'lfg',
    title: 'One more for competitive doubles',
    content: 'Looking for a 3.75–4.0 player. We have Court 4 and will rotate partners.',
    session_date: DAY.toISOString().slice(0, 10),
    session_time: '18:30:00',
    max_players: 1,
    participant_count: 0,
    comment_count: 2,
  }),
  feedPost('p3', 'me', 8, {
    content: 'Great energy at open play this morning. Thanks to everyone who made the new players feel welcome.',
    image_url: '/pulse-og.png',
    reactions: [
      { emoji: '❤️', count: 8, user_reacted: true },
      { emoji: '🔥', count: 3, user_reacted: false },
    ],
    comment_count: 4,
  }),
  feedPost('p4', 'staff', 2, {
    type: 'poll',
    title: 'Which Saturday clinic should we add next?',
    content: 'We are opening one more weekly slot in October.',
    poll_options: [
      { idx: 0, text: 'Beginner fundamentals' },
      { idx: 1, text: 'Third-shot drop workshop' },
      { idx: 2, text: 'Competitive drilling' },
    ],
    poll_vote_counts: [11, 18, 14],
    poll_my_vote: 1,
  }),
];

export default function VenuePreview() {
  const [day, setDay] = useState(DAY);
  const previewMode = new URLSearchParams(window.location.search).get('preview');

  if (previewMode === 'phone') {
    return (
      <div className="flex min-h-screen justify-center bg-muted/50 p-4">
        <iframe
          title="Phone-sized venue feed preview"
          src="/__venue-preview?preview=feed"
          className="h-[844px] w-[390px] rounded-[26px] border-0 bg-background shadow-[0_24px_70px_-28px_rgba(0,0,0,0.45)]"
        />
      </div>
    );
  }

  if (previewMode === 'admin-phone') {
    return (
      <div className="flex min-h-screen justify-center bg-[#0f1115] p-4">
        <iframe
          title="Phone-sized venue admin preview"
          src="/__venue-preview?preview=admin"
          className="h-[844px] w-[390px] rounded-[28px] border-0 bg-background shadow-[0_28px_80px_-30px_rgba(0,0,0,0.75)]"
        />
      </div>
    );
  }

  if (previewMode === 'feed') {
    return (
      <main className="min-h-screen bg-muted/[0.16] px-4 py-5">
        <VenueFeedPreview />
      </main>
    );
  }

  if (previewMode === 'desktop') {
    return <VenueDesktopPagePreview />;
  }

  if (previewMode === 'admin') {
    return <VenueAdminPagePreview />;
  }

  const grid = buildDayGrid(COURTS, SESSIONS, day, {
    openHour: 8,
    closeHour: 22,
    slotMinutes: 60,
    now: NOW,
  });
  const statuses = courtStatuses(COURTS, SESSIONS, NOW);
  const summary = daySummary(grid, statuses, NOW);
  const programming = SESSIONS.filter(
    (s) => s.event_format !== 'reservation' && s.event_format !== 'maintenance',
  );

  const gaps = upcomingGaps(grid, NOW, 60).slice(0, 4);

  return (
    <>
      <OpsDashboard
        venueName="ELEVENO"
        day={day}
        now={NOW}
        isToday
        loading={false}
        closed={false}
        statuses={statuses}
        summary={summary}
        gaps={gaps}
        grid={grid}
        accent={ACCENT}
        canManage
        onBack={() => {}}
        onSettings={() => {}}
        onCloseCourt={() => {}}
        onPickCourt={() => {}}
        onDayChange={setDay}
        onPickSlot={() => {}}
        onPickSession={() => {}}
        onFillGap={() => {}}
      />

      <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-5 sm:px-6">
        <Section title="Venue feed (player-facing)">
          <VenueFeedPreview />
        </Section>

        <Section title="Venue chat (player-facing)">
          <div className="mx-auto max-w-[420px] overflow-hidden rounded-2xl border border-border/80 bg-background shadow-[0_16px_48px_-28px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2.5 border-b border-border/60 px-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                EL
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">ELEVENO</p>
                <p className="text-[11px] text-muted-foreground">Venue chat · 8 online</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Connected" />
            </div>
            <div className="px-3 pb-5 sm:px-4">
              {CHAT_MESSAGES.map((message, index) => {
                const previous = CHAT_MESSAGES[index - 1];
                const next = CHAT_MESSAGES[index + 1];
                const firstInRun = !previous || previous.user_id !== message.user_id;
                const lastInRun = !next || next.user_id !== message.user_id;
                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isOwn={message.user_id === 'me'}
                    showAvatar={message.user_id !== 'me' && lastInRun}
                    showHeader={firstInRun}
                    isLastInGroup={lastInRun}
                    showDateSeparator={index === 0}
                    previousMessageDate={previous ? new Date(previous.created_at) : undefined}
                    onReactionAdd={() => {}}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-2 border-t border-border/60 px-3 py-3">
              <div className="flex h-10 flex-1 items-center rounded-full border border-border/70 bg-muted/35 px-3 text-sm text-muted-foreground">
                Message…
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">↑</div>
            </div>
          </div>
        </Section>

        <Section title="Venue home (player-facing)">
          <VenueHome
            welcomeHeadline="Welcome to ELEVENO"
            welcomeMessage="Book court time, find today’s sessions, and stay connected with the players and staff at ELEVENO."
            city="Foxboro"
            state="MA"
            phone={null}
            websiteUrl={null}
            hours={VENUE_HOURS}
            nextUp={programming.slice(0, 3).map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              start_time: p.start_time,
            }))}
            hasCourts
            freeNow={2}
            courtCount={6}
            accent={ACCENT}
            onBook={() => {}}
            onOpenPlay={() => {}}
          />
        </Section>

        <Section title="Play (player-facing)">
          <VenueProgramming
            sessions={programming}
            going={GOING}
            loading={false}
            venueName="ELEVENO"
            accent={ACCENT}
          />
        </Section>
      </div>

    </>
  );
}

const ADMIN_ITEMS: VenueAdminNavItem[] = [
  { value: 'overview', label: 'Overview', description: 'Venue health and shortcuts', icon: LayoutDashboard, section: 'venue' },
  { value: 'profile', label: 'Profile & brand', shortLabel: 'Profile', description: 'Identity, imagery, and contact details', icon: Palette, section: 'venue' },
  { value: 'facility', label: 'Courts & hours', shortLabel: 'Facility', description: 'Booking inventory and availability', icon: LayoutGrid, section: 'venue' },
  { value: 'staff', label: 'Staff access', shortLabel: 'Staff', description: 'Venue roles and operations access', icon: ShieldCheck, section: 'venue' },
  { value: 'general', label: 'Community profile', shortLabel: 'Community', description: 'Name, description, and identity', icon: Settings, section: 'community' },
  { value: 'permissions', label: 'Member permissions', shortLabel: 'Permissions', description: 'Venue posting and chat controls', icon: Shield, section: 'community' },
  { value: 'privacy', label: 'Access & privacy', shortLabel: 'Access', description: 'Visibility, joining, and invite codes', icon: Lock, section: 'community' },
  { value: 'roles', label: 'Community roles', shortLabel: 'Roles', description: 'Owner and moderator authority', icon: Users, section: 'community' },
  { value: 'danger', label: 'Danger zone', shortLabel: 'Danger', description: 'Leave or permanently remove the space', icon: AlertTriangle, section: 'advanced' },
];

function VenueAdminPagePreview() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <VenueAdminShell
      venueName="ELEVENO"
      verified
      roleLabel="Owner"
      accent={ACCENT}
      activeTab={activeTab}
      items={ADMIN_ITEMS}
      onTabChange={setActiveTab}
      onBack={() => {}}
      onViewVenue={() => {}}
      onOperations={() => {}}
    >
      {activeTab === 'overview' ? (
        <VenueAdminOverview
          venueId="eleveno-preview"
          groupId="eleveno-preview"
          venueName="ELEVENO"
          memberCount={284}
          accent={ACCENT}
          canManageCommunity
          chatEnabled
          countsOverride={ADMIN_COUNTS}
          onOpenTab={setActiveTab}
          onOperations={() => {}}
          onOpenVenueTab={() => {}}
        />
      ) : activeTab === 'permissions' ? (
        <AdminPermissionsTab
          settings={DEFAULT_GROUP_SETTINGS}
          saving={false}
          venueMode
          onSettingChange={() => {}}
        />
      ) : activeTab === 'staff' ? (
        <VenueStaffPreview />
      ) : activeTab === 'facility' ? (
        <VenueFacilityPreview />
      ) : (
        <AdminPreviewPlaceholder item={ADMIN_ITEMS.find((item) => item.value === activeTab)} />
      )}
    </VenueAdminShell>
  );
}

function VenueStaffPreview() {
  const staff = [
    ['AR', 'Anthony Rossi', 'Owner'],
    ['JM', 'Jordan Miller', 'Manager'],
    ['SC', 'Sam Chen', 'Organizer'],
    ['TR', 'Taylor Reed', 'Staff'],
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-[22px] border border-border/70 bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
          <div><h3 className="text-lg font-semibold">Venue staff access</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Facility roles stay separate from community moderation, with clear authority for every teammate.</p></div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-4"><div><p className="text-sm font-semibold">Team</p><p className="mt-1 text-xs text-muted-foreground">People authorized to represent and operate ELEVENO.</p></div><Badge variant="secondary">4</Badge></div>
        <div className="divide-y divide-border/60">
          {staff.map(([initials, name, role]) => (
            <div key={name} className="flex items-center gap-3 px-4 py-4 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{initials}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground">{role === 'Owner' ? 'Full venue and community authority' : `${role} access`}</p></div>
              <Badge variant={role === 'Owner' ? 'outline' : 'secondary'}>{role}</Badge>
            </div>
          ))}
        </div>
      </div>
      <Button className="w-full rounded-xl sm:w-auto"><ShieldCheck className="mr-2 h-4 w-4" />Add a teammate</Button>
    </div>
  );
}

function VenueFacilityPreview() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="border-b border-border/60 bg-muted/20 px-5 py-4"><p className="text-sm font-semibold">Courts</p><p className="mt-1 text-xs text-muted-foreground">Five active courts power the member booking grid.</p></div>
        <div className="divide-y divide-border/60">
          {['Court 1', 'Court 2', 'Court 3', 'Court 4', 'Court 5'].map((court, index) => (
            <div key={court} className="flex items-center gap-3 px-5 py-4"><LayoutGrid className="h-4 w-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{court}</p><p className="text-xs text-muted-foreground">Indoor · Cushioned</p></div>{index === 1 && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Premium</Badge>}<Badge variant="outline">Available</Badge></div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Operating hours</p></div>
        <div className="mt-4 space-y-3 text-sm">
          {['Monday – Thursday', 'Friday', 'Saturday – Sunday'].map((label, index) => <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{index === 1 ? '9 AM – 11 PM' : '9 AM – 10 PM'}</span></div>)}
        </div>
      </div>
    </div>
  );
}

function AdminPreviewPlaceholder({ item }: { item?: VenueAdminNavItem }) {
  const Icon = item?.icon ?? Settings;
  return <div className="rounded-[22px] border border-border/70 bg-card p-6 sm:p-8"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-xl font-semibold">{item?.label}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{item?.description}. This preview keeps the production panel shell visible while authenticated data remains private.</p></div>;
}

function VenueDesktopPagePreview() {
  const [activeTab, setActiveTab] = useState<VenuePageTab>('home');
  const [day, setDay] = useState(DAY);
  const programming = SESSIONS.filter(
    (session) => session.event_format !== 'reservation' && session.event_format !== 'maintenance',
  );
  const nextUp = programming.slice(0, 3).map((session) => ({
    id: session.id,
    title: session.title,
    description: session.description,
    start_time: session.start_time,
  }));
  const grid = buildDayGrid(COURTS, SESSIONS, day, {
    openHour: 8,
    closeHour: 22,
    slotMinutes: 60,
    now: NOW,
  });
  const showDesktopRail =
    activeTab === 'play' ||
    activeTab === 'feed' ||
    activeTab === 'chat' ||
    activeTab === 'more';

  return (
    <div className="flex min-h-screen flex-col bg-muted/[0.16]">
      <VenueMasthead
        venueName="ELEVENO"
        tagline="Premium pickleball, thoughtfully played"
        fallbackBackground="linear-gradient(145deg, #202329 0%, #141619 58%, #090a0c 100%)"
        bloom="rgba(197, 173, 17, 0.28)"
        accent={ACCENT}
        verified
        hasCourts
        freeNow={2}
        courtCount={6}
        memberCount={284}
        nextStart={nextUp[0]?.start_time}
        isOperator
        isAdmin
        onBack={() => {}}
        onOperations={() => {}}
        onSettings={() => {}}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as VenuePageTab)}
        className="flex min-h-0 flex-1 flex-col"
        style={{ '--venue-accent': ACCENT } as React.CSSProperties}
      >
        <VenueMobileTabs hasCourts />
        <div className="flex-1">
          <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
            <div
              className={cn(
                'lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start lg:gap-8 min-[1180px]:gap-10',
                showDesktopRail && 'min-[1180px]:grid-cols-[210px_minmax(0,1fr)_292px]',
              )}
            >
              <VenueDesktopNavigation
                hasCourts
                isOperator
                isAdmin
                onOperations={() => {}}
                onSettings={() => {}}
              />

              <main className="min-w-0">
                <TabsContent value="home" className="mt-0">
                  <VenueHome
                    welcomeHeadline="Welcome to ELEVENO"
                    welcomeMessage="Book court time, find today’s sessions, and stay connected with the players and staff at ELEVENO."
                    city="Foxboro"
                    state="MA"
                    phone="(508) 555-0111"
                    websiteUrl="https://eleveno.example"
                    hours={VENUE_HOURS}
                    nextUp={nextUp}
                    hasCourts
                    freeNow={2}
                    courtCount={6}
                    accent={ACCENT}
                    onBook={() => setActiveTab('book')}
                    onOpenPlay={() => setActiveTab('play')}
                  />
                </TabsContent>

                <TabsContent value="book" className="mt-0">
                  <VenueBookingGrid
                    grid={grid}
                    day={day}
                    loading={false}
                    canBook
                    accent={ACCENT}
                    onDayChange={setDay}
                    onPickSlot={() => {}}
                  />
                </TabsContent>

                <TabsContent value="play" className="mt-0 max-w-3xl">
                  <VenueProgramming
                    sessions={programming}
                    going={GOING}
                    loading={false}
                    venueName="ELEVENO"
                    accent={ACCENT}
                  />
                </TabsContent>

                <TabsContent value="feed" className="mt-0 max-w-[760px]">
                  <VenueFeedPreview />
                </TabsContent>

                <TabsContent value="chat" className="mt-0 max-w-[820px]">
                  <div className="h-[620px] overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-[0_16px_45px_-30px_hsl(var(--foreground)/0.42)]">
                    <VenueChatPreview />
                  </div>
                </TabsContent>

                <TabsContent value="more" className="mt-0 max-w-[820px]">
                  <div className="rounded-2xl border border-border/70 bg-card p-6">
                    <p className="text-lg font-semibold tracking-tight">ELEVENO community</p>
                    <p className="mt-1 text-sm text-muted-foreground">284 members · 8 online now</p>
                  </div>
                </TabsContent>
              </main>

              {showDesktopRail && (
                <VenueDesktopRail
                  venueName="ELEVENO"
                  activeTab={activeTab}
                  hasCourts
                  freeNow={2}
                  courtCount={6}
                  memberCount={284}
                  onlineCount={8}
                  nextUp={nextUp}
                  hours={VENUE_HOURS}
                  accent={ACCENT}
                  onOpenTab={setActiveTab}
                  onBookings={() => {}}
                />
              )}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function VenueChatPreview() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
          EL
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">ELEVENO</p>
          <p className="text-[11px] text-muted-foreground">Venue chat · 8 online</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Connected" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
        {CHAT_MESSAGES.map((message, index) => {
          const previous = CHAT_MESSAGES[index - 1];
          const next = CHAT_MESSAGES[index + 1];
          const firstInRun = !previous || previous.user_id !== message.user_id;
          const lastInRun = !next || next.user_id !== message.user_id;
          return (
            <ChatMessage
              key={message.id}
              message={message}
              isOwn={message.user_id === 'me'}
              showAvatar={message.user_id !== 'me' && lastInRun}
              showHeader={firstInRun}
              isLastInGroup={lastInRun}
              showDateSeparator={index === 0}
              previousMessageDate={previous ? new Date(previous.created_at) : undefined}
              onReactionAdd={() => {}}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3">
        <div className="flex h-11 flex-1 items-center rounded-full border border-border/70 bg-muted/35 px-4 text-sm text-muted-foreground">
          Message ELEVENO…
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">↑</div>
      </div>
    </div>
  );
}

function VenueFeedPreview() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<PostType>('post');

  return (
    <div className="mx-auto max-w-2xl">
      <GroupFeed
        groupId=""
        groupName="ELEVENO"
        isAdmin
        currentUserId="me"
        venueMode
        previewPosts={FEED_POSTS}
        onOpenQuickPost={(type) => {
          setComposerType(type);
          setComposerOpen(true);
        }}
      />
      <QuickPostComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        initialType={composerType}
        groupId="eleveno-preview"
        contextName="ELEVENO"
        venueMode
        canPostAnnouncements
        onSubmit={async () => true}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
