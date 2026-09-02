import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Gauge,
  GraduationCap,
  LayoutGrid,
  MapPin,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
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

const FORMAT_ICON: Record<string, typeof Users> = {
  open_play: Users,
  clinic: GraduationCap,
  practice: Target,
  round_robin: Trophy,
  social: Sparkles,
  other: CalendarDays,
};

const ROTATION_LABEL: Record<string, string> = {
  paddle_stack: 'Paddle stack',
  timed_rotation: 'Timed rotation',
  winners_stay: 'Winners stay',
  organized_games: 'Organized games',
  coach_led: 'Coach-led',
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
  viewerRsvpByEvent?: Record<string, string | null | undefined>;
}

export function VenueProgramming({
  sessions,
  going,
  loading,
  venueName,
  accent,
  onPick,
  viewerRsvpByEvent = {},
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

      <div className="space-y-2">
        {shown.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            going={going[session.id] ?? 0}
            venueName={venueName}
            accent={accent}
            onPick={onPick}
            viewerRsvp={viewerRsvpByEvent[session.id]}
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
  viewerRsvp,
}: {
  session: VenueDaySession;
  going: number;
  venueName?: string | null;
  accent?: string | null;
  onPick?: (sessionId: string) => void;
  viewerRsvp?: string | null;
}) {
  const start = new Date(session.start_time);
  const end = session.end_time ? new Date(session.end_time) : null;
  const spotsLeft = session.capacity != null ? Math.max(0, session.capacity - going) : null;
  const full = spotsLeft === 0;
  const urgent = spotsLeft !== null && spotsLeft > 0 && spotsLeft <= URGENT_AT;
  const past = (end ?? start) < new Date();

  const formatLabel = FORMAT_LABEL[session.event_format] ?? 'Event';
  const Row = onPick ? 'button' : 'div';
  const FormatIcon = FORMAT_ICON[session.event_format] ?? CalendarDays;
  const rsvpLabel =
    viewerRsvp === 'going'
      ? "You're in"
      : viewerRsvp === 'waitlist'
        ? 'Waitlisted'
        : viewerRsvp === 'maybe'
          ? 'Maybe'
          : null;

  return (
    <Row
      {...(onPick ? { type: 'button' as const, onClick: () => onPick(session.id) } : {})}
      className={cn(
        'group w-full rounded-[18px] border border-border/75 bg-card px-3.5 py-3.5 text-left shadow-[0_12px_32px_-28px_hsl(var(--foreground)/0.55)] transition-[border-color,background-color,transform] sm:px-4',
        onPick && 'hover:-translate-y-px hover:border-primary/35 hover:bg-card/95',
        past && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          style={accent ? { backgroundColor: `${accent}16`, color: accent } : undefined}
        >
          <FormatIcon className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              {formatLabel}
            </span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums text-foreground/75">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-primary"
                style={accent ? { backgroundColor: accent } : undefined}
              />
              {formatSlotTime(start)}
              {end ? ` – ${formatSlotTime(end)}` : ''}
            </span>
          </div>

          <p className="mt-1 truncate text-[15px] font-extrabold leading-tight tracking-tight sm:text-base">
            {session.title}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
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
            {(session.skill_level_min != null || session.skill_level_max != null) && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Gauge className="h-3 w-3" />
                {session.skill_level_min != null && session.skill_level_max != null
                  ? `${session.skill_level_min.toFixed(1)}–${session.skill_level_max.toFixed(1)}`
                  : session.skill_level_min != null
                    ? `${session.skill_level_min.toFixed(1)}+`
                    : `≤ ${session.skill_level_max!.toFixed(1)}`}
              </span>
            )}
            {session.rr_courts != null && session.rr_courts > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <LayoutGrid className="h-3 w-3" />
                {session.rr_courts} court{session.rr_courts === 1 ? '' : 's'}
              </span>
            )}
            {session.rotation_style && ROTATION_LABEL[session.rotation_style] && (
              <span className="inline-flex items-center gap-1">
                <Shuffle className="h-3 w-3" />
                {ROTATION_LABEL[session.rotation_style]}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {rsvpLabel ? (
            <Badge
              variant="outline"
              className={cn(
                'whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.09em]',
                viewerRsvp === 'going' && 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              )}
            >
              {rsvpLabel}
            </Badge>
          ) : full ? (
            <Badge variant="outline" className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.09em]">
              {session.waitlist_enabled ? 'Join waitlist' : 'Full'}
            </Badge>
          ) : urgent ? (
            <Badge className="whitespace-nowrap bg-primary text-[9px] font-bold uppercase tracking-[0.09em] text-primary-foreground">
              {spotsLeft} left
            </Badge>
          ) : spotsLeft != null ? (
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{spotsLeft} spots</span>
          ) : null}
          {onPick && (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          )}
        </div>
      </div>
    </Row>
  );
}
