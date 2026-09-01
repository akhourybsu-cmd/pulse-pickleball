import { useState } from 'react';
import { buildDayGrid, type Court } from '@/lib/venues/availability';
import { courtStatuses, daySummary } from '@/lib/venues/ops';
import { upcomingGaps } from '@/lib/venues/ops';
import { OpsDashboard } from '@/components/venue/ops/OpsDashboard';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
import { VenueHome } from '@/components/venue/VenueHome';
import { ChatMessage } from '@/components/community/ChatMessage';
import { parseVenueHours } from '@/lib/venues/hours';
import type { VenueDaySession } from '@/hooks/useVenueDay';
import type { GroupMessage } from '@/hooks/useGroupChat';

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

export default function VenuePreview() {
  const [day, setDay] = useState(DAY);

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
            hours={parseVenueHours({
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
            })}
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
