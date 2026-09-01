import { useState } from 'react';
import { buildDayGrid, type Court } from '@/lib/venues/availability';
import { courtStatuses, daySummary } from '@/lib/venues/ops';
import { upcomingGaps } from '@/lib/venues/ops';
import { OpsDashboard } from '@/components/venue/ops/OpsDashboard';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
import { VenueHome } from '@/components/venue/VenueHome';
import { parseVenueHours } from '@/lib/venues/hours';
import type { VenueDaySession } from '@/hooks/useVenueDay';

/**
 * Design harness for the venue surfaces.
 *
 * DEV ONLY — the route is not registered in a production build. It exists so
 * these screens can be looked at with real proportions and realistic data
 * before anyone has a venue set up, rather than being judged from the source.
 */

const ACCENT = '#C9962F';
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
        venueName="Riverside Pickleball"
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
        <Section title="Venue home (player-facing)">
          <VenueHome
            welcomeHeadline="Welcome to Riverside"
            welcomeMessage="Open play every weekday morning, clinics on Saturdays. New players always welcome — say hello at the desk and we'll find you a game."
            city="Bridgewater"
            state="MA"
            phone="(508) 555-0142"
            websiteUrl="https://riversidepickleball.com"
            hours={parseVenueHours({
              slotMinutes: 60,
              days: {
                '0': { open: '08:00', close: '20:00' },
                '1': null,
                '2': { open: '06:00', close: '22:00' },
                '3': { open: '06:00', close: '22:00' },
                '4': { open: '06:00', close: '22:00' },
                '5': { open: '06:00', close: '23:00' },
                '6': { open: '07:00', close: '21:00' },
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
            venueName="Riverside Pickleball"
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
