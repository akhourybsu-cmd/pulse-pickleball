import { useEffect, useState } from 'react';
import { Check, Grid3x3, Rows3, Lock, X, MoonStar } from 'lucide-react';
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
import { formatDuration } from '@/lib/venues/ops';
import { programService } from '@/lib/venues/servicePresentation';
import { VenueServiceHeading } from './VenueServiceHeading';

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
  timeZone?: string | null;
  grid: CourtColumn[];
  day: Date;
  loading: boolean;
  closed?: boolean;
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
  timeZone,
  grid,
  day,
  loading,
  closed = false,
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
    <div className="min-w-0 space-y-3" data-venue-service="booking">
      <VenueServiceHeading service="booking" icon={Grid3x3} title="Court reservations" description="Choose a time, review the details, then confirm. Selecting a court doesn’t hold it." />
      <p className="text-xs text-muted-foreground">{timeZone ? `All court times are in ${timeZone.replace(/_/g, ' ')} (venue time).` : 'Court times use your device’s time zone.'}</p>
      {/* The view toggle rides on the day strip: it belongs to the same day of
          data, and a row of its own was pure overhead. */}
      <DayStrip
        timeZone={timeZone}
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

      {!loading && !closed && grid.length > 0 && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-1 text-xs text-muted-foreground" aria-label="Court availability legend">
        <span className="flex items-center gap-1.5"><span aria-hidden className="venue-service-outline h-2.5 w-2.5 rounded-sm border" />Available</span>
        {effectiveMode === 'times' && <span className="flex items-center gap-1.5"><Check aria-hidden className="venue-service-label h-3.5 w-3.5" />Selected</span>}
        <span className="flex items-center gap-1.5"><Lock aria-hidden className="h-3 w-3" />Booked or closed</span>
      </div>}

      {!loading && !closed && !canBook && (
        <p className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Booking isn’t available to your account here. You can still view the schedule.
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : closed ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center">
          <p className="text-sm font-semibold">Closed on this day</p>
          <p className="mt-1 text-sm text-muted-foreground">Choose another date to see available court times.</p>
        </div>
      ) : grid.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
          <p className="text-sm font-semibold">No active courts available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Courts will appear when the venue makes them available for booking.
          </p>
        </div>
      ) : effectiveMode === 'times' ? (
        <TimesView
          timeZone={timeZone}
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
          timeZone={timeZone}
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
        <div className="venue-selection-enter sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg sm:grid-cols-[auto_minmax(0,1fr)_auto]" aria-label="Booking selection">
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold [overflow-wrap:anywhere]">
              {selectedCourt.name ?? `Court ${selectedCourt.court_number}`}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatSlotTime(range.start, timeZone)}–{formatSlotTime(range.end, timeZone)} ·{' '}
              {formatDuration(range.minutes)}
            </p>
          </div>
          <Button
            size="sm"
            className="venue-service-solid venue-interactive col-span-2 min-h-11 w-full rounded-xl sm:col-span-1 sm:w-auto"
            onClick={() => {
              onPickSlot(selectedCourt.id, range.start, range.minutes);
              setSelection(null);
            }}
          >
            Review booking
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
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[7px] px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-2.5',
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
  timeZone,
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
  timeZone?: string | null;
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
              {formatSlotTime(entry.start, timeZone)}
            </span>
            <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground/70">
              {!entry.booked && <MoonStar className="h-3 w-3" />}
              {entry.booked ? 'Fully booked' : 'Closed'}
              <span className="text-muted-foreground/50">
                · until {formatSlotTime(entry.end, timeZone)}
              </span>
            </span>
            <span aria-hidden className="h-px flex-1 bg-border/60" />
          </div>
        ) : (
          <div
            key={entry.index}
            className="flex items-start gap-3 rounded-xl border border-border/75 bg-card px-3 py-3 sm:px-4"
          >
            <span className="w-16 shrink-0 pt-1 text-sm font-semibold tabular-nums">
              {formatSlotTime(entry.start, timeZone)}
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
                    aria-label={`Select ${slotLabel(col, entry.index, entry.index, timeZone)}`}
                    onClick={() => onToggle(col.court.id, entry.index)}
                    className={cn(
                      'venue-interactive inline-flex min-h-11 min-w-11 max-w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold [overflow-wrap:anywhere]',
                      !canBook && 'border-border/60 bg-background text-muted-foreground',
                      canBook && !picked && 'venue-service-outline',
                      canBook && picked && 'venue-service-solid border-transparent',
                    )}
                  >
                    {picked && <Check aria-hidden className="h-3.5 w-3.5 shrink-0" />}<span className="min-w-0">{shortCourtName(col.court)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ),
      )}

      {canBook && anyOpen && !selection && (
        <p className="px-1 pt-1 text-xs text-muted-foreground">
          Select a court, then the next time on that court to extend. Review your booking before confirming. Selecting a time does not hold the court.
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
  timeZone,
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
  timeZone?: string | null;
  onPickSession?: (sessionId: string) => void;
}) {
  const slotCount = grid[0]?.slots.length ?? 0;
  if (slotCount === 0) return null;

  const ROW = 44;

  return (
    <div role="region" aria-label="Court schedule, scroll horizontally for more courts" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
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
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 border-b border-border bg-muted/50 px-2 py-2"
          >
            <span className="max-w-[12rem] whitespace-normal text-center text-xs font-semibold [overflow-wrap:anywhere]">
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
              {formatSlotTime(slot.start, timeZone)}
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
              label={slotLabel(col, block.fromIndex, block.toIndex, timeZone)}
              canBook={canBook}
              accent={accent}
              onBook={() => onPickSlot(col.court.id, col.slots[block.fromIndex].start)}
              onOpenSession={
                onPickSession && block.reservation && !block.reservation.id.startsWith('hold:')
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

/** Include venue-local date and range: a bare court number is ambiguous to assistive technology. */
function slotLabel(column: CourtColumn, from: number, to: number, timeZone?: string | null): string {
  const start = column.slots[from].start;
  const end = column.slots[to].end;
  const date = start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', timeZone: timeZone || undefined });
  return `${column.court.name || `Court ${column.court.court_number ?? ''}`} · ${date}, ${formatSlotTime(start, timeZone)}–${formatSlotTime(end, timeZone)}${timeZone ? ' · venue time' : ''}`;
}

function GridBlock({
  block,
  column,
  label,
  canBook,
  accent,
  onBook,
  onOpenSession,
}: {
  block: CourtBlock;
  column: number;
  label: string;
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
        data-venue-service={closed ? 'community' : block.reservation.event_format === 'reservation' ? 'booking' : programService(block.reservation.event_format)}
        {...(onOpenSession ? { type: 'button' as const, onClick: onOpenSession } : {})}
        style={position}
        className="min-w-0 p-[3px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`${block.reservation.title || (closed ? 'Closed' : 'Booked')} · ${label}`}
        title={block.reservation.title ?? undefined}
      >
        <div
          className={cn(
            'flex h-full flex-col justify-start overflow-hidden rounded-md px-2 py-1.5',
            'border-l-2 text-[11px] font-medium leading-tight',
            closed
              ? 'border-l-muted-foreground/40 bg-muted text-muted-foreground'
              : 'venue-service-icon border-l-current',
            onOpenSession && 'transition-opacity hover:opacity-80',
          )}
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
        'group m-[3px] rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
        canBook ? 'border border-dashed border-emerald-800/20 bg-emerald-800/[0.025] hover:bg-emerald-800/10 dark:border-emerald-300/20 dark:bg-emerald-300/[0.025] dark:hover:bg-emerald-300/10' : 'cursor-default',
      )}
      aria-label={`${canBook ? 'Review booking' : 'Available'} · ${label}`}
    >
      {canBook && (
        <span aria-hidden className="venue-service-label flex h-full items-center justify-center text-sm font-semibold opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          +
        </span>
      )}
    </button>
  );
}
