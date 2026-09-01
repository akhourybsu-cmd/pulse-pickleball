import { cn } from '@/lib/utils';
import { formatDuration, type DaySummary } from '@/lib/venues/ops';

/**
 * The day in four numbers.
 *
 * Every one is chosen to be actionable at the desk, which is why there is no
 * booking count here: knowing there were 31 bookings changes nothing you can
 * do. Utilisation tells you how the day compares to a normal one; the court
 * ribbon tells you what is happening this second; unsold time is literally the
 * inventory you could still fill this afternoon.
 */

interface OpsStatRailProps {
  summary: DaySummary;
  accent?: string | null;
}

export function OpsStatRail({ summary, accent }: OpsStatRailProps) {
  const { utilization: util, inPlay, open, closed, openMinutes } = summary;
  const courts = inPlay + open + closed;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {/* Utilisation, with the bar doing the comparing rather than a number
          floating on its own. */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Utilisation
        </p>
        <p className="mt-1 text-2xl font-bold leading-none tabular-nums">
          {util.percent}
          <span className="text-sm font-semibold text-muted-foreground">%</span>
        </p>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{
              width: `${util.percent}%`,
              ...(accent ? { backgroundColor: accent } : {}),
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
          {util.booked} of {util.total} court-hours
        </p>
      </div>

      {/* Court ribbon — the floor as one bar, proportional to reality. */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Courts
        </p>
        <p className="mt-1 text-2xl font-bold leading-none tabular-nums">
          {inPlay}
          <span className="text-sm font-semibold text-muted-foreground">/{courts}</span>
        </p>
        <div className="mt-2 flex h-[3px] overflow-hidden rounded-full bg-muted">
          <Segment count={inPlay} total={courts} className="bg-primary" accent={accent} />
          <Segment count={open} total={courts} className="bg-emerald-500/70" />
          <Segment count={closed} total={courts} className="bg-muted-foreground/30" />
        </div>
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground tabular-nums">
          {inPlay} in play · {open} free{closed > 0 ? ` · ${closed} closed` : ''}
        </p>
      </div>

      {/* The commercial one: time still sellable today. */}
      <div className="col-span-2 rounded-xl border border-border bg-card p-3 sm:col-span-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Unsold today
        </p>
        <p className="mt-1 text-2xl font-bold leading-none tabular-nums">
          {formatDuration(openMinutes)}
        </p>
        <p className="mt-[calc(0.5rem+3px)] text-[11px] text-muted-foreground">
          {openMinutes === 0 ? 'Fully committed' : 'Court time still open'}
        </p>
      </div>
    </div>
  );
}

function Segment({
  count,
  total,
  className,
  accent,
}: {
  count: number;
  total: number;
  className: string;
  accent?: string | null;
}) {
  if (count === 0 || total === 0) return null;
  return (
    <span
      className={cn('h-full', className)}
      style={{
        width: `${(count / total) * 100}%`,
        ...(accent && className.includes('bg-primary') ? { backgroundColor: accent } : {}),
      }}
    />
  );
}
