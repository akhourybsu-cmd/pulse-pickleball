import { useMemo, useState } from 'react';
import { MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatSlotTime } from '@/lib/venues/availability';
import type { VenueDaySession } from '@/hooks/useVenueDay';

/**
 * What the venue is running today.
 *
 * Court-reservation apps bury programming in a PDF or a wall of undifferentiated
 * rows; the good ones filter it by kind and shout when something is nearly full.
 * Both matter: a player scanning for "is there open play tonight" should not
 * have to read past four clinics, and "3 spots left" is what turns browsing
 * into signing up.
 *
 * Urgency is only claimed when it is real. A session with no capacity set has no
 * spots to run out of, so it gets no badge rather than a fake one.
 */

const FILTERS = [
  { value: 'all', label: 'All', formats: null },
  { value: 'open_play', label: 'Open Play', formats: ['open_play'] },
  { value: 'clinic', label: 'Clinics', formats: ['clinic', 'practice'] },
  { value: 'round_robin', label: 'Round Robin', formats: ['round_robin'] },
  { value: 'social', label: 'Social', formats: ['social', 'other'] },
] as const;

const FORMAT_LABEL: Record<string, string> = {
  open_play: 'Open Play',
  clinic: 'Clinic',
  practice: 'Practice',
  round_robin: 'Round Robin',
  social: 'Social',
  other: 'Event',
};

/** Below this many spots left, the badge earns attention. */
const URGENT_AT = 5;

interface VenueProgrammingProps {
  sessions: VenueDaySession[];
  /** eventId → confirmed sign-ups. */
  going: Record<string, number>;
  loading: boolean;
  venueName?: string | null;
  accent?: string | null;
  onPick?: (sessionId: string) => void;
}

export function VenueProgramming({
  sessions,
  going,
  loading,
  venueName,
  accent,
  onPick,
}: VenueProgrammingProps) {
  const [filter, setFilter] = useState<string>('all');

  // Only offer a filter the day actually has something in — a row of chips
  // where four of six return nothing is worse than no chips at all.
  const available = useMemo(
    () =>
      FILTERS.filter(
        (f) => !f.formats || sessions.some((s) => f.formats!.includes(s.event_format as never)),
      ),
    [sessions],
  );

  const shown = useMemo(() => {
    const active = FILTERS.find((f) => f.value === filter);
    if (!active?.formats) return sessions;
    return sessions.filter((s) => active.formats!.includes(s.event_format as never));
  }, [sessions, filter]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
        <p className="text-sm font-semibold">Nothing scheduled</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No open play, clinics or events on this day.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {available.length > 1 && (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-1.5">
            {available.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                  style={
                    active && accent
                      ? {
                          backgroundColor: `${accent}18`,
                          borderColor: `${accent}88`,
                          color: 'hsl(var(--foreground))',
                        }
                      : undefined
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
        {shown.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            going={going[session.id] ?? 0}
            venueName={venueName}
            accent={accent}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  going,
  venueName,
  accent,
  onPick,
}: {
  session: VenueDaySession;
  going: number;
  venueName?: string | null;
  accent?: string | null;
  onPick?: (sessionId: string) => void;
}) {
  const start = new Date(session.start_time);
  const end = session.end_time ? new Date(session.end_time) : null;
  const spotsLeft = session.capacity != null ? Math.max(0, session.capacity - going) : null;
  const full = spotsLeft === 0;
  const urgent = spotsLeft !== null && spotsLeft > 0 && spotsLeft <= URGENT_AT;
  const past = (end ?? start) < new Date();

  const formatLabel = FORMAT_LABEL[session.event_format] ?? 'Event';
  const titleStatesFormat = session.title
    .toLowerCase()
    .includes(formatLabel.toLowerCase());

  const Row = onPick ? 'button' : 'div';

  return (
    <Row
      {...(onPick ? { type: 'button' as const, onClick: () => onPick(session.id) } : {})}
      className={cn(
        'w-full px-4 py-3.5 text-left transition-colors',
        onPick && 'hover:bg-muted/35',
        past && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-primary"
            style={accent ? { backgroundColor: accent } : undefined}
          />
          {formatSlotTime(start)}
          {end ? ` – ${formatSlotTime(end)}` : ''}
        </span>

        {full ? (
          <Badge variant="outline" className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em]">
            {session.waitlist_enabled ? 'Waitlist' : 'Full'}
          </Badge>
        ) : urgent ? (
          <Badge className="shrink-0 bg-primary text-[10px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
            {spotsLeft} left
          </Badge>
        ) : null}
      </div>

      <p className="mt-1 truncate text-base font-bold leading-tight">{session.title}</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {/* The kind chip is dropped when the title already says it — "Open Play"
            twice on one row is clutter, not information. */}
        {!titleStatesFormat && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
            {FORMAT_LABEL[session.event_format] ?? 'Event'}
          </span>
        )}
        {venueName && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{venueName}</span>
          </span>
        )}
        {session.capacity != null && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users className="h-3 w-3" />
            {going}/{session.capacity}
          </span>
        )}
      </div>
    </Row>
  );
}
