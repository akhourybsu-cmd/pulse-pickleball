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
  courtBlocks,
  type CourtBlock,
  type CourtColumn,
  type SlotSelection,
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
      {/* The view toggle rides on the day strip: it belongs to the same day of
          data, and a row of its own was pure overhead. */}
      <DayStrip
        value={day}
        onChange={onDayChange}
        accent={accent}
        trailing={
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
        }
      />

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
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // Icon-only on a phone. Sharing the day strip's row costs ~80px of label,
      // which on a 390px screen is two days of navigation — and the strip is
      // the more important control of the two.
      aria-label={children}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-xs font-semibold transition-colors sm:px-2.5',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{children}</span>
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
          // Deliberately slight: this is dead time, and giving it the same
          // weight as a bookable row pushed the first real row off the screen.
          <div
            key={`gap-${entry.fromIndex}`}
            className="flex items-center gap-3 px-3 py-1.5"
          >
            <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground/70">
              {formatSlotTime(entry.start)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
              {!entry.booked && <MoonStar className="h-3 w-3" />}
              {entry.booked ? 'Fully booked' : 'Closed'}
              <span className="text-muted-foreground/50">
                · until {formatSlotTime(entry.end)}
              </span>
            </span>
            <span aria-hidden className="h-px flex-1 bg-border/60" />
          </div>
        ) : (
          <div
            key={entry.index}
            className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <span className="w-16 shrink-0 pt-1 text-sm font-semibold tabular-nums">
              {formatSlotTime(entry.start)}
            </span>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Court
              </span>
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
                    {shortCourtName(col.court)}
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

/**
 * The real grid: courts across, time down.
 *
 * A CSS grid rather than rows of cells, so a booking is ONE block spanning its
 * real height instead of its title repeated once per hour. Free slots are left
 * genuinely empty — printing "Open" sixty times down a quiet afternoon is what
 * made this read as a spreadsheet rather than a calendar. The affordance
 * appears on hover instead.
 */
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
  if (slotCount === 0) return null;

  const ROW = 44;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div
        className="grid min-w-max"
        style={{
          // Columns stretch to fill a wide screen rather than leaving a dead
          // zone to the right of a narrow fixed table.
          gridTemplateColumns: `56px repeat(${grid.length}, minmax(104px, 1fr))`,
          gridTemplateRows: `auto repeat(${slotCount}, ${ROW}px)`,
        }}
      >
        {/* Corner + court headers */}
        <div className="sticky left-0 z-10 border-b border-r border-border bg-muted/50" />
        {grid.map((col) => (
          <div
            key={col.court.id}
            className="flex flex-col items-center justify-center gap-0.5 border-b border-border bg-muted/50 px-2 py-2"
          >
            <span className="truncate text-xs font-semibold">
              {col.court.name ?? `Court ${col.court.court_number}`}
            </span>
            {col.court.is_premium && (
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Premium
              </span>
            )}
          </div>
        ))}

        {/* Time gutter */}
        {grid[0].slots.map((slot, i) => (
          <div
            key={`t-${i}`}
            className="sticky left-0 z-10 flex items-start justify-end border-r border-border bg-card pr-2 pt-1"
            style={{ gridColumn: 1, gridRow: i + 2 }}
          >
            <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-muted-foreground">
              {compactTime(slot.start)}
            </span>
          </div>
        ))}

        {/* Hour rules, drawn once across the whole width rather than per cell */}
        {grid[0].slots.map((_, i) => (
          <div
            key={`r-${i}`}
            aria-hidden
            className="border-b border-border/40"
            style={{ gridColumn: `2 / span ${grid.length}`, gridRow: i + 2 }}
          />
        ))}

        {/* Blocks */}
        {grid.map((col, colIndex) =>
          courtBlocks(col).map((block) => (
            <GridBlock
              key={`${col.court.id}-${block.fromIndex}`}
              block={block}
              column={colIndex + 2}
              canBook={canBook}
              accent={accent}
              onBook={() => onPickSlot(col.court.id, col.slots[block.fromIndex].start)}
              onOpenSession={
                onPickSession && block.reservation
                  ? () => onPickSession(block.reservation!.id)
                  : undefined
              }
            />
          )),
        )}
      </div>
    </div>
  );
}

/**
 * "1" from "Court 1" — a row of chips that all begin with the same word wastes
 * the width it needs to avoid wrapping. Anything not of that shape is left
 * alone, so a court actually called "Stadium" still reads as itself.
 */
function shortCourtName(court: CourtColumn['court']): string {
  const name = court.name ?? (court.court_number != null ? `Court ${court.court_number}` : '');
  const match = /^court\s+(\S.*)$/i.exec(name.trim());
  return match ? match[1] : name;
}

/** "8 AM" / "12:30 PM" — one line, so rows keep a constant height. */
function compactTime(d: Date): string {
  const minutes = d.getMinutes();
  return d
    .toLocaleTimeString([], {
      hour: 'numeric',
      ...(minutes === 0 ? {} : { minute: '2-digit' }),
    })
    .replace(/\s?([AP])M/i, ' $1M');
}

function GridBlock({
  block,
  column,
  canBook,
  accent,
  onBook,
  onOpenSession,
}: {
  block: CourtBlock;
  column: number;
  canBook: boolean;
  accent?: string | null;
  onBook: () => void;
  onOpenSession?: () => void;
}) {
  const span = block.toIndex - block.fromIndex + 1;
  const position = { gridColumn: column, gridRow: `${block.fromIndex + 2} / span ${span}` };

  if (block.reservation) {
    const closed = block.reservation.event_format === 'maintenance';
    const Tag = onOpenSession ? 'button' : 'div';
    return (
      <Tag
        {...(onOpenSession ? { type: 'button' as const, onClick: onOpenSession } : {})}
        style={position}
        className="p-[3px] text-left"
        title={block.reservation.title ?? undefined}
      >
        <div
          className={cn(
            'flex h-full flex-col justify-start overflow-hidden rounded-md px-2 py-1.5',
            'border-l-2 text-[11px] font-medium leading-tight',
            closed
              ? 'border-l-muted-foreground/40 bg-muted text-muted-foreground'
              : 'border-l-primary bg-primary/10 text-foreground',
            onOpenSession && 'transition-opacity hover:opacity-80',
          )}
          style={
            !closed && accent
              ? { backgroundColor: `${accent}1a`, borderLeftColor: accent }
              : undefined
          }
        >
          <span className="truncate font-semibold">
            {block.reservation.title || (closed ? 'Closed' : 'Booked')}
          </span>
        </div>
      </Tag>
    );
  }

  // Dead space: outside hours or already gone. Reads as inert, says nothing.
  if (!block.bookable) {
    return (
      // Tinted from the foreground rather than `muted`, so it darkens on a
      // light theme and lightens on a dark one. A muted fill was invisible
      // against a dark card, making unbookable time look bookable.
      <div aria-hidden style={position} className="bg-foreground/[0.05]" />
    );
  }

  // Free and bookable. Deliberately empty until hovered — the whole column
  // saying "Open" is noise, and the emptiness is what makes booked blocks read.
  return (
    <button
      type="button"
      disabled={!canBook}
      onClick={onBook}
      style={position}
      className={cn(
        'group m-[3px] rounded-md transition-colors',
        canBook ? 'hover:bg-primary/10' : 'cursor-default',
      )}
      aria-label={canBook ? 'Book this slot' : undefined}
    >
      {canBook && (
        <span className="flex h-full items-center justify-center text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
          +
        </span>
      )}
    </button>
  );
}
