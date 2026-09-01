import { useState } from 'react';
import { buildDayGrid, type Court } from '@/lib/venues/availability';
import { courtStatuses, daySummary } from '@/lib/venues/ops';
import { CourtStatusBoard } from '@/components/venue/ops/CourtStatusBoard';
import { OpsStatRail } from '@/components/venue/ops/OpsStatRail';
import { VenueBookingGrid } from '@/components/venue/VenueBookingGrid';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
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

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4">
      <Section title="On the floor">
        <CourtStatusBoard statuses={statuses} accent={ACCENT} onPickCourt={() => {}} />
      </Section>

      <Section title="The day">
        <OpsStatRail summary={summary} accent={ACCENT} />
      </Section>

      <Section title="Book">
        <VenueBookingGrid
          grid={grid}
          day={day}
          loading={false}
          canBook
          accent={ACCENT}
          onDayChange={setDay}
          onPickSlot={() => {}}
        />
      </Section>

      <Section title="Play">
        <VenueProgramming
          sessions={programming}
          going={GOING}
          loading={false}
          venueName="Riverside Pickleball"
          accent={ACCENT}
        />
      </Section>
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
