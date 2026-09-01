import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Grid3x3, Rows3, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatSlotTime, type CourtColumn, type Slot } from '@/lib/venues/availability';

/**
 * The court grid.
 *
 * In every court-reservation tool worth copying, this screen IS the product —
 * and in every one of them it is a desktop table crushed onto a phone. Eight
 * courts across a 390px screen gives you 45px columns and pinch-zoom.
 *
 * So there are two real views, the same approach that fixed the bracket:
 *   • Courts — the true grid, courts as columns, time as rows. Default on
 *     desktop, where a venue's staff actually run the day.
 *   • Times — one row per time slot, with the free courts as tappable chips.
 *     Default on a phone, because "what's open at 6pm" is the question a
 *     player is actually asking, and it answers it without any horizontal
 *     scrolling at all.
 */

interface VenueBookingGridProps {
  grid: CourtColumn[];
  day: Date;
  loading: boolean;
  canBook: boolean;
  accent?: string | null;
  onDayChange: (day: Date) => void;
  onPickSlot: (courtId: string, start: Date) => void;
}

export function VenueBookingGrid({
  grid,
  day,
  loading,
  canBook,
  accent,
  onDayChange,
  onPickSlot,
}: VenueBookingGridProps) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<'courts' | 'times'>('times');
  const [modeTouched, setModeTouched] = useState(false);

  // Follow the viewport until the viewer expresses a preference, then respect it.
  const effectiveMode = modeTouched ? mode : isMobile ? 'times' : 'courts';

  const setModeExplicit = (m: 'courts' | 'times') => {
    setMode(m);
    setModeTouched(true);
  };

  const shiftDay = (delta: number) => {
    const next = new Date(day);
    next.setDate(next.getDate() + delta);
    next.setHours(0, 0, 0, 0);
    onDayChange(next);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = day.getTime() === today.getTime();
  const isPast = day < today;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-l-lg rounded-r-none"
            onClick={() => shiftDay(-1)}
            disabled={isPast}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[7.5rem] px-2 text-center text-sm font-semibold">
            {isToday
              ? 'Today'
              : day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-r-lg rounded-l-none"
            onClick={() => shiftDay(1)}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!isToday && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => onDayChange(today)}>
            <CalendarDays className="mr-1.5 h-4 w-4" />
            Today
          </Button>
        )}

        <div className="ml-auto inline-flex rounded-lg border border-border bg-card p-0.5">
          <ViewButton
            active={effectiveMode === 'times'}
            onClick={() => setModeExplicit('times')}
            icon={Rows3}
          >
            Times
          </ViewButton>
          <ViewButton
            active={effectiveMode === 'courts'}
            onClick={() => setModeExplicit('courts')}
            icon={Grid3x3}
          >
            Courts
          </ViewButton>
        </div>
      </div>

      {!canBook && (
        <p className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Only staff can book courts at this venue. You can still see what's on.
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : grid.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
          <p className="text-sm font-semibold">No courts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add courts in venue settings and they'll appear here to book.
          </p>
        </div>
      ) : effectiveMode === 'times' ? (
        <TimesView grid={grid} canBook={canBook} accent={accent} onPickSlot={onPickSlot} />
      ) : (
        <CourtsView grid={grid} canBook={canBook} accent={accent} onPickSlot={onPickSlot} />
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Rows3;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

/**
 * Time-first. One row per slot, free courts as chips.
 *
 * This is the phone view and it is not a fallback — for a player deciding when
 * to play, "6pm: Courts 2, 5, 6 open" is a better answer than a grid, and it
 * fits without scrolling sideways.
 */
function TimesView({
  grid,
  canBook,
  accent,
  onPickSlot,
}: {
  grid: CourtColumn[];
  canBook: boolean;
  accent?: string | null;
  onPickSlot: (courtId: string, start: Date) => void;
}) {
  const slotCount = grid[0]?.slots.length ?? 0;

  const rows = Array.from({ length: slotCount }, (_, i) => {
    const start = grid[0].slots[i].start;
    const free = grid.filter((col) => col.slots[i]?.bookable);
    const taken = grid.filter((col) => col.slots[i]?.reservation);
    return { start, free, taken, index: i };
  });

  const anyOpen = rows.some((r) => r.free.length > 0);

  return (
    <div className="space-y-1.5">
      {!anyOpen && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-center text-sm text-muted-foreground">
          Nothing open on this day.
        </p>
      )}

      {rows.map((row) => (
        <div
          key={row.index}
          className={cn(
            'flex items-start gap-3 rounded-lg border px-3 py-2.5',
            row.free.length > 0 ? 'border-border bg-card' : 'border-border/50 bg-muted/25',
          )}
        >
          <span className="w-16 shrink-0 pt-1 text-sm font-semibold tabular-nums">
            {formatSlotTime(row.start)}
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {row.free.length === 0 ? (
              <span className="pt-1 text-xs text-muted-foreground">
                {row.taken.length > 0 ? 'Fully booked' : 'Closed'}
              </span>
            ) : (
              row.free.map((col) => (
                <button
                  key={col.court.id}
                  type="button"
                  disabled={!canBook}
                  onClick={() => onPickSlot(col.court.id, row.start)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    canBook
                      ? 'border-border bg-background hover:border-primary/50 hover:bg-primary/5'
                      : 'border-border/60 bg-background text-muted-foreground',
                  )}
                  style={
                    canBook && accent ? { borderColor: `${accent}55`, color: accent } : undefined
                  }
                >
                  {col.court.name ?? `Court ${col.court.court_number}`}
                </button>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The real grid: courts across, time down. */
function CourtsView({
  grid,
  canBook,
  accent,
  onPickSlot,
}: {
  grid: CourtColumn[];
  canBook: boolean;
  accent?: string | null;
  onPickSlot: (courtId: string, start: Date) => void;
}) {
  const slotCount = grid[0]?.slots.length ?? 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <div className="min-w-max">
        {/* Court headers */}
        <div className="flex border-b border-border bg-muted/40">
          <div className="w-16 shrink-0 px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Time
          </div>
          {grid.map((col) => (
            <div
              key={col.court.id}
              className="w-[104px] shrink-0 border-l border-border px-2 py-2 text-center"
            >
              <div className="truncate text-xs font-semibold">
                {col.court.name ?? `Court ${col.court.court_number}`}
              </div>
              {col.court.is_premium && (
                <Badge variant="outline" className="mt-0.5 h-4 px-1 text-[9px]">
                  Premium
                </Badge>
              )}
            </div>
          ))}
        </div>

        {Array.from({ length: slotCount }, (_, i) => (
          <div key={i} className="flex border-b border-border/50 last:border-0">
            <div className="w-16 shrink-0 px-2 py-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {formatSlotTime(grid[0].slots[i].start)}
            </div>
            {grid.map((col) => (
              <GridCell
                key={col.court.id}
                slot={col.slots[i]}
                canBook={canBook}
                accent={accent}
                onClick={() => onPickSlot(col.court.id, col.slots[i].start)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GridCell({
  slot,
  canBook,
  accent,
  onClick,
}: {
  slot: Slot;
  canBook: boolean;
  accent?: string | null;
  onClick: () => void;
}) {
  if (slot.reservation) {
    return (
      <div
        className="w-[104px] shrink-0 border-l border-border px-1.5 py-1.5"
        title={slot.reservation.title ?? undefined}
      >
        <div
          className="truncate rounded-md bg-primary/10 px-1.5 py-1 text-[11px] font-medium"
          style={accent ? { backgroundColor: `${accent}1f`, color: accent } : undefined}
        >
          {slot.reservation.title || 'Booked'}
        </div>
      </div>
    );
  }

  if (!slot.bookable) {
    return (
      <div className="w-[104px] shrink-0 border-l border-border bg-muted/30 px-1.5 py-1.5">
        <div className="h-[26px]" />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!canBook}
      onClick={onClick}
      className={cn(
        'w-[104px] shrink-0 border-l border-border px-1.5 py-1.5 text-left transition-colors',
        canBook ? 'hover:bg-primary/5' : 'cursor-default',
      )}
      aria-label={`Book ${formatSlotTime(slot.start)}`}
    >
      <div
        className={cn(
          'flex h-[26px] items-center justify-center rounded-md border border-dashed text-[11px] font-medium',
          canBook ? 'border-border text-muted-foreground' : 'border-border/50 text-muted-foreground/60',
        )}
      >
        {canBook ? 'Open' : '—'}
      </div>
    </button>
  );
}
