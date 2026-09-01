import { cn } from '@/lib/utils';
import { formatDuration, type DaySummary } from '@/lib/venues/ops';

/**
 * The day in three numbers.
 *
 * Every one is chosen to be actionable at the desk, which is why there is no
 * booking count: knowing there were 31 bookings changes nothing you can do at
 * 5pm. Utilisation says how the day compares to a normal one, the court ribbon
 * says what is happening this second, and unsold time is literally the
 * inventory still sellable this afternoon.
 *
 * One panel with hairline dividers rather than three bordered tiles. Three
 * boxes in a row read as three unrelated widgets; a divided panel reads as one
 * instrument, which is what a rail beside the floor should feel like.
 */

interface OpsStatRailProps {
  summary: DaySummary;
  accent?: string | null;
}

export function OpsStatRail({ summary, accent }: OpsStatRailProps) {
  const { utilization: util, inPlay, open, closed, openMinutes } = summary;
  const courts = inPlay + open + closed;

  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-card">
      <Row label="Utilisation" value={`${util.percent}%`} caption={`${util.booked} of ${util.total} court-hours`}>
        <Track>
          <Fill portion={util.percent / 100} className="bg-primary" accent={accent} />
        </Track>
      </Row>

      <Row
        label="Courts"
        value={
          <>
            {inPlay}
            <span className="text-base font-semibold text-muted-foreground">/{courts}</span>
          </>
        }
        caption={`${inPlay} in play · ${open} free${closed > 0 ? ` · ${closed} closed` : ''}`}
      >
        <Track>
          <Fill portion={courts ? inPlay / courts : 0} className="bg-primary" accent={accent} />
          <Fill portion={courts ? open / courts : 0} className="bg-emerald-500/70" />
          <Fill portion={courts ? closed / courts : 0} className="bg-muted-foreground/30" />
        </Track>
      </Row>

      <Row
        label="Unsold today"
        value={formatDuration(openMinutes)}
        caption={openMinutes === 0 ? 'Fully committed' : 'Court time still open'}
      />
    </div>
  );
}

function Row({
  label,
  value,
  caption,
  children,
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="text-2xl font-bold leading-none tabular-nums">{value}</span>
      </div>
      {children && <div className="mt-2.5">{children}</div>}
      <p className={cn('text-[11px] tabular-nums text-muted-foreground', children ? 'mt-1.5' : 'mt-1')}>
        {caption}
      </p>
    </div>
  );
}

function Track({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[3px] overflow-hidden rounded-full bg-muted">{children}</div>;
}

function Fill({
  portion,
  className,
  accent,
}: {
  portion: number;
  className: string;
  accent?: string | null;
}) {
  if (portion <= 0) return null;
  return (
    <span
      className={cn('h-full', className)}
      style={{
        width: `${Math.min(100, portion * 100)}%`,
        ...(accent && className.includes('bg-primary') ? { backgroundColor: accent } : {}),
      }}
    />
  );
}
