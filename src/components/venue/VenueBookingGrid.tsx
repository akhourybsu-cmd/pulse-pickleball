import { useEffect, useState } from 'react';
import { Grid3x3, Rows3, Lock, X, MoonStar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  formatSlotTime,
  isSelected,
  selectionRange,
  timeList,
  toggleSlot,
  type CourtColumn,
  type SlotSelection,
  type Slot,
} from '@/lib/venues/availability';
import { DayStrip } from './DayStrip';

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
  /** `minutes` is the length of the range the viewer selected. */
  onPickSlot: (courtId: string, start: Date, minutes: number) => void;
  /**
   * Staff only. When given, an OCCUPIED cell becomes actionable too, which is
   * the whole difference between a player's booking grid and an operator's day
   * view. Keeping it one component means the two can never disagree about what
   * is on a court.
   */
  onPickSession?: (sessionId: string) => void;
}

export function VenueBookingGrid({
  grid,
  day,
  loading,
  canBook,
  accent,
  onDayChange,
  onPickSlot,
  onPickSession,
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

  const [selection, setSelection] = useState<SlotSelection | null>(null);

  // A selection is only meaningful against the grid it was made on. Clearing on
  // day change stops a stale range following the viewer to another date.
  useEffect(() => {
    setSelection(null);
  }, [day]);

  const range = selectionRange(grid, selection);
  // The grid can refresh under a selection — if a slot inside it just got taken,
  // selectionRange returns null and the action bar drops rather than offering a
  // booking the database will refuse.
  const selectedCourt = grid.find((c) => c.court.id === selection?.courtId)?.court ?? null;

  return (
    <div className="space-y-3">
      <DayStrip value={day} onChange={onDayChange} accent={accent} />

      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
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
        <TimesView
          grid={grid}
          canBook={canBook}
          accent={accent}
          selection={selection}
          onToggle={(courtId, index) =>
            setSelection((sel) => toggleSlot(sel, courtId, index))
          }
        />
      ) : (
        <CourtsView
          grid={grid}
          canBook={canBook}
          accent={accent}
          onPickSlot={(courtId, start) => onPickSlot(courtId, start, 0)}
          onPickSession={onPickSession}
        />
      )}

      {/* Selection bar — appears only when a range is live, and states the exact
          court and span being booked so nothing is guessed in the dialog. */}
      {range && selectedCourt && canBook && (
        <div className="sticky bottom-3 z-10 flex items-center gap-2 rounded-xl border border-primary/40 bg-card p-2.5 shadow-lg">
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {selectedCourt.name ?? `Court ${selectedCourt.court_number}`}
            </p>
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              {formatSlotTime(range.start)}–{formatSlotTime(range.end)} ·{' '}
              {range.minutes >= 60
                ? `${range.minutes / 60}h${range.minutes % 60 ? ` ${range.minutes % 60}m` : ''}`
                : `${range.minutes}m`}
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => {
              onPickSlot(selectedCourt.id, range.start, range.minutes);
              setSelection(null);
            }}
          >
            Book
          </Button>
        </div>
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
  selection,
  onToggle,
}: {
  grid: CourtColumn[];
  canBook: boolean;
  accent?: string | null;
  selection: SlotSelection | null;
  onToggle: (courtId: string, index: number) => void;
}) {
  const entries = timeList(grid);
  const anyOpen = entries.some((e) => e.kind === 'slots');

  return (
    <div className="space-y-1.5">
      {!anyOpen && entries.length === 0 && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-center text-sm text-muted-foreground">
          Nothing scheduled on this day.
        </p>
      )}

      {entries.map((entry) =>
        entry.kind === 'unavailable' ? (
          // One band instead of a run of identical empty rows. A venue booked
          // solid 6-8pm should say so once.
          <div
            key={`gap-${entry.fromIndex}`}
            className="rounded-lg border border-border/50 bg-muted/30 px-3 py-3 text-center"
          >
            <p className="text-sm font-semibold tabular-nums text-muted-foreground">
              {formatSlotTime(entry.start)} – {formatSlotTime(entry.end)}
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {!entry.booked && <MoonStar className="h-3 w-3" />}
              {entry.booked ? 'No courts available' : 'Closed'}
            </p>
          </div>
        ) : (
          <div
            key={entry.index}
            className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <span className="w-16 shrink-0 pt-1 text-sm font-semibold tabular-nums">
              {formatSlotTime(entry.start)}
            </span>

            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {entry.free.map((col) => {
                const picked = isSelected(selection, col.court.id, entry.index);
                return (
                  <button
                    key={col.court.id}
                    type="button"
                    disabled={!canBook}
                    aria-pressed={picked}
                    onClick={() => onToggle(col.court.id, entry.index)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                      !canBook && 'border-border/60 bg-background text-muted-foreground',
                      canBook && !picked && 'border-border bg-background hover:border-primary/50 hover:bg-primary/5',
                      canBook && picked && 'border-primary bg-primary text-primary-foreground',
                    )}
                    style={
                      canBook && accent
                        ? picked
                          ? { backgroundColor: accent, borderColor: accent, color: '#fff' }
                          : { borderColor: `${accent}55`, color: accent }
                        : undefined
                    }
                  >
                    {col.court.name ?? `Court ${col.court.court_number}`}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      )}

      {canBook && anyOpen && !selection && (
        <p className="px-1 pt-1 text-xs text-muted-foreground">
          Tap a court to hold it. Tap the next hour on the same court to extend.
        </p>
      )}
    </div>
  );
}

/** The real grid: courts across, time down. */
function CourtsView({
  grid,
  canBook,
  accent,
  onPickSlot,
  onPickSession,
}: {
  grid: CourtColumn[];
  canBook: boolean;
  accent?: string | null;
  onPickSlot: (courtId: string, start: Date) => void;
  onPickSession?: (sessionId: string) => void;
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
                onPickSession={onPickSession}
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
  onPickSession,
}: {
  slot: Slot;
  canBook: boolean;
  accent?: string | null;
  onClick: () => void;
  onPickSession?: (sessionId: string) => void;
}) {
  if (slot.reservation) {
    const closed = slot.reservation.event_format === 'maintenance';
    const Cell = onPickSession ? 'button' : 'div';
    return (
      <Cell
        {...(onPickSession
          ? {
              type: 'button' as const,
              onClick: () => onPickSession(slot.reservation!.id),
            }
          : {})}
        className={cn(
          'w-[104px] shrink-0 border-l border-border px-1.5 py-1.5 text-left',
          onPickSession && 'transition-colors hover:bg-muted/60',
        )}
        title={slot.reservation.title ?? undefined}
      >
        <div
          className={cn(
            'truncate rounded-md px-1.5 py-1 text-[11px] font-medium',
            closed
              ? 'bg-muted text-muted-foreground line-through decoration-1'
              : 'bg-primary/10',
          )}
          style={!closed && accent ? { backgroundColor: `${accent}1f`, color: accent } : undefined}
        >
          {slot.reservation.title || (closed ? 'Closed' : 'Booked')}
        </div>
      </Cell>
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
