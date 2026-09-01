import { Wrench, Play, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSlotTime } from '@/lib/venues/availability';
import { formatDuration, type CourtStatus } from '@/lib/venues/ops';

/**
 * The floor, right now.
 *
 * This is the screen a manager keeps open. Rather than reporting the day in
 * aggregate, it answers the question they actually have while standing in the
 * building: which courts are live, how long until each frees up, and what lands
 * on it next.
 *
 * The progress bar is the point. "Court 3 · 12m left" is worth more than any
 * count, because it is the only thing that tells you whether the group waiting
 * at the desk can be put somewhere in the next quarter hour.
 */

interface CourtStatusBoardProps {
  statuses: CourtStatus[];
  accent?: string | null;
  onPickCourt: (courtId: string) => void;
}

export function CourtStatusBoard({ statuses, accent, onPickCourt }: CourtStatusBoardProps) {
  if (statuses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
        <p className="text-sm font-semibold">No courts</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add courts in venue settings to see the floor here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {statuses.map((status) => (
        <CourtCard
          key={status.court.id}
          status={status}
          accent={accent}
          onClick={() => onPickCourt(status.court.id)}
        />
      ))}
    </div>
  );
}

function CourtCard({
  status,
  accent,
  onClick,
}: {
  status: CourtStatus;
  accent?: string | null;
  onClick: () => void;
}) {
  const { court, state, current, next, progress, minutesLeft, minutesUntilNext } = status;
  const live = state === 'in_play';
  const closed = state === 'closed';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        live && 'border-primary/40',
        !live && !closed && 'border-border hover:border-primary/30',
        // Dashed, not just dimmed: a muted fill nearly vanishes against a dark
        // card, so an out-of-service court read the same as an open one.
        closed && 'border-dashed border-muted-foreground/40 bg-muted/40',
      )}
      style={live && accent ? { borderColor: `${accent}66` } : undefined}
    >
      {/* State rail — reads at a glance from across a desk. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-[3px]',
          live && 'bg-primary',
          !live && !closed && 'bg-emerald-500/70',
          closed && 'bg-muted-foreground/50',
        )}
        style={live && accent ? { backgroundColor: accent } : undefined}
      />

      <div className="flex items-start justify-between gap-2 pl-1.5">
        <span className="truncate text-sm font-bold">
          {court.name ?? `Court ${court.court_number}`}
        </span>
        <StatePill state={state} />
      </div>

      <div className="mt-2 min-h-[2.75rem] pl-1.5">
        {live && current ? (
          <>
            <p className="line-clamp-1 text-xs font-medium text-foreground">
              {current.title || 'In play'}
            </p>
            <p className="mt-0.5 text-lg font-bold leading-none tabular-nums">
              {minutesLeft !== null ? formatDuration(minutesLeft) : '—'}
              <span className="ml-1 text-[11px] font-semibold text-muted-foreground">left</span>
            </p>
          </>
        ) : closed ? (
          <>
            <p className="truncate text-xs font-medium text-foreground">
              {current?.title || 'Out of service'}
            </p>
            {minutesLeft !== null && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Back in {formatDuration(minutesLeft)}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Free</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {next && minutesUntilNext !== null
                ? `${formatSlotTime(new Date(next.start_time))} · ${next.title || 'Booked'}`
                : 'Free rest of day'}
            </p>
          </>
        )}
      </div>

      {/* Thin progress rule for a live court — how far through, at a glance. */}
      {live && (
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{
              width: `${Math.round(progress * 100)}%`,
              ...(accent ? { backgroundColor: accent } : {}),
            }}
          />
        </div>
      )}
    </button>
  );
}

function StatePill({ state }: { state: CourtStatus['state'] }) {
  const map = {
    in_play: { label: 'In play', icon: Play, className: 'text-primary' },
    open: { label: 'Open', icon: CircleDot, className: 'text-emerald-600 dark:text-emerald-400' },
    closed: { label: 'Closed', icon: Wrench, className: 'text-muted-foreground' },
  } as const;

  const { label, icon: Icon, className } = map[state];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em]',
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
